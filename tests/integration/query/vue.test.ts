import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueryClient } from '@tanstack/vue-query';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, type Ref } from 'vue';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';
import { queryFeatures } from './consumers.ts';

type AnyFn = (...args: never[]) => unknown;
interface QueryResult {
  data: Ref<unknown>;
  isSuccess: Ref<boolean>;
}

let server: MockServer;
let hooks: Record<string, AnyFn>;
let queryClient: QueryClient;

/** Runs composables in an effect scope, as a component's `setup` would. */
function inScope<T>(fn: () => T): { value: T; stop: () => void } {
  const scope = effectScope();
  const value = scope.run(fn) as T;
  return { value, stop: () => scope.stop() };
}
const call = (name: string, ...args: unknown[]): unknown =>
  (hooks[name] as (...a: unknown[]) => unknown)(...args);
const circle = { kind: 'circle', id: 'c1', radius: 2 };

beforeAll(async () => {
  server = await startMockServer();
  const { directory } = await generateCase('vue-query-runtime', {
    spec: { version: '3.1', input: fixture('features-3.1.yaml') },
    features: queryFeatures('vue'),
  });
  const api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as {
    client: { setConfig(config: Record<string, unknown>): void };
  };
  hooks = (await import(
    pathToFileURL(path.join(directory, 'vue-query', 'index.ts')).href
  )) as Record<string, AnyFn>;
  api.client.setConfig({ baseUrl: server.url });
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('generated Vue Query composables', () => {
  it('refetch when a parameter getter changes', async () => {
    server.respond((request) => ({ body: { ...circle, id: request.path.split('/').at(-1) } }));
    const id = ref('a');
    const { value: query, stop } = inScope(
      () => call('useGetShape', () => ({ shapeId: id.value }), {}, queryClient) as QueryResult,
    );
    await vi.waitFor(() => {
      expect(query.data.value).toMatchObject({ id: 'a' });
    });
    id.value = 'b';
    await vi.waitFor(() => {
      expect(query.data.value).toMatchObject({ id: 'b' });
    });
    expect(server.requests.map((r) => r.url)).toEqual(['/shapes/a', '/shapes/b']);
    stop();
  });

  it('honors reactive options such as enabled', async () => {
    server.respond(() => ({ body: circle }));
    const enabled = ref(false);
    const { value: query, stop } = inScope(
      () =>
        call(
          'useGetShape',
          { shapeId: 'c1' },
          () => ({ enabled: enabled.value }),
          queryClient,
        ) as QueryResult,
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.requests).toHaveLength(0);
    enabled.value = true;
    await vi.waitFor(() => {
      expect(query.isSuccess.value).toBe(true);
    });
    stop();
  });

  it('run mutations and invalidate configured queries', async () => {
    server.respond((request) =>
      request.method === 'POST'
        ? { status: 201, body: circle }
        : { body: { items: [], nextCursor: null } },
    );
    const { value, stop } = inScope(() => ({
      list: call('useListShapes', { 'X-Request-ID': 'r1' }, {}, queryClient) as QueryResult,
      create: call('useCreateShape', {}, queryClient) as {
        mutateAsync(variables: unknown): Promise<unknown>;
      },
    }));
    await vi.waitFor(() => {
      expect(value.list.isSuccess.value).toBe(true);
    });
    const listCalls = (): number => server.requests.filter((r) => r.method === 'GET').length;
    expect(listCalls()).toBe(1);
    await value.create.mutateAsync({ body: circle });
    expect(server.requests.find((r) => r.method === 'POST')?.json()).toEqual(circle);
    await vi.waitFor(() => {
      expect(listCalls()).toBe(2);
    });
    stop();
  });
});
