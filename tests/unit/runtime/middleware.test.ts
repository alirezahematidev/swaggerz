import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '../../../src/templates/runtime/client.ts';
import { ApiError, RequestError } from '../../../src/templates/runtime/errors.ts';
import { refreshAuth, retry } from '../../../src/templates/runtime/middleware.ts';
import type {
  ClientConfig,
  OperationInfo,
  OperationRequest,
  TransportRequest,
  TransportResponse,
} from '../../../src/templates/runtime/types.ts';

type Reply = TransportResponse | Error | Promise<TransportResponse>;

function reply(status: number, headers: Record<string, string> = {}, data?: unknown): Reply {
  return { status, statusText: '', headers: new Headers(headers), data, raw: undefined };
}

/** A client whose transport answers with `script` and records every request. */
function setup(
  script: (request: TransportRequest, index: number) => Reply,
  config: Partial<ClientConfig> = {},
) {
  const requests: TransportRequest[] = [];
  const client = createClient({
    baseUrl: 'http://api.test',
    ...config,
    transport: async (request) => {
      requests.push(request);
      const result = await script(request, requests.length - 1);
      if (result instanceof Error) throw result;
      return result;
    },
  });
  return { client, requests };
}

const operation = (method = 'GET', extra: Partial<OperationRequest> = {}): OperationRequest => ({
  operationId: 'op',
  method,
  path: '/items',
  ...extra,
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected a rejection');
}

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries idempotent requests with jittered exponential backoff', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(1);
    // Every call fails twice, then succeeds.
    let failures = 0;
    const { client, requests } = setup(() => {
      if (failures < 2) {
        failures++;
        return reply(503);
      }
      failures = 0;
      return reply(200, {}, 'ok');
    });
    const attempts: number[] = [];
    const operations = new Set<OperationInfo>();
    client.use(retry());
    client.use({
      onRequest({ attempt, operation: info }) {
        attempts.push(attempt);
        operations.add(info);
      },
    });
    const result = client.request(operation());
    await vi.advanceTimersByTimeAsync(299);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(599);
    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ok');
    expect(requests).toHaveLength(3);
    expect(attempts).toEqual([1, 2, 3]);
    // One OperationInfo per call, so middleware can keep per-call state.
    expect(operations.size).toBe(1);

    // The jitter waits between half and all of the backoff.
    random.mockReturnValue(0);
    const second = client.request(operation());
    await vi.advanceTimersByTimeAsync(149);
    expect(requests).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(300);
    await expect(second).resolves.toBe('ok');
  });

  it('gives up after the configured attempts with the last response', async () => {
    const { client, requests } = setup(() => reply(503, {}, { title: 'busy' }));
    client.use(retry({ attempts: 2, delay: 10 }));
    const result = rejection(client.request(operation()));
    await vi.advanceTimersByTimeAsync(100);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, body: { title: 'busy' } });
    expect(requests).toHaveLength(2);
  });

  it('only retries idempotent methods, listed methods or requests with an Idempotency-Key', async () => {
    const { client, requests } = setup(() => reply(503));
    client.use(retry({ attempts: 2, delay: 10 }));
    const post = rejection(client.request(operation('POST')));
    await vi.advanceTimersByTimeAsync(100);
    expect(await post).toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);

    const keyed = rejection(
      client.request(operation('POST'), { headers: { 'Idempotency-Key': 'k1' } }),
    );
    await vi.advanceTimersByTimeAsync(100);
    await keyed;
    expect(requests).toHaveLength(3);
    expect(requests[2]?.headers.get('idempotency-key')).toBe('k1');

    const listed = setup(() => reply(503));
    listed.client.use(retry({ attempts: 2, delay: 10, methods: ['post'] }));
    const allowed = rejection(listed.client.request(operation('POST')));
    await vi.advanceTimersByTimeAsync(100);
    await allowed;
    expect(listed.requests).toHaveLength(2);
  });

  it('waits as long as Retry-After asks, and not at all when it asks too much', async () => {
    const { client, requests } = setup(
      (_request, index) =>
        [
          reply(429, { 'retry-after': '2' }),
          reply(503, { 'retry-after': new Date(Date.now() + 5_000).toUTCString() }),
          reply(200, {}, 'ok'),
        ][index] ?? reply(500),
    );
    client.use(retry({ attempts: 3 }));
    const result = client.request(operation());
    await vi.advanceTimersByTimeAsync(1_999);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(2);
    // An HTTP date five seconds after the second response.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ok');

    const patient = setup(() => reply(503, { 'retry-after': '120' }));
    patient.client.use(retry());
    expect(await rejection(patient.client.request(operation()))).toMatchObject({ status: 503 });
    expect(patient.requests).toHaveLength(1);
  });

  it('retries network failures but not unreadable responses', async () => {
    const { client, requests } = setup((_request, index) =>
      index === 0 ? new TypeError('fetch failed') : reply(200, {}, 'ok'),
    );
    client.use(retry({ delay: 10 }));
    const result = client.request(operation());
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('ok');
    expect(requests).toHaveLength(2);

    const context = { operationId: 'op', method: 'GET' as const, url: '/items' };
    const broken = setup(() => new RequestError('parse', 'Invalid JSON', context));
    broken.client.use(retry({ delay: 10 }));
    expect(await rejection(broken.client.request(operation()))).toMatchObject({ kind: 'parse' });
    expect(broken.requests).toHaveLength(1);

    const off = setup(() => new TypeError('fetch failed'));
    off.client.use(retry({ networkErrors: false }));
    expect(await rejection(off.client.request(operation()))).toMatchObject({ kind: 'network' });
    expect(off.requests).toHaveLength(1);
  });

  it('stops waiting when the call is aborted or times out', async () => {
    const { client, requests } = setup(() => reply(503, { 'retry-after': '1' }));
    client.use(retry());
    const controller = new AbortController();
    const aborted = rejection(client.request(operation(), { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    const reason = await aborted;
    expect(reason).toBe(controller.signal.reason);
    expect(reason).not.toBeInstanceOf(RequestError);
    expect(requests).toHaveLength(1);

    const timedOut = rejection(client.request(operation(), { timeout: 200 }));
    await vi.advanceTimersByTimeAsync(200);
    expect(await timedOut).toMatchObject({ name: 'RequestError', kind: 'timeout' });
    expect(requests).toHaveLength(2);
  });

  it('lets shouldRetry decide last', async () => {
    const { client, requests } = setup(() => reply(503));
    const shouldRetry = vi.fn<() => boolean>(() => false);
    client.use(retry({ shouldRetry }));
    expect(await rejection(client.request(operation()))).toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }));
  });
});

