import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';

// Generated modules are loaded dynamically; their types are checked by the compile tests.
type Operation = (...args: unknown[]) => Promise<unknown>;
interface Api {
  readonly createAccount: Operation;
  readonly createDiscount: Operation;
  readonly getAccount: Operation;
  readonly listStatements: Operation;
  readonly uploadAvatar: Operation;
  readonly client: {
    setConfig(config: Record<string, unknown>): void;
    getConfig(): Record<string, unknown>;
  };
}
interface QueryOptions {
  queryFn(context: { signal: AbortSignal }): Promise<unknown>;
}
interface ReactQueryApi {
  getAccountQueryOptions(params: unknown): QueryOptions;
}

let server: MockServer;
let api: Api;
let reactQuery: ReactQueryApi;

const ACCOUNT = {
  id: 'a1',
  name: 'Ada',
  createdAt: '2026-03-04T05:06:07.000Z',
  birthday: '1990-12-10',
  owner: { name: 'Ada', born: '1990-12-10', parent: { name: 'Byron', born: '1788-01-22' } },
  history: [{ id: 's1', issuedOn: '2026-01-31', amount: 3 }],
  reminders: { renewal: '2027-01-01T00:00:00.000Z' },
  lastEvent: { type: 'closed', closedOn: '2026-02-01' },
};

beforeAll(async () => {
  server = await startMockServer();
  const { directory } = await generateCase('runtime-advanced', {
    spec: { version: '3.1', input: fixture('advanced-3.1.yaml') },
    types: { dates: 'Date' },
    features: { validation: { library: 'zod', request: true }, reactQuery: true },
  });
  api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
  reactQuery = (await import(
    pathToFileURL(path.join(directory, 'react-query', 'index.ts')).href
  )) as ReactQueryApi;
  api.client.setConfig({ baseUrl: server.url });
});
afterAll(async () => {
  await server.close();
});

describe('dates', () => {
  it('revives nested, recursive, mapped and discriminated dates in responses', async () => {
    server.respond(() => ({ status: 201, body: ACCOUNT }));
    const account = (await api.createAccount({
      body: { name: 'Ada', password: 'secret' },
    })) as Record<string, unknown> & typeof ACCOUNT;
    expect(account.createdAt).toEqual(new Date('2026-03-04T05:06:07.000Z'));
    expect(account.birthday).toEqual(new Date('1990-12-10'));
    expect(account.owner.born).toBeInstanceOf(Date);
    expect(account.owner.parent.born).toEqual(new Date('1788-01-22'));
    expect(account.history[0]?.issuedOn).toEqual(new Date('2026-01-31'));
    expect(account.reminders.renewal).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(account.lastEvent.closedOn).toEqual(new Date('2026-02-01'));
    expect(account.name).toBe('Ada');
  });

  it('encodes Date values in bodies and parameters without mutating the input', async () => {
    server.respond(() => ({ status: 201, body: ACCOUNT }));
    const body = {
      name: 'Ada',
      password: 'secret',
      birthday: new Date('1990-12-10'),
      history: [{ issuedOn: new Date('2026-01-31'), amount: 1 }],
      reminders: { renewal: new Date('2027-01-01T08:00:00.000Z') },
    };
    await api.createAccount({ body });
    expect(server.requests.at(-1)?.json()).toEqual({
      name: 'Ada',
      password: 'secret',
      birthday: '1990-12-10',
      history: [{ issuedOn: '2026-01-31', amount: 1 }],
      reminders: { renewal: '2027-01-01T08:00:00.000Z' },
    });
    expect(body.birthday).toBeInstanceOf(Date);

    server.respond(() => ({ body: [] }));
    await api.listStatements({
      accountId: 'a1',
      since: new Date('2026-01-01'),
      until: new Date('2026-02-01T10:00:00.000Z'),
    });
    expect(server.requests.at(-1)?.url).toBe(
      '/accounts/a1/statements?since=2026-01-01&until=2026-02-01T10%3A00%3A00.000Z',
    );
  });

  it('rejects invalid dates when responses are validated', async () => {
    server.respond(() => ({ status: 201, body: { ...ACCOUNT, createdAt: 'yesterday' } }));
    await expect(api.createAccount({ body: { name: 'Ada', password: 'p' } })).rejects.toMatchObject(
      { name: 'RequestError', kind: 'validation' },
    );
  });
});

