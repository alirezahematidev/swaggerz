import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_EXTENSIONS, loadConfig } from '../../../src/config/load.ts';
import type { JsonSchema } from '../../../src/config/schema.ts';
import { configJsonSchema, HOOK_NAMES } from '../../../src/config/validate.ts';
import { configTemplate, type InitAnswers } from '../../../src/cli/commands/init.ts';
import { SwaggerzError } from '../../../src/diagnostics/bag.ts';
import { withTempDir } from '../../helpers.ts';

async function write(dir: string, file: string, content: string): Promise<string> {
  const target = path.join(dir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  return target;
}

async function failure(promise: Promise<unknown>): Promise<SwaggerzError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SwaggerzError);
  return error as SwaggerzError;
}

const ANSWERS: InitAnswers = {
  input: './specs/it\'s "quoted".yaml',
  version: '3.0',
  output: './src/api',
  language: 'typescript',
  adapter: 'axios',
  reactQuery: true,
};

describe('config file formats', () => {
  it('supports every documented extension', () => {
    expect(CONFIG_EXTENSIONS).toEqual([
      '.ts',
      '.mts',
      '.cts',
      '.js',
      '.mjs',
      '.cjs',
      '.json',
      '.yaml',
      '.yml',
    ]);
  });

  it.each(['json', 'yaml'] as const)('loads %s configs written by init', (format) =>
    withTempDir(async (dir) => {
      const file = await write(dir, `swaggerz.config.${format}`, configTemplate(ANSWERS, format));
      const loaded = await loadConfig({ cwd: dir });
      expect(loaded.file).toBe(file);
      expect(loaded.config.spec).toMatchObject({
        version: '3.0',
        input: path.join(dir, 'specs', 'it\'s "quoted".yaml'),
      });
      expect(loaded.config.output.directory).toBe(path.join(dir, 'src', 'api'));
      expect(loaded.config.client.adapter).toBe('axios');
      expect(loaded.config.features.query).toMatchObject({ framework: 'react' });
    }),
  );

  it('loads .yml files and data configs from an explicit path', () =>
    withTempDir(async (dir) => {
      await write(dir, 'conf/swaggerz.config.yml', 'spec:\n  version: "2.0"\n  input: s.json\n');
      const loaded = await loadConfig({ cwd: dir, configFile: 'conf/swaggerz.config.yml' });
      expect(loaded.config.spec.input).toBe(path.join(dir, 'conf', 's.json'));
    }));

  it('reports syntax errors with positions and validates data configs', () =>
    withTempDir(async (dir) => {
      await write(dir, 'swaggerz.config.yaml', 'spec:\n  version: "3.1"\n  input: [unclosed\n');
      const yaml = await failure(loadConfig({ cwd: dir }));
      expect(yaml.diagnostics[0]).toMatchObject({
        code: 'config/load-failed',
        location: { file: path.join(dir, 'swaggerz.config.yaml'), line: expect.any(Number) },
      });

      await write(dir, 'swaggerz.config.json', '{ "spec": { "version": "3.1", }');
      const json = await failure(loadConfig({ cwd: dir, configFile: 'swaggerz.config.json' }));
      expect(json.diagnostics[0]?.location?.line).toBe(1);

      await write(
        dir,
        'swaggerz.config.json',
        JSON.stringify({ spec: { version: '3.1', input: 'a.yaml' }, ouput: {} }),
      );
      const invalid = await failure(loadConfig({ cwd: dir, configFile: 'swaggerz.config.json' }));
      expect(invalid.diagnostics[0]).toMatchObject({
        code: 'config/invalid',
        hint: 'Did you mean "output"?',
      });
    }));

  it('reports the line and column of validation errors in JSON and YAML configs', () =>
    withTempDir(async (dir) => {
      await write(
        dir,
        'swaggerz.config.yaml',
        'spec:\n  version: "3.1"\n  input: a.yaml\noutput:\n  clean: "yes"\n',
      );
      const yaml = await failure(loadConfig({ cwd: dir }));
      expect(yaml.diagnostics[0]).toMatchObject({
        code: 'config/invalid',
        message: 'output.clean: Expected a boolean but received a string.',
        location: { file: path.join(dir, 'swaggerz.config.yaml'), line: 5, column: 3 },
      });
      // A wrong value from an environment variable has no position in the file.
      await write(
        dir,
        'env/swaggerz.config.yaml',
        'spec:\n  version: "3.1"\n  input: a.yaml\nclient:\n  adapter: fetch\n',
      );
      const fromEnv = await failure(
        loadConfig({ cwd: path.join(dir, 'env'), env: { SWAGGERZ_CLIENT_ADAPTER: 'fech' } }),
      );
      expect(fromEnv.diagnostics[0]).toMatchObject({ message: expect.stringContaining('"fech"') });
      expect(fromEnv.diagnostics[0]?.location?.line).toBeUndefined();

      await write(
        dir,
        'swaggerz.config.json',
        JSON.stringify({ spec: { version: '3.1', input: 'a.yaml' }, ouput: {} }, null, 2),
      );
      const json = await failure(loadConfig({ cwd: dir, configFile: 'swaggerz.config.json' }));
      expect(json.diagnostics[0]).toMatchObject({
        message: 'ouput: Unknown option.',
        location: { line: 6, column: 3 },
      });
    }));

  it('suggests quoting spec.version when YAML reads it as a number', () =>
    withTempDir(async (dir) => {
      await write(dir, 'swaggerz.config.yaml', 'spec:\n  version: 3.1\n  input: a.yaml\n');
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]).toMatchObject({
        message:
          'spec.version: Expected one of "2.0", "3.0", "3.1", "3.2", "auto" but received the number 3.1.',
        hint: expect.stringContaining('Quote the value: "3.1"') as string,
      });
      await write(dir, 'swaggerz.config.yaml', 'spec:\n  version: 3.0\n  input: a.yaml\n');
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]).toMatchObject({
        message: expect.stringContaining('but received the number 3.') as string,
        hint: expect.stringContaining('Quote the value: "3.0"') as string,
      });
    }));

  it('treats Object.prototype member names as unknown options', () =>
    withTempDir(async (dir) => {
      await write(
        dir,
        'swaggerz.config.json',
        '{ "spec": { "version": "3.1", "input": "a.yaml" }, "__proto__": { "x": 1 }, "output": { "valueOf": 1, "constructor": 2 } }',
      );
      const error = await failure(loadConfig({ cwd: dir }));
      expect(error.diagnostics.map((d) => [d.code, d.message])).toEqual([
        ['config/invalid', '__proto__: Unknown option.'],
        ['config/invalid', 'output.valueOf: Unknown option.'],
        ['config/invalid', 'output.constructor: Unknown option.'],
      ]);
    }));

  it('prefers code configs over data configs in the same directory', () =>
    withTempDir(async (dir) => {
      await write(dir, 'swaggerz.config.yaml', 'spec: { version: "3.0", input: yaml.yaml }\n');
      const mjs = await write(
        dir,
        'swaggerz.config.mjs',
        'export default { spec: { version: "3.0", input: "mjs.yaml" } };\n',
      );
      expect((await loadConfig({ cwd: dir })).file).toBe(mjs);
    }));
});

