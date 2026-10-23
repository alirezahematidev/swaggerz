import { mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SwaggerzPlugin } from '../../../src/plugins/types.ts';
import { generate } from '../../../src/api.ts';
import { runGeneration } from '../../../src/pipeline/generate.ts';
import { MANIFEST_FILENAME } from '../../../src/meta.ts';
import { codes, fixture, makeConfig, REPO_ROOT } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, typecheck } from '../../support/typescript.ts';

const read = (dir: string, file: string): Promise<string> => readFile(path.join(dir, file), 'utf8');

describe('naming and escaping edge cases', () => {
  it('resolves collisions deterministically and compiles', async () => {
    const { directory, result } = await generateCase('edge-cases', {
      spec: { version: '3.0', input: fixture('edge-cases-3.0.yaml') },
      types: { enums: 'const' },
    });
    // Output-relative paths with `/`, as on every platform the manifest records them.
    const files = (await listFiles(directory, '.ts')).map((f) =>
      path.relative(directory, f).split(path.sep).join('/'),
    );
    expect(files).toContain('items-things/list.ts');
    expect(files).toContain('items-things/list2.ts');
    expect(files).toContain('models-api/delete-items-by-id.ts');
    expect(files).toContain('models/item.ts');
    expect(files).toContain('models/item2.ts');
    // Different export names, same file name on case-insensitive file systems.
    expect(files).toContain('models/http-error.ts');
    expect(files).toContain('models/http-error-2.ts');
    expect(codes(result.diagnostics)).toContain('operation/duplicate-id');
    expect(codes(result.diagnostics)).toContain('naming/collision');

    const list = await read(directory, 'items-things/list.ts');
    expect(list).toContain(
      'Lists items. This description contains *\\/ which must not end the comment.',
    );
    expect(list).toContain(' * \\@internal must not become a tag.');
    expect(list).toContain(
      "query: { default: params?.default, 'page[size]': params?.['page[size]'] }",
    );
    expect(await read(directory, 'items-things/list2.ts')).toContain('export function list2(');

    const item = await read(directory, 'models/item.ts');
    expect(item).toContain("import type { Blob as BlobModel } from './blob.js';");
    expect(item).toContain('blob?: BlobModel;');
    expect(item).toContain('"quote\'d"?: string;'.replace('"quote\'d"', "'quote\\'d'"));
    const status = await read(directory, 'models/status.ts');
    expect(status).toContain(
      "export const Status = {\n  Active: 'active',\n  InProgress: 'in-progress',\n  Empty: '',\n} as const;",
    );
    expect(await read(directory, 'models/priority.ts')).toContain('Value1: 1,');
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
  });
});

