/**
 * Runs the browser examples on their generated Mock Service Worker mocks in Chromium, Firefox and
 * WebKit (Playwright). Each app lists and pages tasks, creates one (and shows the documented `422`
 * for an empty title), updates and deletes one; every API request must be answered by the
 * service worker, and no page error may occur.
 *
 * Usage: node scripts/examples-browsers.ts [example…]
 *   Generate the clients first (`pnpm examples:check`). Playwright comes from `.runtimes/`, where
 *   `pnpm test:runtimes` installs it, or is installed there now (network).
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOOLS = path.join(ROOT, '.runtimes');
/** Keep in step with `scripts/runtimes.ts`. */
const PLAYWRIGHT = '1.64.1';
const EXAMPLES = ['react-query', 'vue-query', 'svelte-query', 'solid-query', 'swr'] as const;
const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

interface Locator {
  filter(options: { hasText: string }): Locator;
  getByRole(role: string, options: { name: string | RegExp }): Locator;
  getByText(text: string, options?: { exact: boolean }): Locator;
  first(): Locator;
  count(): Promise<number>;
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  waitFor(options?: { state?: 'detached'; timeout?: number }): Promise<void>;
}

interface Page extends Locator {
  goto(url: string): Promise<unknown>;
  locator(selector: string): Locator;
  getByPlaceholder(text: string): Locator;
  on(event: 'response', listener: (response: PlaywrightResponse) => void): void;
  on(event: 'pageerror', listener: (error: Error) => void): void;
}

interface PlaywrightResponse {
  url(): string;
  status(): number;
  fromServiceWorker(): boolean;
  request(): { method(): string };
}

type Engines = Record<
  (typeof ENGINES)[number],
  { launch(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }> }
>;

async function playwright(): Promise<Engines> {
  await mkdir(TOOLS, { recursive: true });
  const manifest = path.join(TOOLS, 'package.json');
  if (!existsSync(manifest)) await writeFile(manifest, JSON.stringify({ name: 'runtimes' }));
  if (!existsSync(path.join(TOOLS, 'node_modules', 'playwright', 'package.json'))) {
    console.log('Installing Playwright into .runtimes/ …');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', `playwright@${PLAYWRIGHT}`], {
      cwd: TOOLS,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
  const require = createRequire(manifest);
  const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
  execFileSync(process.execPath, [cli, 'install', ...ENGINES], { cwd: TOOLS, stdio: 'inherit' });
  return require('playwright') as Engines;
}

/** Starts an example's Vite dev server and resolves with its URL once it answers. */
async function devServer(example: string, port: number): Promise<{ url: string; stop(): void }> {
  const directory = path.join(ROOT, 'examples', example);
  const vite = path.join(directory, 'node_modules', 'vite', 'bin', 'vite.js');
  const child: ChildProcess = spawn(
    process.execPath,
    [vite, '--port', String(port), '--strictPort'],
    {
      cwd: directory,
      stdio: 'ignore',
    },
  );
  const url = `http://localhost:${port}/`;
  for (let attempt = 0; attempt < 120; attempt++) {
    const ready = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) return { url, stop: () => child.kill() };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`The dev server of ${example} did not start.`);
}

/** The steps the app went through, the API requests and whether the worker answered them. */
async function exercise(page: Page, url: string): Promise<{ steps: string[]; problems: string[] }> {
  const requests: PlaywrightResponse[] = [];
  const problems: string[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/')) requests.push(response);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  const steps: string[] = [];
  try {
    await page.goto(url);
    const items = page.locator('li');
    await items.filter({ hasText: 'Ship the release' }).waitFor({ timeout: 20_000 });
    steps.push('list');
    await page.getByRole('button', { name: 'Load more' }).click();
    await items.filter({ hasText: 'Generate the client' }).waitFor();
    steps.push('page');
    await page.getByPlaceholder('New task').fill('Try the mocks');
    await page.getByRole('button', { name: 'Add' }).click();
    await items.filter({ hasText: 'Try the mocks' }).waitFor();
    steps.push('create');
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByText('Invalid task').first().waitFor();
    steps.push('422');
    const created = items.filter({ hasText: 'Try the mocks' });
    await created.getByRole('button', { name: /doing/ }).click();
    await created.getByText('doing', { exact: true }).waitFor();
    steps.push('update');
    await items
      .filter({ hasText: 'Write the changelog' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await items.filter({ hasText: 'Write the changelog' }).waitFor({ state: 'detached' });
    steps.push('delete');
  } catch (error) {
    problems.push(`after ${steps.at(-1) ?? 'start'}: ${String(error).split('\n')[0] ?? ''}`);
  }
  if (requests.length === 0) problems.push('no API request');
  for (const response of requests) {
    if (!response.fromServiceWorker())
      problems.push(`${response.request().method()} ${response.url()} bypassed the worker`);
  }
  return { steps, problems };
}

const requested = process.argv.slice(2);
for (const name of requested)
  if (!(EXAMPLES as readonly string[]).includes(name))
    throw new Error(`Unknown example "${name}". Examples: ${EXAMPLES.join(', ')}`);
const examples = requested.length === 0 ? EXAMPLES : requested;

const engines = await playwright();
const rows: string[] = [];
let failed = false;
for (const [index, example] of examples.entries()) {
  if (!existsSync(path.join(ROOT, 'examples', example, 'src', 'generated', 'api', 'mocks'))) {
    throw new Error(
      `examples/${example} has no generated mocks: run \`pnpm examples:check\` first.`,
    );
  }
  const server = await devServer(example, 5300 + index);
  try {
    for (const engine of ENGINES) {
      const browser = await engines[engine].launch();
      try {
        const { steps, problems } = await exercise(await browser.newPage(), server.url);
        failed ||= problems.length > 0;
        rows.push(
          `| ${example} | ${engine} | ${steps.join(', ')} | ${problems.length === 0 ? 'pass' : `FAIL — ${problems.join('; ')}`} |`,
        );
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.stop();
  }
}
console.log('\n| Example | Browser | Steps | Result |\n| --- | --- | --- | --- |');
console.log(rows.join('\n'));
process.exitCode = failed ? 1 : 0;
