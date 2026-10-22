import { createHash, randomBytes } from 'node:crypto';
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { GENERATED_MARKER } from '../codegen/context.ts';
import type { GeneratedFile } from '../codegen/types.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { MANIFEST_FILENAME, PACKAGE_NAME, PACKAGE_VERSION } from '../meta.ts';
import { isRecord } from '../utils/object.ts';
import { compareStrings } from '../utils/strings.ts';
import type { FileChange, WritePlan, WriteResult } from './types.ts';

/** Records which files in the output directory the generator owns. */
export interface Manifest {
  readonly manifestVersion: 1;
  readonly generator: { readonly name: string; readonly version: string };
  /** Output-relative path → sha256 of the content that was written. */
  readonly files: Readonly<Record<string, string>>;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generated files use `\n`. A checkout that converted them to `\r\n` (Git's `core.autocrlf`)
 * still holds the generated content, so line endings are ignored when comparing.
 */
function normalizeLineEndings(text: string): string {
  return text.includes('\r\n') ? text.replaceAll('\r\n', '\n') : text;
}

function sameContent(a: string, b: string): boolean {
  return a === b || normalizeLineEndings(a) === normalizeLineEndings(b);
}

/** True when `content` is what was recorded in the manifest (ignoring line endings). */
function matchesHash(content: string, hash: string): boolean {
  if (hashContent(content) === hash) return true;
  const normalized = normalizeLineEndings(content);
  return normalized !== content && hashContent(normalized) === hash;
}

/** Paths are compared case-insensitively, as on the default macOS and Windows file systems. */
function foldCase(file: string): string {
  return file.toLowerCase();
}

function errorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function readManifest(directory: string): Promise<Manifest | undefined> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(directory, MANIFEST_FILENAME), 'utf8'),
    );
    if (!isRecord(raw) || raw.manifestVersion !== 1 || !isRecord(raw.files)) return undefined;
    const files: Record<string, string> = {};
    for (const [file, hash] of Object.entries(raw.files))
      if (typeof hash === 'string' && isSafeOutputPath(file)) files[file] = hash;
    const generator = isRecord(raw.generator) ? raw.generator : {};
    return {
      manifestVersion: 1,
      generator: {
        name: typeof generator.name === 'string' ? generator.name : PACKAGE_NAME,
        version: typeof generator.version === 'string' ? generator.version : 'unknown',
      },
      files,
    };
  } catch {
    return undefined;
  }
}

/**
 * True for a normalized, relative file path inside the output directory: `/`-separated, without
 * empty, `.` or `..` segments, a trailing `/`, backslashes, `:` (Windows drive-relative paths and
 * alternate data streams) or NUL, and not the manifest itself. Used for generated paths and for
 * manifest entries, which are untrusted.
 */
export function isSafeOutputPath(file: string): boolean {
  if (file === '' || /[\\:\0]/.test(file)) return false;
  if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file)) return false;
  if (foldCase(file) === foldCase(MANIFEST_FILENAME)) return false;
  return file.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
}

/** What is at an output path. */
type Existing =
  | { readonly state: 'missing' }
  | { readonly state: 'file'; readonly content: string }
  /** Something the generator cannot replace: a directory, or a file where a directory is needed. */
  | { readonly state: 'blocked'; readonly reason: string }
  | { readonly state: 'unreadable'; readonly error: unknown };

/** The first ancestor of `file` (output-relative) that exists but is not a directory. */
async function blockingAncestor(directory: string, file: string): Promise<string> {
  const segments = file.split('/');
  for (let index = 1; index < segments.length; index++) {
    const relative = segments.slice(0, index).join('/');
    try {
      if (!(await stat(path.join(directory, relative))).isDirectory()) return relative;
    } catch {
      break;
    }
  }
  return path.posix.dirname(file);
}

async function inspect(directory: string, file: string): Promise<Existing> {
  const target = path.join(directory, file);
  try {
    const info = await stat(target);
    if (info.isDirectory()) return { state: 'blocked', reason: `${file} is a directory` };
    // Never read FIFOs or devices, which could block.
    if (!info.isFile()) return { state: 'blocked', reason: `${file} is not a regular file` };
    return { state: 'file', content: await readFile(target, 'utf8') };
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT') return { state: 'missing' };
    if (code === 'ENOTDIR') {
      return {
        state: 'blocked',
        reason: `${await blockingAncestor(directory, file)} is a file, not a directory`,
      };
    }
    return { state: 'unreadable', error };
  }
}