describe('plugin references', () => {
  it('loads plugins and plugin factories by path, with options, from data configs', () =>
    withTempDir(async (dir) => {
      await write(
        dir,
        'plugins/plain.mjs',
        "export default { name: 'plain', enforce: 'post', generate: () => [] };\n",
      );
      await write(
        dir,
        'plugins/factory.ts',
        [
          'interface Options { prefix: string }',
          'export default (options: Options) => ({',
          '  name: `factory:${options.prefix}`,',
          '  operationName: (_operation: unknown, suggested: string) => options.prefix + suggested,',
          '});',
        ].join('\n'),
      );
      await write(
        dir,
        'swaggerz.config.yaml',
        [
          'spec: { version: "3.0", input: spec.yaml }',
          'plugins:',
          '  - ./plugins/plain.mjs',
          '  - [./plugins/factory.ts, { prefix: api }]',
        ].join('\n'),
      );
      const loaded = await loadConfig({ cwd: dir });
      expect(loaded.plugins.map((p) => p.name)).toEqual(['factory:api', 'plain']);
      expect(loaded.plugins[0]?.operationName?.({} as never, 'Get')).toBe('apiGet');
    }));

  it('resolves packages, including ESM-only packages that export only an import condition', () =>
    withTempDir(async (dir) => {
      await write(
        dir,
        'node_modules/@acme/swaggerz-plugin/package.json',
        JSON.stringify({
          name: '@acme/swaggerz-plugin',
          type: 'module',
          exports: { '.': { import: './dist/index.js' } },
        }),
      );
      await write(
        dir,
        'node_modules/@acme/swaggerz-plugin/dist/index.js',
        'export default (options = {}) => ({ name: `acme:${JSON.stringify(options)}` });\n',
      );
      await write(
        dir,
        'swaggerz.config.json',
        JSON.stringify({
          spec: { version: '3.0', input: 'spec.yaml' },
          plugins: [['@acme/swaggerz-plugin', { level: 2 }]],
        }),
      );
      const loaded = await loadConfig({ cwd: dir });
      expect(loaded.plugins).toEqual([{ name: 'acme:{"level":2}' }]);
    }));

  it('lists local plugin modules and loads their changes on the next load', () =>
    withTempDir(async (dir) => {
      const esm = await write(dir, 'plugins/esm.mjs', "export default { name: 'esm-v1' };\n");
      const cjs = await write(dir, 'plugins/cjs.cjs', "module.exports = { name: 'cjs-v1' };\n");
      await write(
        dir,
        'node_modules/pkg-plugin/package.json',
        JSON.stringify({ name: 'pkg-plugin', main: 'index.js' }),
      );
      await write(dir, 'node_modules/pkg-plugin/index.js', "module.exports = { name: 'pkg' };\n");
      await write(
        dir,
        'swaggerz.config.json',
        JSON.stringify({
          spec: { version: '3.0', input: 'spec.yaml' },
          plugins: ['./plugins/esm.mjs', './plugins/cjs.cjs', 'pkg-plugin'],
        }),
      );
      const first = await loadConfig({ cwd: dir });
      expect(first.plugins.map((p) => p.name)).toEqual(['esm-v1', 'cjs-v1', 'pkg']);
      // Packages are not watched; local modules are.
      expect(first.watchFiles).toEqual([cjs, esm]);

      await writeFile(esm, "export default { name: 'esm-v2' };\n");
      await writeFile(cjs, "module.exports = { name: 'cjs-v2' };\n");
      expect((await loadConfig({ cwd: dir })).plugins.map((p) => p.name)).toEqual([
        'esm-v2',
        'cjs-v2',
        'pkg',
      ]);
    }));

  it('reports a malformed package.json of a plugin package as a load failure', () =>
    withTempDir(async (dir) => {
      await write(dir, 'node_modules/broken-plugin/package.json', '{ "name": ');
      await write(
        dir,
        'swaggerz.config.json',
        JSON.stringify({
          spec: { version: '3.0', input: 'spec.yaml' },
          plugins: ['broken-plugin'],
        }),
      );
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]).toMatchObject({
        code: 'config/plugin-load-failed',
        message: expect.stringContaining('is not valid JSON') as string,
      });
    }));

  it('explains plugin reference failures', () =>
    withTempDir(async (dir) => {
      const config = (plugins: unknown[]) =>
        write(
          dir,
          'swaggerz.config.json',
          JSON.stringify({ spec: { version: '3.0', input: 'spec.yaml' }, plugins }),
        );
      await write(dir, 'object.mjs', "export default { name: 'object' };\n");
      await write(dir, 'nameless.mjs', 'export default { generate() {} };\n');

      await config(['./missing.mjs']);
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]).toMatchObject({
        code: 'config/plugin-load-failed',
        message: expect.stringContaining('module not found'),
      });
      await config([['./object.mjs', { a: 1 }]]);
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]?.message).toContain(
        'exports a plugin object instead of a function',
      );
      await config(['./nameless.mjs']);
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]?.message).toContain(
        'not a plugin: name: This option is required.',
      );
      await config([[]]);
      expect((await failure(loadConfig({ cwd: dir }))).diagnostics[0]).toMatchObject({
        code: 'config/invalid',
        message: expect.stringContaining('plugins[0]'),
      });
    }));
});

