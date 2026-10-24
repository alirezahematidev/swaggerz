/**
 * Compiles a corpus of public API descriptions (`fixtures/corpus/corpus.json`) with every feature
 * enabled, type-checks the generated TypeScript, and compares the outcome with
 * `fixtures/corpus/baseline.json`: a crash, a type error or any change in the diagnostics fails.
 *
 * Usage: node scripts/corpus.ts [name…] [--update] [--no-typecheck]
 *   --update        record checksums of new documents and rewrite the baseline
 *   --no-typecheck  skip type-checking the generated clients (faster)
 *
 * Documents are checked out once into `.corpus/` with git (network) and verified against their
 * checksums.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../src/config/resolve.ts';
import { runGeneration } from '../src/pipeline/generate.ts';
import { BROWSER, typecheck } from '../tests/support/typescript.ts';
import { buildRuntimeTemplates } from './build-assets.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIST = path.join(ROOT, 'fixtures', 'corpus', 'corpus.json');
const BASELINE = path.join(ROOT, 'fixtures', 'corpus', 'baseline.json');
const CACHE = path.join(ROOT, '.corpus');
/** Inside the repository, so generated clients resolve zod and React Query from node_modules. */
const OUTPUT = path.join(ROOT, 'tests', '.output', 'corpus');

interface Git {
  readonly repo: string;
  readonly commit: string;
  /** The directory to check out when the description spreads over many files. */
  readonly sparse?: string;
}

interface Entry {
  readonly name: string;
  readonly git: Git;
  /** The root document, relative to the repository. */
  readonly path: string;
  sha256?: string;
}

interface Result {
  readonly version: string;
  readonly ok: boolean;
  readonly operations: number;
  readonly models: number;
  readonly files: number;
  /** `severity code` → count. */
  readonly diagnostics: Record<string, number>;
  /** Type errors in the generated TypeScript (`null` when not checked). */
  readonly typeErrors: number | null;
}

const args = process.argv.slice(2);
const update = args.includes('--update');
const check = !args.includes('--no-typecheck');
const only = args.filter((arg) => !arg.startsWith('--'));

/** A file's content, or `undefined` when it does not exist (read without a separate check). */
async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

const list = JSON.parse(await readFile(LIST, 'utf8')) as { documents: Entry[] };
const selected = list.documents.filter((entry) => only.length === 0 || only.includes(entry.name));
if (selected.length === 0) throw new Error(`No corpus documents match ${only.join(', ')}.`);
const baselineText = await readIfExists(BASELINE);
const baseline: Record<string, Result> =
  baselineText === undefined
    ? {}
    : (JSON.parse(baselineText.toString('utf8')) as Record<string, Result>);

/** Checks out `file` (or the `sparse` directory) of a repository at a commit, shallow. */
function checkout(directory: string, git: Git, file: string): void {
  const run = (...gitArgs: string[]): void => {
    execFileSync('git', gitArgs, { cwd: directory, stdio: 'ignore' });
  };
  run('init', '--quiet');
  run('remote', 'add', 'origin', git.repo);
  run('fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', git.commit);
  if (git.sparse === undefined) {
    // Fetches the one blob.
    run('checkout', '--quiet', 'FETCH_HEAD', '--', file);
  } else {
    // A sparse checkout fetches the directory's blobs in one batch; a path checkout would fetch
    // them one by one.
    run('sparse-checkout', 'set', git.sparse);
    run('checkout', '--quiet', 'FETCH_HEAD');
  }
}

/** Verifies (or, with --update, records) the checksum of a document's content. */
function verify(entry: Entry, content: Buffer): void {
  const sha256 = createHash('sha256').update(content).digest('hex');
  if (entry.sha256 === undefined && update) entry.sha256 = sha256;
  else if (entry.sha256 !== sha256)
    throw new Error(
      `${entry.name}: checksum ${sha256} does not match ${entry.sha256 ?? '(none recorded; run with --update)'}.`,
    );
}

/**
 * `corpus.json` is data, so its repositories must be on GitHub over https and its commits full
 * hashes (which also keeps them from being read as git options).
 */
function checkSource(entry: Entry): void {
  const url = new URL(entry.git.repo);
  if (url.protocol !== 'https:' || url.host !== 'github.com')
    throw new Error(`${entry.name}: ${url.origin} is not an allowed source (https://github.com).`);
  if (!/^[0-9a-f]{40}$/.test(entry.git.commit))
    throw new Error(`${entry.name}: ${entry.git.commit} is not a full commit hash.`);
}

/**
 * Checks a document out once and verifies its checksum. A checkout is verified before it is moved
 * into `.corpus/`, so a failed, changed or tampered one never gets there.
 */