describe('request media types', () => {
  it('sends the selected media type with its serializer', async () => {
    server.respond(() => ({ status: 201, body: ACCOUNT }));
    await api.createAccount({
      contentType: 'application/x-www-form-urlencoded',
      body: { name: 'Ada Lovelace', password: 'p&q' },
    });
    const form = server.requests.at(-1);
    expect(form?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(form?.text()).toBe('name=Ada+Lovelace&password=p%26q');

    await api.createAccount({ contentType: 'application/xml', body: '<account name="Ada"/>' });
    const xml = server.requests.at(-1);
    expect(xml?.headers['content-type']).toBe('application/xml');
    expect(xml?.text()).toBe('<account name="Ada"/>');

    await api.createAccount({ body: { name: 'Ada', password: 'p' } });
    expect(server.requests.at(-1)?.headers['content-type']).toBe('application/json');
  });
});

describe('statuses and servers', () => {
  it('resolves declared 304 responses without a body', async () => {
    server.respond(() => ({ status: 304 }));
    await expect(api.getAccount({ accountId: 'a1', 'If-None-Match': '"v1"' })).resolves.toBe(
      undefined,
    );
    expect(server.requests.at(-1)?.headers['if-none-match']).toBe('"v1"');
    server.respond(() => ({ status: 404 }));
    await expect(api.getAccount({ accountId: 'a1' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });

  it('gives TanStack Query null instead of undefined for bodiless responses', async () => {
    server.respond(() => ({ status: 304 }));
    const options = reactQuery.getAccountQueryOptions({ accountId: 'a1' });
    await expect(options.queryFn({ signal: new AbortController().signal })).resolves.toBeNull();
  });

  it('sends operations with their own servers there unless disabled or overridden', async () => {
    const urls: string[] = [];
    const transport = (request: { url: string }) => {
      urls.push(request.url);
      return Promise.resolve({
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        data: undefined,
        raw: undefined,
      });
    };
    const original = api.client.getConfig();
    api.client.setConfig({ transport });
    try {
      await api.uploadAvatar({ body: new Blob(['png']) });
      await api.uploadAvatar({ body: new Blob(['png']) }, { baseUrl: 'https://proxy.test' });
      api.client.setConfig({ operationServers: false });
      await api.uploadAvatar({ body: new Blob(['png']) });
    } finally {
      api.client.setConfig(original);
    }
    expect(urls).toEqual([
      'https://eu.uploads.example.com/v2/uploads/avatar',
      'https://proxy.test/uploads/avatar',
      `${server.url}/uploads/avatar`,
    ]);
  });
});

describe('assertions types cannot express', () => {
  it('enforces not, if/then/else, dependentRequired and dependentSchemas in request validation', async () => {
    server.respond(() => ({ status: 204 }));
    const valid = [
      { kind: 'percent', value: 20 },
      { kind: 'amount', value: 500, currency: 'EUR', code: 'SPRING' },
    ];
    for (const body of valid) await expect(api.createDiscount({ body })).resolves.toBeUndefined();
    const sent = server.requests.length;
    const invalid = [
      // then: percentages are at most 100
      { kind: 'percent', value: 150 },
      // else: amounts need a currency
      { kind: 'amount', value: 5 },
      // not: code must not be TEST
      { kind: 'percent', value: 5, code: 'TEST', currency: 'EUR' },
      // dependentRequired: code requires currency
      { kind: 'percent', value: 5, code: 'SPRING' },
      // dependentSchemas: currency must have three letters
      { kind: 'amount', value: 5, currency: 'EURO' },
    ];
    for (const body of invalid) {
      await expect(api.createDiscount({ body }), JSON.stringify(body)).rejects.toMatchObject({
        name: 'RequestError',
        kind: 'validation',
      });
    }
    expect(server.requests).toHaveLength(sent);
  });
});
