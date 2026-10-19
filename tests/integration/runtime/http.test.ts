import path from 'node:path';
import { pathToFileURL } from 'node:url';
import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';

// Generated modules are loaded dynamically; their types are checked by the compile tests.
type Module = Record<string, (...args: unknown[]) => Promise<unknown>> & {
  client: {
    setConfig(config: Record<string, unknown>): void;
    getConfig(): Record<string, unknown>;
    use(middleware: Record<string, unknown>): () => void;
  };
  createClient(config: Record<string, unknown>): Module['client'];
  createAxiosTransport?(instance: unknown): unknown;
  ApiError: new (...args: never[]) => Error;
  RequestError: new (...args: never[]) => Error;
};

let server: MockServer;
beforeAll(async () => {
  server = await startMockServer();
});
afterAll(async () => {
  await server.close();
});

async function load(
  name: string,
  input: string,
  version: '2.0' | '3.0' | '3.1',
  adapter: 'fetch' | 'axios',
  extra = {},
): Promise<Module> {
  const { directory } = await generateCase(name, {
    spec: { version, input: fixture(input) },
    client: { adapter },
    ...extra,
  });
  return (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Module;
}

const rejection = async (promise: Promise<unknown>): Promise<Error & Record<string, unknown>> => {
  try {
    await promise;
  } catch (error) {
    return error as Error & Record<string, unknown>;
  }
  throw new Error('Expected the promise to reject');
};

describe.each(['fetch', 'axios'] as const)('%s adapter', (adapter) => {
  let petstore: Module;
  let features: Module;
  let swagger: Module;

  beforeAll(async () => {
    petstore = await load(`http-petstore-${adapter}`, 'petstore-3.0.yaml', '3.0', adapter);
    features = await load(`http-features-${adapter}`, 'features-3.1.yaml', '3.1', adapter);
    swagger = await load(`http-swagger-${adapter}`, 'petstore-2.0.json', '2.0', adapter);
    for (const api of [petstore, features, swagger])
      api.client.setConfig({ baseUrl: `${server.url}/api` });
  });

  it('builds URLs with encoded path parameters and parses JSON', async () => {
    server.respond(() => ({ body: { id: 1, name: 'Rex', photoUrls: [] } }));
    await expect(petstore.getPetById!({ petId: 1 })).resolves.toEqual({
      id: 1,
      name: 'Rex',
      photoUrls: [],
    });
    expect(server.requests.at(-1)).toMatchObject({ method: 'GET', url: '/api/pet/1' });
    expect(server.requests.at(-1)?.headers.accept).toBe('application/json');

    server.respond(() => ({ body: { username: 'a b' } }));
    await petstore.getUserByName!({ username: 'a b/c' });
    expect(server.requests.at(-1)?.url).toBe('/api/user/a%20b%2Fc');
  });

  it('serializes query parameters, headers and cookies with their styles', async () => {
    server.respond(() => ({ body: { items: [] }, headers: { 'x-total-count': '0' } }));
    await features.listShapes!({
      filter: { color: 'red', minArea: 2 },
      ids: [1, 2],
      cursor: null,
      limit: 5,
      'X-Request-ID': 'req-1',
      session: 'abc',
    });
    const request = server.requests.at(-1);
    expect(request?.path).toBe('/api/shapes');
    expect(request?.rawQuery).toBe('filter[color]=red&filter[minArea]=2&ids=1%7C2&limit=5');
    expect(request?.headers['x-request-id']).toBe('req-1');
    expect(request?.headers.cookie).toBe('session=abc');

    server.respond(() => ({ body: [] }));
    await petstore.findPetsByTags!({ tags: ['a', 'b'] });
    expect(server.requests.at(-1)?.rawQuery).toBe('tags=a,b');
    await swagger.findPetsByStatus!({ status: ['available', 'sold'], sort: ['name', 'id'] });
    expect(server.requests.at(-1)?.rawQuery).toBe('status=available&status=sold&sort=name%7Cid');
  });

  it('applies the first satisfiable security requirement', async () => {
    server.respond(() => ({ body: {} }));
    petstore.client.setConfig({ auth: { petstore_auth: () => Promise.resolve('oauth-token') } });
    await petstore.getPetById!({ petId: 1 });
    expect(server.requests.at(-1)?.headers.authorization).toBe('Bearer oauth-token');
    expect(server.requests.at(-1)?.headers.api_key).toBeUndefined();

    petstore.client.setConfig({ auth: { api_key: 'secret', petstore_auth: 'oauth-token' } });
    await petstore.getPetById!({ petId: 1 });
    expect(server.requests.at(-1)?.headers.api_key).toBe('secret');
    expect(server.requests.at(-1)?.headers.authorization).toBeUndefined();
    petstore.client.setConfig({ auth: undefined });

    swagger.client.setConfig({ auth: { api_key: 'k' } });
    await swagger.getInventory!();
    expect(server.requests.at(-1)?.headers.api_key).toBe('k');

    features.client.setConfig({ auth: { bearerAuth: () => 'jwt' } });
    await features.getTree!();
    expect(server.requests.at(-1)?.headers.authorization).toBe('Bearer jwt');
    server.respond(() => ({ status: 204 }));
    await features.deleteShape!({ shapeId: 's' });
    expect(server.requests.at(-1)?.headers.authorization).toBeUndefined();
    features.client.setConfig({ auth: undefined });
  });

  it('sends JSON, urlencoded, multipart and binary bodies', async () => {
    server.respond(() => ({ status: 201, body: { id: 7, name: 'n', photoUrls: [] } }));
    await expect(petstore.addPet!({ body: { name: 'n', photoUrls: [] } })).resolves.toMatchObject({
      id: 7,
    });
    expect(server.requests.at(-1)?.headers['content-type']).toBe('application/json');
    expect(server.requests.at(-1)?.json()).toEqual({ name: 'n', photoUrls: [] });

    server.respond(() => ({ status: 200, body: '' }));
    await swagger.updatePetWithForm!({ petId: 3, body: { name: 'Tom', status: 'sold' } });
    expect(server.requests.at(-1)?.headers['content-type']).toContain(
      'application/x-www-form-urlencoded',
    );
    expect(server.requests.at(-1)?.text()).toBe('name=Tom&status=sold');

    server.respond(() => ({ body: { code: 200 } }));
    await petstore.uploadFile!({
      petId: 1,
      additionalMetadata: 'meta',
      body: { file: new Blob(['png-bytes'], { type: 'image/png' }), tags: ['a', 'b'] },
    });
    const upload = server.requests.at(-1)!;
    expect(upload.url).toBe('/api/pet/1/uploadImage?additionalMetadata=meta');
    expect(upload.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    const form = await upload.formData();
    expect(await (form.get('file') as Blob).text()).toBe('png-bytes');
    expect(form.getAll('tags')).toEqual(['a', 'b']);

    server.respond(() => ({ body: { id: 'doc' } }));
    await features.uploadDocument!({ body: new Uint8Array([1, 2, 3]) });
    expect(server.requests.at(-1)?.headers['content-type']).toBe('application/octet-stream');
    expect([...server.requests.at(-1)!.body]).toEqual([1, 2, 3]);
  });

  it('reads binary, text and empty responses', async () => {
    server.respond(() => ({
      headers: { 'content-type': 'image/png' },
      body: Buffer.from([137, 80, 78, 71]),
    }));
    const photo = (await petstore.downloadPhoto!({ petId: 1 })) as Blob;
    expect(photo).toBeInstanceOf(Blob);
    expect([...new Uint8Array(await photo.arrayBuffer())]).toEqual([137, 80, 78, 71]);

    server.respond(() => ({ status: 204 }));
    await expect(petstore.deletePet!({ petId: 1 })).resolves.toBeUndefined();

    server.respond(() => ({ headers: { 'content-type': 'text/plain' }, body: 'plain text' }));
    await expect(petstore.loginUser!({ username: 'u', password: 'p' })).resolves.toBe('plain text');
  });

  it('rejects with ApiError carrying status, body and headers', async () => {
    server.respond(() => ({
      status: 404,
      headers: { 'x-trace': 't1' },
      body: { code: 'not_found', message: 'No pet' },
    }));
    const error = await rejection(petstore.getPetById!({ petId: 9 }));
    expect(error).toBeInstanceOf(petstore.ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 404,
      operationId: 'getPetById',
      method: 'GET',
      body: { code: 'not_found', message: 'No pet' },
    });
    expect((error.headers as Headers).get('x-trace')).toBe('t1');
    expect(error.url).toBe(`${server.url}/api/pet/9`);
    // The axios adapter keeps the original AxiosError as the cause.
    expect(adapter !== 'axios' || axios.isAxiosError(error.cause)).toBe(true);

    server.respond(() => ({
      status: 500,
      headers: { 'content-type': 'text/plain' },
      body: 'boom',
    }));
    await expect(rejection(petstore.getInventory!())).resolves.toMatchObject({
      status: 500,
      body: 'boom',
    });
  });

  it('reports network failures and timeouts as RequestError', async () => {
    server.respond(() => ({ destroy: true }));
    const network = await rejection(petstore.getInventory!());
    expect(network).toBeInstanceOf(petstore.RequestError);
    expect(network.kind).toBe('network');

    server.respond(() => ({ delay: 300, body: {} }));
    const timeout = await rejection(petstore.getInventory!({ timeout: 50 }));
    expect(timeout).toMatchObject({
      name: 'RequestError',
      kind: 'timeout',
      operationId: 'getInventory',
    });
  });

  it('propagates cancellation without wrapping it', async () => {
    server.respond(() => ({ delay: 300, body: {} }));
    const controller = new AbortController();
    const pending = rejection(petstore.getInventory!({ signal: controller.signal }));
    setTimeout(() => {
      controller.abort();
    }, 20);
    const error = await pending;
    expect(error).not.toBeInstanceOf(petstore.RequestError);
    expect(['AbortError', 'CanceledError']).toContain(error.name);
  });

  it('runs middleware in order and can recover from failures', async () => {
    server.respond(() => ({ body: { a: 1 } }));
    const calls: string[] = [];
    const remove = petstore.client.use({
      onRequest: ({ request }: { request: { headers: Headers } }) => {
        calls.push('request');
        request.headers.set('x-middleware', 'yes');
      },
      onResponse: ({ response }: { response: { data: unknown } }) => {
        calls.push('response');
        return { ...response, data: { wrapped: response.data } };
      },
    });
    await expect(petstore.getInventory!()).resolves.toEqual({ wrapped: { a: 1 } });
    expect(server.requests.at(-1)?.headers['x-middleware']).toBe('yes');
    expect(calls).toEqual(['request', 'response']);
    remove();

    server.respond(() => ({ destroy: true }));
    const removeRecovery = petstore.client.use({
      onError: () => ({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: { fallback: true },
        raw: undefined,
      }),
    });
    await expect(petstore.getInventory!()).resolves.toEqual({ fallback: true });
    removeRecovery();
  });

  it('supports per-call clients, headers and default headers', async () => {
    server.respond(() => ({ body: {} }));
    const other = petstore.createClient({
      ...petstore.client.getConfig(),
      baseUrl: `${server.url}/other`,
      headers: { 'x-tenant': 't1', 'x-drop': 'd' },
    });
    await petstore.getInventory!({
      client: other,
      headers: { 'x-call': 'c', 'x-drop': undefined },
    });
    expect(server.requests.at(-1)?.url).toBe('/other/store/inventory');
    expect(server.requests.at(-1)?.headers['x-tenant']).toBe('t1');
    expect(server.requests.at(-1)?.headers['x-call']).toBe('c');
    expect(server.requests.at(-1)?.headers['x-drop']).toBeUndefined();
  });

  it.runIf(adapter === 'fetch')('rejects malformed JSON in successful responses', async () => {
    server.respond(() => ({
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    }));
    await expect(rejection(petstore.getInventory!())).resolves.toMatchObject({
      name: 'RequestError',
      kind: 'parse',
    });
  });

  it.runIf(adapter === 'axios')('uses a custom axios instance with its interceptors', async () => {
    server.respond(() => ({ body: { ok: true } }));
    const instance = axios.create({ headers: { 'x-instance': 'custom' } });
    instance.interceptors.request.use((config) => {
      config.headers.set('x-intercepted', '1');
      return config;
    });
    const transport = petstore.createAxiosTransport!(instance);
    const custom = petstore.createClient({ ...petstore.client.getConfig(), transport });
    await petstore.getInventory!({
      client: custom,
      transportOptions: { headers: { 'x-extra': 'e' } },
    });
    expect(server.requests.at(-1)?.headers['x-instance']).toBe('custom');
    expect(server.requests.at(-1)?.headers['x-intercepted']).toBe('1');
  });
});

describe('full response style', () => {
  it('resolves with data, status and headers', async () => {
    const api = await load('http-full', 'petstore-3.0.yaml', '3.0', 'fetch', {
      client: { responseStyle: 'full', adapter: 'fetch' },
    });
    api.client.setConfig({ baseUrl: server.url });
    server.respond(() => ({ status: 201, headers: { 'x-id': '7' }, body: { id: 7 } }));
    const response = (await api.addPet!({ body: { name: 'n', photoUrls: [] } })) as {
      data: unknown;
      status: number;
      headers: Headers;
    };
    expect(response.status).toBe(201);
    expect(response.data).toEqual({ id: 7 });
    expect(response.headers.get('x-id')).toBe('7');
  });
});
