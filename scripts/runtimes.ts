/**
 * Runs generated clients in other JavaScript runtimes: Node.js, Deno, Bun, Chromium, Firefox,
 * WebKit (Playwright) and workerd, Cloudflare's edge runtime (through miniflare). Every runtime
 * executes `tests/runtimes/suite.js` against the server in `tests/runtimes/server.mjs`.
 *
 * Usage: node scripts/runtimes.ts [runtime…] [--require] [--install-deps]
 *   runtimes: node, deno, bun, chromium, firefox, webkit, workerd (default: all)
 *   --require       fail when a runtime cannot be found or installed (CI)
 *   --install-deps  also install the browsers' system dependencies (Linux CI)
 *
 * Deno, Bun, Playwright and miniflare come from PATH or are installed into `.runtimes/` with npm
 * (network); the project itself does not depend on them.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { runGeneration } from '../src/pipeline/generate.ts';
import { resolveConfig } from '../src/config/resolve.ts';
import { buildRuntimeTemplates } from './build-assets.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = path.join(ROOT, 'tests', '.output', 'runtimes');
const SUITE = path.join(ROOT, 'tests', 'runtimes');
const TOOLS = path.join(ROOT, '.runtimes');

/** Exact versions installed when a runtime is not on PATH. */
// Playwright: keep in step with the Playwright image of the `browsers` job in .github/workflows/ci.yml,
// whose browsers this version then finds instead of downloading them.
const VERSIONS = { deno: '2.9.6', bun: '1.3.13', playwright: '1.64.1', miniflare: '4.20260730.0' };
const ALL = ['node', 'deno', 'bun', 'chromium', 'firefox', 'webkit', 'workerd'] as const;
type Runtime = (typeof ALL)[number];

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly error?: string;
}

interface Outcome {
  readonly runtime: string;
  readonly client: 'js' | 'ts';
  readonly status: 'pass' | 'fail' | 'skipped';
  readonly detail: string;
  readonly checks: readonly Check[];
}

const args = process.argv.slice(2);
const requireAll = args.includes('--require');
const installDeps = args.includes('--install-deps');
const requested = args.filter((arg) => !arg.startsWith('--'));
for (const name of requested) {
  if (!(ALL as readonly string[]).includes(name))
    throw new Error(`Unknown runtime "${name}". Runtimes: ${ALL.join(', ')}`);
}
const runtimes = (requested.length === 0 ? ALL : requested) as readonly Runtime[];

function run(command: string, commandArgs: readonly string[], cwd = ROOT): string {
  return execFileSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    // `npm` is a .cmd script on Windows, which Node.js only starts through a shell.
    shell: process.platform === 'win32' && command === 'npm',
  });
}

/** A command and the arguments that precede the script it runs. */
interface Launcher {
  readonly command: string;
  readonly prefix: readonly string[];
}

function onPath(command: string): string | undefined {
  try {
    const where = process.platform === 'win32' ? 'where' : 'which';
    return run(where, [command]).split(/\r?\n/)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Installs npm packages into `.runtimes/` once and returns a require function for them. */
async function tools(packages: readonly string[]): Promise<NodeJS.Require> {
  await mkdir(TOOLS, { recursive: true });
  const manifest = path.join(TOOLS, 'package.json');
  // `wx` creates the manifest only if it is missing, without a separate existence check.
  await writeFile(manifest, JSON.stringify({ name: 'runtimes', private: true }), {
    flag: 'wx',
  }).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  });
  const missing = packages.filter((spec) => {
    const name = spec.slice(0, spec.lastIndexOf('@'));
    return !existsSync(path.join(TOOLS, 'node_modules', name, 'package.json'));
  });
  if (missing.length > 0) {
    console.log(`Installing ${missing.join(', ')} into .runtimes/ …`);
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...missing], TOOLS);
  }
  return createRequire(manifest);
}

