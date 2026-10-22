import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
import type { Transport, TransportRequest } from './types.js';

/** Extra `fetch` options accepted per request (`transportOptions`) and as client defaults. */
export type FetchTransportOptions = Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;

export interface FetchTransportConfig {
  /** Custom `fetch` implementation. Defaults to `globalThis.fetch` at request time. */
  readonly fetch?: typeof fetch;
}

async function readBody(
  response: Response,
  request: TransportRequest<FetchTransportOptions>,
): Promise<unknown> {
  const parseAs = responseParseAs(request.parseAs, response.status);
  if (parseAs === 'stream') return response.body;
  if (
    request.method === 'HEAD' ||
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304
  ) {
    return undefined;
  }
  if (parseAs === 'blob') return response.blob();
  if (parseAs === 'arrayBuffer') return response.arrayBuffer();
  if (parseAs === 'text') return response.text();
  const contentType = response.headers.get('content-type');
  if (parseAs === 'json' || isJsonMediaType(contentType)) {
    const text = await response.text();
    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Error bodies are best-effort: keep the text so ApiError still carries it.
      if (!response.ok) return text;
      throw new RequestError(
        'parse',
        'The response body is not valid JSON.',
        { operationId: request.operationId, method: request.method, url: request.url },
        error,
      );
    }
  }
  if (contentType === null || isTextMediaType(contentType)) {
    const text = await response.text();
    return text === '' && contentType === null ? undefined : text;
  }
  return response.blob();
}

/** Creates a transport backed by the Fetch API. */
export function createFetchTransport(
  config: FetchTransportConfig = {},
): Transport<FetchTransportOptions> {
  return async (request) => {
    const init: RequestInit = {
      ...request.transportOptions,
      method: request.method,
      headers: request.headers,
    };
    if (request.body !== undefined) init.body = request.body as NonNullable<RequestInit['body']>;
    if (request.signal !== undefined) init.signal = request.signal;
    if (request.credentials !== undefined) init.credentials = request.credentials;
    const fetchImpl = config.fetch ?? globalThis.fetch;
    const response = await fetchImpl(request.url, init);
    const data = await readBody(response, request);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      raw: response,
    };
  };
}

/** The default Fetch transport. */
export const fetchTransport: Transport<FetchTransportOptions> =
  /* @__PURE__ */ createFetchTransport();
