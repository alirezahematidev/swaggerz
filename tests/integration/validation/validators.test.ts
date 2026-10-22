import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type } from 'arktype';
import * as v from 'valibot';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';
import { ARKTYPE_CONSUMER, VALIBOT_CONSUMER } from './consumers.ts';

/** Valibot and ArkType, next to Zod (tests/integration/zod). */
const LIBRARIES = [
  {
    library: 'valibot',
    error: 'ValiError',
    consumer: VALIBOT_CONSUMER,
    accepts: (schema: unknown, value: unknown): boolean =>
      v.safeParse(schema as v.GenericSchema, value).success,
    parse: (schema: unknown, value: unknown): unknown => v.parse(schema as v.GenericSchema, value),
  },
  {
    library: 'arktype',
    error: 'TraversalError',
    consumer: ARKTYPE_CONSUMER,
    accepts: (schema: unknown, value: unknown): boolean =>
      (schema as { allows(value: unknown): boolean }).allows(value),
    parse: (schema: unknown, value: unknown): unknown => {
      const result = (schema as (value: unknown) => unknown)(value);
      if (result instanceof type.errors) throw new Error(result.summary);
      return result;
    },
  },
] as const;

const MODES = [
  ['ts', {}, BROWSER, (f: string[]) => f.filter((x) => x.endsWith('.ts'))],
  [
    'js',
    { language: 'javascript', declarations: true },
    BROWSER,
    (f: string[]) => f.filter((x) => x.endsWith('.d.ts')),
  ],
  [
    'jsdoc',
    { language: 'javascript', declarations: false },
    CHECK_JS,
    (f: string[]) =>
      f.filter(
        (x) =>
          x.endsWith('.d.ts') || (x.endsWith('.js') && !f.includes(x.replace(/\.js$/, '.d.ts'))),
      ),
  ],
] as const;

describe.each(LIBRARIES)('$library schemas', ({ library, consumer, accepts, parse }) => {
  it.each(MODES)(
    'compile in %s output with recursive, polymorphic and mutually recursive schemas',
    async (mode, output, options, pick) => {
      for (const [spec, version] of [
        ['features-3.1.yaml', '3.1'],
        ['features-3.2.yaml', '3.2'],
        ['external/openapi.yaml', '3.0'],
        ['advanced-3.1.yaml', '3.1'],
      ] as const) {
        const caseName = `${library}-${mode}-${spec.split('/')[0]?.replace('.yaml', '') ?? spec}`;
        const { directory } = await generateCase(caseName, {
          spec: { version, input: fixture(spec) },
          output,
          features: { validation: { library, request: true } },
          // advanced-3.1.yaml has dates: their schemas validate the wire format.
          ...(spec === 'advanced-3.1.yaml' ? { types: { dates: 'Date' } } : {}),
        });
        const roots = pick(await listFiles(directory));
        if (spec === 'features-3.1.yaml' && mode !== 'jsdoc') {
          const file = path.join(OUTPUT_ROOT, `${caseName}.consumer.ts`);
          await writeFile(file, consumer.replaceAll('__API__', `./${caseName}`));
          roots.push(file);
        }
        expect(typecheck(roots, options)).toEqual([]);
      }
    },
  );

  it('validate discriminated unions, recursion and unknown properties', async () => {
    const { directory } = await generateCase(`${library}-runtime-features`, {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: { validation: library },
    });
    const schemas = (await import(
      pathToFileURL(path.join(directory, library, 'index.ts')).href
    )) as Record<string, unknown>;
    const { ShapeSchema, TreeNodeSchema } = schemas;
    expect(accepts(ShapeSchema, { kind: 'circle', id: 'c', radius: 1 })).toBe(true);
    expect(accepts(ShapeSchema, { kind: 'rect', id: 'r', width: 1, height: 2 })).toBe(true);
    // The discriminator selects the variant: a circle's properties do not make a rectangle.
    expect(accepts(ShapeSchema, { kind: 'rect', id: 'r', radius: 1 })).toBe(false);
    expect(accepts(TreeNodeSchema, { value: 'a', children: [{ value: 'b' }] })).toBe(true);
    expect(accepts(TreeNodeSchema, { value: 'a', children: [{ value: 2 }] })).toBe(false);
    expect(parse(TreeNodeSchema, { value: 'a', extra: 1 })).toEqual({ value: 'a', extra: 1 });
  });

  it('validate OpenAPI 3.2 discriminators with a default mapping', async () => {
    const { directory } = await generateCase(`${library}-default-mapping`, {
      spec: { version: '3.2', input: fixture('features-3.2.yaml') },
      features: { validation: library },
    });
    const { PetSchema } = (await import(
      pathToFileURL(path.join(directory, library, 'pet.ts')).href
    )) as { PetSchema: unknown };
    expect(accepts(PetSchema, { kind: 'cat', name: 'Tom' })).toBe(true);
    expect(accepts(PetSchema, { name: 'Rex' })).toBe(true);
    expect(accepts(PetSchema, { kind: 'parrot', name: 'Polly' })).toBe(true);
    expect(accepts(PetSchema, { kind: 'cat' })).toBe(false);
  });

  it(`keeps ${library} out of the main barrel and models`, async () => {
    const { result } = await generateCase(`${library}-isolation`, {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: { validation: { library, response: false } },
    });
    const importers = result.files
      .filter((f) => f.content.includes(`from '${library}'`))
      .map((f) => f.path);
    expect(importers.length).toBeGreaterThan(0);
    expect(importers.every((p) => p.startsWith(`${library}/`))).toBe(true);
  });
});