/** True when both paths name the same existing file (for example `Pet.ts` and `pet.ts` on macOS). */
async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    const [first, second] = await Promise.all([
      stat(a, { bigint: true }),
      stat(b, { bigint: true }),
    ]);
    if (first.ino !== 0n) return first.dev === second.dev && first.ino === second.ino;
    // Some file systems report no inode numbers; compare canonical paths instead.
    return (await realpath(a)) === (await realpath(b));
  } catch {
    return false;
  }
}

function hasMarker(content: string): boolean {
  return content.slice(0, 400).includes(GENERATED_MARKER);
}

export interface PlanOptions {
  /** Delete generated files that are no longer produced. */
  readonly clean: boolean;
  /** Overwrite or delete files the generator does not own (or that were edited by hand). */
  readonly force: boolean;
}

export interface PlannedWrite {
  readonly plan: WritePlan;
  /** Problems that prevent writing (user-owned files in the way). */
  readonly conflicts: readonly Diagnostic[];
  /** Notes such as edited generated files that were kept. */
  readonly notes: readonly Diagnostic[];
  readonly manifest: Manifest;
  /**
   * How the manifest's file list (ownership and content hashes) changes. The recorded generator
   * version is ignored, so upgrading swaggerz alone does not make the output stale.
   */
  readonly manifestChange: 'create' | 'update' | 'unchanged';
  /**
   * Deleted paths that name the same file as a generated path in another letter case (a
   * case-insensitive file system after a rename such as `pet.ts` → `Pet.ts`). They are deleted
   * before the new files are moved into place, so the file takes the new name and is not lost.
   */
  readonly caseRenamed: readonly string[];
}

