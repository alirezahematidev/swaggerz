import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type } from 'arktype';
import { setupServer } from 'msw/node';
import * as v from 'valibot';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { planOperation } from '../../../src/codegen/operation-plan.ts';
import type { UserConfig } from '../../../src/config/types.ts';
import type { SchemaIR } from '../../../src/ir/types.ts';
import { codes, fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, NODE, typecheck } from '../../support/typescript.ts';
import { MOCKS_CONSUMER } from './consumers.ts';

type Spec = readonly [file: string, version: '2.0' | '3.0' | '3.1' | '3.2'];

const MOCKS: Spec = ['mocks-3.1.yaml', '3.1'];
const ADVANCED: Spec = ['advanced-3.1.yaml', '3.1'];
const SPECS: readonly Spec[] = [
  MOCKS,
  ['petstore-3.0.yaml', '3.0'],
  ['petstore-2.0.json', '2.0'],
  ['features-3.1.yaml', '3.1'],
  ['features-3.2.yaml', '3.2'],
  ADVANCED,
  ['edge-cases-3.0.yaml', '3.0'],
  ['external/openapi.yaml', '3.0'],
];

const caseName = (prefix: string, [spec]: Spec): string =>
  `${prefix}-${spec.replace(/\.(yaml|json)$/, '').replace(/[/.]/g, '-')}`;

/** advanced-3.1.yaml has dates: its fixtures hold `Date` values and handlers encode them. */
const configFor = ([spec, version]: Spec, extra: Partial<UserConfig> = {}): UserConfig => ({
  spec: { version, input: fixture(spec) },
  ...extra,
  features: { mocks: 'msw', ...extra.features },
  ...(spec === 'advanced-3.1.yaml' ? { types: { dates: 'Date' } } : {}),
});