describe.each(LIBRARIES)('runtime validation with $library', ({ library, error: errorName }) => {
  let server: MockServer;
  let api: Record<string, (...args: unknown[]) => Promise<unknown>> & {
    client: { setConfig(config: Record<string, unknown>): void };
    RequestError: new (...args: never[]) => Error;
  };

  beforeAll(async () => {
    server = await startMockServer();
    const { directory } = await generateCase(`${library}-runtime`, {
      spec: { version: '3.0', input: fixture('petstore-3.0.yaml') },
      features: { validation: { library, request: true } },
    });
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as typeof api;
    api.client.setConfig({ baseUrl: server.url });
  });

  afterAll(async () => {
    await server.close();
  });

  it('accepts valid responses and keeps unknown properties', async () => {
    server.respond(() => ({ body: { id: 1, name: 'Rex', photoUrls: [], extra: 'kept' } }));
    await expect(api.getPetById!({ petId: 1 })).resolves.toEqual({
      id: 1,
      name: 'Rex',
      photoUrls: [],
      extra: 'kept',
    });
  });

  it('rejects invalid responses with a validation RequestError', async () => {
    server.respond(() => ({ body: { id: 'not-a-number', name: 'Rex', photoUrls: [] } }));
    const error = (await api.getPetById!({ petId: 1 }).catch((e: unknown) => e)) as Error & {
      kind: string;
      cause: unknown;
    };
    expect(error).toBeInstanceOf(api.RequestError);
    expect(error.kind).toBe('validation');
    expect((error.cause as Error).name).toBe(errorName);
  });

  it('validates request bodies before sending', async () => {
    server.respond(() => ({ status: 201, body: { id: 1, name: 'x', photoUrls: [] } }));
    const error = (await api.addPet!({ body: { name: 'x' } }).catch((e: unknown) => e)) as Error & {
      kind: string;
    };
    expect(error).toMatchObject({ name: 'RequestError', kind: 'validation' });
    expect(server.requests).toHaveLength(0);
    await expect(api.addPet!({ body: { name: 'x', photoUrls: [] } })).resolves.toMatchObject({
      id: 1,
    });
  });
});
