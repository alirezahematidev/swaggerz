/**
 * Runs an example against this checkout: builds the package, generates the example's client (with
 * its `generate` script, when it has one) and runs one of its scripts (by default `dev`, otherwise
 * `start`).
 *
 * Usage: node scripts/example.ts <example|all> [script]
 *   pnpm example:react-query          # build, generate, start the Vite dev server
 *   pnpm example node-javascript      # build, generate, run the script
 *   pnpm example all check            # build, then generate and type-check every example
 *
 * The examples are pnpm workspace packages (`"swaggerz": "workspace:*"`), so run `pnpm install` in
 * the repository root once before the first run.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXAMPLES = path.join(ROOT, 'examples');

const available = (await readdir(EXAMPLES, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const [target, requested] = process.argv.slice(2);
if (target === undefined || (target !== 'all' && !available.includes(target))) {
  console.error(
    `${target === undefined ? 'Missing example name' : `Unknown example "${target}"`}.\n` +
      `Usage: node scripts/example.ts <example|all> [script]\nExamples: ${available.join(', ')}`,
  );
  process.exit(2);
}
if (target === 'all' && requested === undefined) {
  console.error('Name the script to run in every example, e.g. `pnpm example all check`.');
  process.exit(2);
}

/** Runs a command with inherited output and resolves with its exit code. */
function run(command: string, args: readonly string[], cwd: string): Promise<number> {
  console.log(`\n$ ${[command === process.execPath ? 'node' : command, ...args].join(' ')}`);
  return new Promise((resolve, reject) => {
    // `pnpm` is a `.cmd` shim on Windows; prefer the pnpm that runs this script when there is one.
    const pnpm = process.env['npm_execpath'];
    const [file, prefix, shell] =
      command === 'pnpm' && pnpm !== undefined && /\.c?js$/.test(pnpm)
        ? [process.execPath, [pnpm], false]
        : [command, [], process.platform === 'win32' && command === 'pnpm'];
    const child = spawn(file, [...prefix, ...args], { cwd, stdio: 'inherit', shell });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve(code ?? (signal === null ? 1 : 0));
    });
  });
}

async function scriptsOf(name: string): Promise<Record<string, string>> {
  const manifest = JSON.parse(
    await readFile(path.join(EXAMPLES, name, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  return manifest.scripts ?? {};
}

// Ctrl+C reaches the child processes directly; keep this process alive until they exit.
process.on('SIGINT', () => undefined);

const build = await run(process.execPath, ['scripts/build.ts'], ROOT);
if (build !== 0) process.exit(build);

for (const name of target === 'all' ? available : [target]) {
  const directory = path.join(EXAMPLES, name);
  if (!existsSync(path.join(directory, 'node_modules', 'swaggerz'))) {
    console.error(`examples/${name} has no dependencies yet; run \`pnpm install\` in the root.`);
    process.exit(1);
  }
  const scripts = await scriptsOf(name);
  const script = requested ?? ['dev', 'start'].find((candidate) => candidate in scripts);
  if (script === undefined || !(script in scripts)) {
    console.error(
      `examples/${name} has no "${script ?? 'dev'}" script. Scripts: ${Object.keys(scripts).join(', ')}`,
    );
    process.exit(2);
  }
  // Examples on the Vite plugin, Astro or Next.js integration generate when their dev server or
  // build starts and have no `generate` script.
  const steps = 'generate' in scripts && script !== 'generate' ? ['generate', script] : [script];
  for (const step of steps) {
    const code = await run('pnpm', ['run', step], directory);
    if (code !== 0) process.exit(code);
  }
}
