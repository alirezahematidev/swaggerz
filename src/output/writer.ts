import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises';
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

export async function readManifest(directory: string): Promise<Manifest | undefined> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(directory, MANIFEST_FILENAME), 'utf8'),
    );
    if (!isRecord(raw) || raw.manifestVersion !== 1 || !isRecord(raw.files)) return undefined;
    const files: Record<string, string> = {};
    for (const [file, hash] of Object.entries(raw.files))
      if (typeof hash === 'string' && isSafeRelative(file)) files[file] = hash;
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

/** Rejects manifest entries that could point outside the output directory. */
function isSafeRelative(file: string): boolean {
  const normalized = path.posix.normalize(file);
  return (
    normalized === file &&
    !normalized.startsWith('../') &&
    !path.isAbsolute(file) &&
    !file.includes('\\')
  );
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    throw error;
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
  const produced = new Set<string>();

  for (const file of files) {
    produced.add(file.path);
    const target = path.join(directory, file.path);
    const existing = await readIfExists(target);
    nextFiles[file.path] = hashContent(file.content);
    if (existing === undefined) {
      changes.push({ path: file.path, kind: 'create', after: file.content });
    } else if (existing === file.content) {
      changes.push({ path: file.path, kind: 'unchanged' });
    } else if (owned.has(file.path) || hasMarker(existing) || options.force) {
      changes.push({ path: file.path, kind: 'update', before: existing, after: file.content });
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
    const existing = await readIfExists(target);
    if (existing === undefined) continue;
    if (!options.clean) {
      nextFiles[file] = hash;
      continue;
    }
    if (hashContent(existing) !== hash && !options.force) {
      notes.push({
        code: 'output/edited-stale-file',
        severity: 'warning',
        message: `${file} is no longer generated but was edited by hand; it was kept.`,
        location: { file: target },
        hint: 'Delete it manually or rerun with --force.',
      });
      continue;
    }
    changes.push({ path: file, kind: 'delete', before: existing });
  }

  changes.sort((a, b) => compareStrings(a.path, b.path));
  const sortedFiles: Record<string, string> = {};
  for (const key of Object.keys(nextFiles).sort(compareStrings))
    sortedFiles[key] = nextFiles[key] ?? '';
  return {
    plan: { directory, changes },
    conflicts,
    notes,
    manifest: {
      manifestVersion: 1,
      generator: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
      files: sortedFiles,
    },
  };
}

/**
 * Refuses to write or delete through a symbolic link that leads outside the output directory
 * (for example a generated subdirectory replaced by a link to another location).
 */
async function assertInside(root: string, directory: string, file: string): Promise<void> {
  const real = await realpath(directory);
  if (real !== root && !real.startsWith(root + path.sep)) {
    throw new Error(
      `Refusing to write ${file}: ${directory} resolves to ${real}, outside the output directory.`,
    );
  }
}

function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
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
 * Applies a plan. New content is first written to temporary files next to their targets; only
 * when every write succeeded are they renamed into place, so a failure leaves the previous output
 * untouched. Unchanged files are not rewritten.
 */
export async function applyWrite(planned: PlannedWrite): Promise<WriteResult> {
  const { plan, manifest } = planned;
  const directory = plan.directory;
  const suffix = `.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
  const pending: { temp: string; target: string }[] = [];
  const writes = plan.changes.filter((c) => c.kind === 'create' || c.kind === 'update');

  try {
    await mkdir(directory, { recursive: true });
    const root = await realpath(directory);
    for (const change of writes) {
      const target = path.join(directory, change.path);
      await mkdir(path.dirname(target), { recursive: true });
      await assertInside(root, path.dirname(target), change.path);
      const temp = `${target}${suffix}`;
      await writeFile(temp, change.after ?? '', 'utf8');
      pending.push({ temp, target });
    }
    const manifestPath = path.join(directory, MANIFEST_FILENAME);
    const manifestText = serializeManifest(manifest);
    if ((await readIfExists(manifestPath)) !== manifestText) {
      await mkdir(directory, { recursive: true });
      const temp = `${manifestPath}${suffix}`;
      await writeFile(temp, manifestText, 'utf8');
      pending.push({ temp, target: manifestPath });
    }
  } catch (error) {
    await Promise.all(pending.map(({ temp }) => rm(temp, { force: true })));
    throw error;
  }

  for (const { temp, target } of pending) await rename(temp, target);

  const deleted: string[] = [];
  const root = await realpath(directory);
  for (const change of plan.changes.filter((c) => c.kind === 'delete')) {
    const target = path.join(directory, change.path);
    await assertInside(root, path.dirname(target), change.path);
    await rm(target, { force: true });
    deleted.push(change.path);
    await removeEmptyDirectories(path.dirname(target), directory);
  }

  return {
    directory,
    created: plan.changes.filter((c) => c.kind === 'create').map((c) => c.path),
    updated: plan.changes.filter((c) => c.kind === 'update').map((c) => c.path),
    deleted,
    unchanged: plan.changes.filter((c) => c.kind === 'unchanged').map((c) => c.path),
    dryRun: false,
  };
}

/** Removes every file recorded in the manifest (keeping hand-edited files unless forced). */
export async function cleanOutput(
  directory: string,
  options: { force: boolean; dryRun: boolean },
): Promise<{
  deleted: string[];
  kept: Diagnostic[];
}> {
  const manifest = await readManifest(directory);
  if (manifest === undefined) return { deleted: [], kept: [] };
  const deleted: string[] = [];
  const kept: Diagnostic[] = [];
  for (const [file, hash] of Object.entries(manifest.files).sort(([a], [b]) =>
    compareStrings(a, b),
  )) {
    const target = path.join(directory, file);
    const existing = await readIfExists(target);
    if (existing === undefined) continue;
    if (hashContent(existing) !== hash && !options.force) {
      kept.push({
        code: 'output/edited-file-kept',
        severity: 'warning',
        message: `${file} was edited after generation and was kept.`,
        location: { file: target },
        hint: 'Rerun with --force to delete it.',
      });
      continue;
    }
    deleted.push(file);
    if (!options.dryRun) {
      await assertInside(await realpath(directory), path.dirname(target), file);
      await rm(target, { force: true });
      await removeEmptyDirectories(path.dirname(target), directory);
    }
  }
  if (!options.dryRun) {
    const manifestPath = path.join(directory, MANIFEST_FILENAME);
    if (kept.length === 0) {
      await rm(manifestPath, { force: true });
      await removeEmptyDirectories(directory, path.dirname(directory));
    } else {
      // Keep ownership of the hand-edited files that were not deleted.
      const remaining: Record<string, string> = {};
      for (const [file, hash] of Object.entries(manifest.files))
        if (!deleted.includes(file)) remaining[file] = hash;
      await writeFile(manifestPath, serializeManifest({ ...manifest, files: remaining }), 'utf8');
    }
  }
  return { deleted, kept };
}
