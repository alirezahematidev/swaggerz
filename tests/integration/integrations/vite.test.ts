import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build, createServer, type InlineConfig, type Logger, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { swaggerz, type SwaggerzViteOptions } from '../../../src/integrations/vite.ts';
import { createProject } from '../../support/project.ts';

const spec = (operation: string): string => `openapi: 3.0.3
info: { title: Pets, version: '1' }
paths:
  /pets:
    get:
      operationId: ${operation}
      responses:
        '200':
          description: The pets.
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/Pet' } }
components:
  schemas:
    Pet:
      type: object
      properties:
        name: { type: string }
`;
/** An app module that imports the generated client, so a build fails without it. */
const MAIN = `import { listPets } from './generated/api/index.ts';
export const load = () => listPets();
`;

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

/** A logger that keeps what Vite and the plugin print. */
function capture(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const log =
    (level: string) =>
    (message: string): void => {
      lines.push(`${level} ${message}`);
    };
  const logger: Logger = {
    hasWarned: false,
    info: log('info'),
    warn: log('warn'),
    warnOnce: log('warn'),
    error: log('error'),
    clearScreen: () => undefined,
    hasErrorLogged: () => false,
  };
  return { logger, lines };
}

async function project(name: string): Promise<string> {
  return createProject(name, {
    config: { spec: { version: '3.0', input: './openapi.yaml' } },
    files: { 'openapi.yaml': spec('listPets'), 'src/main.ts': MAIN },
  });
}

function config(directory: string, logger: Logger, options?: SwaggerzViteOptions): InlineConfig {
  return {
    root: directory,
    configFile: false,
    customLogger: logger,
    // Keeps Vite's build progress off the test output; the plugin logs through `logger`.
    logLevel: 'warn',
    plugins: [swaggerz(options)],
  };
}

async function devServer(
  directory: string,
  options?: SwaggerzViteOptions,
  watch?: null,
): Promise<{ server: ViteDevServer; lines: string[]; url: string }> {
  const { logger, lines } = capture();
  const server = await createServer({
    ...config(directory, logger, options),
    server: {
      port: 15_300 + Math.floor(Math.random() * 500),
      ...(watch === null ? { watch } : {}),
    },
  });
  closers.push(() => server.close());
  await server.listen();
  const address = server.httpServer?.address();
  if (address === null || typeof address !== 'object') throw new Error('No address');
  const token = (server.config as unknown as { webSocketToken: string }).webSocketToken;
  return { server, lines, url: `ws://localhost:${address.port}/?token=${token}` };
}

/** A browser's HMR connection: the payloads Vite sends it. */
async function hmrClient(url: string): Promise<{
  messages: {
    type: string;
    err?: { message: string; plugin?: string; id?: string; frame?: string };
  }[];
}> {
  const socket = new WebSocket(url, 'vite-hmr');
  const messages: { type: string }[] = [];
  socket.addEventListener('message', (event) => {
    messages.push(JSON.parse(String(event.data)) as { type: string });
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', () => reject(new Error('Cannot connect')));
  });
  closers.push(async () => socket.close());
  await vi.waitFor(() => {
    expect(messages.some((message) => message.type === 'connected')).toBe(true);
  });
  return { messages };
}

