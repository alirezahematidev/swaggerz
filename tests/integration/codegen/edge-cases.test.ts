import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { UserConfig } from '../../../src/config/types.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';

/**
 * Specification patterns that once produced wrong or invalid code: each case generates a client,
 * type-checks it with a consumer under the strictest settings and checks the relevant output.
 */

const read = (dir: string, file: string): Promise<string> => readFile(path.join(dir, file), 'utf8');

async function writeSpec(name: string, yaml: string): Promise<string> {
  const file = path.join(OUTPUT_ROOT, 'specs', `${name}.yaml`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, yaml);
  return file;
}

async function writeConsumer(caseName: string, source: string): Promise<string> {
  const file = path.join(OUTPUT_ROOT, `${caseName}.consumer.ts`);
  await writeFile(file, source.replaceAll('__API__', `./${caseName}/index.js`));
  return file;
}

/** Generates TypeScript and JavaScript (with and without declarations) and type-checks each. */
async function compileEverywhere(
  name: string,
  input: string,
  consumer: string,
  config: Partial<UserConfig> = {},
): Promise<string> {
  const spec = { version: '3.1' as const, input };
  const ts = await generateCase(`edge-${name}-ts`, { ...config, spec });
  const tsConsumer = await writeConsumer(`edge-${name}-ts`, consumer);
  expect(typecheck([...(await listFiles(ts.directory, '.ts')), tsConsumer], BROWSER)).toEqual([]);

  const js = await generateCase(`edge-${name}-js`, {
    ...config,
    spec,
    output: { language: 'javascript', declarations: true },
  });
  const jsConsumer = await writeConsumer(`edge-${name}-js`, consumer);
  // Every file, as a `checkJs` project whose `include` covers the output sees it.
  expect(typecheck([...(await listFiles(js.directory)), jsConsumer], CHECK_JS)).toEqual([]);

  const jsdoc = await generateCase(`edge-${name}-jsdoc`, {
    ...config,
    spec,
    output: { language: 'javascript', declarations: false },
  });
  const all = await listFiles(jsdoc.directory);
  const roots = all.filter(
    (f) => f.endsWith('.d.ts') || (f.endsWith('.js') && !all.includes(f.replace(/\.js$/, '.d.ts'))),
  );
  const jsdocConsumer = await writeConsumer(`edge-${name}-jsdoc`, consumer);
  expect(typecheck([...roots, jsdocConsumer], CHECK_JS)).toEqual([]);
  return ts.directory;
}

