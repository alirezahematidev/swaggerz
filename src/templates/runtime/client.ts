import { ApiError, RequestError } from './errors.js';
import {
  interpolatePath,
  joinUrl,
  serializeBody,
  serializeCookies,
  serializeHeader,
  serializeQuery,
} from './serialization.js';
import { linkSignal } from './signal.js';
import type {
  ApiResponse,
  AuthValue,
  Client,
  ClientConfig,
  HeaderValues,
  Middleware,
  OperationInfo,
  OperationRequest,
  RequestOptions,
  SecurityScheme,
  TransportRequest,
  TransportResponse,
} from './types.js';

function setHeaders(headers: Headers, values: HeaderValues | undefined): void {
  if (values === undefined) return;
  for (const name of Object.keys(values)) {
    const value = values[name];
    if (value === undefined) headers.delete(name);
    else headers.set(name, value);
  }
}

function appendCookie(headers: Headers, cookie: string): void {
  if (cookie === '') return;
  const existing = headers.get('cookie');
  headers.set('cookie', existing === null || existing === '' ? cookie : `${existing}; ${cookie}`);
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function resolveAuth(value: AuthValue): Promise<string | undefined> {
  return typeof value === 'function' ? await value() : value;
}

function applyScheme(
  scheme: SecurityScheme | undefined,
  value: string,
  headers: Headers,
  query: Record<string, unknown>,
): void {
  if (scheme === undefined) return;
  switch (scheme.type) {
    case 'apiKey':
      if (scheme.in === 'header') headers.set(scheme.name, value);
      else if (scheme.in === 'query') query[scheme.name] = value;
      else appendCookie(headers, `${scheme.name}=${encodeURIComponent(value)}`);
      return;
    case 'http': {
      const name = scheme.scheme.toLowerCase();
      if (name === 'basic') {
        headers.set('authorization', /^basic /i.test(value) ? value : `Basic ${base64(value)}`);
      } else if (name === 'bearer') {
        headers.set('authorization', /^bearer /i.test(value) ? value : `Bearer ${value}`);
      } else {
        headers.set(
          'authorization',
          `${scheme.scheme.charAt(0).toUpperCase()}${scheme.scheme.slice(1)} ${value}`,
        );
      }
      return;
    }
    case 'oauth2':
    case 'openIdConnect':
      headers.set('authorization', /^bearer /i.test(value) ? value : `Bearer ${value}`);
      return;
  }
}

/**
 * Applies the first security requirement whose credentials are all configured. Requirements are
 * alternatives; schemes inside one requirement are applied together.
 */
async function applySecurity<T>(
  security: OperationRequest['security'],
  config: ClientConfig<T>,
  headers: Headers,
  query: Record<string, unknown>,
): Promise<void> {
  if (security === undefined || config.auth === undefined) return;
  const auth = config.auth;
  for (const requirement of security) {
    if (requirement.length === 0) continue;
    const values = await Promise.all(requirement.map((key) => resolveAuth(auth[key])));
    if (values.every((value) => value !== undefined && value !== '')) {
      requirement.forEach((key, index) => {
        applyScheme(config.securitySchemes?.[key], values[index] ?? '', headers, query);
      });
      return;
    }
  }
}

/** 2xx statuses, plus declared statuses (`304`) and ranges (`3XX`) the operation resolves with. */
function isSuccess(status: number, declared: readonly string[] | undefined): boolean {
  if (status >= 200 && status < 300) return true;
  if (declared === undefined) return false;
  const code = String(status);
  return declared.some((entry) =>
    entry.endsWith('XX') ? entry.charAt(0) === code.charAt(0) : entry === code,
  );
}

function mergeTransportOptions<T>(base: T | undefined, override: T | undefined): T | undefined {
  if (base === undefined) return override;
  if (override === undefined) return base;
  if (
    typeof base === 'object' &&
    base !== null &&
    typeof override === 'object' &&
    override !== null
  ) {
    return { ...base, ...override };
  }
  return override;
}

/** Creates a client. Generated code creates one default client; create more for multi-tenant use. */
export function createClient<TTransportOptions = unknown>(
  initialConfig: ClientConfig<TTransportOptions>,
): Client<TTransportOptions> {
  let config: ClientConfig<TTransportOptions> = { ...initialConfig };
  const middleware: Middleware<TTransportOptions>[] = [];

  async function send<TResponse extends ApiResponse<unknown>>(
    operation: OperationRequest,
    options: RequestOptions<TTransportOptions> = {},
  ): Promise<TResponse> {
    const current = config;
    const info: OperationInfo = {
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
    };
    const context = {
      operationId: operation.operationId,
      method: operation.method,
      url: operation.path,
    };
    const query: Record<string, unknown> = { ...operation.query };
    const headers = new Headers();

    setHeaders(
      headers,
      typeof current.headers === 'function' ? await current.headers() : current.headers,
    );
    if (operation.accept !== undefined && !headers.has('accept'))
      headers.set('accept', operation.accept);
    const headerParams = operation.headers ?? {};
    for (const name of Object.keys(headerParams)) {
      const value = headerParams[name];
      if (value !== undefined && value !== null)
        headers.set(name, serializeHeader(value, operation.styles?.header?.[name]));
    }
    appendCookie(headers, serializeCookies(operation.cookies, operation.styles?.cookie));
    await applySecurity(operation.security, current, headers, query);

    let bodyValue = operation.body;
    // Encode first (e.g. `Date` values to strings) so validation sees the wire format.
    if (operation.encodeBody !== undefined && bodyValue !== undefined)
      bodyValue = operation.encodeBody(bodyValue);
    if (operation.validateBody !== undefined && bodyValue !== undefined) {
      try {
        bodyValue = operation.validateBody(bodyValue);
      } catch (error) {
        throw new RequestError(
          'validation',
          `Request body validation failed: ${error instanceof Error ? error.message : String(error)}`,
          context,
          error,
        );
      }
    }

    let url: string;
    let body: unknown;
    try {
      const serialized = serializeBody(bodyValue, operation.mediaType, operation.encoding);
      body = serialized.body;
      if (serialized.contentType !== undefined) headers.set('content-type', serialized.contentType);
      const path = interpolatePath(operation.path, operation.pathParams, operation.styles?.path);
      const baseUrl =
        options.baseUrl ??
        (operation.server !== undefined && current.operationServers !== false
          ? operation.server
          : current.baseUrl);
      url = joinUrl(baseUrl, path, serializeQuery(query, operation.styles?.query));
    } catch (error) {
      throw new RequestError(
        'serialization',
        `Could not serialize the request: ${error instanceof Error ? error.message : String(error)}`,
        context,
        error,
      );
    }
    setHeaders(headers, options.headers);

    const timeout = options.timeout ?? current.timeout;
    const linked = linkSignal(options.signal, timeout);
    let request: TransportRequest<TTransportOptions> = {
      operationId: operation.operationId,
      method: operation.method,
      url,
      headers,
      body,
      signal: linked.signal,
      credentials: current.credentials,
      parseAs: options.parseAs ?? operation.parseAs ?? 'auto',
      transportOptions: mergeTransportOptions(current.transportOptions, options.transportOptions),
    };

    try {
      for (const item of middleware.slice()) {
        const replaced = await item.onRequest?.({ request, operation: info });
        if (replaced !== undefined) request = replaced;
      }
      const errorContext = { ...context, url: request.url };

      const sent = request;
      const recover = async (error: unknown): Promise<TransportResponse> => {
        for (const item of middleware.slice()) {
          const recovered: TransportResponse | void = await item.onError?.({
            request: sent,
            error,
            operation: info,
          });
          if (recovered !== undefined) return recovered;
        }
        if (error instanceof ApiError || error instanceof RequestError) throw error;
        if (linked.timedOut()) {
          throw new RequestError(
            'timeout',
            `Request timed out after ${String(timeout)} ms`,
            errorContext,
            error,
          );
        }
        if (options.signal?.aborted === true) throw error;
        throw new RequestError(
          'network',
          `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          errorContext,
          error,
        );
      };
      let response = await current.transport(sent).catch(recover);

      for (const item of middleware.slice()) {
        const replaced: TransportResponse | void = await item.onResponse?.({
          request: sent,
          response,
          operation: info,
        });
        if (replaced !== undefined) response = replaced;
      }

      if (!isSuccess(response.status, operation.successStatuses)) {
        throw new ApiError({
          ...errorContext,
          status: response.status,
          statusText: response.statusText,
          body: response.data,
          headers: response.headers,
          response: response.raw,
          cause: response.error,
        });
      }

      let data = response.data;
      if (operation.validateResponse !== undefined) {
        try {
          data = operation.validateResponse(data);
        } catch (error) {
          throw new RequestError(
            'validation',
            `Response validation failed: ${error instanceof Error ? error.message : String(error)}`,
            errorContext,
            error,
          );
        }
      }
      if (operation.transformResponse !== undefined) data = operation.transformResponse(data);
      const result: ApiResponse<unknown> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        raw: response.raw,
      };
      // The response shape is asserted from the API description; it is validated only when
      // runtime validation is generated.
      return result as TResponse;
    } finally {
      linked.dispose();
    }
  }

  return {
    getConfig: () => ({ ...config }),
    setConfig(patch) {
      config = { ...config, ...patch };
    },
    use(item) {
      middleware.push(item);
      return () => {
        const index = middleware.indexOf(item);
        if (index !== -1) middleware.splice(index, 1);
      };
    },
    send,
    async request<TData>(
      operation: OperationRequest,
      options?: RequestOptions<TTransportOptions>,
    ): Promise<TData> {
      const response = await send<ApiResponse<TData>>(operation, options);
      return response.data;
    },
  };
}
