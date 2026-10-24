/** Types of the browser compiler bundle (built by scripts/playground.ts from playground/compiler.ts). */
declare module '*/generated/compiler.js' {
  import type { BrowserCompileInput, BrowserCompileResult } from '../../playground/compiler.ts';

  export type {
    BrowserCompileInput,
    BrowserCompileResult,
    BrowserDiagnostic,
  } from '../../playground/compiler.ts';
  export const ROOT: string;
  export function compileInBrowser(input: BrowserCompileInput): Promise<BrowserCompileResult>;
}
