import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AstroIntegration } from 'astro';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import swaggerzAstro, { type SwaggerzAstroOptions } from '../../../src/integrations/astro.ts';
import type { GenerationSession } from '../../../src/integrations/core.ts';
import { withSwaggerz } from '../../../src/integrations/next.ts';
import { createProject } from '../../support/project.ts';

const spec = (operation: string): string => `openapi: 3.0.3
info: { title: Pets, version: '1' }
paths:
  /pets:
    get:
      operationId: ${operation}
      responses:
        '204': { description: Done. }
`;

function project(name: string): Promise<string> {
  return createProject(name, {
    config: { spec: { version: '3.0', input: './openapi.yaml' } },
    files: { 'openapi.yaml': spec('listPets') },
  });
}

const generated = (directory: string): string =>
  path.join(directory, 'src', 'generated', 'api', 'index.ts');

type SetupHook = NonNullable<AstroIntegration['hooks']['astro:config:setup']>;
type SetupOptions = Parameters<SetupHook>[0];

/** Runs the integration's `astro:config:setup` hook with the parts of Astro it uses. */
async function setup(
  directory: string,
  command: SetupOptions['command'],
  options?: SwaggerzAstroOptions,
): Promise<{ lines: string[]; updates: unknown[] }> {
  const lines: string[] = [];
  const updates: unknown[] = [];
  const log =
    (level: string) =>
    (message: string): void => {
      lines.push(`${level} ${message}`);
    };
  const hook = swaggerzAstro(options).hooks['astro:config:setup'];
  await hook?.({
    config: { root: pathToFileURL(`${directory}/`) },
    command,
    updateConfig: (update: unknown) => {
      updates.push(update);
      return {};
    },
    logger: { info: log('info'), warn: log('warn'), error: log('error') },
  } as unknown as SetupOptions);
  return { lines, updates };
}

describe('swaggerz/astro', () => {
  it('adds the Vite plugin for astro dev, which generates and watches', async () => {
    const directory = await project('astro-dev');
    const { updates } = await setup(directory, 'dev');
    expect(updates).toEqual([
      { vite: { plugins: [expect.objectContaining({ name: 'swaggerz' })] } },
    ]);
    // The plugin generates when Vite's dev server starts, not here.
    expect(existsSync(generated(directory))).toBe(false);
  });

  it('generates for astro build and astro sync', async () => {
    for (const command of ['build', 'sync'] as const) {
      const directory = await project(`astro-${command}`);
      const { lines, updates } = await setup(directory, command);
      expect(updates).toEqual([]);
      expect(await readFile(generated(directory), 'utf8')).toContain('list-pets');
      expect(lines).toEqual([
        expect.stringMatching(/^info Generated \d+ files in src\/generated\/api/),
      ]);
    }
  });

  it('fails the build when the client cannot be generated or is out of date', async () => {
    const directory = await project('astro-build-error');
    await setup(directory, 'build');
    await writeFile(path.join(directory, 'openapi.yaml'), spec('listAllPets'));
    await expect(setup(directory, 'build', { build: 'check' })).rejects.toThrow(
      /^swaggerz: src\/generated\/api is out of date/,
    );
    await rm(path.join(directory, 'swaggerz.config.mjs'));
    await expect(setup(directory, 'build')).rejects.toThrow(/^swaggerz: No config file found\./);
  });

  it('does nothing for astro preview or with build: false', async () => {
    const directory = await project('astro-preview');
    await setup(directory, 'preview');
    await setup(directory, 'build', { build: false });
    expect(existsSync(generated(directory))).toBe(false);
  });
});

describe('swaggerz/next', () => {
  const STATE = Symbol.for('swaggerz.next');
  const state = (): { dev?: Promise<GenerationSession> } =>
    (globalThis as { [STATE]?: { dev?: Promise<GenerationSession> } })[STATE] ?? {};
  const reset = async (): Promise<void> => {
    await (await state().dev)?.close();
    Reflect.deleteProperty(globalThis, STATE);
    delete process.env['SWAGGERZ_NEXT_GENERATED'];
  };
  beforeEach(reset);
  afterEach(reset);

  it('generates once per build, in the first process that loads the config', async () => {
    const directory = await project('next-build');
    const config = withSwaggerz({ reactStrictMode: true }, { cwd: directory });
    expect(await config('phase-production-build', { defaultConfig: {} as never })).toEqual({
      reactStrictMode: true,
    });
    expect(await readFile(generated(directory), 'utf8')).toContain('list-pets');
    // Build workers inherit the marker: no second generation.
    expect(process.env['SWAGGERZ_NEXT_GENERATED']).toBe('1');
    await writeFile(path.join(directory, 'openapi.yaml'), spec('listAllPets'));
    await config('phase-production-build', { defaultConfig: {} as never });
    expect(await readFile(generated(directory), 'utf8')).toContain('list-pets');
  });

  it('passes the phase to a config function and fails the build on errors', async () => {
    const directory = await project('next-function');
    await rm(path.join(directory, 'swaggerz.config.mjs'));
    const phases: string[] = [];
    const config = withSwaggerz(
      (phase) => {
        phases.push(phase);
        return { output: 'export' as const };
      },
      { cwd: directory },
    );
    await expect(config('phase-production-build', { defaultConfig: {} as never })).rejects.toThrow(
      /^swaggerz: No config file found\./,
    );
    expect(await config('phase-production-server', { defaultConfig: {} as never })).toEqual({
      output: 'export',
    });
    expect(phases).toEqual(['phase-production-server']);
    expect(process.env['SWAGGERZ_NEXT_GENERATED']).toBeUndefined();
  });

  it('starts one watching session for the dev server', async () => {
    const directory = await project('next-dev');
    const config = withSwaggerz({}, { cwd: directory });
    await config('phase-development-server', { defaultConfig: {} });
    const session = await state().dev;
    // Loading the config again in the same process reuses the session.
    await config('phase-development-server', { defaultConfig: {} });
    expect(await state().dev).toBe(session);
    expect(await readFile(generated(directory), 'utf8')).toContain('list-pets');
  });
});
