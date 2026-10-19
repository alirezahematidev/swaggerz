import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles } from '../../support/generate.ts';
import { BROWSER, typecheck } from '../../support/typescript.ts';

const petstore = { version: '3.0' as const, input: fixture('petstore-3.0.yaml') };
const read = (dir: string, file: string): Promise<string> => readFile(path.join(dir, file), 'utf8');

describe('output options', () => {
  it('supports extensionless and .ts import specifiers', async () => {
    const none = await generateCase('opt-ext-none', {
      spec: petstore,
      output: { importExtension: 'none' },
    });
    expect(await read(none.directory, 'pet/get-pet-by-id.ts')).toContain("from '../client';");
    expect(typecheck(await listFiles(none.directory, '.ts'), BROWSER)).toEqual([]);

    const tsExt = await generateCase('opt-ext-ts', {
      spec: petstore,
      output: { importExtension: '.ts' },
    });
    expect(await read(tsExt.directory, 'runtime/client.ts')).toContain("from './errors.ts';");
    expect(
      typecheck(await listFiles(tsExt.directory, '.ts'), {
        ...BROWSER,
        allowImportingTsExtensions: true,
      }),
    ).toEqual([]);
  });

  it('flattens operations without tag grouping and can omit unused models and the barrel', async () => {
    const { directory, result } = await generateCase('opt-layout', {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      output: { groupBy: 'none', models: 'used', barrel: false },
    });
    const files = result.files.map((f) => f.path);
    expect(files).toContain('operations/get-shape.ts');
    expect(files).not.toContain('models/unused.ts');
    expect(files).not.toContain('index.ts');
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
  });

  it('converts parameter names to camelCase while keeping wire names', async () => {
    const { directory } = await generateCase('opt-camel', {
      spec: { version: '3.0', input: fixture('edge-cases-3.0.yaml') },
      naming: { parameters: 'camelCase', operations: 'snake_case' },
    });
    const list = await read(directory, 'items-things/list.ts');
    expect(list).toContain("query: { default: params?.default, 'page[size]': params?.pageSize }");
    expect(list).toContain('export function list(');
    expect(await read(directory, 'models-api/delete-items-by-id.ts')).toContain(
      'export function delete_items_by_id(',
    );
  });

  it('bakes client defaults into the client module', async () => {
    const { directory } = await generateCase('opt-client', {
      spec: petstore,
      client: {
        baseUrl: 'https://api.test',
        headers: { 'x-app': 'demo' },
        timeout: 2500,
        includeCredentials: true,
      },
    });
    const client = await read(directory, 'client.ts');
    expect(client).toContain("baseUrl: 'https://api.test'");
    expect(client).toContain("headers: { 'x-app': 'demo' }");
    expect(client).toContain('timeout: 2500');
    expect(client).toContain("credentials: 'include'");
  });

  it('types full responses as status-discriminated unions', async () => {
    const { directory } = await generateCase('opt-full', {
      spec: petstore,
      client: { responseStyle: 'full' },
    });
    expect(await read(directory, 'pet/add-pet.ts')).toContain(
      'export type AddPetResponse = ApiResponse<Pet, 201>;',
    );
    expect(await read(directory, 'pet/delete-pet.ts')).toContain('ApiResponse<undefined, 204>');
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
  });

  it('omits documentation comments when jsdoc is disabled but keeps deprecations', async () => {
    const { directory } = await generateCase('opt-nodoc', {
      spec: petstore,
      features: { jsdoc: false },
    });
    const findByTags = await read(directory, 'pet/find-pets-by-tags.ts');
    expect(findByTags).not.toContain('Finds Pets by tags');
    expect(findByTags).toContain('@deprecated');
    const source = ts.createSourceFile('x.ts', findByTags, ts.ScriptTarget.Latest);
    expect(source.statements.length).toBeGreaterThan(3);
  });
});
