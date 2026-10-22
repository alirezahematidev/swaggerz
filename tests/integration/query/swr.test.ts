// @vitest-environment happy-dom
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';
import { queryFeatures } from './consumers.ts';

type AnyFn = (...args: never[]) => unknown;
interface SwrResult {
  data: unknown;
  error: unknown;
  isLoading: boolean;
}

let server: MockServer;
let hooks: Record<string, AnyFn>;

// A fresh cache per hook render keeps the tests independent.
const hook = <T>(fn: () => T) => {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false } },
      children,
    );
  return renderHook(fn, { wrapper });
};
const call = (name: string, ...args: unknown[]): unknown =>
  (hooks[name] as (...a: unknown[]) => unknown)(...args);
const circle = { kind: 'circle', id: 'c1', radius: 2 };

beforeAll(async () => {
  server = await startMockServer();
  const { directory } = await generateCase('swr-runtime', {
    spec: { version: '3.1', input: fixture('features-3.1.yaml') },
    features: queryFeatures('swr'),
  });
  const api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as {
    client: { setConfig(config: Record<string, unknown>): void };
  };
  hooks = (await import(pathToFileURL(path.join(directory, 'swr', 'index.ts')).href)) as Record<
    string,
    AnyFn
  >;
  api.client.setConfig({ baseUrl: server.url });
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  cleanup();
});

describe('generated SWR hooks', () => {
  it('fetches data by key and skips fetching when disabled', async () => {
    server.respond(() => ({ body: circle }));
    const { result } = hook(() => call('useGetShape', { shapeId: 'c1' }) as SwrResult);
    await waitFor(() => {
      expect(result.current.data).toEqual(circle);
    });
    expect(server.requests.map((r) => r.url)).toEqual(['/shapes/c1']);

    server.respond(() => ({ body: circle }));
    const disabled = hook(
      () => call('useGetShape', { shapeId: 'c2' }, { enabled: false }) as SwrResult,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(disabled.result.current.isLoading).toBe(false);
    expect(server.requests).toHaveLength(0);
  });

  it('exposes typed API errors', async () => {
    server.respond(() => ({
      status: 404,
      headers: { 'content-type': 'application/problem+json' },
      body: { title: 'Missing', status: 404 },
    }));
    const { result } = hook(() => call('useGetShape', { shapeId: 'missing' }) as SwrResult);
    await waitFor(() => {
      expect(result.current.error).toMatchObject({ name: 'ApiError', status: 404 });
    });
  });

  it('triggers mutations and revalidates configured queries', async () => {
    server.respond((request) =>
      request.method === 'POST'
        ? { status: 201, body: circle }
        : { body: { items: [], nextCursor: null } },
    );
    const { result } = hook(() => ({
      list: call('useListShapes', { 'X-Request-ID': 'r1' }) as SwrResult,
      create: call('useCreateShape') as { trigger(arg: unknown): Promise<unknown> },
    }));
    await waitFor(() => {
      expect(result.current.list.data).toBeDefined();
    });
    const listCalls = (): number => server.requests.filter((r) => r.method === 'GET').length;
    expect(listCalls()).toBe(1);
    await act(() => result.current.create.trigger({ body: circle }));
    expect(server.requests.find((r) => r.method === 'POST')?.json()).toEqual(circle);
    await waitFor(() => {
      expect(listCalls()).toBe(2);
    });
  });

  it('paginates with the configured page parameter', async () => {
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
        ) as SwrResult & { setSize(size: number): Promise<unknown> },
    );
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    await act(() => result.current.setSize(2));
    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(
      (result.current.data as { items: { id: string }[] }[]).map((page) => page.items[0]?.id),
    ).toEqual(['first', 'second']);
    expect(server.requests.map((r) => r.rawQuery)).toContain('cursor=page2&limit=1');
  });

  it('revalidates every loaded page of infinite lists after a mutation', async () => {
    // Pages reflect a version that the mutation bumps, so stale pages are visible.
    let version = 1;
    server.respond((request) => {
      if (request.method === 'POST') {
        version += 1;
        return { status: 201, body: circle };
      }
      const second = request.rawQuery.includes('cursor=page2');
      const id = `${second ? 'second' : 'first'}-v${version}`;
      return { body: { items: [{ ...circle, id }], nextCursor: second ? null : 'page2' } };
    });
    const { result } = hook(() => ({
      list: call(
        'useListShapesInfinite',
        { 'X-Request-ID': 'r3', limit: 1 },
        {
          initialPageParam: undefined,
          getNextPageParam: (last: { nextCursor: string | null }) => last.nextCursor,
        },
      ) as SwrResult & { setSize(size: number): Promise<unknown> },
      // Configured to invalidate `listShapes`, which covers its infinite list.
      create: call('useCreateShape') as { trigger(arg: unknown): Promise<unknown> },
    }));
    const ids = (): (string | undefined)[] =>
      ((result.current.list.data ?? []) as { items: { id: string }[] }[]).map(
        (page) => page.items[0]?.id,
      );
    await waitFor(() => {
      expect(ids()).toEqual(['first-v1']);
    });
    await act(() => result.current.list.setSize(2));
    await waitFor(() => {
      expect(ids()).toEqual(['first-v1', 'second-v1']);
    });
    await act(() => result.current.create.trigger({ body: circle }));
    await waitFor(() => {
      expect(ids()).toEqual(['first-v2', 'second-v2']);
    });
  });
});
