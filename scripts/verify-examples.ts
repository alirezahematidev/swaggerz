/**
 * Verifies the examples the way a user runs them: packs the package, copies each example to a
 * temporary directory, installs its dependencies with the packed tarball in place of the local
 * checkout, and runs its `generate`, `check` and (when present) `start` scripts.
 *
 * Usage: node scripts/verify-examples.ts [example…]   (requires network access)
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXAMPLES = path.join(ROOT, 'examples');
const SKIPPED = new Set(['node_modules', 'dist', 'generated']);

interface ExamplePackage {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function run(command: string, args: readonly string[], cwd: string): string {
  console.log(`$ ${command} ${args.join(' ')}`);
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as {
  name: string;
};
const requested = process.argv.slice(2);
const examples = (await readdir(EXAMPLES, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => requested.length === 0 || requested.includes(name))
  .sort();
if (examples.length === 0) throw new Error(`No examples match ${requested.join(', ')}.`);

const work = await mkdtemp(path.join(os.tmpdir(), 'swaggerz-examples-'));
const results: { name: string; ok: boolean }[] = [];
try {
  execFileSync(process.execPath, ['scripts/build.ts'], { cwd: ROOT, stdio: 'inherit' });
  const [info] = JSON.parse(
    run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', work], ROOT),
  ) as [{ filename: string }];
  const tarball = path.join(work, info.filename);

  for (const name of examples) {
    console.log(`\n▶ ${name}`);
    const directory = path.join(work, name);
    await cp(path.join(EXAMPLES, name), directory, {
      recursive: true,
      filter: (source) => !SKIPPED.has(path.basename(source)),
    });
    const manifestPath = path.join(directory, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ExamplePackage;
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const deps = manifest[field];
      if (deps?.[pkg.name] !== undefined) deps[pkg.name] = `file:${tarball}`;
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    try {
      run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], directory);
      for (const script of ['generate', 'check', 'start']) {
        if (manifest.scripts?.[script] === undefined) continue;
        process.stdout.write(run('npm', ['run', '--silent', script], directory));
      }
      results.push({ name, ok: true });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      results.push({ name, ok: false });
    }
  }
} finally {
  await rm(work, { recursive: true, force: true });
}

console.log('\n| Example | Result |\n| --- | --- |');
for (const { name, ok } of results) console.log(`| ${name} | ${ok ? 'pass' : 'FAIL'} |`);
if (results.some((r) => !r.ok)) process.exitCode = 1;
