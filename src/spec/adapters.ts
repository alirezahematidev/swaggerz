import type { ApiDocument, SpecVersion } from '../ir/types.ts';
import type { ParseContext } from './context.ts';
import { normalizeOpenApi3 } from './openapi3/normalize.ts';
import { oas30Dialect, oas31Dialect, oas32Dialect } from './schema/dialects.ts';
import { normalizeSwagger2 } from './swagger2/normalize.ts';

/**
 * A specification adapter converts one specification family into the IR. Supporting a new
 * version means adding an adapter (and usually a schema dialect); generators are unaffected.
 */
export interface SpecAdapter {
  readonly version: SpecVersion;
  normalize(ctx: ParseContext, rawVersion: string): ApiDocument;
}

export const ADAPTERS: Readonly<Record<SpecVersion, SpecAdapter>> = {
  '2.0': { version: '2.0', normalize: (ctx) => normalizeSwagger2(ctx) },
  '3.0': {
    version: '3.0',
    normalize: (ctx, raw) => normalizeOpenApi3(ctx, oas30Dialect, '3.0', raw),
  },
  '3.1': {
    version: '3.1',
    normalize: (ctx, raw) => normalizeOpenApi3(ctx, oas31Dialect, '3.1', raw),
  },
  '3.2': {
    version: '3.2',
    normalize: (ctx, raw) => normalizeOpenApi3(ctx, oas32Dialect, '3.2', raw),
  },
};
