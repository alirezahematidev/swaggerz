/**
 * HTTP methods used by generated operations: the standard ones, `QUERY`, and any other method an
 * OpenAPI 3.2 description declares (sent exactly as declared).
 */
export type HttpMethod =
  | 'GET'
  | 'PUT'
  | 'POST'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'
  | 'PATCH'
  | 'TRACE'
  | 'QUERY'
  // Keeps completion for the methods above while accepting others.
  | (string & {});

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ToNumber<T> = T extends `${infer N extends number}` ? N : never;

/**
 * HTTP status codes from 100 to 599 as literal types, optionally of some classes only:
 * `HttpStatus<4>` is 400–499 and `HttpStatus<4 | 5>` 400–599. Generated error types use it to
 * describe the statuses a response does not declare, so that `error.status === 404` narrows.
 */
export type HttpStatus<TClass extends 1 | 2 | 3 | 4 | 5 = 1 | 2 | 3 | 4 | 5> =
  ToNumber<`${TClass}${Digit}${Digit}`>;

/** How a response body is read. `auto` decides from the `Content-Type` header. */
export type ParseAs = 'auto' | 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';

/**
 * Parameter serialization styles (OpenAPI 3 `style`, `tabDelimited` for Swagger 2.0, and
 * OpenAPI 3.2's `cookie`).
 */
export type ParamStyle =
  | 'form'
  | 'simple'
  | 'label'
  | 'matrix'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'tabDelimited'
  | 'deepObject'
  | 'cookie';

export type ParamLocation = 'path' | 'query' | 'header' | 'cookie';

/** Non-default serialization of one parameter. */
export interface ParamSerialization {
  readonly style?: ParamStyle;
  readonly explode?: boolean;
  readonly allowReserved?: boolean;
  /** Serialize the value as JSON (parameters declared with `content`). */
  readonly json?: boolean;
}

/** Serialization of one property of a form or multipart body. */
export interface PropertyEncoding {
  readonly contentType?: string;
  readonly style?: ParamStyle;
  readonly explode?: boolean;
}

/** Credentials as a value or a (possibly async) function evaluated per request. */
export type AuthValue =
  | string
  | undefined
  | (() => string | undefined | Promise<string | undefined>);

/**
 * A security scheme declared by the API. `apiKey` values are sent as-is; `http` bearer, `oauth2`
 * and `openIdConnect` values are sent as `Authorization: Bearer <token>`; `http` basic values
 * must be `username:password` and are base64-encoded.
 */
export type SecurityScheme =
  | { readonly type: 'apiKey'; readonly in: 'header' | 'query' | 'cookie'; readonly name: string }
  | { readonly type: 'http'; readonly scheme: string }
  | { readonly type: 'oauth2' }
  | { readonly type: 'openIdConnect' };

/** Request description produced by a generated operation function. */
export interface OperationRequest {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** Path template, e.g. `/pets/{petId}`. */
  readonly path: string;
  readonly pathParams?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly cookies?: Readonly<Record<string, unknown>>;
  /**
   * OpenAPI 3.2 `in: querystring`: the whole query string as one value, serialized by its media
   * type (form-urlencoded, JSON, or text).
   */
  readonly querystring?: {
    readonly value: unknown;
    readonly mediaType: string;
    readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
  };
  /** Non-default parameter serialization, by location and wire name. */
  readonly styles?: Readonly<
    Partial<Record<ParamLocation, Readonly<Record<string, ParamSerialization>>>>
  >;
  readonly body?: unknown;
  /** Request media type, e.g. `application/json` or `multipart/form-data`. */
  readonly mediaType?: string;
  readonly encoding?: Readonly<Record<string, PropertyEncoding>>;
  /** Base URL of a server declared by the operation or its path; see `ClientConfig.operationServers`. */
  readonly server?: string;
  /** Declared non-2xx statuses that resolve instead of rejecting, e.g. `304` or `3XX`. */
  readonly successStatuses?: readonly string[];
  /** Preferred response media type for the `Accept` header. */
  readonly accept?: string;
  /** Alternative security requirements (scheme keys that must be applied together). */
  readonly security?: readonly (readonly string[])[];
  readonly parseAs?: ParseAs;
  /** Validates the request body before it is serialized (generated when request validation is enabled). */
  readonly validateBody?: (body: unknown) => unknown;
  /** Validates/transforms successful response data (generated when runtime validation is enabled). */
  readonly validateResponse?: (data: unknown) => unknown;
  /** Converts the request body to its wire form (e.g. `Date` values to strings) before validation. */
  readonly encodeBody?: (body: unknown) => unknown;
  /** Converts successful response data from its wire form, e.g. date strings to `Date`. */
  readonly transformResponse?: (data: unknown) => unknown;
}

/** Normalized request passed to a transport after serialization and middleware. */
export interface TransportRequest<TTransportOptions = unknown> {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** Fully resolved URL including the query string. May be relative when `baseUrl` is empty. */
  url: string;
  readonly headers: Headers;
  body: unknown;
  signal: AbortSignal | undefined;
  credentials: 'omit' | 'same-origin' | 'include' | undefined;
  parseAs: ParseAs;
  /** Transport-specific per-request options. */
  transportOptions: TTransportOptions | undefined;
}

/** Response returned by a transport, with the body already read according to `parseAs`. */
export interface TransportResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly data: unknown;
  /** The underlying response object (`Response` for fetch, `AxiosResponse` for axios). */
  readonly raw: unknown;
  /** The underlying error, when the transport reported the response as a failure (axios). */
  readonly error?: unknown;
}

