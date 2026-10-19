import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { RequestError } from './errors.js';
import type { ParseAs, Transport, TransportRequest, TransportResponse } from './types.js';

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
 * Binary bodies are always requested as `arraybuffer` (axios decodes `blob` responses as text in
 * Node.js) and converted here.
 */
function readData(data: unknown, parseAs: ParseAs, contentType: string | null): unknown {
  if (parseAs === 'blob' || parseAs === 'arrayBuffer') {
    const bytes = toBytes(data);
    if (bytes === undefined) return data;
    const copy = copyBytes(bytes);
    return parseAs === 'blob'
      ? new Blob([copy], contentType === null ? {} : { type: contentType })
      : copy.buffer;
  }
  if ((parseAs === 'auto' || parseAs === 'json') && data === '') return undefined;
  return data;
}

function responseType(parseAs: ParseAs): AxiosRequestConfig['responseType'] {
  switch (parseAs) {
    case 'blob':
    case 'arrayBuffer':
      return 'arraybuffer';
    case 'text':
      return 'text';
    case 'stream':
      return 'stream';
    case 'json':
      return 'json';
    case 'auto':
      return undefined;
  }
}

function fromAxiosResponse(
  response: AxiosResponse<unknown>,
  parseAs: ParseAs,
  error?: unknown,
): TransportResponse {
  const headers = toHeaders(response.headers);
  const result = {
    status: response.status,
    statusText: response.statusText,
    headers,
    data: readData(response.data, parseAs, headers.get('content-type')),
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
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const config: AxiosRequestConfig = {
      url: request.url,
      method: request.method,
      headers,
      data: request.body,
    };
    const type = responseType(request.parseAs);
    if (type !== undefined) config.responseType = type;
    Object.assign(config, request.transportOptions);
    if (request.signal !== undefined) config.signal = request.signal;
    if (request.credentials === 'include') config.withCredentials = true;
    try {
      const response = await instance.request<unknown>(config);
      return fromAxiosResponse(response, request.parseAs);
    } catch (error) {
      // `axios.isAxiosError` (rather than the named export) works with every axios 1.x release.
      if (axios.isAxiosError(error)) {
        if (error.response !== undefined)
          return fromAxiosResponse(error.response, request.parseAs, error);
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
