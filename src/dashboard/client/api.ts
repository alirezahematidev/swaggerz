import { useEffect, useState, useSyncExternalStore } from 'react';

const TOKEN_KEY = 'swaggerz-dashboard-token';

/** Reads the session token from the URL once, then keeps it in session storage only. */
export function initToken(): string | undefined {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('token');
  if (fromUrl !== null) {
    try {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      // Storage may be unavailable; the token stays in memory for this page.
    }
    params.delete('token');
    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${location.pathname}${query === '' ? '' : `?${query}`}${location.hash}`,
    );
    memoryToken = fromUrl;
    return fromUrl;
  }
  try {
    memoryToken = sessionStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    memoryToken = undefined;
  }
  return memoryToken;
}

let memoryToken: string | undefined;

export function authorization(): string {
  return `Bearer ${memoryToken ?? ''}`;
}

// Requests in flight, for the progress bar.
let pending = 0;
const pendingListeners = new Set<() => void>();
function setPending(delta: number): void {
  pending += delta;
  for (const listener of pendingListeners) listener();
}

/** Whether any API request is in flight. */
export function usePending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener);
      return () => {
        pendingListeners.delete(listener);
      };
    },
    () => pending > 0,
  );
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  setPending(1);
  let response: Response;
  let data: unknown;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: {
        authorization: authorization(),
        ...(options.method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
    });
    data = await response.json().catch(() => ({}));
  } finally {
    setPending(-1);
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String(data.error)
        : response.statusText;
    throw new ApiRequestError(response.status, message);
  }
  return data as T;
}

export type Resource<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly error: Error }
  | {
      readonly state: 'ready';
      readonly data: T;
      /** The data belongs to the previous request; the current one is still in flight. */
      readonly stale?: boolean;
    };

/**
 * Fetches a GET endpoint and re-fetches when `path` or `version` changes. While a new request is
 * in flight, the previous data stays on screen (marked `stale`) instead of a loading state, so
 * live reloads and switching between items do not make the page jump. Errors are never kept.
 */
export function useResource<T>(path: string | undefined, version: number): Resource<T> {
  const key = path === undefined ? undefined : `${version}\u0000${path}`;
  const [result, setResult] = useState<{ key: string; resource: Resource<T> } | undefined>();
  useEffect(() => {
    if (key === undefined || path === undefined) return undefined;
    let active = true;
    api<T>(path).then(
      (data) => {
        if (active) setResult({ key, resource: { state: 'ready', data } });
      },
      (error: unknown) => {
        if (active)
          setResult({
            key,
            resource: {
              state: 'error',
              error: error instanceof Error ? error : new Error(String(error)),
            },
          });
      },
    );
    return () => {
      active = false;
    };
  }, [key, path]);
  if (result === undefined || key === undefined) return { state: 'loading' };
  if (result.key === key) return result.resource;
  return result.resource.state === 'ready'
    ? { state: 'ready', data: result.resource.data, stale: true }
    : { state: 'loading' };
}
