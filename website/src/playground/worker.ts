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

addEventListener('message', (event: MessageEvent<CompileRequest>) => {
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
