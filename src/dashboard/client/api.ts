import { useEffect, useState } from 'preact/hooks';

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
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${memoryToken ?? ''}`,
      ...(options.method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
  });
  const data: unknown = await response.json().catch(() => ({}));
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
  | { readonly state: 'ready'; readonly data: T };

/** Fetches a GET endpoint and re-fetches when `path` or `version` changes. */
export function useResource<T>(path: string | undefined, version: number): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading' });
  useEffect(() => {
    if (path === undefined) return undefined;
    let active = true;
    setResource({ state: 'loading' });
    api<T>(path).then(
      (data) => {
        if (active) setResource({ state: 'ready', data });
      },
      (error: unknown) => {
        if (active)
          setResource({
            state: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [path, version]);
  return resource;
}