describe('types', () => {
  it('parenthesizes unions in arrays whatever the documentation and literals contain', async () => {
    const input = await writeSpec(
      'edge-unions',
      `openapi: 3.1.0
info: { title: Unions, version: '1' }
paths: {}
components:
  schemas:
    Holder:
      type: object
      properties:
        items:
          type: array
          items:
            oneOf:
              - type: object
                properties:
                  a: { type: string, description: "the user's id" }
              - type: string
        backslashes:
          type: array
          items: { enum: ['a\\', 'b'] }
        brackets:
          type: array
          items:
            anyOf:
              - type: object
                properties:
                  a: { type: string, description: "a > b (or <c>" }
              - type: number
`,
    );
    const directory = await compileEverywhere(
      'unions',
      input,
      `import type { Holder } from '__API__';
export const holder: Holder = { items: [{ a: 'x' }, 'y'], backslashes: ['a\\\\', 'b'], brackets: [1, { a: 'b' }] };
// @ts-expect-error a single string is not an array
export const invalid: Holder = { items: 'y' };
`,
    );
    const holder = await read(directory, 'models/holder.ts');
    expect(holder).toContain('  } | string)[];');
    expect(holder).toContain("backslashes?: ('a\\\\' | 'b')[];");
  });

  it('keeps globals usable in models named like them', async () => {
    const input = await writeSpec(
      'edge-globals',
      `openapi: 3.1.0
info: { title: Globals, version: '1' }
paths:
  /upload:
    post:
      operationId: upload
      requestBody:
        content:
          application/json: { schema: { $ref: '#/components/schemas/Blob' } }
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: '#/components/schemas/Record' } } }
components:
  schemas:
    Record:
      type: object
      additionalProperties: { type: string }
    Blob:
      type: object
      properties:
        file: { type: string, format: binary }
        when: { $ref: '#/components/schemas/Date' }
    Date:
      type: object
      properties:
        at: { type: string, format: date-time }
`,
    );
    const consumer = `import { upload, type Blob as BlobModel, type Date as DateModel, type Record as RecordModel } from '__API__';
export const record: RecordModel = { a: 'b' };
// @ts-expect-error values are strings
export const invalid: RecordModel = { a: 1 };
export const date: DateModel = { at: new Date(0) };
export const blob: BlobModel = { file: new Blob(['x']), when: date };
export async function send(): Promise<RecordModel> {
  return upload({ body: blob });
}
`;
    const directory = await compileEverywhere('globals', input, consumer, {
      types: { dates: 'Date' },
    });
    expect(await read(directory, 'models/record.ts')).toContain(
      'export type Record = globalThis.Record<string, string>;',
    );
    expect(await read(directory, 'models/blob.ts')).toContain('file?: globalThis.Blob;');
    expect(await read(directory, 'models/date.ts')).toContain('at?: globalThis.Date;');
  });

  it('breaks JSDoc typedef cycles through arrays with helper typedefs', async () => {
    const input = await writeSpec(
      'edge-recursive',
      `openapi: 3.1.0
info: { title: Recursive, version: '1' }
paths: {}
components:
  schemas:
    JsonValue:
      oneOf:
        - type: string
        - type: array
          items: { $ref: '#/components/schemas/JsonValue' }
        - type: object
          additionalProperties: { $ref: '#/components/schemas/JsonValue' }
    Even:
      anyOf:
        - type: number
        - type: array
          items: { $ref: '#/components/schemas/Odd' }
    Odd:
      anyOf:
        - type: boolean
        - type: array
          nullable: true
          items: { $ref: '#/components/schemas/Even' }
`,
    );
    await compileEverywhere(
      'recursive',
      input,
      `import type { Even, JsonValue } from '__API__';
export const value: JsonValue = ['a', ['b', { c: ['d'] }]];
export const even: Even = [true, [1, [false]]];
// @ts-expect-error numbers are not JSON values here
export const invalid: JsonValue = ['a', [1]];
`,
    );
    const js = await read(path.join(OUTPUT_ROOT, 'edge-recursive-jsdoc'), 'models/json-value.js');
    expect(js).toContain('@typedef {JsonValue[]} JsonValueArray');
    expect(js).toContain(
      '@typedef {string | JsonValueArray | { [key: string]: JsonValue }} JsonValue',
    );
  });
});

