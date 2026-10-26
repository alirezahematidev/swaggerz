// @vitest-environment happy-dom
/**
 * Mock handlers in a DOM test environment (happy-dom, as component tests use): a relative base URL
 * resolves against the page, and the DOM's own `Blob` and `FormData` go through the handlers.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';

type Module = Record<string, (...args: unknown[]) => unknown>;

describe('mock handlers in happy-dom', () => {
  const server = setupServer();
  let api: Module;
  let mocks: Module;

  beforeAll(async () => {
    const { directory } = await generateCase('mocks-dom', {
      spec: { version: '3.1', input: fixture('mocks-3.1.yaml') },
      client: { baseUrl: '/api' },
      features: { mocks: 'msw' },
    });
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Module;
    mocks = (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Module;
    server.listen({ onUnhandledFrame: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  it('answer requests to a relative base URL, on the page origin', async () => {
    const page = (globalThis as unknown as { location: { origin: string } }).location;
    expect(page.origin).toMatch(/^http:\/\/localhost/);
    server.use(...(mocks.mockHandlers!() as never[]));
    await expect(api.getPet!({ petId: 1 })).resolves.toEqual(mocks.makePet!());
    const photo = (await api.getPetPhoto!({ petId: 1 })) as Blob;
    expect(photo.type).toBe('image/png');
    expect(await photo.text()).not.toBe('');
  });

  it('read DOM bodies and send DOM blobs', async () => {
    server.use(
      mocks.mockUpload!({
        body: async ({ body }: { body: () => Promise<FormData> }) => ({
          size: ((await body()).get('file') as Blob).size,
        }),
      }) as never,
      mocks.mockGetPetPhoto!({ body: new Blob(['abc'], { type: 'image/png' }) }) as never,
    );
    // `upload` declares its own (absolute) server.
    await expect(api.upload!({ body: { file: new Blob(['12345']), label: 'x' } })).resolves.toEqual(
      { size: 5 },
    );
    const photo = (await api.getPetPhoto!({ petId: 1 })) as Blob;
    expect(await photo.text()).toBe('abc');
  });
});

describe('cross-origin mock handlers in happy-dom', () => {
  const server = setupServer();
  const load = async (name: string, adapter: 'fetch' | 'axios'): Promise<[Module, Module]> => {
    const { directory } = await generateCase(name, {
      spec: { version: '3.1', input: fixture('mocks-3.1.yaml') },
      client: { adapter },
      features: { mocks: 'msw' },
    });
    return [
      (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Module,
      (await import(pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href)) as Module,
    ];
  };

  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  it.each(['fetch', 'axios'] as const)(
    'answer the preflight, then the request (%s), and count once without the preflight',
    async (adapter) => {
      const [api, mocks] = await load(`mocks-dom-cors-${adapter}`, adapter);
      server.resetHandlers(mocks.mockGetPet!({ once: true }) as never);
      await expect(api.getPet!({ petId: 1 })).resolves.toEqual(mocks.makePet!());
      await expect(api.getPet!({ petId: 1 })).rejects.toMatchObject({ name: 'RequestError' });
      server.resetHandlers(mocks.mockGetPet!({ status: 404 }) as never);
      await expect(api.getPet!({ petId: 1 })).rejects.toMatchObject({
        status: 404,
        body: mocks.makeProblem!(),
      });
    },
  );
});
