import { RequestError } from './errors.js';
import type {
  Middleware,
  MiddlewareContext,
  OperationInfo,
  TransportRequest,
  TransportResponse,
} from './types.js';

/** Waits `ms` milliseconds; rejects with the signal's reason when it aborts first. */
function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      // The abort reason is what an aborted request rejects with, whatever its type.
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted === true) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Milliseconds a `Retry-After` header asks for (seconds or an HTTP date), if valid. */
function retryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const date = Date.parse(text);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export interface RetryOptions {
  /** Attempts per call, including the first. Default `3`. */
  readonly attempts?: number;
  /**
   * Methods that are retried. Default: the idempotent `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`,
   * `TRACE` and `QUERY`. Requests with an `Idempotency-Key` header are retried whatever the method.
   */
  readonly methods?: readonly string[];
  /** Response statuses that are retried. Default `[408, 429, 500, 502, 503, 504]`. */
  readonly statuses?: readonly number[];
  /** Retry when no response arrives (network failures). Default `true`. */
  readonly networkErrors?: boolean;
  /** Base delay in milliseconds; it doubles with every retry. Default `300`. */
  readonly delay?: number;
  /** Upper bound of the computed delay in milliseconds. Default `10000`. */
  readonly maxDelay?: number;
  /** Wait as long as a `Retry-After` response header asks instead. Default `true`. */
  readonly respectRetryAfter?: boolean;
  /**
   * When `Retry-After` asks for longer than this (milliseconds), the response is returned instead
   * of waiting. Default `60000`.
   */
  readonly maxRetryAfter?: number;
  /** Decides last, after the other options allowed a retry. */
  readonly shouldRetry?: (context: {
    readonly request: TransportRequest;
    readonly operation: OperationInfo;
    readonly attempt: number;
    readonly response?: TransportResponse;
    readonly error?: unknown;
  }) => boolean | Promise<boolean>;
}

const IDEMPOTENT: readonly string[] = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE', 'QUERY'];

/** Bodies that can only be read once cannot be sent again. */
function replayable(request: TransportRequest): boolean {
  return typeof ReadableStream === 'undefined' || !(request.body instanceof ReadableStream);
}

/**
 * Retries failed requests with jittered exponential backoff: the n-th retry waits between half
 * and all of `min(maxDelay, delay × 2^(n−1))`, or what `Retry-After` asks. Only idempotent
 * methods are retried by default. A wait ends early when the call is aborted or times out.
 *
 * ```ts
 * client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));
 * ```
 */
export function retry<TTransportOptions = unknown>(
  options: RetryOptions = {},
): Middleware<TTransportOptions> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const methods = new Set((options.methods ?? IDEMPOTENT).map((method) => method.toUpperCase()));
  const statuses = options.statuses ?? [408, 429, 500, 502, 503, 504];
  const delay = options.delay ?? 300;
  const maxDelay = options.maxDelay ?? 10_000;
  const maxRetryAfter = options.maxRetryAfter ?? 60_000;
  const retries = new WeakMap<OperationInfo, number>();

  /** Milliseconds to wait before the next attempt, or `undefined` not to retry. */
  const plan = async (
    context: MiddlewareContext<TTransportOptions>,
    outcome: { readonly response?: TransportResponse; readonly error?: unknown },
  ): Promise<number | undefined> => {
    const { request, operation } = context;
    const done = retries.get(operation) ?? 0;
    if (done + 1 >= attempts || request.signal?.aborted === true || !replayable(request))
      return undefined;
    const idempotent =
      methods.has(request.method.toUpperCase()) || request.headers.has('idempotency-key');
    if (!idempotent) return undefined;
    let requested: number | undefined;
    if (outcome.response !== undefined) {
      if (!statuses.includes(outcome.response.status)) return undefined;
      if (options.respectRetryAfter !== false) {
        requested = retryAfter(outcome.response.headers.get('retry-after'));
        if (requested !== undefined && requested > maxRetryAfter) return undefined;
      }
    } else {
      const error = outcome.error;
      const failed =
        !(error instanceof RequestError) || error.kind === 'network' || error.kind === 'timeout';
      if (options.networkErrors === false || !failed) return undefined;
    }
    if (options.shouldRetry !== undefined) {
      const allowed = await options.shouldRetry({
        request,
        operation,
        attempt: context.attempt,
        ...outcome,
      });
      if (!allowed) return undefined;
    }
    retries.set(operation, done + 1);
    if (requested !== undefined) return requested;
    const backoff = Math.min(maxDelay, delay * 2 ** done);
    return backoff / 2 + Math.random() * (backoff / 2);
  };

  return {
    async onResponse(context) {
      const ms = await plan(context, { response: context.response });
      if (ms === undefined) return undefined;
      await wait(ms, context.request.signal);
      return context.retry();
    },
    async onError(context) {
      const ms = await plan(context, { error: context.error });
      if (ms === undefined) return undefined;
      await wait(ms, context.request.signal);
      return context.retry();
    },
  };
}

