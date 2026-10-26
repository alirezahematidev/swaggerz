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
    for (const model of models) {
      const make = mocks[model.fixtureName ?? ''] as () => unknown;
      let value = make();
      // Schemas validate the wire format: with `types.dates: 'Date'`, dates are strings there.
      if (model.datesModule !== undefined && model.datesName !== undefined) {
        const { encodeDates } = (await load('runtime/dates')) as {
          encodeDates: (value: unknown, shape: unknown) => unknown;
        };
        value = encodeDates(value, (await load(model.datesModule))[model.datesName]);
      }
      const found = problem(schemas[model.schemaName ?? ''], value);
      if (found !== undefined) failures.push(`${model.name}: ${found}`);
      // Every call returns an equal value, and a new one for objects.
      expect(make()).toEqual(make());
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

  it(`respond with the fixtures by default (${label})`, async () => {
    server.use(...(mocks.mockHandlers!() as never[]));
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!());
    // A media type example; and `/pets/mine` is matched before `/pets/{petId}`.
    await expect(call(api, 'listMyPets')).resolves.toEqual([
      { id: 1, name: 'Rex', kind: 'dog', tags: [] },
      { id: 2, name: 'Tom', kind: 'cat', tags: ['indoor'] },
    ]);
    await expect(call(api, 'getPetNote', { petId: 1 })).resolves.toBe('A very good pet.');
    const photo = (await call(api, 'getPetPhoto', { petId: 1 })) as Blob;
    expect(photo).toBeInstanceOf(Blob);
    expect(photo.type).toBe('image/png');
    await expect(call(api, 'deletePet', { petId: 1 })).resolves.toBeUndefined();
    await expect(call(api, 'listPets')).resolves.toEqual([mocks.makePet!()]);
  });

  it('respond with a documented status and its fixture', async () => {
    server.use(mocks.mockGetPet!({ status: 404 }) as never);
    const notFound = await failure(call(api, 'getPet', { petId: 1 }));
    expect((api['isGetPetApiError'] as (e: unknown) => boolean)(notFound)).toBe(true);
    expect(notFound['status']).toBe(404);
    expect(notFound['body']).toEqual(mocks.makeProblem!());
    // A range (`4XX`) and `default` serve every status they cover.
    server.use(mocks.mockGetPet!({ status: 409 }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      status: 409,
      body: mocks.makeProblem!(),
    });
    server.use(mocks.mockDeletePet!({ status: 503 }) as never);
    expect(await failure(call(api, 'deletePet', { petId: 1 }))).toMatchObject({
      status: 503,
      body: mocks.makeProblem!(),
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
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!());
    // `upload` declares its own server, which the client and the handler both use.
    await expect(call(api, 'upload', { body: { label: 'x' } })).resolves.toEqual(
      expect.objectContaining({ size: expect.any(Number) }),
    );
    server.resetHandlers(mocks.mockGetPet!({ baseUrl: 'https://elsewhere.example.com' }) as never);
    expect(await failure(call(api, 'getPet', { petId: 1 }))).toMatchObject({
      name: 'RequestError',
    });
    api.client.setConfig({ baseUrl: 'https://elsewhere.example.com' });
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!());
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
    await expect(call(api, 'getPet', { petId: 1 }, { client: other })).resolves.toEqual(
      mocks.makePet!(),
    );
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
    server.use(...(mocks.mockHandlers!() as never[]));
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
    await expect(call(api, 'getAccount', { accountId: 'a' })).resolves.toEqual(account);
    await call(api, 'createAccount', { body: mocks.makeAccountInput!() });
    expect((received as Record<string, unknown>)['birthday']).toBeInstanceOf(Date);
    expect(received).toEqual(mocks.makeAccountInput!());
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
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!());
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
    await expect(call(api, 'getPet', { petId: 1 })).resolves.toEqual(mocks.makePet!());
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
    server.use(mocks.mockGetPet!({ status: 404 }) as never);
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