function sameFiles(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function blockedConflict(file: string, target: string, reason: string): Diagnostic {
  return {
    code: 'output/user-file',
    severity: 'error',
    message: `${file} cannot be written because ${reason}; nothing was changed.`,
    location: { file: target },
    hint: 'Move it out of the way or choose another output directory.',
  };
}

function unreadableConflict(file: string, target: string, error: unknown): Diagnostic {
  return {
    code: 'output/write-failed',
    severity: 'error',
    message: `Could not read ${file}: ${errorMessage(error)}`,
    location: { file: target },
  };
}

/**
 * Compares generated files with the output directory. Files are only overwritten or deleted
 * when the manifest (or the generated-file marker) shows the generator owns them.
 */
export async function planWrite(
  files: readonly GeneratedFile[],
  directory: string,
  options: PlanOptions,
): Promise<PlannedWrite> {
  const previous = await readManifest(directory);
  const owned = new Map(Object.entries(previous?.files ?? {}));
  const changes: FileChange[] = [];
  const conflicts: Diagnostic[] = [];
  const notes: Diagnostic[] = [];
  const nextFiles: Record<string, string> = {};
  const produced = new Set(files.map((file) => file.path));

  // Owned files whose path differs from a generated path only in letter case.
  const producedByCase = new Map(files.map((file) => [foldCase(file.path), file.path]));
  const renamedFrom = new Map<string, string>();
  for (const file of [...owned.keys()].sort(compareStrings)) {
    if (produced.has(file)) continue;
    const renamed = producedByCase.get(foldCase(file));
    if (renamed !== undefined && !renamedFrom.has(renamed)) renamedFrom.set(renamed, file);
  }
  const caseRenamed = new Set<string>();

  for (const file of files) {
    const target = path.join(directory, file.path);
    nextFiles[file.path] = hashContent(file.content);
    const previousPath = renamedFrom.get(file.path);
    if (
      previousPath !== undefined &&
      (await sameFile(path.join(directory, previousPath), target))
    ) {
      // A case-insensitive file system finds the old file under the new name: replace it.
      caseRenamed.add(previousPath);
      changes.push({ path: file.path, kind: 'create', after: file.content });
      continue;
    }
    const existing = await inspect(directory, file.path);
    if (existing.state === 'missing') {
      changes.push({ path: file.path, kind: 'create', after: file.content });
    } else if (existing.state === 'blocked') {
      conflicts.push(blockedConflict(file.path, target, existing.reason));
    } else if (existing.state === 'unreadable') {
      conflicts.push(unreadableConflict(file.path, target, existing.error));
    } else if (sameContent(existing.content, file.content)) {
      changes.push({ path: file.path, kind: 'unchanged' });
    } else if (owned.has(file.path) || hasMarker(existing.content) || options.force) {
      changes.push({
        path: file.path,
        kind: 'update',
        before: normalizeLineEndings(existing.content),
        after: file.content,
      });
    } else {
      conflicts.push({
        code: 'output/user-file',
        severity: 'error',
        message: `${file.path} exists and was not created by the generator; it was not overwritten.`,
        location: { file: target },
        hint: 'Move the file, choose another output directory, or rerun with --force to overwrite it.',
      });
    }
  }

  for (const [file, hash] of [...owned.entries()].sort(([a], [b]) => compareStrings(a, b))) {
    if (produced.has(file)) continue;
    const target = path.join(directory, file);
    const existing = await inspect(directory, file);
    if (caseRenamed.has(file)) {
      changes.push({
        path: file,
        kind: 'delete',
        ...(existing.state === 'file' ? { before: normalizeLineEndings(existing.content) } : {}),
      });
      continue;
    }
    // Gone, or replaced by a directory: nothing of the generator's is left at this path.
    if (existing.state === 'missing' || existing.state === 'blocked') continue;
    if (existing.state === 'unreadable') {
      conflicts.push(unreadableConflict(file, target, existing.error));
      continue;
    }
    if (!options.clean) {
      nextFiles[file] = hash;
      continue;
    }
    if (!matchesHash(existing.content, hash) && !options.force) {
      notes.push({
        code: 'output/edited-stale-file',
        severity: 'warning',
        message: `${file} is no longer generated but was edited by hand; it was kept.`,
        location: { file: target },
        hint: 'Delete it manually or rerun with --force.',
      });
      continue;
    }
    changes.push({ path: file, kind: 'delete', before: normalizeLineEndings(existing.content) });
  }

  changes.sort((a, b) => compareStrings(a.path, b.path));
  const sortedFiles: Record<string, string> = {};
  for (const key of Object.keys(nextFiles).sort(compareStrings))
    sortedFiles[key] = nextFiles[key] ?? '';
  const manifestPath = path.join(directory, MANIFEST_FILENAME);
  let manifestExists = previous !== undefined;
  if (!manifestExists) {
    const existing = await inspect(directory, MANIFEST_FILENAME);
    if (existing.state === 'blocked')
      conflicts.push(blockedConflict(MANIFEST_FILENAME, manifestPath, existing.reason));
    manifestExists = existing.state !== 'missing';
  }
  return {
    plan: { directory, changes },
    conflicts,
    notes,
    manifest: {
      manifestVersion: 1,
      generator: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
      files: sortedFiles,
    },
    manifestChange: !manifestExists
      ? 'create'
      : previous !== undefined && sameFiles(previous.files, sortedFiles)
        ? 'unchanged'
        : 'update',
    caseRenamed: [...caseRenamed].sort(compareStrings),
  };
}

/**
 * Refuses to write or delete through a symbolic link that leads outside the output directory
 * (for example a generated subdirectory replaced by a link to another location). The nearest
 * existing ancestor of `directory` is checked, so this runs before any directory is created.
 */
async function assertInside(
  root: string,
  directory: string,
  file: string,
  action: 'write' | 'delete',
): Promise<void> {
  let existing = directory;
  for (;;) {
    try {
      await lstat(existing);
      break;
    } catch (error) {
      const parent = path.dirname(existing);
      if (errorCode(error) !== 'ENOENT' || parent === existing) throw error;
      existing = parent;
    }
  }
  const real = await realpath(existing);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(
      `Refusing to ${action} ${file}: ${existing} resolves to ${real}, outside the output directory.`,
    );
  }
}

