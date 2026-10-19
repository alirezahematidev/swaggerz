import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/load.ts';
import { validateUserConfig } from '../../../src/config/validate.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { REPO_ROOT } from '../../helpers.ts';

const DIR = path.join(REPO_ROOT, 'tests', '.output', 'config-unit');

async function configFile(name: string, source: string): Promise<string> {
  await mkdir(DIR, { recursive: true });
  const file = path.join(DIR, name);
  await writeFile(file, source);
  return file;
}

describe('config validation', () => {
  it('accepts a complete configuration', () => {
    expect(
      validateUserConfig({
        spec: {
          version: '3.1',
          input: './openapi.yaml',
          refs: { external: 'remote', allowedHosts: ['schemas.example.com'] },
        },
        output: {
          directory: './api',
          language: 'javascript',
          declarations: false,
          importExtension: 'none',
          groupBy: 'none',
        },
        client: {
          adapter: 'axios',
          baseUrl: 'https://api.example.com',
          timeout: 5000,
          includeCredentials: true,
        },
        features: {
          reactQuery: { queryMethods: ['get', 'head'] },
          jsdoc: false,
          validation: 'zod',
        },
        naming: { operations: 'snake_case', parameters: 'camelCase' },
        types: { enums: 'const' },
        dashboard: { port: 0, usage: { include: ['app'] } },
        plugins: [{ name: 'x', beforeParse: () => undefined }],
        hooks: { afterGenerate: () => undefined },
      }),
    ).toEqual([]);
  });

  it('reports precise, actionable issues', () => {
    expect(
      validateUserConfig({
        spec: { version: '3.2', input: '' },
        output: { langauge: 'typescript', clean: 'yes' },
        client: { adapter: 'fech' },
        plugins: [{}],
      }),
    ).toEqual([
      {
        path: 'spec.version',
        message: 'Expected one of "2.0", "3.0", "3.1", "auto" but received "3.2".',
        hint: 'Did you mean "3.0"?',
      },
      { path: 'spec.input', message: 'Expected a non-empty string.' },
      { path: 'output.langauge', message: 'Unknown option.', hint: 'Did you mean "language"?' },
      { path: 'output.clean', message: 'Expected a boolean but received a string.' },
      {
        path: 'client.adapter',
        message: 'Expected one of "fetch", "axios" but received "fech".',
        hint: 'Did you mean "fetch"?',
      },
      { path: 'plugins[0].name', message: 'This option is required.' },
    ]);
    expect(validateUserConfig({})).toEqual([{ path: 'spec', message: 'This option is required.' }]);
  });
});

describe('config loading', () => {
  it('loads TypeScript config files, functions and environment overrides', async () => {
    await rm(DIR, { recursive: true, force: true });
    const file = await configFile(
      'swaggerz.config.ts',
      [
        "import type { ConfigEnv } from '../../../src/config/types.ts';",
        'export default (env: ConfigEnv) => ({',
        "  spec: { version: '3.0' as const, input: './spec.yaml' },",
        "  output: { directory: env.command === 'generate' ? './generated' : './other' },",
        '});',
      ].join('\n'),
    );
    const loaded = await loadConfig({
      cwd: DIR,
      command: 'generate',
      env: {
        SWAGGERZ_OUTPUT_LANGUAGE: 'javascript',
        SWAGGERZ_CLIENT_BASE_URL: 'https://env.example.com',
      },
    });
    expect(loaded.file).toBe(file);
    expect(loaded.config.output.directory).toBe(path.join(DIR, 'generated'));
    expect(loaded.config.output.language).toBe('javascript');
    expect(loaded.config.client.baseUrl).toBe('https://env.example.com');
    expect(loaded.config.spec.input).toBe(path.join(DIR, 'spec.yaml'));
    expect(loaded.envApplied).toEqual(['SWAGGERZ_OUTPUT_LANGUAGE', 'SWAGGERZ_CLIENT_BASE_URL']);
  });

  it('orders plugins and inline hooks deterministically', async () => {
    const loaded = await loadConfig({
      cwd: DIR,
      inlineConfig: {
        spec: { version: '3.0', input: 'x.yaml' },
        plugins: [
          { name: 'post', enforce: 'post' },
          { name: 'normal' },
          { name: 'pre', enforce: 'pre' },
        ],
        hooks: { afterGenerate: () => undefined },
      },
    });
    expect(loaded.plugins.map((p) => p.name)).toEqual(['pre', 'normal', 'config.hooks', 'post']);
  });

  it('explains load failures and missing config files', async () => {
    await rm(DIR, { recursive: true, force: true });
    const missing = await loadConfig({ cwd: DIR }).catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(SwaggerzError);
    expect((missing as SwaggerzError).diagnostics[0]).toMatchObject({
      code: 'config/not-found',
      hint: expect.stringContaining('init'),
    });

    await configFile('swaggerz.config.mjs', 'export default { spec: { version: "3.0" } };\n');
    const invalid = await loadConfig({ cwd: DIR }).catch((e: unknown) => e);
    expect((invalid as SwaggerzError).diagnostics[0]).toMatchObject({
      code: 'config/invalid',
      message: 'spec.input: This option is required.',
    });

    await configFile('swaggerz.config.mjs', 'throw new Error("boom");\n');
    const broken = await loadConfig({ cwd: DIR }).catch((e: unknown) => e);
    expect((broken as SwaggerzError).diagnostics[0]).toMatchObject({
      code: 'config/load-failed',
      message: expect.stringContaining('boom'),
    });
  });
});
