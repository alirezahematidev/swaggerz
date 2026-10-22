import type { ModelSymbol } from '../../analysis/types.ts';
import type { ValidationLibrary } from '../../config/types.ts';
import type { SchemaIR } from '../../ir/types.ts';
import type { EmitContext, ModuleOutput } from '../context.ts';
import type { ImportManager } from '../imports.ts';

/**
 * What the operation generator and the schema modules need from a validation library. Each
 * library prints schemas in its own idiom; the choice of which schema validates what is shared.
 */
export interface Validator {
  readonly library: ValidationLibrary;
  /** Display name, e.g. `Zod`. */
  readonly label: string;
  /** Expression for `schema` evaluated when data is validated: references need no deferral. */
  inline(schema: SchemaIR, imports: ImportManager, ctx: EmitContext): string;
  union(members: readonly string[], imports: ImportManager): string;
  unknown(imports: ImportManager): string;
  undefined(imports: ImportManager): string;
  blob(imports: ImportManager): string;
  /** An expression that validates `value` with `schema` and returns it, or throws. */
  parse(schema: string, value: string, imports: ImportManager): string;
  /** The schema module of a model (`zod/pet`, `valibot/pet`, `arktype/pet`). */
  model(model: ModelSymbol, ctx: EmitContext): ModuleOutput | undefined;
  /** Modules shared by the schema modules (ArkType's reference helpers). */
  support?(ctx: EmitContext): ModuleOutput[];
}

/**
 * The type a model's schema validates: the model type, or `unknown` with `types.dates: 'Date'`
 * for models containing dates (schemas check the wire format, where dates are strings).
 */
export function wireType(model: ModelSymbol, imports: ImportManager): string {
  return model.datesName === undefined
    ? imports.add(model.module, model.name, { typeOnly: true })
    : 'unknown';
}