function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function temporarySuffix(): string {
  return `.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
}

/** Temporary files written by {@link applyWrite}: `<name>.<pid>-<8 hex digits>.tmp`. */
const TEMPORARY_FILE = /\.(\d+)-[\da-f]{8}\.tmp$/;

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === 'EPERM';
  }
}

/**
 * Removes temporary files that an interrupted run left next to generated files. Only files named
 * after a generated path whose writing process is no longer running are removed. Best effort.
 */
async function removeOrphanedTemporaryFiles(
  directory: string,
  files: readonly string[],
): Promise<void> {
  const names = new Map<string, Set<string>>();
  for (const file of [...files, MANIFEST_FILENAME]) {
    const parent = path.posix.dirname(file);
    const entry = names.get(parent) ?? new Set<string>();
    entry.add(path.posix.basename(file));
    names.set(parent, entry);
  }
  for (const [relative, expected] of [...names.entries()].sort(([a], [b]) =>
    compareStrings(a, b),
  )) {
    const absolute = path.join(directory, relative);
    let entries: string[];
    try {
      entries = await readdir(absolute);
    } catch {
      continue;
    }
    for (const entry of entries.sort(compareStrings)) {
      const match = TEMPORARY_FILE.exec(entry);
      if (match === null || !expected.has(entry.slice(0, match.index))) continue;
      const pid = Number(match[1]);
      if (pid === process.pid || isRunning(pid)) continue;
      await rm(path.join(absolute, entry), { force: true }).catch(() => undefined);
    }
  }
}

/**
 * A case-insensitive file system keeps the letter case a file or directory was created with, so a
 * generated path whose case changed (after changing `naming.files`, for example) would keep its
 * old name on disk, and version control would record the old name. Renames such entries to the
 * generated case. Best effort.
 */
async function matchLetterCase(directory: string, files: readonly string[]): Promise<void> {
  const listings = new Map<string, string[] | undefined>();
  const list = async (parent: string): Promise<string[] | undefined> => {
    if (!listings.has(parent)) listings.set(parent, await readdir(parent).catch(() => undefined));
    return listings.get(parent);
  };
  const checked = new Set<string>();
  for (const file of files) {
    const segments = file.split('/');
    for (const [index, name] of segments.entries()) {
      const relative = segments.slice(0, index + 1).join('/');
      if (checked.has(relative)) continue;
      checked.add(relative);
      const parent = path.join(directory, ...segments.slice(0, index));
      const entries = await list(parent);
      if (entries === undefined) break;
      if (entries.includes(name)) continue;
      const variant = entries.find((entry) => foldCase(entry) === foldCase(name));
      if (variant === undefined) break;
      const from = path.join(parent, variant);
      const to = path.join(parent, name);
      if (!(await sameFile(from, to))) break;
      try {
        await rename(from, to);
        entries[entries.indexOf(variant)] = name;
      } catch {
        break;
      }
    }
  }
}

async function removeEmptyDirectories(directory: string, root: string): Promise<void> {
  let current = directory;
  while (current.startsWith(root + path.sep) && current !== root) {
    try {
      const entries = await readdir(current);
      if (entries.length > 0) return;
      await rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

/**
 * Applies a plan. New content is first written to temporary files next to their targets, and every
 * target and deleted file is checked to stay inside the output directory; only when all of that
 * succeeded are files renamed into place and stale files deleted, so a failure leaves the previous
 * output untouched. Unchanged files are not rewritten.
 */
export async function applyWrite(planned: PlannedWrite): Promise<WriteResult> {
  const { plan, manifest } = planned;
  const directory = plan.directory;
  const suffix = temporarySuffix();
  const pending: { temp: string; target: string }[] = [];
  const writes = plan.changes.filter((c) => c.kind === 'create' || c.kind === 'update');
  const deletes = plan.changes.filter((c) => c.kind === 'delete');
  const renamed = new Set(planned.caseRenamed);

  try {
    await mkdir(directory, { recursive: true });
    const root = await realpath(directory);
    for (const change of deletes)
      await assertInside(
        root,
        path.dirname(path.join(directory, change.path)),
        change.path,
        'delete',
      );
    for (const change of writes) {
      const target = path.join(directory, change.path);
      const parent = path.dirname(target);
      await assertInside(root, parent, change.path, 'write');
      await mkdir(parent, { recursive: true });
      await assertInside(root, parent, change.path, 'write');
      const temp = `${target}${suffix}`;
      await writeFile(temp, change.after ?? '', 'utf8');
      pending.push({ temp, target });
    }
    const manifestPath = path.join(directory, MANIFEST_FILENAME);
    const manifestText = serializeManifest(manifest);
    if ((await readIfExists(manifestPath)) !== manifestText) {
      const temp = `${manifestPath}${suffix}`;
      await writeFile(temp, manifestText, 'utf8');
      pending.push({ temp, target: manifestPath });
    }
  } catch (error) {
    await Promise.all(pending.map(({ temp }) => rm(temp, { force: true })));
    throw error;
  }

  // Files renamed in letter case only are removed first, so the new name replaces them.
  for (const file of renamed) await rm(path.join(directory, file), { force: true });
  for (const { temp, target } of pending) await rename(temp, target);

  const kept = plan.changes.filter((c) => c.kind !== 'delete').map((c) => c.path);
  const keptByCase = new Map(kept.map((file) => [foldCase(file), file]));
  const deleted: string[] = [];
  for (const change of deletes) {
    const target = path.join(directory, change.path);
    if (!renamed.has(change.path)) {
      // Never delete a file that was just written under another letter case.
      const twin = keptByCase.get(foldCase(change.path));
      if (twin !== undefined && (await sameFile(target, path.join(directory, twin)))) continue;
      await rm(target, { force: true });
    }
    deleted.push(change.path);
    await removeEmptyDirectories(path.dirname(target), directory);
  }
  await matchLetterCase(directory, kept);
  await removeOrphanedTemporaryFiles(directory, kept);

  return {
    directory,
    created: plan.changes.filter((c) => c.kind === 'create').map((c) => c.path),
    updated: plan.changes.filter((c) => c.kind === 'update').map((c) => c.path),
    deleted,
    unchanged: plan.changes.filter((c) => c.kind === 'unchanged').map((c) => c.path),
    dryRun: false,
  };
}

export interface CleanResult {
  /** Files that were (or in a dry run would be) deleted. */
  readonly deleted: string[];
  /** Warnings for hand-edited files that were kept. */
  readonly kept: Diagnostic[];
  /** Errors that stopped the cleaning; when a file is refused, nothing is deleted. */
  readonly errors: Diagnostic[];
}

/** Removes every file recorded in the manifest (keeping hand-edited files unless forced). */
export async function cleanOutput(
  directory: string,
  options: { force: boolean; dryRun: boolean },
): Promise<CleanResult> {
  const manifest = await readManifest(directory);
  if (manifest === undefined) return { deleted: [], kept: [], errors: [] };
  const candidates: string[] = [];
  const kept: Diagnostic[] = [];
  const keptFiles = new Set<string>();
  const failure = (message: string): CleanResult => ({
    deleted: [],
    kept,
    errors: [
      {
        code: 'output/write-failed',
        severity: 'error',
        message,
        location: { file: directory },
      },
    ],
  });
  for (const [file, hash] of Object.entries(manifest.files).sort(([a], [b]) =>
    compareStrings(a, b),
  )) {
    const target = path.join(directory, file);
    const existing = await inspect(directory, file);
    if (existing.state === 'missing' || existing.state === 'blocked') continue;
    if (existing.state === 'unreadable')
      return failure(`Could not read ${file}: ${errorMessage(existing.error)}`);
    if (!matchesHash(existing.content, hash) && !options.force) {
      keptFiles.add(file);
      kept.push({
        code: 'output/edited-file-kept',
        severity: 'warning',
        message: `${file} was edited after generation and was kept.`,
        location: { file: target },
        hint: 'Rerun with --force to delete it.',
      });
      continue;
    }
    candidates.push(file);
  }
  if (options.dryRun) return { deleted: candidates, kept, errors: [] };

  // Every file is checked before the first one is deleted.
  try {
    const root = await realpath(directory);
    for (const file of candidates)
      await assertInside(root, path.dirname(path.join(directory, file)), file, 'delete');
  } catch (error) {
    return failure(`Could not clean the output: ${errorMessage(error)}`);
  }
  const deleted: string[] = [];
  const errors: Diagnostic[] = [];
  for (const file of candidates) {
    const target = path.join(directory, file);
    try {
      await rm(target, { force: true });
    } catch (error) {
      keptFiles.add(file);
      errors.push({
        code: 'output/write-failed',
        severity: 'error',
        message: `Could not delete ${file}: ${errorMessage(error)}`,
        location: { file: target },
      });
      continue;
    }
    deleted.push(file);
    await removeEmptyDirectories(path.dirname(target), directory);
  }

  const manifestPath = path.join(directory, MANIFEST_FILENAME);
  if (keptFiles.size === 0) {
    await rm(manifestPath, { force: true });
    await removeEmptyDirectories(directory, path.dirname(directory));
  } else {
    // Keep ownership of the files that were not deleted.
    const remaining: Record<string, string> = {};
    for (const [file, hash] of Object.entries(manifest.files))
      if (keptFiles.has(file)) remaining[file] = hash;
    const temp = `${manifestPath}${temporarySuffix()}`;
    try {
      await writeFile(temp, serializeManifest({ ...manifest, files: remaining }), 'utf8');
      await rename(temp, manifestPath);
    } catch (error) {
      await rm(temp, { force: true });
      errors.push({
        code: 'output/write-failed',
        severity: 'error',
        message: `Could not update ${MANIFEST_FILENAME}: ${errorMessage(error)}`,
        location: { file: manifestPath },
      });
    }
  }
  return { deleted, kept, errors };
}
