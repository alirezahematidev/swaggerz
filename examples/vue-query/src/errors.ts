import { isApiError, type OperationError } from './generated/api';

/** A readable message for any error an operation can reject with. */
export function errorMessage(error: OperationError<unknown>): string {
  if (isApiError(error)) {
    const body = error.body as { title?: unknown } | undefined;
    return typeof body?.title === 'string' ? body.title : `HTTP ${error.status}`;
  }
  // RequestError: network failure, timeout, or a response that failed Valibot validation.
  return `${error.kind}: ${error.message}`;
}