describe('refreshAuth', () => {
  const secured = (): OperationRequest => operation('GET', { security: [['bearerAuth']] });
  const bearer = {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
  } as const;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes once for a burst of concurrent 401s and replays every request', async () => {
    const { client, requests } = setup(
      (request) =>
        request.headers.get('authorization') === 'Bearer fresh' ? reply(200, {}, 'ok') : reply(401),
      { ...bearer, auth: { bearerAuth: 'stale' } },
    );
    let refreshes = 0;
    client.use(
      refreshAuth({
        scheme: 'bearerAuth',
        refresh: async () => {
          refreshes++;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return 'fresh';
        },
      }),
    );
    const results = await Promise.all(Array.from({ length: 5 }, () => client.request(secured())));
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(refreshes).toBe(1);
    expect(requests).toHaveLength(10);
    expect(client.getConfig().auth).toEqual({ bearerAuth: 'fresh' });
  });

  it('replays a 401 that arrives after another call refreshed, without refreshing again', async () => {
    vi.useFakeTimers();
    let token = 'stale';
    const { client, requests } = setup(
      (request, index) => {
        const ok = request.headers.get('authorization') === 'Bearer fresh';
        // The second call's first attempt answers slowly, after the refresh finished.
        const delay = index === 1 ? 100 : 0;
        return new Promise((resolve) =>
          setTimeout(() => {
            resolve(
              ok ? (reply(200, {}, 'ok') as TransportResponse) : (reply(401) as TransportResponse),
            );
          }, delay),
        );
      },
      { ...bearer, auth: { bearerAuth: () => token } },
    );
    const refresh = vi.fn<() => Promise<void>>(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      token = 'fresh';
    });
    client.use(refreshAuth({ refresh }));
    const first = client.request(secured());
    const second = client.request(secured());
    await vi.advanceTimersByTimeAsync(200);
    await expect(first).resolves.toBe('ok');
    await expect(second).resolves.toBe('ok');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
      'Bearer stale',
      'Bearer stale',
      'Bearer fresh',
      'Bearer fresh',
    ]);
  });

  it('leaves operations without security alone and replays a call at most once', async () => {
    const { client, requests } = setup(() => reply(401), {
      ...bearer,
      auth: { bearerAuth: 'stale' },
    });
    const refresh = vi.fn<() => string>(() => 'still-rejected');
    client.use(refreshAuth({ scheme: 'bearerAuth', refresh }));
    expect(await rejection(client.request(operation()))).toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);

    expect(await rejection(client.request(secured()))).toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(3);

    // With a scheme, operations secured by other schemes are not refreshed.
    const other = operation('GET', { security: [['apiKey']] });
    expect(await rejection(client.request(other))).toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('rejects with the original response when refreshing fails, and tries again next time', async () => {
    const { client } = setup(() => reply(401), { ...bearer, auth: { bearerAuth: 'stale' } });
    const failures: unknown[] = [];
    let calls = 0;
    client.use(
      refreshAuth({
        scheme: 'bearerAuth',
        refresh: () => {
          calls++;
          throw new Error('refresh token expired');
        },
        onFailure: (error) => failures.push(error),
      }),
    );
    expect(await rejection(client.request(secured()))).toMatchObject({ status: 401 });
    expect(await rejection(client.request(secured()))).toMatchObject({ status: 401 });
    expect(calls).toBe(2);
    expect(failures).toHaveLength(2);
  });
});
