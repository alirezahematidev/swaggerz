import type { ValidationLibrary } from '../../config/types.ts';
import type { MediaTypeIR } from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager } from '../imports.ts';
import { bodyKind, type OperationPlan, type PlannedResponse } from '../operation-plan.ts';
import { quote } from '../printer.ts';
import type { GeneratedExport } from '../types.ts';
import { ARKTYPE } from './arktype.ts';
import { VALIBOT } from './valibot.ts';
import type { Validator } from './shared.ts';
import { ZOD } from './zod.ts';

export { wireType, type Validator } from './shared.ts';

const VALIDATORS: Readonly<Record<ValidationLibrary, Validator>> = {
  zod: ZOD,
  valibot: VALIBOT,
  arktype: ARKTYPE,
};

/** The configured validator, or `undefined` when validation is disabled. */
export function validatorFor(ctx: EmitContext): Validator | undefined {
  const validation = ctx.config.features.validation;
  return validation === false ? undefined : VALIDATORS[validation.library];
}

/** The `validateResponse` function of an operation: validates the data it resolves with. */
export function responseValidation(
  plan: OperationPlan,
  imports: ImportManager,
  ctx: EmitContext,
  validator: Validator,
): string {
  const bodySchema = (response: PlannedResponse): string => {
    const media = response.media;
    if (media === undefined) return validator.undefined(imports);
    if (media.schema.kind === 'binary' || plan.parseAs === 'blob') return validator.blob(imports);
    return validator.inline(media.schema, imports, ctx);
  };
  const members = [...new Set(plan.success.map(bodySchema))];
  const schema =
    members.length === 0
      ? validator.unknown(imports)
      : members.length === 1
        ? (members[0] ?? '')
        : validator.union(members, imports);
  return `(data) => ${validator.parse(schema, 'data', imports)}`;
}

/**
 * The `validateBody` function of an operation, validating the request body before it is sent.
 * With several media types, `selected` is the expression of the chosen media type and the schema
 * is picked from it. Pre-encoded bodies (binary, XML and other raw formats) are not validated.
 */
export function requestValidation(
  plan: OperationPlan,
  imports: ImportManager,
  ctx: EmitContext,
  validator: Validator,
  selected?: string,
): string | undefined {
  if (plan.body === undefined) return undefined;
  const schemaOf = (media: MediaTypeIR): string => {
    const kind = bodyKind(media);
    return kind === 'raw' || kind === 'binary'
      ? validator.unknown(imports)
      : validator.inline(media.schema, imports, ctx);
  };
  const preferred = schemaOf(plan.body.media);
  let schema = preferred;
  if (plan.body.alternatives.length > 0 && selected !== undefined) {
    for (const media of [...plan.body.alternatives].reverse()) {
      const alternative = schemaOf(media);
      if (alternative !== preferred)
        schema = `${selected} === ${quote(media.mediaType)} ? ${alternative} : ${schema}`;
    }
    if (schema !== preferred) schema = `(${schema})`;
  }
  return `(body) => ${validator.parse(schema, 'body', imports)}`;
}

/** Every schema module, the library's support modules and the `<library>/index` barrel. */
export function generateValidationModules(ctx: EmitContext): ModuleOutput[] {
  const validator = validatorFor(ctx);
  if (validator === undefined) return [];
  const schemas = ctx.project.models
    .map((model) => validator.model(model, ctx))
    .filter((m): m is ModuleOutput => m !== undefined);
  const modules = [...(validator.support?.(ctx) ?? []), ...schemas];
  if (ctx.config.output.barrel) modules.push(validationBarrel(validator, ctx, schemas));
  return modules;
}

/** The `<library>/index` barrel, separate from the main barrel so the library stays optional. */
function validationBarrel(
  validator: Validator,
  ctx: EmitContext,
  modules: readonly ModuleOutput[],
): ModuleOutput {
  const module = `${validator.library}/index`;
  const outputs = renderAll(
    module,
    ctx,
    (imports) =>
      `${modules.map((m) => `export * from '${imports.specifier(m.module)}';`).join('\n')}\n`,
  );
  const exports: GeneratedExport[] = modules.flatMap((m) => m.exports);
  return { module, origin: 'core:validation-barrel', ...outputs, exports };
}