describe('config JSON Schema', () => {
  const schema = configJsonSchema();
  const properties = (node: JsonSchema): Record<string, JsonSchema> =>
    (node.properties ?? {}) as Record<string, JsonSchema>;

  it('documents every option and leaves out function-only options', () => {
    const undocumented: string[] = [];
    const visit = (node: JsonSchema, at: string): void => {
      for (const [key, child] of Object.entries(properties(node))) {
        const location = at === '' ? key : `${at}.${key}`;
        if (typeof child.description !== 'string') undocumented.push(location);
        visit(child, location);
        for (const branch of (child.anyOf ?? []) as JsonSchema[]) visit(branch, location);
      }
    };
    visit(schema, '');
    expect(undocumented).toEqual([]);
    expect(Object.keys(properties(schema))).not.toContain('hooks');
    // `jsdoc` is also the name of a real option (features.jsdoc).
    const hooks = HOOK_NAMES.filter((name) => name !== 'jsdoc');
    expect(JSON.stringify(schema)).not.toMatch(new RegExp(`"(${hooks.join('|')})"`));
  });

  it('describes plugin references and rejects unknown options', () => {
    const plugins = properties(schema).plugins as { items: { anyOf: JsonSchema[] } };
    expect(plugins.items.anyOf.map((branch) => branch.type)).toEqual(['string', 'array']);
    expect(schema).toMatchObject({
      additionalProperties: false,
      required: ['spec'],
      properties: {
        spec: { required: ['version', 'input'] },
        types: { properties: { readWrite: { enum: ['split', 'merged'], default: 'split' } } },
      },
    });
  });
});
