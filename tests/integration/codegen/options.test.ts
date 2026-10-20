import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';

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

  it('types errors by status: codes, ranges, default and undocumented statuses', async () => {
    const input = path.join(OUTPUT_ROOT, 'specs', 'statuses.yaml');
    await mkdir(path.dirname(input), { recursive: true });
    const json = (schema: string): string =>
      `{ description: d, content: { application/json: { schema: ${schema} } } }`;
    await writeFile(
      input,
      [
        'openapi: 3.1.0',
        'info: { title: Statuses, version: "1" }',
        'paths:',
        '  /a:',
        '    get:',
        '      operationId: rangeAndDefault',
        '      responses:',
        `        '200': ${json('{ type: string }')}`,
        "        '304': { description: not modified }",
        `        '404': ${json("{ $ref: '#/components/schemas/Problem' }")}`,
        `        '4XX': ${json("{ $ref: '#/components/schemas/Problem' }")}`,
        '        default: { description: d, content: { text/plain: { schema: { type: string } } } }',
        '  /b:',
        '    get:',
        '      operationId: everyClass',
        '      responses:',
        "        '2XX': { description: ok }",
        "        '1XX': { description: info }",
        "        '3XX': { description: redirect }",
        "        '4XX': { description: client }",
        "        '5XX': { description: server }",
        'components:',
        '  schemas:',
        '    Problem: { type: object, required: [title], properties: { title: { type: string } } }',
        '',
      ].join('\n'),
    );
    const { directory } = await generateCase('opt-statuses', {
      spec: { version: '3.1', input },
      client: { responseStyle: 'full' },
    });
    const range = await read(directory, 'default/range-and-default.ts');
    expect(range).toContain(
      [
        'export type RangeAndDefaultApiError =',
        '  | ApiError<Problem, 404>',
        '  | ApiError<Problem, Exclude<HttpStatus<4>, 404>>',
        '  | ApiError<string, Exclude<HttpStatus<1 | 3 | 5>, 304>>;',
      ].join('\n'),
    );
    expect(range).toContain(
      'export type RangeAndDefaultResponse = ApiResponse<string, 200> | ApiResponse<undefined, 304>;',
    );
    // Every class is documented, so nothing is left for an "undocumented" member.
    const every = await read(directory, 'default/every-class.ts');
    expect(every).toContain('ApiError<undefined, HttpStatus<1>>');
    expect(every).toContain('ApiError<undefined, HttpStatus<5>>;');
    expect(every).not.toContain('ApiError<unknown');
    expect(every).toContain(
      'export type EveryClassResponse = ApiResponse<undefined, HttpStatus<2>> | ApiResponse<undefined, HttpStatus<3>>;',
    );

    const consumer = path.join(OUTPUT_ROOT, 'opt-statuses.consumer.ts');
    await writeFile(
      consumer,
      `import { everyClass, isEveryClassApiError, isRangeAndDefaultApiError, rangeAndDefault, type Problem } from './opt-statuses/index.js';
export async function usage(error: unknown): Promise<void> {
  const response = await rangeAndDefault();
  if (response.status === 200) { const text: string = response.data; void text; }
  else { const none: undefined = response.data; void none; }
  const status: 200 | 201 | 299 = (await everyClass()).status as 200 | 201 | 299;
  void status;
  if (isRangeAndDefaultApiError(error)) {
    if (error.status === 418) { const problem: Problem = error.body; void problem; }
    if (error.status === 503) { const text: string = error.body; void text; }
    // @ts-expect-error 304 resolves
    if (error.status === 304) void error;
  }
  if (isEveryClassApiError(error) && error.status === 502) { const none: undefined = error.body; void none; }
}
`,
    );
    expect(typecheck([...(await listFiles(directory, '.ts')), consumer], BROWSER)).toEqual([]);
  });

  it('keeps JSDoc types in JavaScript output when documentation is disabled', async () => {
    const { directory } = await generateCase('opt-js-nodoc', {
      spec: petstore,
      output: { language: 'javascript', declarations: false },
      features: { jsdoc: false, reactQuery: true },
    });
    const getPetById = await read(directory, 'pet/get-pet-by-id.js');
    expect(getPetById).not.toContain('Find pet by ID');
    expect(getPetById).toContain('@param {GetPetByIdParams} params');
    const consumer = path.join(OUTPUT_ROOT, 'opt-js-nodoc.consumer.ts');
    await writeFile(
      consumer,
      `import { getPetById, type Pet } from './opt-js-nodoc/index.js';
export async function usage(): Promise<Pet> {
  // @ts-expect-error petId must be a number
  await getPetById({ petId: 'x' });
  return getPetById({ petId: 1 });
}
`,
    );
    const all = await listFiles(directory);
    const roots = all.filter(
      (f) =>
        f.endsWith('.d.ts') || (f.endsWith('.js') && !all.includes(f.replace(/\.js$/, '.d.ts'))),
    );
    expect(typecheck([...roots, consumer], { ...CHECK_JS, noImplicitAny: true })).toEqual([]);
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