describe('deterministic and safe output', () => {
  const spec = { version: '3.0' as const, input: fixture('petstore-3.0.yaml') };

  it('produces identical output and rewrites nothing on a second run', async () => {
    const { directory } = await generateCase('determinism', { spec });
    const before = await stat(path.join(directory, 'pet/get-pet-by-id.ts'));
    const snapshot = await Promise.all(
      (await listFiles(directory)).map((f) => readFile(f, 'utf8')),
    );
    const second = await runGeneration({ config: makeConfig({ spec, output: { directory } }) });
    expect(second.write?.created).toEqual([]);
    expect(second.write?.updated).toEqual([]);
    expect(second.write?.unchanged.length).toBe(second.files.length);
    expect((await stat(path.join(directory, 'pet/get-pet-by-id.ts'))).mtimeMs).toBe(before.mtimeMs);
    expect(await Promise.all((await listFiles(directory)).map((f) => readFile(f, 'utf8')))).toEqual(
      snapshot,
    );
  });

  it('removes stale generated files but keeps hand-edited ones', async () => {
    const { directory } = await generateCase('stale', { spec });
    await writeFile(path.join(directory, 'user/login-user.ts'), '// my edits\n');
    const result = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      plugins: [
        {
          name: 'drop-user-ops',
          afterNormalize: (ir) => ({
            ...ir,
            operations: ir.operations.filter((op) => !op.tags.includes('user')),
          }),
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.write?.deleted).toEqual(['user/get-user-by-name.ts', 'user/logout-user.ts']);
    expect(codes(result.diagnostics)).toContain('output/edited-stale-file');
    expect(await read(directory, 'user/login-user.ts')).toBe('// my edits\n');
    const manifest = JSON.parse(await read(directory, MANIFEST_FILENAME)) as {
      files: Record<string, string>;
    };
    expect(Object.keys(manifest.files)).not.toContain('user/get-user-by-name.ts');
  });

  it('never overwrites files it does not own', async () => {
    const directory = path.join(OUTPUT_ROOT, 'conflict');
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'client.ts'), 'export const mine = 1;\n');
    const result = await runGeneration({ config: makeConfig({ spec, output: { directory } }) });
    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('output/user-file');
    expect(await read(directory, 'client.ts')).toBe('export const mine = 1;\n');
    expect(await listFiles(directory)).toEqual([path.join(directory, 'client.ts')]);

    const forced = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      force: true,
    });
    expect(forced.ok).toBe(true);
    expect(await read(directory, 'client.ts')).toContain('@generated by');
  });

  it('writes nothing when generation fails or in dry-run mode', async () => {
    const directory = path.join(OUTPUT_ROOT, 'failure');
    await rm(directory, { recursive: true, force: true });
    const failing = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      plugins: [
        {
          name: 'explodes',
          afterGenerate: () => {
            throw new Error('kaboom');
          },
        },
      ],
    });
    expect(failing.ok).toBe(false);
    expect(failing.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'plugin/hook-failed',
        plugin: 'explodes',
        message: expect.stringContaining('afterGenerate hook: kaboom'),
      }),
    );
    await expect(stat(directory)).rejects.toThrow(/ENOENT/);

    const dry = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      dryRun: true,
    });
    expect(dry.write?.dryRun).toBe(true);
    expect(dry.write?.created.length).toBeGreaterThan(10);
    await expect(stat(directory)).rejects.toThrow(/ENOENT/);
  });

  it('refuses output directories that contain the project', async () => {
    const result = await runGeneration({
      config: makeConfig({ spec, output: { directory: REPO_ROOT } }),
    });
    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('config/unsafe-output');
  });

  it('sees through symbolic links and letter case when checking the output directory', async () => {
    const project = path.join(OUTPUT_ROOT, 'unsafe-project');
    await rm(project, { recursive: true, force: true });
    await mkdir(project, { recursive: true });
    await symlink('.', path.join(project, 'self'), 'dir');
    const unsafe = async (directory: string): Promise<boolean> => {
      const result = await runGeneration({
        config: makeConfig({ spec, output: { directory } }, project),
        dryRun: true,
      });
      return codes(result.diagnostics).includes('config/unsafe-output');
    };
    expect(await unsafe('./self')).toBe(true);
    expect(await unsafe('./self/api')).toBe(false);
    // `../UNSAFE-PROJECT` is the project itself where the file system ignores letter case.
    const variant = path.join(OUTPUT_ROOT, 'UNSAFE-PROJECT');
    const caseInsensitive = await stat(variant).then(
      () => true,
      () => false,
    );
    expect(await unsafe(variant)).toBe(caseInsensitive);
  });

  it('keeps every file when the file naming style changes only the letter case', async () => {
    const { directory } = await generateCase('case-rename', { spec });
    const renamed = makeConfig({ spec, output: { directory }, naming: { files: 'PascalCase' } });
    const result = await runGeneration({ config: renamed });
    expect(result.ok).toBe(true);
    expect(result.write?.created).toContain('models/Pet.ts');
    expect(result.write?.deleted).toContain('models/pet.ts');
    const onDisk = (await listFiles(directory)).map((f) =>
      path.relative(directory, f).split(path.sep).join('/'),
    );
    expect(onDisk).toEqual(
      [MANIFEST_FILENAME, ...result.files.map((f) => f.path)].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    );
    const check = await runGeneration({ config: renamed, dryRun: true });
    expect(check.manifestChange).toBe('unchanged');
    expect(check.write?.unchanged).toHaveLength(result.files.length);
  });

  it('reports file system conflicts from the programmatic API as diagnostics', async () => {
    const cwd = path.join(OUTPUT_ROOT, 'api-conflict');
    await rm(cwd, { recursive: true, force: true });
    await mkdir(path.join(cwd, 'api'), { recursive: true });
    // A user file where the generator needs the `models` directory.
    await writeFile(path.join(cwd, 'api', 'models'), 'notes\n');
    const result = await generate({ cwd, config: { spec, output: { directory: './api' } } });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'output/user-file',
        message: expect.stringContaining('models is a file, not a directory'),
      }),
    );
    expect(await listFiles(path.join(cwd, 'api'))).toEqual([path.join(cwd, 'api', 'models')]);
  });
});