/** A transport sends a request and returns the response. It must not throw for HTTP errors. */
export type Transport<TTransportOptions = unknown> = (
  request: TransportRequest<TTransportOptions>,
) => Promise<TransportResponse>;

/** Successful response with metadata, returned when the client uses `responseStyle: 'full'`. */
export interface ApiResponse<TData, TStatus extends number = number> {
  readonly data: TData;
  readonly status: TStatus;
  readonly statusText: string;
  readonly headers: Headers;
  readonly raw: unknown;
}

/**
 * The operation a request belongs to. The same object is passed for every attempt of one call, so
 * middleware can key per-call state on it (for example in a `WeakMap`).
 */
export interface OperationInfo {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  /** Alternative security requirements (scheme names) of the operation; absent without auth. */
  readonly security?: readonly (readonly string[])[];
}

declare const retryDirective: unique symbol;

/** Returned from `onResponse` or `onError` (via `context.retry()`) to send the request again. */
export interface RetryDirective {
  readonly [retryDirective]: true;
}

/** What every middleware hook receives. */
export interface MiddlewareContext<TTransportOptions = unknown> {
  readonly request: TransportRequest<TTransportOptions>;
  readonly operation: OperationInfo;
  /** 1 for the first attempt of a call; each retry starts the next attempt. */
  readonly attempt: number;
  /** The client sending the request, e.g. to store a refreshed token with `setConfig`. */
  readonly client: Client<TTransportOptions>;
}

/** Context of `onResponse` and `onError`, which may ask for the request to be sent again. */
export interface RetryableContext<
  TTransportOptions = unknown,
> extends MiddlewareContext<TTransportOptions> {
  /**
   * Discards this attempt and sends the request again: return the result from the hook. The
   * request is built anew (headers and `auth` from the current config, then every `onRequest`),
   * and the call's timeout and signal still apply.
   */
  retry(): RetryDirective;
}

/** Hooks that run around every request. Registered with `client.use()`; run in order. */
export interface Middleware<TTransportOptions = unknown> {
  /** Inspect or replace the outgoing request. Runs again for every retry. */
  onRequest?(
    context: MiddlewareContext<TTransportOptions>,
  ):
    | void
    | TransportRequest<TTransportOptions>
    | Promise<void | TransportRequest<TTransportOptions>>;
  /**
   * Inspect or replace the response (also called for HTTP error statuses), or return
   * `context.retry()` to send the request again.
   */
  onResponse?(
    context: RetryableContext<TTransportOptions> & { readonly response: TransportResponse },
  ): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
  /**
   * Called when the transport fails: return a response to recover, or `context.retry()` to send
   * the request again.
   */
  onError?(
    context: RetryableContext<TTransportOptions> & { readonly error: unknown },
  ): void | TransportResponse | RetryDirective | Promise<void | TransportResponse | RetryDirective>;
}

export type HeaderValues = Readonly<Record<string, string | undefined>>;

export interface ClientConfig<TTransportOptions = unknown> {
  /** Prefix for every request path. Empty for same-origin relative requests. */
  baseUrl: string;
  /**
   * Send operations that declare their own `servers` to that server instead of `baseUrl`
   * (default `true`). A per-call `baseUrl` option always wins.
   */
  operationServers?: boolean | undefined;
  transport: Transport<TTransportOptions>;
  /** Default headers, or a function computing them per request. */
  headers?: HeaderValues | (() => HeaderValues | Promise<HeaderValues>) | undefined;
  /** Credentials keyed by security scheme name. */
  auth?: Readonly<Record<string, AuthValue>> | undefined;
  securitySchemes?: Readonly<Record<string, SecurityScheme>> | undefined;
  /** Default timeout in milliseconds. */
  timeout?: number | undefined;
  credentials?: 'omit' | 'same-origin' | 'include' | undefined;
  /** Default transport-specific options merged into every request. */
  transportOptions?: TTransportOptions | undefined;
}

/** Per-call options accepted by every generated operation. */
export interface RequestOptions<TTransportOptions = unknown> {
  /** Cancels the request. */
  signal?: AbortSignal | undefined;
  /** Timeout in milliseconds; overrides the client default. */
  timeout?: number | undefined;
  /** Extra headers; `undefined` values remove a header. */
  headers?: HeaderValues | undefined;
  /** Overrides the client's base URL for this call. */
  baseUrl?: string | undefined;
  /** Use a different client instance (e.g. per-tenant or per-request on the server). */
  client?: Client<TTransportOptions> | undefined;
  /** Overrides how the response body is read. */
  parseAs?: ParseAs | undefined;
  /** Transport-specific options (fetch `RequestInit` fields or an axios request config). */
  transportOptions?: TTransportOptions | undefined;
}

export interface Client<TTransportOptions = unknown> {
  /** Returns a copy of the current configuration. */
  getConfig(): ClientConfig<TTransportOptions>;
  /** Shallow-merges configuration into the client. */
  setConfig(config: Partial<ClientConfig<TTransportOptions>>): void;
  /** Registers middleware; returns a function that removes it. */
  use(middleware: Middleware<TTransportOptions>): () => void;
  /** Sends a request and resolves with the parsed body. Throws `ApiError` for non-2xx statuses. */
  request<TData>(
    operation: OperationRequest,
    options?: RequestOptions<TTransportOptions>,
  ): Promise<TData>;
  /** Sends a request and resolves with data, status and headers. Throws `ApiError` for non-2xx statuses. */
  send<TResponse extends ApiResponse<unknown>>(
    operation: OperationRequest,
    options?: RequestOptions<TTransportOptions>,
  ): Promise<TResponse>;
}