interface RefreshAuthBase {
  /** Response statuses that mean "the credentials expired". Default `[401]`. */
  readonly statuses?: readonly number[];
  /** Called when `refresh` fails; the call then rejects with the original response. */
  readonly onFailure?: (error: unknown) => void;
}

export type RefreshAuthOptions =
  | (RefreshAuthBase & {
      /** Security scheme whose credential `refresh` returns. */
      readonly scheme: string;
      /** Obtains a new credential; it is stored as `auth[scheme]` in the client config. */
      readonly refresh: () => string | Promise<string>;
    })
  | (RefreshAuthBase & {
      readonly scheme?: undefined;
      /** Refreshes credentials that the client's `auth` functions read (e.g. from a store). */
      readonly refresh: () => void | Promise<void>;
    });

/**
 * Refreshes expired credentials once and replays the request. Concurrent requests that fail
 * while a refresh is running wait for it instead of refreshing again, and requests sent with
 * credentials that were refreshed meanwhile are replayed without another refresh. Operations
 * without security requirements (such as a login endpoint) are never refreshed; with `scheme`,
 * only operations that use that scheme are.
 *
 * ```ts
 * client.use(
 *   refreshAuth({
 *     scheme: 'bearerAuth',
 *     refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
 *   }),
 * );
 * ```
 */
export function refreshAuth<TTransportOptions = unknown>(
  options: RefreshAuthOptions,
): Middleware<TTransportOptions> {
  const statuses = options.statuses ?? [401];
  /** Incremented by every successful refresh. */
  let generation = 0;
  let pending: Promise<boolean> | undefined;
  /** Per call: the generation its latest attempt was sent with, and whether it was replayed. */
  const sent = new WeakMap<OperationInfo, number>();
  const replayed = new WeakSet<OperationInfo>();

  const applies = (operation: OperationInfo): boolean => {
    const security = operation.security ?? [];
    const scheme = options.scheme;
    return scheme === undefined
      ? security.some((requirement) => requirement.length > 0)
      : security.some((requirement) => requirement.includes(scheme));
  };

  /** Refreshes once; resolves with whether it succeeded. Never rejects. */
  const run = async (context: MiddlewareContext<TTransportOptions>): Promise<boolean> => {
    try {
      const credential = await options.refresh();
      if (options.scheme !== undefined && typeof credential === 'string') {
        const { auth } = context.client.getConfig();
        context.client.setConfig({ auth: { ...auth, [options.scheme]: credential } });
      }
      generation++;
      return true;
    } catch (error) {
      options.onFailure?.(error);
      return false;
    }
  };
  // Concurrent failures share one refresh.
  const refresh = (context: MiddlewareContext<TTransportOptions>): Promise<boolean> =>
    (pending ??= run(context).finally(() => {
      pending = undefined;
    }));

  return {
    onRequest(context) {
      sent.set(context.operation, generation);
    },
    async onResponse(context) {
      const { operation, response } = context;
      if (!statuses.includes(response.status) || !applies(operation) || replayed.has(operation))
        return undefined;
      replayed.add(operation);
      // Credentials refreshed since this attempt was sent: replay with them, without refreshing.
      if ((sent.get(operation) ?? generation) < generation) return context.retry();
      return (await refresh(context)) ? context.retry() : undefined;
    },
  };
}
