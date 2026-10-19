import { mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SwaggerzPlugin } from '../../../src/plugins/types.ts';
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
    const files = (await listFiles(directory, '.ts')).map((f) => path.relative(directory, f));
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
      resolveImport: ({ specifier }) =>
        specifier.startsWith('../client') ? specifier.replace('../client', '../client') : undefined,
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
    expect(await read(directory, 'pet/get-pet-by-id.ts')).toMatch(/\/\/ transformed\n$/);
    expect(JSON.parse(await read(directory, 'meta/operations.json'))).toContain('fetchStock');
    expect(result.files.find((f) => f.path === 'meta/operations.json')?.origin).toBe(
      'plugin:custom',
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'custom/note', plugin: 'custom' }),
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
    for (let i = 0; i < 1_000; i++) schema = { type: 'object', properties: { next: schema } };
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