const MODES = [
  ['ts', {}, BROWSER, (f: string[]) => f.filter((x) => x.endsWith('.ts'))],
  ['node', {}, NODE, (f: string[]) => f.filter((x) => x.endsWith('.ts'))],
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

describe('generated mocks', () => {
  it.each(MODES)('compile in %s output', async (mode, output, options, pick) => {
    for (const spec of SPECS) {
      const name = caseName(`mocks-${mode}`, spec);
      const { directory, result } = await generateCase(
        name,
        configFor(spec, { output, features: { validation: 'zod' } }),
      );
      expect(codes(result.diagnostics).filter((code) => code.startsWith('mock/'))).toEqual([]);
      const roots = pick(await listFiles(directory));
      if (spec === MOCKS && (mode === 'ts' || mode === 'js')) {
        const consumer = path.join(OUTPUT_ROOT, `${name}.consumer.ts`);
        await writeFile(consumer, MOCKS_CONSUMER.replaceAll('__API__', `./${name}`));
        roots.push(consumer);
      }
      expect(typecheck(roots, options)).toEqual([]);
    }
  });

  it('compile when schemas cannot be satisfied or there are no operations', async () => {
    const input = path.join(OUTPUT_ROOT, 'mocks-unsatisfiable.yaml');
    await writeFile(
      input,
      `openapi: 3.1.0
info: { title: Unsatisfiable, version: '1' }
paths: {}
components:
  schemas:
    Track:
      type: object
      required: [type]
      properties:
        type: { type: string, enum: [track] }
    Player:
      type: object
      required: [queue]
      properties:
        item:
          oneOf: [{ $ref: '#/components/schemas/Track' }]
          discriminator: { propertyName: type }
        queue:
          type: array
          items:
            oneOf: [{ $ref: '#/components/schemas/Track' }]
            discriminator: { propertyName: type }
    Code: { type: string, minLength: 5, maxLength: 2 }
    Loop:
      type: object
      required: [next]
      properties:
        next: { $ref: '#/components/schemas/Loop' }
`,
    );
    for (const [mode, output, options, pick] of MODES) {
      const { directory, result } = await generateCase(`mocks-unsatisfiable-${mode}`, {
        spec: { version: '3.1', input },
        output,
        features: { mocks: 'msw' },
      });
      expect(codes(result.diagnostics)).toContain('mock/unsatisfiable');
      expect(typecheck(pick(await listFiles(directory)), options)).toEqual([]);
    }
  });

  it.each(['ts', 'js'] as const)(
    'start in the browser from a module that imports nothing until it is called (%s)',
    async (extension) => {
      const { directory } = await generateCase(`mocks-start-${extension}`, {
        ...configFor(MOCKS),
        output: extension === 'js' ? { language: 'javascript' } : {},
      });
      const source = await readFile(path.join(directory, 'mocks', `start.${extension}`), 'utf8');
      // Only type imports (none at all in JavaScript): MSW and the handlers load when it is called.
      expect(source.match(/^import (?!type\b).*$/gm) ?? []).toEqual([]);
      expect(source).toContain("import('msw/browser')");
      const { startMocks } = (await import(
        pathToFileURL(path.join(directory, 'mocks', `start.${extension}`)).href
      )) as { startMocks: () => Promise<unknown> };
      // Service workers need a browser: elsewhere it says what to use instead.
      await expect(startMocks()).rejects.toThrow('startMocks() needs service workers');
    },
  );

  it('keep msw out of the client and its barrel', async () => {
    const { result } = await generateCase('mocks-isolation', configFor(MOCKS));
    const importers = result.files
      .filter((f) => f.content.includes("from 'msw'"))
      .map((f) => f.path);
    expect(importers.length).toBeGreaterThan(0);
    expect(importers.every((p) => p.startsWith('mocks/'))).toBe(true);
    const barrel = result.files.find((f) => f.path === 'index.ts');
    expect(barrel?.content).not.toContain('mocks/');
  });

  it('are the same on every run', async () => {
    const first = await generateCase('mocks-determinism-1', configFor(MOCKS));
    const second = await generateCase('mocks-determinism-2', configFor(MOCKS));
    const contents = async (directory: string): Promise<string[]> =>
      Promise.all((await listFiles(directory)).map((file) => readFile(file, 'utf8')));
    expect(await contents(second.directory)).toEqual(await contents(first.directory));
  });

  it('do not rename the client when enabled', async () => {
    const without = await generateCase('mocks-names-off', {
      spec: { version: '3.0', input: fixture('edge-cases-3.0.yaml') },
    });
    const withMocks = await generateCase('mocks-names-on', {
      spec: { version: '3.0', input: fixture('edge-cases-3.0.yaml') },
      features: { mocks: 'msw' },
    });
    const names = (result: typeof without.result): string[] =>
      result.files
        .filter((f) => !f.path.startsWith('mocks/'))
        .flatMap((f) => (f.exports ?? []).map((e) => `${f.path}:${e.name}`));
    expect(names(withMocks.result)).toEqual(names(without.result));
  });
});

const LIBRARIES = [
  {
    library: 'zod',
    problem: (schema: unknown, value: unknown): string | undefined => {
      const result = (
        schema as { safeParse(value: unknown): { success: boolean; error?: unknown } }
      ).safeParse(value);
      return result.success ? undefined : JSON.stringify(result.error);
    },
  },
  {
    library: 'valibot',
    problem: (schema: unknown, value: unknown): string | undefined => {
      const result = v.safeParse(schema as v.GenericSchema, value);
      return result.success ? undefined : JSON.stringify(result.issues.map((i) => i.message));
    },
  },
  {
    library: 'arktype',
    problem: (schema: unknown, value: unknown): string | undefined => {
      const result = (schema as (value: unknown) => unknown)(value);
      return result instanceof type.errors ? result.summary : undefined;
    },
  },
] as const;

/** The fixture options every fixture is validated with, beyond the examples. */
const SEEDS = [
  ...Array.from({ length: 24 }, (_, index) => ({ seed: index + 1 })),
  { seed: 4_000_000_000 },
  { empty: true },
  { seed: 11, empty: true },
];

describe('fixture variants', () => {
  let mocks: Mocks;

  beforeAll(async () => {
    const { directory } = await generateCase('mocks-variants', configFor(MOCKS));
    mocks = (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Mocks;
  });

  const seeds = Array.from({ length: 80 }, (_, index) => ({ seed: index + 1 }));

  it('cover every enum value, absent property and null in turn', () => {
    const pets = seeds.map(
      (options) => mocks.makePet!(undefined, options) as Record<string, unknown>,
    );
    expect(new Set(pets.map((pet) => pet['kind']))).toEqual(new Set(['dog', 'cat', 'bird']));
    expect(pets.some((pet) => !('chip' in pet))).toBe(true);
    expect(pets.some((pet) => 'chip' in pet)).toBe(true);
    expect(new Set(pets.map((pet) => pet['id'])).size).toBeGreaterThan(70);
    const visits = seeds.map(
      (options) => mocks.makeVisit!(undefined, options) as Record<string, unknown>,
    );
    expect(new Set(visits.map((visit) => visit['status']))).toEqual(
      new Set(['scheduled', 'completed', 'cancelled']),
    );
    expect(visits.some((visit) => visit['notes'] === null)).toBe(true);
    // Identifiers keep the example's shape.
    for (const visit of visits) expect(visit['id']).toMatch(/^vis_[0-9a-z]{10}$/);
  });

  it('make realistic values that keep their constraints', () => {
    for (const options of seeds) {
      const pet = mocks.makePet!(undefined, options) as Record<string, unknown>;
      expect(pet['name']).toMatch(/^.{1,20}$/);
      expect(pet['chip'] ?? 'ABC-1234').toMatch(/^[A-Z]{3}-\d{4}$/);
      expect(pet['contact'] ?? 'a@b').toMatch(/^[a-z.]+@[a-z.]+$/);
      expect((((pet['weight'] as number | undefined) ?? 1) * 2) % 1).toBe(0);
      const person = mocks.makePerson!(undefined, options) as Record<string, unknown>;
      expect(person['name']).toMatch(/^\S+ \S+$/);
      // An example's domain is kept.
      expect(person['email']).toMatch(/@vets\.example\.com$/);
    }
    // Seed 0 is the specification's examples.
    expect(mocks.makePerson!()).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@vets.example.com',
    });
    expect(mocks.makePet!(undefined, { seed: 0 })).toEqual(mocks.makePet!());
  });

  it('make arrays as short as allowed in empty states', () => {
    expect(mocks.makeVisitPage!(undefined, { empty: true })).toMatchObject({ items: [] });
    const page = mocks.makeVisitPage!() as { items: unknown[] };
    expect(page.items.length).toBeGreaterThan(1);
    expect(page.items[0]).toEqual(mocks.makeVisit!());
  });
});

