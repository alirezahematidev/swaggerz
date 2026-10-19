// @vitest-environment happy-dom
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';
import { REACT_QUERY_CONFIG } from './config.ts';

type AnyFn = (...args: never[]) => unknown;
type Api = Record<string, AnyFn> & {
  client: {
    setConfig(config: Record<string, unknown>): void;
    use(middleware: Record<string, unknown>): () => void;
  };
};
type Hooks = Record<string, AnyFn> & { shapesKeys: { all: readonly string[] } };

let server: MockServer;
let api: Api;
let hooks: Hooks;
let queryClient: QueryClient;

const hook = <T>(fn: () => T) => {
  const client = queryClient;
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(fn, { wrapper });
};
const call = (name: string, ...args: unknown[]): unknown =>
  (hooks[name] as (...a: unknown[]) => unknown)(...args);
const circle = { kind: 'circle', id: 'c1', radius: 2 };

beforeAll(async () => {
  server = await startMockServer();
  const { directory } = await generateCase('rq-runtime', {
    spec: { version: '3.1', input: fixture('features-3.1.yaml') },
    features: REACT_QUERY_CONFIG,
  });
  api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as Api;
  hooks = (await import(
    pathToFileURL(path.join(directory, 'react-query', 'index.ts')).href
  )) as Hooks;
  api.client.setConfig({ baseUrl: server.url });
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe('generated React Query hooks', () => {
  it('fetches data and applies select', async () => {
    server.respond(() => ({ body: circle }));
    const { result } = hook(() => call('useGetShape', { shapeId: 'c1' }) as UseQueryResult);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(circle);
    expect(server.requests.at(-1)?.url).toBe('/shapes/c1');

    const selected = hook(
      () =>
        call(
          'useGetShape',
          { shapeId: 'c1' },
          { select: (s: { kind: string }) => s.kind },
        ) as UseQueryResult,
    );
    await waitFor(() => {
      expect(selected.result.current.data).toBe('circle');
      // The cached entry is stale, so mounting triggers a background refetch; let it settle.
      expect(selected.result.current.isFetching).toBe(false);
    });
  });

  it('isolates the cache by parameters and deduplicates identical queries', async () => {
    server.respond((request) => ({ body: { ...circle, id: request.path.split('/').at(-1) } }));
    const { result } = hook(() => [
      call('useGetShape', { shapeId: 'a' }) as UseQueryResult,
      call('useGetShape', { shapeId: 'b' }) as UseQueryResult,
      call('useGetShape', { shapeId: 'a' }) as UseQueryResult,
    ]);
    await waitFor(() => {
      expect(result.current.every((q) => q.isSuccess)).toBe(true);
    });
    expect(result.current.map((q) => (q.data as { id: string }).id)).toEqual(['a', 'b', 'a']);
    expect(server.requests.map((r) => r.url).sort()).toEqual(['/shapes/a', '/shapes/b']);
  });

  it('propagates cancellation to the HTTP request', async () => {
    const signals: AbortSignal[] = [];
    const remove = api.client.use({
      onRequest: ({ request }: { request: { signal: AbortSignal | undefined } }) => {
        if (request.signal !== undefined) signals.push(request.signal);
      },
    });
    server.respond(() => ({ delay: 1000, body: circle }));
    hook(() => call('useGetShape', { shapeId: 'slow' }));
    await waitFor(() => {
      expect(signals).toHaveLength(1);
    });
    await act(() => queryClient.cancelQueries({ queryKey: hooks.shapesKeys.all }));
    expect(signals[0]?.aborted).toBe(true);
    remove();
  });

  it('exposes typed API errors', async () => {
    server.respond(() => ({
      status: 404,
      headers: { 'content-type': 'application/problem+json' },
      body: { title: 'Missing', status: 404 },
    }));
    const { result } = hook(() => call('useGetShape', { shapeId: 'missing' }) as UseQueryResult);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({
      name: 'ApiError',
      status: 404,
      body: { title: 'Missing' },
    });
  });

  it('runs mutations and invalidates configured queries', async () => {
    server.respond((request) =>
      request.method === 'POST'
        ? { status: 201, body: circle }
        : { body: { items: [], nextCursor: null } },
    );
    const { result } = hook(() => ({
      list: call('useListShapes', { 'X-Request-ID': 'r1' }) as UseQueryResult,
      create: call('useCreateShape') as { mutateAsync(variables: unknown): Promise<unknown> },
    }));
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    const listCalls = (): number => server.requests.filter((r) => r.method === 'GET').length;
    expect(listCalls()).toBe(1);
    await act(() => result.current.create.mutateAsync({ body: circle }));
    const post = server.requests.find((r) => r.method === 'POST');
    expect(post?.json()).toEqual(circle);
    await waitFor(() => {
      expect(listCalls()).toBe(2);
    });
  });

  it('paginates infinite queries through the configured page parameter', async () => {
    server.respond((request) =>
      request.rawQuery.includes('cursor=page2')
        ? { body: { items: [{ ...circle, id: 'second' }], nextCursor: null } }
        : { body: { items: [{ ...circle, id: 'first' }], nextCursor: 'page2' } },
    );
    const { result } = hook(
      () =>
        call(
          'useListShapesInfinite',
          { 'X-Request-ID': 'r2', limit: 1 },
          {
            initialPageParam: undefined,
            getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor,
          },
        ) as UseQueryResult<{ pages: { items: { id: string }[] }[] }> & {
          fetchNextPage(): Promise<unknown>;
          hasNextPage: boolean;
        },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.hasNextPage).toBe(true);
    await act(() => result.current.fetchNextPage());
    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });
    expect(result.current.data?.pages.map((p) => p.items[0]?.id)).toEqual(['first', 'second']);
    expect(server.requests.map((r) => r.rawQuery)).toEqual(['limit=1', 'cursor=page2&limit=1']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('works with the imperative QueryClient API', async () => {
    server.respond(() => ({ body: circle }));
    const options = call('getShapeQueryOptions', { shapeId: 'c1' }) as {
      queryKey: readonly unknown[];
    };
    // fetchQuery works across every v5 release (newer releases also offer queryClient.query()).
    await expect(queryClient.fetchQuery(options as never)).resolves.toEqual(circle);
    expect(queryClient.getQueryData(options.queryKey)).toEqual(circle);
    expect(options.queryKey).toEqual(['Shapes', 'getShape', { shapeId: 'c1' }]);
  });
});
