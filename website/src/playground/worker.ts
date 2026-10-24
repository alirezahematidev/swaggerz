/**
 * Compiles in a worker, so typing in a large specification never blocks the page. Requests carry
 * an id; the page ignores answers to requests it has superseded.
 */
import { compileInBrowser } from '../generated/compiler.js';
import type { BrowserCompileInput, BrowserCompileResult } from '../../playground/compiler.ts';

export interface CompileRequest {
  readonly id: number;
  readonly input: BrowserCompileInput;
}

export type CompileResponse =
  | { readonly id: number; readonly result: BrowserCompileResult; readonly elapsed: number }
  | { readonly id: number; readonly error: string };

function isRequest(value: unknown): value is CompileRequest {
  if (typeof value !== 'object' || value === null) return false;
  const { id, input } = value as { id?: unknown; input?: unknown };
  return (
    typeof id === 'number' &&
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { files?: unknown }).files === 'object'
  );
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  // A dedicated worker only hears from the page that started it (whose messages carry an empty
  // origin, or the page's own); anything else, or anything malformed, is ignored.
  if (event.origin !== '' && event.origin !== self.location.origin) return;
  if (!isRequest(event.data)) return;
  const { id, input } = event.data;
  const started = performance.now();
  compileInBrowser(input).then(
    (result) =>
      postMessage({ id, result, elapsed: performance.now() - started } satisfies CompileResponse),
    (error: unknown) =>
      postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies CompileResponse),
  );
});
