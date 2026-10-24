/**
 * Bundle sizes and compiler timings shown on the site. They come from the repository's own
 * measurements: the tree-shaking test (`tests/integration/treeshake`) and `scripts/bench.ts`.
 * Each run is stamped with its date, commit and machine, which the pages print next to the
 * numbers. `--measure` (or missing results) runs both again; otherwise the last results are used.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DriftError, ROOT, WEBSITE, writeGenerated } from './output.ts';

const CACHE = path.join(WEBSITE, '.measurements');
const TREESHAKE_OUTPUT = path.join(ROOT, 'tests', '.output', 'treeshake', 'sizes.json');
/** Resource groups for the compiler benchmark: 100, 500, 2,500 and 10,000 operations. */
const BENCH_SIZES = ['20', '100', '500', '2000'];

/** The tree-shaking test's labels, and the field each one becomes. */
const TREESHAKE_KEYS = {
  oneOperation: 'esbuild: 1 operation via direct import',
  threeOperationsEsbuild: 'esbuild: 3 operations via barrel',
  threeOperationsVite: 'vite: 3 operations via barrel',
  threeOperationsWebpack: 'webpack: 3 operations via barrel',
  threeOperationsRollupUnminified: 'rollup: 3 operations via barrel (unminified)',
  reactQueryHook: 'esbuild: 1 React Query hook via barrel, minus TanStack Query itself',
  entireClient: 'esbuild: entire client (1,000 operations)',
} as const;

interface Stamp {
  readonly measuredAt: string;
  readonly commit: string | undefined;
}

interface BenchRow {
  readonly operations: number;
  readonly models: number;
  readonly specBytes: number;
  readonly parseMs: number;
  readonly analyzeMs: number;
  readonly generateMs: number;
  readonly totalMs: number;
  readonly files: number;
  readonly heapBytes: number;
}

interface BenchResult extends Stamp {
  readonly environment: { node: string; cpu: string; platform: string; arch: string };
  readonly runs: number;
  readonly rows: readonly BenchRow[];
}

interface TreeshakeResult extends Stamp {
  readonly sizes: Readonly<Record<string, number>>;
}

function commit(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

function run(command: string, args: readonly string[]): void {
  execFileSync(command, args, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
}

async function measureTreeshake(): Promise<void> {
  console.log('Measuring bundle sizes (tests/integration/treeshake)…');
  const stamp: Stamp = { measuredAt: new Date().toISOString(), commit: commit() };
  run('pnpm', ['vitest', 'run', 'tests/integration/treeshake']);
  const sizes = JSON.parse(await readFile(TREESHAKE_OUTPUT, 'utf8')) as Record<string, number>;
  await writeFile(
    path.join(CACHE, 'treeshake.json'),
    `${JSON.stringify({ ...stamp, sizes }, null, 2)}\n`,
  );
}

async function measureCompiler(): Promise<void> {
  console.log('Measuring the compiler (scripts/bench.ts)…');
  const stamp: Stamp = { measuredAt: new Date().toISOString(), commit: commit() };
  const file = path.join(CACHE, 'bench.raw.json');
  run(process.execPath, ['--expose-gc', 'scripts/bench.ts', '--json', file, ...BENCH_SIZES]);
  const result = JSON.parse(await readFile(file, 'utf8')) as Omit<BenchResult, keyof Stamp>;
  await writeFile(
    path.join(CACHE, 'bench.json'),
    `${JSON.stringify({ ...stamp, ...result }, null, 2)}\n`,
  );
}

/**
 * The size of the client the tree-shaking test bundles, read from the test itself: each resource
 * group of `scripts/large-spec.ts` has five operations and three models, plus two shared models.
 */
async function treeshakeSpecSize(): Promise<{ operations: number; models: number }> {
  const test = await readFile(
    path.join(ROOT, 'tests', 'integration', 'treeshake', 'bundle.test.ts'),
    'utf8',
  );
  const resources = Number(/const RESOURCES = (\d+);/.exec(test)?.[1]);
  if (!Number.isInteger(resources)) {
    throw new DriftError('Cannot read the size of the tree-shaking test client:', [
      'tests/integration/treeshake/bundle.test.ts has no `const RESOURCES = <number>;`',
    ]);
  }
  return { operations: resources * 5, models: resources * 3 + 2 };
}

function platformName(platform: string): string {
  return platform === 'darwin'
    ? 'macOS'
    : platform === 'win32'
      ? 'Windows'
      : platform === 'linux'
        ? 'Linux'
        : platform;
}

export async function measurements(options: { measure: boolean }): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  if (options.measure || !existsSync(path.join(CACHE, 'treeshake.json'))) await measureTreeshake();
  if (options.measure || !existsSync(path.join(CACHE, 'bench.json'))) await measureCompiler();

  const treeshake = JSON.parse(
    await readFile(path.join(CACHE, 'treeshake.json'), 'utf8'),
  ) as TreeshakeResult;
  const bench = JSON.parse(await readFile(path.join(CACHE, 'bench.json'), 'utf8')) as BenchResult;

  const missing = Object.entries(TREESHAKE_KEYS)
    .filter(([, label]) => typeof treeshake.sizes[label] !== 'number')
    .map(([field, label]) => `${field}: "${label}" is not in the tree-shaking test's sizes.json`);
  if (missing.length > 0) {
    throw new DriftError(
      'The tree-shaking test no longer reports a size the site shows (update TREESHAKE_KEYS):',
      missing,
    );
  }
  const sizes = Object.fromEntries(
    Object.entries(TREESHAKE_KEYS).map(([field, label]) => [field, treeshake.sizes[label] ?? 0]),
  ) as Record<keyof typeof TREESHAKE_KEYS, number>;

  // The older of the two runs dates the numbers.
  const measuredAt = [treeshake.measuredAt, bench.measuredAt].sort()[0] ?? treeshake.measuredAt;
  const { environment } = bench;
  await writeGenerated('measurements.json', {
    measuredAt,
    commit: treeshake.commit ?? bench.commit,
    environment: `${environment.cpu}, Node.js ${environment.node.replace(/^v/, '')}, ${platformName(environment.platform)} (${environment.arch})`,
    treeshake: { ...(await treeshakeSpecSize()), ...sizes },
    bench: { runs: bench.runs, rows: bench.rows },
  });
}