/** Generates the clients the runtimes load: JavaScript, and TypeScript with `.ts` imports. */
async function generate(): Promise<void> {
  if (!existsSync(path.join(ROOT, 'assets', 'runtime', 'client.js'))) await buildRuntimeTemplates();
  for (const [name, language, importExtension] of [
    ['js', 'javascript', '.js'],
    ['ts', 'typescript', '.ts'],
  ] as const) {
    const config = resolveConfig(
      {
        spec: { version: '3.0', input: path.join(ROOT, 'fixtures', 'specs', 'petstore-3.0.yaml') },
        output: { directory: path.join(OUTPUT, name), language, importExtension },
      },
      { root: ROOT },
    );
    const result = await runGeneration({ config });
    if (!result.ok) throw new Error(`Generating the ${name} client failed.`);
  }
  // Node.js treats the generated files as ES modules (and strips the types of the .ts client).
  await writeFile(path.join(OUTPUT, 'package.json'), '{ "type": "module" }\n');
  await cp(path.join(SUITE, 'suite.js'), path.join(OUTPUT, 'suite.js'));
}

/** Runs `entry.js` with a server-side runtime and parses the printed results. */
function spawnSuite(command: string, prefix: readonly string[], client: 'js' | 'ts', base: string) {
  const moduleUrl = pathToFileURL(path.join(OUTPUT, client, 'index.' + client)).href;
  return new Promise<Check[]>((resolve, reject) => {
    const child = spawn(
      command,
      [...prefix, path.join(SUITE, 'entry.js'), moduleUrl, base, randomUUID()],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      const line = stdout.trim().split('\n').at(-1) ?? '';
      try {
        resolve(JSON.parse(line) as Check[]);
      } catch {
        reject(
          new Error(`exited with ${String(code)}: ${(stderr || stdout).trim().slice(0, 2000)}`),
        );
      }
    });
  });
}

async function deno(): Promise<Launcher> {
  const found = onPath('deno');
  if (found !== undefined) return { command: found, prefix: [] };
  const require = await tools([`deno@${VERSIONS.deno}`]);
  // The npm package starts the platform binary from a Node.js script.
  const launcher = path.join(path.dirname(require.resolve('deno/package.json')), 'bin.cjs');
  return { command: process.execPath, prefix: [launcher] };
}

async function bun(): Promise<Launcher> {
  const found = onPath('bun');
  if (found !== undefined) return { command: found, prefix: [] };
  const require = await tools([`bun@${VERSIONS.bun}`]);
  const binary = path.join(path.dirname(require.resolve('bun/package.json')), 'bin', 'bun.exe');
  return { command: binary, prefix: [] };
}

interface PlaywrightBrowser {
  launch(): Promise<{
    newPage(): Promise<{
      goto(url: string): Promise<unknown>;
      waitForFunction(fn: string, arg?: unknown, options?: { timeout: number }): Promise<unknown>;
      evaluate(fn: string): Promise<unknown>;
    }>;
    version(): string;
    close(): Promise<void>;
  }>;
}

async function playwright(): Promise<Record<'chromium' | 'firefox' | 'webkit', PlaywrightBrowser>> {
  const require = await tools([`playwright@${VERSIONS.playwright}`]);
  const browsers = runtimes.filter(
    (name): name is 'chromium' | 'firefox' | 'webkit' =>
      name === 'chromium' || name === 'firefox' || name === 'webkit',
  );
  const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
  console.log(`Installing Playwright browsers: ${browsers.join(', ')} …`);
  execFileSync(
    process.execPath,
    [cli, 'install', ...(installDeps ? ['--with-deps'] : []), ...browsers],
    {
      cwd: TOOLS,
      stdio: 'inherit',
      // System packages are installed with apt: never wait for an answer, and fail with a message
      // instead of running into the CI job's time limit.
      env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
      timeout: 15 * 60_000,
    },
  );
  return require('playwright') as Record<'chromium' | 'firefox' | 'webkit', PlaywrightBrowser>;
}

async function browser(
  name: 'chromium' | 'firefox' | 'webkit',
  base: string,
): Promise<{ checks: Check[]; version: string }> {
  const engines = await (playwrightEngines ??= playwright());
  const instance = await engines[name].launch();
  try {
    const page = await instance.newPage();
    await page.goto(`${base}/browser.html?client=js&run=${randomUUID()}`);
    await page.waitForFunction('window.__results !== undefined', undefined, { timeout: 30_000 });
    return {
      checks: (await page.evaluate('window.__results')) as Check[],
      version: instance.version(),
    };
  } finally {
    await instance.close();
  }
}
let playwrightEngines: ReturnType<typeof playwright> | undefined;