describe.each(LIBRARIES)('fixtures validate with $library', ({ library, problem }) => {
  it.each(SPECS)('%s', async (file, version) => {
    const spec: Spec = [file, version];
    const { directory, result } = await generateCase(
      caseName(`mocks-${library}`, spec),
      configFor(spec, { features: { validation: library } }),
    );
    const load = async (module: string): Promise<Record<string, unknown>> =>
      (await import(pathToFileURL(path.join(directory, `${module}.ts`)).href)) as Record<
        string,
        unknown
      >;
    const mocks = await load('mocks/index');
    const schemas = await load(`${library}/index`);
    const failures: string[] = [];
    const models = result.project?.models ?? [];
    expect(models.length).toBeGreaterThan(0);
    const { encodeDates } = (await load('runtime/dates').catch(() => ({}))) as {
      encodeDates?: (value: unknown, shape: unknown) => unknown;
    };
    for (const model of models) {
      const factory = mocks[model.fixtureName ?? ''] as (...args: unknown[]) => unknown;
      // Fixtures of object types take overrides first.
      const make = (options?: object): unknown =>
        factory.length >= 2 ? factory(undefined, options) : factory(options);
      const shape =
        model.datesModule !== undefined && model.datesName !== undefined
          ? (await load(model.datesModule))[model.datesName]
          : undefined;
      // The examples, other seeds, and empty states all match the schema.
      for (const options of [undefined, ...SEEDS]) {
        let value = make(options);
        // Schemas validate the wire format: with `types.dates: 'Date'`, dates are strings there.
        if (shape !== undefined && encodeDates !== undefined) value = encodeDates(value, shape);
        const found = problem(schemas[model.schemaName ?? ''], value);
        if (found !== undefined)
          failures.push(`${model.name} ${JSON.stringify(options)}: ${found}`);
      }
      // Every call returns an equal value for a seed, and a new one for objects.
      expect(make()).toEqual(make());
      expect(make({ seed: 3 })).toEqual(make({ seed: 3 }));
      const value = make();
      const fresh = typeof value !== 'object' || value === null || make() !== make();
      expect(fresh).toBe(true);
    }
    expect(failures).toEqual([]);
  });
});

interface Api {
  client: { setConfig(config: Record<string, unknown>): void; getConfig(): { baseUrl: string } };
  [operation: string]: unknown;
}

type Mocks = Record<string, (...args: unknown[]) => unknown>;

const call = (api: Api, name: string, ...args: unknown[]): Promise<unknown> =>
  (api[name] as (...args: unknown[]) => Promise<unknown>)(...args);

const failure = (promise: Promise<unknown>): Promise<Record<string, unknown>> =>
  promise.then(
    () => {
      throw new Error('Expected the call to fail.');
    },
    (error: unknown) => error as Record<string, unknown>,
  );