/** Writes a file until `done` holds (an edit right after the watcher started can be missed). */
async function edit(
  file: string,
  text: string,
  done: () => boolean | Promise<boolean>,
): Promise<void> {
  const started = Date.now();
  for (;;) {
    await writeFile(file, text);
    const until = Date.now() + 1000;
    while (Date.now() < until) {
      if (await done()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (Date.now() - started > 20_000) throw new Error(`No change after editing ${file}`);
  }
}

describe('swaggerz/vite dev server', { timeout: 60_000 }, () => {
  it('generates before the server starts and regenerates on change', async () => {
    const directory = await project('vite-dev');
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    const { lines } = await devServer(directory);
    expect(await readFile(index, 'utf8')).toContain('list-pets');
    expect(
      lines.some((line) =>
        /^info \(swaggerz\) Generated \d+ files in src\/generated\/api/.test(line),
      ),
    ).toBe(true);

    await edit(path.join(directory, 'openapi.yaml'), spec('listAllPets'), async () =>
      (await readFile(index, 'utf8')).includes('list-all-pets'),
    );
    await vi.waitFor(() => {
      expect(
        lines.some((line) => line.includes('openapi.yaml changed: regenerated src/generated/api')),
      ).toBe(true);
    });
  });

  it('shows errors in the overlay, to pages that connect later too, and clears them', async () => {
    const directory = await project('vite-overlay');
    const { url, lines } = await devServer(directory);
    const page = await hmrClient(url);
    const specFile = path.join(directory, 'openapi.yaml');

    await edit(
      specFile,
      spec('listPets').replace(
        "$ref: '#/components/schemas/Pet'",
        "$ref: '#/components/schemas/Missing'",
      ),
      () => page.messages.some((message) => message.type === 'error'),
    );
    const error = page.messages.find((message) => message.type === 'error')?.err;
    expect(error?.plugin).toBe('swaggerz');
    expect(error?.message).toMatch(
      /^openapi\.yaml changed: generation failed \(1 error\); nothing was written\.\n\nerror /,
    );
    expect(error?.id).toBe(specFile);
    expect(error?.frame).toContain("$ref: '#/components/schemas/Missing'");
    expect(lines.some((line) => line.startsWith('error (swaggerz) error '))).toBe(true);

    // A page loaded while the error lasts gets it on connection.
    const later = await hmrClient(url);
    expect(later.messages.some((message) => message.type === 'error')).toBe(true);

    await edit(specFile, spec('listPets'), () =>
      page.messages.some((message) => message.type === 'update'),
    );
    await vi.waitFor(() => {
      expect(later.messages.some((message) => message.type === 'update')).toBe(true);
    });
    // Fixed: new pages get no error.
    const fresh = await hmrClient(url);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fresh.messages.map((message) => message.type)).toEqual(['connected']);
  });

  it('generates once when Vite does not watch (vitest run)', async () => {
    const directory = await project('vite-no-watch');
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    await devServer(directory, {}, null);
    expect(await readFile(index, 'utf8')).toContain('list-pets');
    await writeFile(path.join(directory, 'openapi.yaml'), spec('listAllPets'));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(await readFile(index, 'utf8')).toContain('list-pets');
  });

  it('stops watching when the server closes', async () => {
    const directory = await project('vite-close');
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    const { server } = await devServer(directory);
    await server.close();
    await writeFile(path.join(directory, 'openapi.yaml'), spec('listAllPets'));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(await readFile(index, 'utf8')).toContain('list-pets');
  });

  it('keeps watching after a restart with the same plugin', async () => {
    const directory = await project('vite-restart');
    const index = path.join(directory, 'src', 'generated', 'api', 'index.ts');
    const { server, lines } = await devServer(directory);
    // Vite starts the new server, then closes the old one: only the old server's session stops.
    // Restarted in place: the helper's cleanup closes the new server.
    await server.restart();
    expect(lines.filter((line) => line.includes('src/generated/api is up to date'))).toHaveLength(
      1,
    );
    await edit(path.join(directory, 'openapi.yaml'), spec('listAllPets'), async () =>
      (await readFile(index, 'utf8')).includes('list-all-pets'),
    );
    // One session watches: one regeneration is reported.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(lines.filter((line) => line.includes('openapi.yaml changed'))).toHaveLength(1);
  });
});

describe('swaggerz/vite build', { timeout: 60_000 }, () => {
  const buildConfig = (
    directory: string,
    logger: Logger,
    options?: SwaggerzViteOptions,
  ): InlineConfig => ({
    ...config(directory, logger, options),
    build: {
      lib: { entry: path.join(directory, 'src', 'main.ts'), formats: ['es'], fileName: 'main' },
      outDir: path.join(directory, 'dist'),
    },
  });

  it('generates the client before building', async () => {
    const directory = await project('vite-build');
    const { logger, lines } = capture();
    await build(buildConfig(directory, logger));
    expect(await readFile(path.join(directory, 'dist', 'main.js'), 'utf8')).toContain('/pets');
    expect(lines.some((line) => /^info \(swaggerz\) Generated \d+ files/.test(line))).toBe(true);
  });

  it('checks a committed client with build: "check"', async () => {
    const directory = await project('vite-build-check');
    const { logger, lines } = capture();
    await build(buildConfig(directory, logger));
    await build(buildConfig(directory, logger, { build: 'check' }));
    expect(lines.some((line) => /src\/generated\/api is up to date/.test(line))).toBe(true);

    await writeFile(path.join(directory, 'openapi.yaml'), spec('listAllPets'));
    await expect(build(buildConfig(directory, logger, { build: 'check' }))).rejects.toThrow(
      /src\/generated\/api is out of date/,
    );
  });

  it('fails the build when the client cannot be generated', async () => {
    const directory = await project('vite-build-error');
    await rm(path.join(directory, 'swaggerz.config.mjs'));
    const { logger } = capture();
    await expect(build(buildConfig(directory, logger))).rejects.toThrow(/No config file found/);
  });

  it('leaves the client alone with build: false', async () => {
    const directory = await project('vite-build-off');
    await mkdir(path.join(directory, 'src', 'generated', 'api'), { recursive: true });
    await writeFile(
      path.join(directory, 'src', 'generated', 'api', 'index.ts'),
      'export const listPets = () => "/pets";\n',
    );
    const { logger } = capture();
    await build(buildConfig(directory, logger, { build: false }));
    expect(await readFile(path.join(directory, 'dist', 'main.js'), 'utf8')).toContain('/pets');
  });

  it('builds again when the specification changes in watch mode', async () => {
    const directory = await project('vite-build-watch');
    const { logger } = capture();
    const watching = buildConfig(directory, logger);
    const watcher = (await build({ ...watching, build: { ...watching.build, watch: {} } })) as {
      on(event: 'event', listener: (event: { code: string }) => void): void;
      close(): Promise<void>;
    };
    closers.push(() => watcher.close());
    let builds = 0;
    watcher.on('event', (event) => {
      if (event.code === 'END') builds++;
    });
    const output = path.join(directory, 'dist', 'main.js');
    // The first build creates the client; the watcher may build once more for the new files.
    await vi.waitFor(async () => {
      expect(builds).toBeGreaterThan(0);
      expect(await readFile(output, 'utf8')).toContain('/pets');
    });
    // The app imports listPets: change its path, not its name.
    await edit(
      path.join(directory, 'openapi.yaml'),
      spec('listPets').replace('/pets:', '/animals:'),
      // A rebuild empties dist/ first.
      async () => (await readFile(output, 'utf8').catch(() => '')).includes('/animals'),
    );
  });
});