async function download(entry: Entry): Promise<string> {
  // Names become directories under `.corpus/`.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.name))
    throw new Error(`Invalid corpus name ${entry.name}.`);
  checkSource(entry);
  const directory = path.join(CACHE, entry.name);
  const file = path.join(directory, entry.path);
  const cached = await readIfExists(file);
  if (cached !== undefined) {
    verify(entry, cached);
    return file;
  }
  const partial = `${directory}.partial`;
  await rm(partial, { recursive: true, force: true });
  await mkdir(partial, { recursive: true });
  checkout(partial, entry.git, entry.path);
  verify(entry, await readFile(path.join(partial, entry.path)));
  await rm(directory, { recursive: true, force: true });
  await rename(partial, directory);
  return file;
}

async function filesOf(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

async function compileEntry(entry: Entry): Promise<Result> {
  const file = await download(entry);
  const directory = path.join(OUTPUT, entry.name);
  await rm(directory, { recursive: true, force: true });
  const config = resolveConfig(
    {
      spec: {
        version: 'auto',
        input: file,
      },
      output: { directory },
      features: { reactQuery: true, validation: { library: 'zod', request: true } },
      types: { dates: 'Date' },
    },
    { root: path.dirname(file) },
  );
  const result = await runGeneration({ config });
  const diagnostics: Record<string, number> = {};
  for (const diagnostic of result.diagnostics) {
    const key = `${diagnostic.severity} ${diagnostic.code}`;
    diagnostics[key] = (diagnostics[key] ?? 0) + 1;
  }
  const sorted = Object.fromEntries(
    Object.entries(diagnostics).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  let typeErrors: number | null = null;
  if (check && result.ok) {
    const problems = typecheck(await filesOf(directory), BROWSER);
    typeErrors = problems.length;
    for (const problem of problems.slice(0, 5)) console.log(`    ${problem}`);
  }
  return {
    version: result.ir?.specVersionRaw ?? '',
    ok: result.ok,
    operations: result.ir?.operations.length ?? 0,
    models: result.project?.models.length ?? 0,
    files: result.files.length,
    diagnostics: sorted,
    typeErrors,
  };
}

/** Differences between a baseline result and a new one, as readable lines. */
function differences(before: Result | undefined, after: Result): string[] {
  if (before === undefined) return ['not in the baseline'];
  const lines: string[] = [];
  for (const key of ['version', 'ok', 'operations', 'models', 'files'] as const) {
    if (before[key] !== after[key])
      lines.push(`${key}: ${String(before[key])} → ${String(after[key])}`);
  }
  if (after.typeErrors !== null && before.typeErrors !== after.typeErrors)
    lines.push(`type errors: ${String(before.typeErrors)} → ${after.typeErrors}`);
  const codes = new Set([...Object.keys(before.diagnostics), ...Object.keys(after.diagnostics)]);
  for (const code of [...codes].sort()) {
    const was = before.diagnostics[code] ?? 0;
    const now = after.diagnostics[code] ?? 0;
    if (was !== now) lines.push(`${code}: ${was} → ${now}`);
  }
  return lines;
}

if (!existsSync(path.join(ROOT, 'assets', 'runtime', 'client.js'))) await buildRuntimeTemplates();

const results: Record<string, Result> = {};
let failures = 0;
console.log(
  '| Document | Version | Operations | Models | Files | Errors | Warnings | Type errors | Time |',
);
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const entry of selected) {
  const started = performance.now();
  let result: Result;
  try {
    result = await compileEntry(entry);
  } catch (error) {
    failures++;
    console.log(
      `| ${entry.name} | crashed: ${error instanceof Error ? error.message : String(error)} |`,
    );
    continue;
  }
  results[entry.name] = result;
  const count = (severity: string): number =>
    Object.entries(result.diagnostics)
      .filter(([key]) => key.startsWith(`${severity} `))
      .reduce((sum, [, value]) => sum + value, 0);
  console.log(
    `| ${entry.name} | ${result.version} | ${result.operations} | ${result.models} | ${result.files} | ${count('error')} | ${count('warning')} | ${result.typeErrors ?? '–'} | ${Math.round(performance.now() - started)} ms |`,
  );
  const internal = result.diagnostics['error internal/error'] ?? 0;
  const changed = differences(baseline[entry.name], result);
  if (internal > 0 || (result.typeErrors ?? 0) > 0) failures++;
  else if (changed.length > 0 && !update) {
    failures++;
    for (const line of changed) console.log(`    ${line}`);
  }
}

if (update) {
  const merged = { ...baseline, ...results };
  const ordered = Object.fromEntries(
    list.documents.flatMap((e) => (e.name in merged ? [[e.name, merged[e.name]]] : [])),
  );
  await writeFile(BASELINE, `${JSON.stringify(ordered, null, 2)}\n`);
  await writeFile(LIST, `${JSON.stringify(list, null, 2)}\n`);
  console.log(
    `\nUpdated ${path.relative(ROOT, BASELINE)} and checksums in ${path.relative(ROOT, LIST)}.`,
  );
}
if (failures > 0) {
  console.error(
    `\n${failures} document${failures === 1 ? '' : 's'} crashed, produced type errors or changed diagnostics.${update ? '' : ' If the change is intended, run with --update.'}`,
  );
  process.exitCode = 1;
}