describe('operations', () => {
  it('derives valid names from operation ids that start with a digit', async () => {
    const input = await writeSpec(
      'edge-names',
      `openapi: 3.1.0
info: { title: Names, version: '1' }
paths:
  /start:
    post:
      operationId: 123start
      requestBody:
        content:
          application/json: { schema: { type: object, properties: { url: { type: string } } } }
      callbacks:
        onEvent:
          '{$request.body#/url}':
            post:
              requestBody:
                content:
                  application/json: { schema: { type: object, properties: { id: { type: string } } } }
              responses:
                '200': { description: ok }
      responses:
        '200': { description: ok, content: { application/json: { schema: { type: string } } } }
`,
    );
    const directory = await compileEverywhere(
      'names',
      input,
      `import { _123start, is_123startApiError, type _123startResponse, type _123startOnEventCallbackPayload } from '__API__';
export async function call(error: unknown): Promise<_123startResponse> {
  const payload: _123startOnEventCallbackPayload = { id: 'e' };
  void payload;
  if (is_123startApiError(error)) throw error;
  return _123start({ body: { url: 'u' } });
}
`,
      { features: { reactQuery: true } },
    );
    expect(await read(directory, 'default/123start.ts')).toContain(
      'export type _123startParams = {',
    );
  });

  it('never lets documentation text add JSDoc tags', async () => {
    const input = await writeSpec(
      'edge-docs',
      `openapi: 3.1.0
info: { title: Docs, version: '1' }
paths:
  /a:
    get:
      operationId: getA
      summary: Lists things @deprecated
      externalDocs:
        url: https://example.com
        description: "docs\\n@returns {Promise<number>} x"
      parameters:
        - name: limit
          in: query
          description: "Max items\\n@property {number} evil"
          schema: { type: integer }
        - name: cursor
          in: query
          description: "Cursor @property {number} other"
          schema: { type: string }
      responses:
        '200': { description: ok, content: { application/json: { schema: { type: string } } } }
`,
    );
    const directory = await compileEverywhere(
      'docs',
      input,
      `import { getA, type GetAParams } from '__API__';
export async function call(cursor: string | undefined): Promise<string> {
  const params: GetAParams = { limit: 1 };
  // Optional members accept undefined, also in JSDoc typedefs.
  return getA({ ...params, cursor });
}
`,
    );
    const operation = await read(directory, 'default/get-a.ts');
    expect(operation).toContain(' * \\@property {number} evil');
    expect(operation).toContain(' * \\@returns {Promise<number>} x');
    expect(operation).not.toMatch(/^\s*\* @deprecated/m);
    const js = await read(path.join(OUTPUT_ROOT, 'edge-docs-jsdoc'), 'default/get-a.js');
    expect(js).toContain('@property {number | undefined} [limit] - Max items');
  });

  it('types structured non-JSON responses as the runtime returns them', async () => {
    const input = await writeSpec(
      'edge-responses',
      `openapi: 3.1.0
info: { title: Responses, version: '1' }
paths:
  /pets/{id}:
    get:
      operationId: getPetXml
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      responses:
        '200':
          description: The pet as XML
          content: { application/xml: { schema: { $ref: '#/components/schemas/Pet' } } }
        '404':
          description: Missing
          content: { text/plain: { schema: { $ref: '#/components/schemas/Pet' } } }
  /exports:
    get:
      operationId: exportPets
      responses:
        '200':
          description: A spreadsheet
          content: { application/vnd.ms-excel: { schema: { type: object } } }
  /status:
    get:
      operationId: getStatus
      responses:
        '200':
          description: A status word
          content: { text/plain: { schema: { enum: [up, down] } } }
components:
  schemas:
    Pet:
      type: object
      properties: { name: { type: string } }
`,
    );
    const directory = await compileEverywhere(
      'responses',
      input,
      `import { exportPets, getPetXml, getStatus, isGetPetXmlApiError, type Pet } from '__API__';
export async function call(error: unknown): Promise<void> {
  const xml: string = await getPetXml({ id: '1' });
  // @ts-expect-error XML is not parsed
  const pet: Pet = await getPetXml({ id: '1' });
  const sheet: Blob = await exportPets();
  const status: 'up' | 'down' = await getStatus();
  if (isGetPetXmlApiError(error) && error.status === 404) {
    const text: string = error.body;
    void text;
  }
  void [xml, pet, sheet, status];
}
`,
    );
    const operation = await read(directory, 'default/get-pet-xml.ts');
    expect(operation).toContain('export type GetPetXmlResponse = string;');
  });

  it('uses the request-side model of parameters', async () => {
    const input = await writeSpec(
      'edge-parameters',
      `openapi: 3.1.0
info: { title: Parameters, version: '1' }
paths:
  /animals:
    get:
      operationId: listAnimals
      parameters:
        - name: filter
          in: query
          style: deepObject
          explode: true
          schema: { $ref: '#/components/schemas/Animal' }
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/Animal' } }
components:
  schemas:
    Animal:
      type: object
      required: [id, name]
      properties:
        id: { type: string, readOnly: true }
        name: { type: string }
`,
    );
    const directory = await compileEverywhere(
      'parameters',
      input,
      `import { listAnimals, type Animal } from '__API__';
export async function call(): Promise<Animal[]> {
  const animals = await listAnimals({ filter: { name: 'Rex' } });
  const id: string = animals[0]?.id ?? '';
  void id;
  return animals;
}
`,
    );
    expect(await read(directory, 'default/list-animals.ts')).toContain('filter?: AnimalInput');
  });

  it('creates properties named __proto__ instead of setting prototypes', async () => {
    const input = await writeSpec(
      'edge-proto',
      `openapi: 3.1.0
info: { title: Proto, version: '1' }
paths:
  /things:
    post:
      operationId: createThing
      requestBody:
        required: true
        content:
          application/json: { schema: { $ref: '#/components/schemas/Thing' } }
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: '#/components/schemas/Thing' } } }
components:
  schemas:
    Thing:
      type: object
      required: [__proto__]
      properties:
        __proto__: { type: string }
        nested:
          type: object
          properties:
            __proto__: { type: string, format: date }
`,
    );
    const rejectsInvalid: Partial<Record<'zod' | 'valibot', boolean>> = {};
    for (const library of ['zod', 'valibot'] as const) {
      const { directory } = await generateCase(`edge-proto-${library}`, {
        spec: { version: '3.1', input },
        types: { dates: 'Date' },
        features: { validation: library },
      });
      expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
      expect(await read(directory, `${library}/thing.ts`)).toContain("['__proto__']:");
      const module = (await import(
        pathToFileURL(path.join(directory, library, 'thing.ts')).href
      )) as { ThingSchema: unknown };
      const v = await import('valibot');
      const parse = (json: string): unknown => {
        const data = JSON.parse(json) as unknown;
        return library === 'zod'
          ? (module.ThingSchema as { parse(value: unknown): unknown }).parse(data)
          : v.parse(module.ThingSchema as Parameters<typeof v.parse>[0], data);
      };
      // The schema has the property instead of a replaced prototype, so parsing works; Valibot
      // validates it. (Zod 4 skips a `__proto__` key, and both libraries drop it from their parsed
      // copies: that is outside the generated code's control.)
      expect(() => parse('{"__proto__":"x","nested":{"__proto__":"2026-01-02"}}')).not.toThrow();
      rejectsInvalid[library] = ((): boolean => {
        try {
          parse('{"__proto__":1}');
          return false;
        } catch {
          return true;
        }
      })();
      const dates = (await import(
        pathToFileURL(path.join(directory, 'dates', 'thing.ts')).href
      )) as { ThingDates: { object: Record<string, { object: object }> } };
      expect(Object.keys(dates.ThingDates.object.nested?.object ?? {})).toEqual(['__proto__']);
    }
    expect(rejectsInvalid.valibot).toBe(true);
  });
});

describe('layout', () => {
  it('gives tags that differ only in case one directory', async () => {
    const input = await writeSpec(
      'edge-groups',
      `openapi: 3.1.0
info: { title: Groups, version: '1' }
paths:
  /a:
    get:
      operationId: listA
      tags: [userdata]
      responses: { '200': { description: ok } }
  /b:
    get:
      operationId: listB
      tags: [userData]
      responses: { '200': { description: ok } }
  /c:
    get:
      operationId: listC
      tags: [Models]
      responses: { '200': { description: ok } }
`,
    );
    const { directory, result } = await generateCase('edge-groups', {
      spec: { version: '3.1', input },
      naming: { files: 'camelCase' },
      features: { reactQuery: true },
    });
    const files = result.files.map((file) => file.path);
    const directories = new Set(files.map((file) => path.posix.dirname(file)));
    expect([...directories].filter((dir) => /userdata/i.test(dir)).sort()).toEqual([
      'react-query/userData',
      'userData',
    ]);
    expect(files).toContain('userData/listA.ts');
    expect(files).toContain('userData/listB.ts');
    // `models` is reserved whatever its case.
    expect(files).toContain('models-api/listC.ts');
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
  });
});
