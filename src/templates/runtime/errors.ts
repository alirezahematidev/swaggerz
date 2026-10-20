import type { HttpMethod } from './types.js';

interface ErrorContext {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;
}

function setCause(error: Error, cause: unknown): void {
  if (cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      value: cause,
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }
}

/**
 * Thrown when the server responds with a status the operation does not resolve with (non-2xx).
 * Generated operations reject with a union of `ApiError`s, one per documented status, so checking
 * `status` also narrows `body`.
 */
export class ApiError<TBody = unknown, TStatus extends number = number> extends Error {
  /** HTTP status code. */
  readonly status: TStatus;
  readonly statusText: string;
  /** Parsed response body (JSON when possible, otherwise text or binary). */
  readonly body: TBody;
  readonly headers: Headers;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;
  /** The underlying response object (`Response` for fetch, `AxiosResponse` for axios). */
  readonly response: unknown;

  constructor(
    init: ErrorContext & {
      readonly status: TStatus;
      readonly statusText: string;
      readonly body: TBody;
      readonly headers: Headers;
      readonly response: unknown;
      readonly cause?: unknown;
    },
  ) {
    super(
      `${init.method} ${init.url} failed with status ${init.status}${init.statusText === '' ? '' : ` ${init.statusText}`}`,
    );
    this.name = 'ApiError';
    this.status = init.status;
    this.statusText = init.statusText;
    this.body = init.body;
    this.headers = init.headers;
    this.operationId = init.operationId;
    this.method = init.method;
    this.url = init.url;
    this.response = init.response;
    setCause(this, init.cause);
  }
}

export type RequestErrorKind = 'network' | 'timeout' | 'parse' | 'serialization' | 'validation';

/**
 * Thrown when a request does not produce a usable response: network failures, timeouts,
 * malformed response bodies, serialization or validation failures. User cancellation via an
 * `AbortSignal` rethrows the original abort error instead.
 */
export class RequestError extends Error {
  readonly kind: RequestErrorKind;
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly url: string;

  constructor(kind: RequestErrorKind, message: string, context: ErrorContext, cause?: unknown) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.operationId = context.operationId;
    this.method = context.method;
    this.url = context.url;
    setCause(this, cause);
  }
}

/** Errors an operation can reject with, when only the union of its error bodies is known. */
export type OperationError<TBody = unknown> = ApiError<TBody> | RequestError;

/**
 * Whether `error` is an {@link ApiError} of any operation. Each generated operation also exports
 * a guard (`isGetPetByIdApiError`) that narrows to that operation's errors by status.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError;
}