describe('plugins', () => {
  it('runs hooks in a deterministic order with typed extension points', async () => {
    const calls: string[] = [];
    const track = (name: string): SwaggerzPlugin => ({
      name,
      beforeParse: () => {
        calls.push(`${name}:beforeParse`);
      },
      beforeGenerate: () => {
        calls.push(`${name}:beforeGenerate`);
      },
    });
    const custom: SwaggerzPlugin = {
      name: 'custom',
      beforeParse(document) {
        const doc = document as { paths: Record<string, Record<string, { operationId?: string }>> };
        const op = doc.paths['/user/logout']?.get;
        if (op !== undefined) op.operationId = 'signOut';
        return doc;
      },
      operationName: (operation, suggested) =>
        operation.operationId === 'getInventory' ? 'fetchStock' : suggested,
      modelName: (definition) => (definition.name === 'Tag' ? 'Label' : undefined),
      jsdoc: (block, target) =>
        target.kind === 'operation'
          ? { ...block, tags: [...block.tags, { tag: 'since', text: '1.0' }] }
          : block,
      // An equivalent path, so the rewritten imports still resolve.
      resolveImport: ({ specifier }) =>
        specifier.startsWith('../client') ? `./${specifier}` : undefined,
      generate: (ctx) => [
        {
          path: 'meta/operations.json',
          content: JSON.stringify(ctx.project.operations.map((o) => o.name)),
          origin: 'x',
        },
      ],
      transformFile: (file) =>
        file.path.endsWith('.ts')
          ? { ...file, content: `${file.content}// transformed\n` }
          : undefined,
      afterNormalize(ir, ctx) {
        ctx.report({
          code: 'custom/note',
          severity: 'info',
          message: `${ir.operations.length} operations`,
        });
      },
    };
    const { directory, result } = await generateCase(
      'plugins',
      { spec: { version: '3.0', input: fixture('petstore-3.0.yaml') } },
      [
        { ...track('post'), enforce: 'post' },
        track('normal'),
        { ...track('pre'), enforce: 'pre' },
        custom,
      ],
    );
    expect(calls).toEqual([
      'pre:beforeParse',
      'normal:beforeParse',
      'post:beforeParse',
      'pre:beforeGenerate',
      'normal:beforeGenerate',
      'post:beforeGenerate',
    ]);
    expect(await read(directory, 'user/sign-out.ts')).toContain('export function signOut(');
    expect(await read(directory, 'store/fetch-stock.ts')).toContain('export function fetchStock(');
    expect(await read(directory, 'models/label.ts')).toContain('export type Label = {');
    expect(await read(directory, 'pet/get-pet-by-id.ts')).toContain('@since 1.0');
    expect(await read(directory, 'pet/get-pet-by-id.ts')).toContain("from './../client.js';");
    expect(await read(directory, 'pet/get-pet-by-id.ts')).toMatch(/\/\/ transformed\n$/);
    expect(JSON.parse(await read(directory, 'meta/operations.json'))).toContain('fetchStock');
    expect(result.files.find((f) => f.path === 'meta/operations.json')?.origin).toBe(
      'plugin:custom',
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'custom/note', plugin: 'custom' }),
    );
  });

  it('stops before writing when beforeWrite reports an error and keeps later diagnostics', async () => {
    const spec = { version: '3.0' as const, input: fixture('petstore-3.0.yaml') };
    const directory = path.join(OUTPUT_ROOT, 'before-write');
    await rm(directory, { recursive: true, force: true });
    const blocked = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      plugins: [
        {
          name: 'gate',
          beforeWrite(plan, ctx) {
            ctx.report({
              code: 'gate/blocked',
              severity: 'error',
              message: `${plan.changes.length} changes`,
            });
          },
        },
      ],
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.write).toBeUndefined();
    expect(blocked.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'gate/blocked', plugin: 'gate' }),
    );
    await expect(stat(directory)).rejects.toThrow(/ENOENT/);

    // A throwing beforeWrite is a diagnostic too, also through the programmatic API.
    const thrown = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      plugins: [
        {
          name: 'thrower',
          beforeWrite: () => {
            throw new Error('no');
          },
        },
      ],
    });
    expect(thrown.ok).toBe(false);
    expect(codes(thrown.diagnostics)).toContain('plugin/hook-failed');
    await expect(stat(directory)).rejects.toThrow(/ENOENT/);

    const after = await runGeneration({
      config: makeConfig({ spec, output: { directory } }),
      plugins: [
        {
          name: 'auditor',
          beforeWrite(_plan, ctx) {
            ctx.report({ code: 'auditor/before', severity: 'warning', message: 'before' });
          },
          afterWrite(result, ctx) {
            ctx.report({
              code: 'auditor/after',
              severity: 'error',
              message: `${result.created.length} created`,
            });
          },
        },
      ],
    });
    // The files were written; the error reported afterwards still fails the run.
    expect(after.write?.created.length).toBeGreaterThan(10);
    expect(after.ok).toBe(false);
    expect(codes(after.diagnostics)).toEqual(
      expect.arrayContaining(['auditor/before', 'auditor/after']),
    );
  });

  it('rejects unsafe plugin output paths', async () => {
    const result = await runGeneration({
      config: makeConfig({
        spec: { version: '3.0', input: fixture('petstore-3.0.yaml') },
        output: { directory: path.join(OUTPUT_ROOT, 'unsafe-plugin') },
      }),
      plugins: [
        { name: 'escape', generate: () => [{ path: '../escape.ts', content: '', origin: '' }] },
      ],
    });
    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('output/invalid-path');
  });
});