/** Bundles the suite and the JavaScript client into a module worker and runs it in workerd. */
async function workerd(base: string): Promise<{ checks: Check[]; version: string }> {
  const require = await tools([`miniflare@${VERSIONS.miniflare}`]);
  const entry = path.join(OUTPUT, 'worker.js');
  await writeFile(
    entry,
    [
      "import * as api from './js/index.js';",
      "import { runSuite } from './suite.js';",
      'export default {',
      '  async fetch(request) {',
      '    const url = new URL(request.url);',
      "    const results = await runSuite(api, url.searchParams.get('base'), url.searchParams.get('run'));",
      '    return Response.json(results);',
      '  },',
      '};',
      '',
    ].join('\n'),
  );
  const bundle = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  });
  const { Miniflare } = require('miniflare') as {
    Miniflare: new (options: Record<string, unknown>) => {
      dispatchFetch(url: string): Promise<{ json(): Promise<unknown> }>;
      dispose(): Promise<void>;
    };
  };
  const mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0]?.text ?? '',
    compatibilityDate: '2026-01-01',
  });
  try {
    const response = await mf.dispatchFetch(
      `http://localhost/?base=${encodeURIComponent(base)}&run=${randomUUID()}`,
    );
    const version = JSON.parse(
      await readFile(
        path.join(path.dirname(require.resolve('workerd/package.json')), 'package.json'),
        'utf8',
      ),
    ) as { version: string };
    return { checks: (await response.json()) as Check[], version: version.version };
  } finally {
    await mf.dispose();
  }
}

function summarize(checks: readonly Check[]): { status: 'pass' | 'fail'; failed: string } {
  const failed = checks.filter((check) => !check.ok);
  return {
    status: failed.length === 0 && checks.length > 0 ? 'pass' : 'fail',
    failed: failed.map((check) => `${check.name}: ${check.error ?? ''}`).join('; '),
  };
}

const { startServer } = (await import(pathToFileURL(path.join(SUITE, 'server.mjs')).href)) as {
  startServer: (options: {
    staticRoot: string;
  }) => Promise<{ url: string; close: () => Promise<void> }>;
};

await generate();
const server = await startServer({ staticRoot: OUTPUT });
const outcomes: Outcome[] = [];
const record = (
  runtime: string,
  client: 'js' | 'ts',
  checks: readonly Check[],
  version: string,
): void => {
  const { status, failed } = summarize(checks);
  outcomes.push({ runtime: `${runtime} ${version}`, client, status, detail: failed, checks });
};

try {
  for (const name of runtimes) {
    try {
      switch (name) {
        case 'node':
          for (const client of ['js', 'ts'] as const)
            record(
              'Node.js',
              client,
              await spawnSuite(process.execPath, [], client, server.url),
              process.versions.node,
            );
          break;
        case 'deno': {
          const { command, prefix } = await deno();
          const version = run(command, [...prefix, '--version']).split(' ')[1] ?? '';
          for (const client of ['js', 'ts'] as const)
            record(
              'Deno',
              client,
              await spawnSuite(
                command,
                [...prefix, 'run', '--allow-net', '--allow-read'],
                client,
                server.url,
              ),
              version,
            );
          break;
        }
        case 'bun': {
          const { command, prefix } = await bun();
          const version = run(command, [...prefix, '--version']).trim();
          for (const client of ['js', 'ts'] as const)
            record('Bun', client, await spawnSuite(command, prefix, client, server.url), version);
          break;
        }
        case 'chromium':
        case 'firefox':
        case 'webkit': {
          const { checks, version } = await browser(name, server.url);
          record(
            { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' }[name],
            'js',
            checks,
            version,
          );
          break;
        }
        case 'workerd': {
          const { checks, version } = await workerd(server.url);
          record('workerd', 'js', checks, version);
          break;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({
        runtime: name,
        client: 'js',
        status: requireAll ? 'fail' : 'skipped',
        detail: message.split('\n')[0] ?? message,
        checks: [],
      });
    }
  }
} finally {
  await server.close();
}

console.log('\n| Runtime | Client | Checks | Result |\n| --- | --- | --- | --- |');
for (const outcome of outcomes) {
  const passed = outcome.checks.filter((check) => check.ok).length;
  console.log(
    `| ${outcome.runtime} | ${outcome.client === 'js' ? 'JavaScript' : 'TypeScript'} | ${passed}/${outcome.checks.length} | ${outcome.status}${outcome.detail === '' ? '' : ` — ${outcome.detail}`} |`,
  );
}
if (outcomes.some((outcome) => outcome.status === 'fail')) process.exitCode = 1;
