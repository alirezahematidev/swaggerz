import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { RequestError } from './errors.js';
import { isJsonMediaType, isTextMediaType, responseParseAs } from './serialization.js';
import type { Transport, TransportRequest, TransportResponse } from './types.js';

/** Extra axios options accepted per request (`transportOptions`) and as client defaults. */
export type AxiosTransportOptions = Omit<
  AxiosRequestConfig,
  'url' | 'method' | 'headers' | 'data' | 'signal'
>;

function toHeaders(source: unknown): Headers {
  const headers = new Headers();
  if (typeof source !== 'object' || source === null) return headers;
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || value === null || typeof value === 'function') continue;
    try {
      if (Array.isArray(value)) for (const item of value) headers.append(name, String(item));
      else headers.set(name, String(value));
    } catch {
      // Skip header names that the Headers class rejects.
    }
  }
  return headers;
}

function toBytes(data: unknown): Uint8Array | undefined {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return undefined;
}

// The return type is inferred so the file also compiles on TypeScript versions before 5.7.
function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * Reads a body requested as `arraybuffer` like the fetch transport reads a `Response`: by
 * `parseAs` for successful statuses, otherwise by `Content-Type` (JSON, text, or a `Blob`). Bytes
 * are decoded here because axios decodes `blob` responses as text in Node.js and would decode
 * binary `auto` responses as UTF-8 text.
 */
function readData(
  response: AxiosResponse<unknown>,
  request: TransportRequest<AxiosTransportOptions>,
  headers: Headers,
): unknown {
  const { status, data } = response;
  const parseAs = responseParseAs(request.parseAs, status);
  if (parseAs === 'stream') return data;
  if (request.method === 'HEAD' || status === 204 || status === 205 || status === 304)
    return undefined;
  const bytes = toBytes(data);
  // Already decoded, e.g. by a `responseType` passed in `transportOptions`.
  if (bytes === undefined) return data;
  const contentType = headers.get('content-type');
  const blob = (): Blob =>
    new Blob([copyBytes(bytes)], contentType === null ? {} : { type: contentType });
  if (parseAs === 'blob') return blob();
  if (parseAs === 'arrayBuffer') return copyBytes(bytes).buffer;
  const text = new TextDecoder().decode(bytes);
  if (parseAs === 'text') return text;
  if (parseAs === 'json' || isJsonMediaType(contentType)) {
    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // Error bodies are best-effort: keep the text so ApiError still carries it.
      if (status < 200 || status >= 300) return text;
      throw new RequestError(
        'parse',
        'The response body is not valid JSON.',
        { operationId: request.operationId, method: request.method, url: request.url },
        error,
      );
    }
  }
  if (contentType === null || isTextMediaType(contentType))
    return text === '' && contentType === null ? undefined : text;
  return blob();
}

function fromAxiosResponse(
  response: AxiosResponse<unknown>,
  request: TransportRequest<AxiosTransportOptions>,
  error?: unknown,
): TransportResponse {
  const headers = toHeaders(response.headers);
  const result = {
    status: response.status,
    statusText: response.statusText,
    headers,
    data: readData(response, request, headers),
    raw: response,
  };
  return error === undefined ? result : { ...result, error };
}

/**
 * Creates a transport backed by axios. Pass your own instance to reuse its interceptors, base
 * URL and defaults. HTTP error responses become `ApiError`s with the `AxiosError` as `cause`.
 */
export function createAxiosTransport(
  instance: AxiosInstance = axios,
): Transport<AxiosTransportOptions> {
  return async (request: TransportRequest<AxiosTransportOptions>) => {
    const entries: [string, string][] = [];
    request.headers.forEach((value, name) => {
      entries.push([name, value]);
    });
    // Own properties for every name, including `__proto__`.
    const headers: Record<string, string> = Object.fromEntries(entries);
    const config: AxiosRequestConfig = {
      url: request.url,
      method: request.method,
      headers,
      data: request.body,
    };
    // Bodies are read as bytes and decoded by `readData`; streams are passed through.
    config.responseType = request.parseAs === 'stream' ? 'stream' : 'arraybuffer';
    Object.assign(config, request.transportOptions);
    if (request.signal !== undefined) config.signal = request.signal;
    if (request.credentials === 'include') config.withCredentials = true;
    try {
      const response = await instance.request<unknown>(config);
      return fromAxiosResponse(response, request);
    } catch (error) {
      // `axios.isAxiosError` (rather than the named export) works with every axios 1.x release.
      if (axios.isAxiosError(error)) {
        if (error.response !== undefined) return fromAxiosResponse(error.response, request, error);
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new RequestError(
            'timeout',
            error.message,
            { operationId: request.operationId, method: request.method, url: request.url },
            error,
          );
        }
      }
      throw error;
    }
  };
}