describe.each([
  ['TypeScript', {}, 'ts'],
  ['JavaScript', { language: 'javascript' }, 'js'],
] as const)('mock handlers (%s output)', (label, output, extension) => {
  const server = setupServer();
  let api: Api;
  let mocks: Mocks;
  let baseUrl: string;

  beforeAll(async () => {
    const { directory } = await generateCase(`mocks-runtime-${extension}`, {
      ...configFor(MOCKS),
      output,
    });
    api = (await import(pathToFileURL(path.join(directory, `index.${extension}`)).href)) as Api;
    mocks = (await import(
      pathToFileURL(path.join(directory, 'mocks', `index.${extension}`)).href
    )) as Mocks;
    baseUrl = api.client.getConfig().baseUrl;
    server.listen({ onUnhandledFrame: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    api.client.setConfig({ baseUrl });
  });

  afterAll(() => {
    server.close();
  });

  it(`respond with the examples, or with values generated for the request (${label})`, async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    // Without parameters: the examples, and more items generated after them.
    const pets = (await call(api, 'listPets')) as { id: number }[];
    expect(pets).toHaveLength(6);
    expect(pets[0]).toEqual(mocks.makePet!());
    expect(new Set(pets.map((pet) => pet.id)).size).toBe(6);
    // A media type example; and `/pets/mine` is matched before `/pets/{petId}`.
    await expect(call(api, 'listMyPets')).resolves.toEqual([
      { id: 1, name: 'Rex', kind: 'dog', tags: [] },
      { id: 2, name: 'Tom', kind: 'cat', tags: ['indoor'] },
    ]);
    // With parameters: values of their own, the same for the same request, with the parameters
    // where the body repeats them.
    const one = await call(api, 'getPet', { petId: 3 });
    expect(one).toMatchObject({ id: 3 });
    await expect(call(api, 'getPet', { petId: 3 })).resolves.toEqual(one);
    await expect(call(api, 'getPet', { petId: 4 })).resolves.not.toEqual({
      ...(one as object),
      id: 4,
    });
    // An `id` a list returned gets the same pet again.
    const listed = pets[2]!;
    await expect(call(api, 'getPet', { petId: listed.id })).resolves.toEqual(listed);
    await expect(call(api, 'getPetNote', { petId: 1 })).resolves.toBe('A very good pet.');
    // Binary responses are real files of their media type.
    const photo = (await call(api, 'getPetPhoto', { petId: 1 })) as Blob;
    expect(photo).toBeInstanceOf(Blob);
    expect(photo.type).toBe('image/png');
    expect([...new Uint8Array(await photo.slice(0, 4).arrayBuffer())]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
    await expect(call(api, 'deletePet', { petId: 1 })).resolves.toBeUndefined();
  });

  it('page through lists until the cursor ends, and bind path parameters into items', async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    const ids = new Set<string>();
    let cursor: string | null | undefined;
    let pages = 0;
    do {
      const page = (await call(api, 'listVisits', {
        petId: 5,
        ...(cursor == null ? {} : { cursor }),
      })) as { items: { id: string; petId: number }[]; nextCursor: string | null };
      for (const visit of page.items) {
        expect(visit.petId).toBe(5);
        ids.add(visit.id);
      }
      cursor = page.nextCursor;
      pages++;
    } while (cursor !== null && pages < 100);
    expect(pages).toBeLessThan(100);
    expect(ids.size).toBeGreaterThan(0);
    // A visit a page listed is the same visit when requested.
    const [first] = ids;
    const visit = (await call(api, 'getVisit', { visitId: first })) as { id: string };
    expect(visit.id).toBe(first);
  });

  it('respond with fixed seeds, empty arrays or the documented error when asked', async () => {
    server.use(...(mocks.mockHandlers!({ seed: 0 }) as never[]));
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!({ id: 1 }));
    server.resetHandlers(...(mocks.mockHandlers!({ seed: 7 }) as never[]));
    const seven = await call(api, 'getPet', { petId: 1 });
    await expect(call(api, 'getPet', { petId: 2 })).resolves.toEqual({
      ...(seven as object),
      id: 2,
    });
    server.resetHandlers(...(mocks.mockHandlers!({ empty: true }) as never[]));
    await expect(call(api, 'listPets')).resolves.toEqual([]);
    await expect(call(api, 'listVisits', { petId: 1 })).resolves.toMatchObject({ items: [] });
    server.resetHandlers(...(mocks.mockHandlers!({ error: true }) as never[]));
    expect(await failure(call(api, 'getVisit', { visitId: 'x' }))).toMatchObject({ status: 404 });
    expect(
      await failure(call(api, 'createPet', { body: { name: 'Bo', kind: 'bird' } })),
    ).toMatchObject({
      status: 422,
    });
    // Without a documented error, `500`.
    expect(await failure(call(api, 'listPets'))).toMatchObject({ status: 500 });
  });

  it('respond with a documented status and its fixture', async () => {
    server.use(mocks.mockGetPet!({ status: 404, seed: 0 }) as never);
    const notFound = await failure(call(api, 'getPet', { petId: 1 }));
    expect((api['isGetPetApiError'] as (e: unknown) => boolean)(notFound)).toBe(true);
    expect(notFound['status']).toBe(404);
    expect(notFound['body']).toEqual(mocks.makeProblem!());
    expect(notFound['body']).toMatchObject({ title: 'Not Found', status: 404 });
    // A range (`4XX`) and `default` serve every status they cover, and error bodies describe the
    // status they are sent with.
    server.use(mocks.mockGetPet!({ status: 409, seed: 0 }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      status: 409,
      body: { ...(mocks.makeProblem!(undefined, { status: 409 }) as object), status: 409 },
    });
    server.use(mocks.mockDeletePet!({ status: 503 }) as never);
    expect(await failure(call(api, 'deletePet', { petId: 1 }))).toMatchObject({
      status: 503,
      body: { title: 'Service Unavailable', status: 503 },
    });
    server.use(mocks.mockCreatePet!({ status: 422, body: { title: 'Invalid' } }) as never);
    expect(
      await failure(call(api, 'createPet', { body: { name: 'Bo', kind: 'bird' } })),
    ).toMatchObject({ status: 422, body: { title: 'Invalid' } });
  });

  it('compute bodies from the request', async () => {
    server.use(
      mocks.mockGetPet!({
        body: ({ params }: { params: { petId: string } }) =>
          mocks.makePet!({ id: Number(params.petId) }),
      }) as never,
      mocks.mockCreatePet!({
        body: async ({ body }: { body: () => Promise<object> }) =>
          mocks.makePet!({ ...(await body()), id: 99 }),
      }) as never,
      mocks.mockListPets!({
        body: ({ query }: { query: URLSearchParams }) =>
          Array.from({ length: Number(query.get('limit')) }, (_, index) =>
            mocks.makePet!({ id: index + 1 }),
          ),
      }) as never,
      mocks.mockUpload!({
        body: async ({ body }: { body: () => Promise<FormData> }) => ({
          size: ((await body()).get('file') as Blob).size,
        }),
      }) as never,
    );
    await expect(call(api, 'getPet', { petId: 7 })).resolves.toMatchObject({ id: 7 });
    // A function can change the body generated for the request.
    server.use(
      mocks.mockGetPet!({
        body: ({ generated }: { generated: () => object }) => ({ ...generated(), name: 'Rex' }),
      }) as never,
    );
    const generated = (await call(api, 'getPet', { petId: 8 })) as Record<string, unknown>;
    expect(generated).toMatchObject({ id: 8, name: 'Rex', kind: expect.any(String) });
    await expect(
      call(api, 'createPet', { body: { name: 'Bo', kind: 'bird' } }),
    ).resolves.toMatchObject({ id: 99, name: 'Bo', kind: 'bird' });
    await expect(call(api, 'listPets', { limit: 3 })).resolves.toHaveLength(3);
    await expect(
      call(api, 'upload', { body: { file: new Blob(['12345']), label: 'x' } }),
    ).resolves.toEqual({ size: 5 });
  });

  it('send a Response a body function returns as it is', async () => {
    server.use(mocks.mockGetPet!({ body: () => Response.error() }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      name: 'RequestError',
      kind: 'network',
    });
    // Bodiless responses take a function too, for side effects or another response.
    let deleted = false;
    server.use(
      mocks.mockDeletePet!({
        body: ({ params }: { params: { petId: string } }) => {
          if (params.petId === '1') deleted = true;
          return params.petId === '1' ? undefined : new Response(null, { status: 410 });
        },
      }) as never,
    );
    await expect(call(api, 'deletePet', { petId: 1 })).resolves.toBeUndefined();
    expect(deleted).toBe(true);
    expect(await failure(call(api, 'deletePet', { petId: 2 }))).toMatchObject({ status: 410 });
  });

  it("write XML documents as the schema's XML Objects describe", async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    const card = (await call(api, 'getPetCard', { petId: 2 })) as string;
    expect(card).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
    // The component's XML Object names the root, with its namespace; `id` is an attribute (with
    // the path parameter's value), `tags` a wrapped list of `tag` elements.
    expect(card).toMatch(/<p:card xmlns:p="https:\/\/example\.com\/pets" id="2">/);
    expect(card).toMatch(/<name>[^<]+<\/name>/);
    expect(card).toMatch(/<tags>(<tag>[^<]+<\/tag>)*<\/tags><\/p:card>/);
  });

  it('decode path parameters, including label and matrix styles', async () => {
    server.use(
      mocks.mockGetBook!({ body: ({ params }: { params: unknown }) => params }) as never,
      mocks.mockDownloadFile!({
        body: ({ params }: { params: { name: string } }) => params.name,
      }) as never,
    );
    await expect(call(api, 'getBook', { shelf: 'a b', id: 'x/y' })).resolves.toEqual({
      shelf: 'a b',
      id: 'x/y',
    });
    await expect(call(api, 'downloadFile', { name: 'report 1.txt' })).resolves.toBe('report 1.txt');
  });

  it("follow the client's base URL and the operations' servers", async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    api.client.setConfig({ baseUrl: 'http://localhost:4000/api/' });
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toMatchObject({ id: 1 });
    // `upload` declares its own server, which the client and the handler both use.
    await expect(call(api, 'upload', { body: { label: 'x' } })).resolves.toEqual(
      expect.objectContaining({ size: expect.any(Number) }),
    );
    server.resetHandlers(mocks.mockGetPet!({ baseUrl: 'https://elsewhere.example.com' }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      name: 'RequestError',
    });
    api.client.setConfig({ baseUrl: 'https://elsewhere.example.com' });
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toMatchObject({ id: 1 });
  });

  it('answer HEAD without a body, and read bodiless requests as undefined', async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    await expect(call(api, 'petExists', { petId: 1 })).resolves.toBeUndefined();
    const head = await fetch(`${baseUrl}/pets/1`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    let received: unknown = 'not read';
    server.use(
      mocks.mockGetPet!({
        body: async ({ body }: { body: () => Promise<unknown> }) => {
          received = await body();
          return mocks.makePet!();
        },
      }) as never,
    );
    await call(api, 'getPet', { petId: 1 });
    expect(received).toBeUndefined();
  });

  it('fail like the network, never respond, or match another client', async () => {
    server.use(mocks.mockGetPet!({ networkError: true }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      name: 'RequestError',
      kind: 'network',
    });
    server.resetHandlers(mocks.mockGetPet!({ delay: 'infinite' }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }, { timeout: 50 }))).toMatchObject({
      kind: 'timeout',
    });
    const other = (api['createClient'] as (config: object) => object)({
      ...api.client.getConfig(),
      baseUrl: 'http://other.test/v2',
    });
    server.resetHandlers(mocks.mockGetPet!({ client: other }) as never);
    await expect(call(api, 'getPet', { petId: 1 }, { client: other })).resolves.toMatchObject({
      id: 1,
    });
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({ kind: 'network' });
  });

  it('add documented and extra headers, and respond once when asked', async () => {
    server.use(mocks.mockListPets!({ once: true, delay: 5, headers: { 'x-extra': '1' } }) as never);
    const response = await fetch(`${baseUrl}/pets`);
    expect(response.headers.get('x-total-count')).toMatch(/^\d+$/);
    expect(response.headers.get('x-extra')).toBe('1');
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(fetch(`${baseUrl}/pets`)).rejects.toThrow('fetch failed');
    server.use(mocks.mockCreatePet!({ status: 422 }) as never);
    const problem = await fetch(`${baseUrl}/pets`, { method: 'POST', body: '{}' });
    expect(problem.headers.get('content-type')).toBe('application/problem+json');
  });
});