describe('hostile inputs', () => {
  it('refuses to write through symbolic links that leave the output directory', async () => {
    const spec = { version: '3.0' as const, input: fixture('petstore-3.0.yaml') };
    const { directory } = await generateCase('symlink', { spec });
    const outside = path.join(OUTPUT_ROOT, 'symlink-target');
    await rm(outside, { recursive: true, force: true });
    await mkdir(outside, { recursive: true });
    await rm(path.join(directory, 'store'), { recursive: true });
    await symlink(outside, path.join(directory, 'store'));
    const result = await runGeneration({ config: makeConfig({ spec, output: { directory } }) });
    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('output/write-failed');
    expect(await listFiles(outside)).toEqual([]);
  });

  it('stops converting pathologically nested schemas instead of exhausting the stack', async () => {
    let schema: Record<string, unknown> = { type: 'string' };
    // Array items nest one document level per schema level, so the document stays below the
    // loader's nesting limit (MAX_DOCUMENT_DEPTH) while the schema exceeds the converter's.
    for (let i = 0; i < 600; i++) schema = { type: 'array', items: schema };
    const file = path.join(OUTPUT_ROOT, 'deep.json');
    await mkdir(OUTPUT_ROOT, { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Deep', version: '1' },
        paths: {},
        components: { schemas: { Deep: schema } },
      }),
    );
    const result = await runGeneration({
      config: makeConfig({
        spec: { version: '3.0', input: file },
        output: { directory: path.join(OUTPUT_ROOT, 'deep') },
      }),
    });
    expect(codes(result.diagnostics)).toContain('schema/too-deep');
  });
});