describe('mock handlers with dates', () => {
  const server = setupServer();
  let api: Api;
  let mocks: Mocks;

  beforeAll(async () => {
    const { directory } = await generateCase('mocks-runtime-dates', configFor(ADVANCED));
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
    mocks = (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Mocks;
    server.listen({ onUnhandledFrame: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  it('send dates in their wire format and revive request bodies', async () => {
    let received: unknown;
    server.use(...(mocks.mockHandlers!({ seed: 0 }) as never[]));
    // Handlers added later take precedence.
    server.use(
      mocks.mockCreateAccount!({
        body: async ({ body }: { body: () => Promise<unknown> }) => {
          received = await body();
          return mocks.makeAccount!();
        },
      }) as never,
    );
    const account = mocks.makeAccount!() as Record<string, unknown>;
    expect(account['birthday']).toBeInstanceOf(Date);
    // The client revives what the handler encoded: the same `Date` values come back.
    await expect(call(api, 'getAccount', { accountId: 'a' })).resolves.toEqual({
      ...account,
      id: 'a',
    });
    await call(api, 'createAccount', { body: mocks.makeAccountInput!() });
    expect((received as Record<string, unknown>)['birthday']).toBeInstanceOf(Date);
    expect(received).toEqual(mocks.makeAccountInput!());
  });
});

describe('webhook and callback mocks', () => {
  it('make requests the API could send, and send them to a route', async () => {
    const { directory } = await generateCase('mocks-webhooks', configFor(ADVANCED));
    const mocks = (await import(
      pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href
    )) as Mocks;
    const request = mocks.makeAccountClosedWebhookRequest!() as {
      body: Record<string, unknown>;
      headers: Record<string, string>;
    };
    expect(request.body).toEqual(mocks.makeAccount!());
    expect(request.headers['x-signature']).toEqual(expect.any(String));
    expect(mocks.makeAccountClosedWebhookRequest!(undefined, { seed: 2 })).not.toEqual(request);
    expect(mocks.makeCreateAccountAccountEventCallbackRequest).toBeTypeOf('function');
    // Sent like the API sends it: method, headers and the JSON body, dates as strings.
    let received: Request | undefined;
    const capture = async (
      input: Parameters<typeof fetch>[0],
      init?: RequestInit,
    ): Promise<Response> => {
      received = new Request(input, init);
      return Response.json({ received: true });
    };
    const response = (await mocks.sendAccountClosedWebhook!(
      'https://hooks.example.com/closed',
      undefined,
      {
        fetch: capture,
        headers: { 'x-delivery': '1' },
      },
    )) as Response;
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(received?.method).toBe('POST');
    expect(received?.url).toBe('https://hooks.example.com/closed');
    expect(received?.headers.get('content-type')).toBe('application/json');
    expect(received?.headers.get('x-signature')).toBe(request.headers['x-signature']);
    expect(received?.headers.get('x-delivery')).toBe('1');
    const sent = (await received?.json()) as Record<string, unknown>;
    expect(sent['birthday']).toEqual(expect.any(String));
  });
});

describe('sequential media types', () => {
  it('write items as JSON Lines and server-sent events', async () => {
    const { directory } = await generateCase(
      'mocks-sequences',
      configFor(['features-3.2.yaml', '3.2'], { features: { validation: 'zod' } }),
    );
    const api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
    const mocks = (await import(
      pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href
    )) as Mocks;
    const transport = (api['createFetchTransport'] as (config: object) => unknown)({
      fetch: mocks.mockFetch!(mocks.mockHandlers!()),
    });
    api.client.setConfig({ transport });
    // JSON Lines: one audit entry per line.
    const audit = (await call(api, 'exportAudit')) as string;
    const lines = audit.trimEnd().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(JSON.parse(line)).toEqual(expect.any(Object));
    // Server-sent events: `data` lines, separated by blank lines.
    const events = (await call(api, 'streamEvents')) as string;
    const blocks = events.trimEnd().split('\n\n');
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block).toMatch(/^(?:(?:event|id|retry): .*\n)*data: /);
  });
});

describe('mockFetch', () => {
  let api: Api;
  let mocks: Mocks;
  let defaults: Record<string, unknown>;

  beforeAll(async () => {
    const { directory } = await generateCase('mocks-fetch', configFor(MOCKS));
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
    mocks = (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Mocks;
    defaults = { ...api.client.getConfig() };
  });

  afterEach(() => {
    api.client.setConfig(defaults);
  });

  /** The client's fetch transport answered by `handlers`, nothing intercepted. */
  const answeredBy = (handlers: unknown[], options?: object): void => {
    const transport = (api['createFetchTransport'] as (config: object) => unknown)({
      fetch: mocks.mockFetch!(handlers, options),
    });
    api.client.setConfig({ transport });
  };

  it('answers the client from handlers without intercepting requests', async () => {
    answeredBy(mocks.mockHandlers!() as unknown[]);
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toMatchObject({ id: 1 });
    await expect(call(api, 'getPetNote', { petId: 1 })).resolves.toBe('A very good pet.');
    // A relative base URL works outside browsers too.
    api.client.setConfig({ baseUrl: '/v1' });
    await expect(call(api, 'listMyPets')).resolves.toHaveLength(2);
    // `fetch` sends `Patch` as it is spelled; handlers compare methods as MSW does.
    const fetch = mocks.mockFetch!(mocks.mockHandlers!()) as typeof globalThis.fetch;
    const patched = await fetch('/v1/pets/1', {
      method: 'Patch',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bo', kind: 'bird' }),
    });
    expect(patched.status).toBe(200);
  });

  it('rejects like the network without a handler, or uses the fallback', async () => {
    answeredBy([]);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({ kind: 'network' });
    answeredBy([mocks.mockGetPet!({ body: () => Response.error() })]);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({ kind: 'network' });
    const fallback = async (): Promise<Response> => Response.json(mocks.makePet!({ id: 5 }));
    answeredBy([], { fallback });
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toMatchObject({ id: 5 });
  });

  it('gives tests that run at the same time handlers of their own', async () => {
    const make = (name: string): object =>
      (api['createClient'] as (config: object) => object)({
        ...defaults,
        transport: (api['createFetchTransport'] as (config: object) => unknown)({
          fetch: mocks.mockFetch!([mocks.mockGetPet!({ body: mocks.makePet!({ name }) })]),
        }),
      });
    const [a, b] = await Promise.all([
      call(api, 'getPet', { petId: 1 }, { client: make('A') }),
      call(api, 'getPet', { petId: 1 }, { client: make('B') }),
    ]);
    expect([a, b]).toMatchObject([{ name: 'A' }, { name: 'B' }]);
  });
});

describe('mock handlers with the axios adapter', () => {
  const server = setupServer();
  let api: Api;
  let mocks: Mocks;

  beforeAll(async () => {
    const { directory } = await generateCase('mocks-axios', {
      ...configFor(MOCKS),
      client: { adapter: 'axios' },
    });
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
    mocks = (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Mocks;
    server.listen({ onUnhandledFrame: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  it('answer requests axios sends', async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toMatchObject({ id: 1 });
    await expect(call(api, 'getPetNote', { petId: 1 })).resolves.toBe('A very good pet.');
    server.use(
      mocks.mockCreatePet!({
        body: async ({ body }: { body: () => Promise<object> }) =>
          mocks.makePet!({ ...(await body()), id: 3 }),
      }) as never,
    );
    await expect(
      call(api, 'createPet', { body: { name: 'Bo', kind: 'bird' } }),
    ).resolves.toMatchObject({ id: 3, name: 'Bo' });
    server.use(mocks.mockGetPet!({ status: 404, seed: 0 }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      status: 404,
      body: mocks.makeProblem!(),
    });
  });
});

/** A value of a parameter's schema, good enough to send. */
function sampleParameter(schema: SchemaIR): unknown {
  switch (schema.kind) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'enum':
      return schema.values[0];
    case 'array':
      return [sampleParameter(schema.items)];
    case 'object':
      return {};
    default:
      return 'x';
  }
}

describe('default handlers', () => {
  it.each(SPECS)(
    'answer every operation of %s with a response its client validates',
    async (file, version) => {
      const spec: Spec = [file, version];
      const { directory, result } = await generateCase(
        caseName('mocks-e2e', spec),
        configFor(spec, { features: { validation: { library: 'zod', request: false } } }),
      );
      const load = async (module: string): Promise<Record<string, unknown>> =>
        (await import(pathToFileURL(path.join(directory, `${module}.ts`)).href)) as Record<
          string,
          unknown
        >;
      const api = await load('index');
      const mocks = (await load('mocks/index')) as Mocks;
      const project = result.project;
      if (project === undefined) throw new Error('No project');
      const transport = (api['createFetchTransport'] as (config: object) => unknown)({
        fetch: mocks.mockFetch!(mocks.mockHandlers!()),
      });
      (api['client'] as Api['client']).setConfig({ transport });
      const failures: string[] = [];
      for (const symbol of project.operations) {
        const plan = planOperation(symbol, project.ir);
        const params: Record<string, unknown> = {};
        for (const { property, parameter } of plan.parameters)
          if (parameter.required) params[property] = sampleParameter(parameter.schema);
        if (plan.body?.required === true) {
          const media = plan.body.media;
          const model =
            media.schema.kind === 'ref' ? project.modelById.get(media.schema.target) : undefined;
          params[plan.body.property] =
            model?.fixtureName === undefined
              ? media.schema.kind === 'binary'
                ? new Blob(['x'])
                : {}
              : mocks[model.fixtureName]!();
        }
        const operation = api[symbol.name] as (params: object) => Promise<unknown>;
        await operation(params).catch((error: unknown) => {
          failures.push(
            `${symbol.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
      expect(failures).toEqual([]);
    },
  );
});
