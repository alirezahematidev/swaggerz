import { dateFormat } from '../analysis/dates.ts';
import type { ModelSymbol } from '../analysis/types.ts';
import type { JsonValue, MediaTypeIR, SchemaAssertions, SchemaIR } from '../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { ImportManager, Lang } from './imports.ts';
import { inheritedDiscriminators } from './models.ts';
import { bodyKind, type OperationPlan, type PlannedResponse } from './operation-plan.ts';
import { literal, propertyKey, quote, renderJsDoc } from './printer.ts';
import type { GeneratedExport } from './types.ts';

/**
 * Zod (v4) schema generation. Schemas mirror the generated TypeScript types:
 *
 * - Objects are `z.looseObject`, so unknown properties are kept instead of silently stripped;
 *   `additionalProperties: false` becomes `z.strictObject`.
 * - Object properties that reference other schemas are getters, Zod 4's way of expressing
 *   recursive and mutually recursive schemas; it also avoids initialization-order problems
 *   between modules that import each other. Other references use `z.lazy`.
 * - Formats and patterns are documentation only and are not enforced.
 */
export interface ZodContext {
  readonly imports: ImportManager;
  readonly ctx: EmitContext;
  /** Model id → local schema name for the schema being declared in this module. */
  readonly self?: { readonly id: string; readonly name: string };
}

function hasRef(schema: SchemaIR): boolean {
  switch (schema.kind) {
    case 'ref':
      return true;
    case 'array':
      return hasRef(schema.items) || (schema.prefixItems ?? []).some(hasRef);
    case 'object':
      return (
        schema.properties.some((p) => hasRef(p.schema)) ||
        (schema.additionalProperties !== undefined &&
          schema.additionalProperties !== false &&
          hasRef(schema.additionalProperties))
      );
    case 'union':
      return schema.variants.some(hasRef);
    case 'intersection':
      return schema.members.some(hasRef);
    default:
      return false;
  }
}

function refSchema(id: string, zc: ZodContext): string | undefined {
  if (zc.self?.id === id) return zc.self.name;
  const model = zc.ctx.project.modelById.get(id);
  if (model?.zodName === undefined || model.zodModule === undefined) return undefined;
  return zc.imports.add(model.zodModule, model.zodName, { typeOnly: false });
}

function literalSchema(z: string, value: JsonValue): string {
  return value === null ? `${z}.null()` : `${z}.literal(${literal(value)})`;
}

function union(z: string, members: readonly string[]): string {
  if (members.length === 0) return `${z}.never()`;
  if (members.length === 1) return members[0] ?? `${z}.never()`;
  return `${z}.union([${members.join(', ')}])`;
}

function intersection(z: string, members: readonly string[]): string {
  return members.reduce((left, right) => `${z}.intersection(${left}, ${right})`);
}

/** The local name of the `z` import, registered only when an expression actually uses it. */
function zName(imports: ImportManager): string {
  return imports.add('zod', 'z', { typeOnly: false, external: true });
}

/** Zod expression for a schema. `inGetter` marks positions that are already evaluated lazily. */
export function zodExpression(schema: SchemaIR, zc: ZodContext, inGetter = false): string {
  if (schema.kind === 'ref') {
    const target = refSchema(schema.target, zc);
    const reference =
      target === undefined
        ? `${zName(zc.imports)}.unknown()`
        : inGetter
          ? target
          : `${zName(zc.imports)}.lazy(() => ${target})`;
    return schema.nullable === true ? `${reference}.nullable()` : reference;
  }
  const z = zName(zc.imports);
  const base = `${zodBase(schema, zc, z, inGetter)}${refinements(schema.assertions, zc)}`;
  return schema.nullable === true && schema.kind !== 'null' ? `${base}.nullable()` : base;
}

/**
 * `.refine()` calls enforcing `not`, `if`/`then`/`else`, `dependentSchemas` and
 * `dependentRequired`, which types cannot express. Nested schemas are evaluated inside the
 * callbacks, so references need no `z.lazy`.
 */
function refinements(assertions: SchemaAssertions | undefined, zc: ZodContext): string {
  if (assertions === undefined) return '';
  const matches = (schema: SchemaIR): string =>
    `${zodExpression(schema, zc, true)}.safeParse(value).success`;
  const refine = (condition: string, message: string): string =>
    `.refine((value) => ${condition}, { message: ${quote(message)} })`;
  const parts: string[] = [];
  if (assertions.not !== undefined)
    parts.push(refine(`!${matches(assertions.not)}`, 'Must not match the `not` schema.'));
  const conditional = assertions.conditional;
  if (conditional !== undefined) {
    const whenTrue = conditional.whenTrue === undefined ? 'true' : matches(conditional.whenTrue);
    const whenFalse = conditional.whenFalse === undefined ? 'true' : matches(conditional.whenFalse);
    parts.push(
      refine(
        `(${matches(conditional.condition)} ? ${whenTrue} : ${whenFalse})`,
        'Must match the `then`/`else` schema selected by `if`.',
      ),
    );
  }
  // `Object(value)` makes `in` safe for any value (primitives have no own properties).
  for (const [property, schema] of Object.entries(assertions.dependentSchemas ?? {})) {
    parts.push(
      refine(
        `!(${quote(property)} in Object(value)) || ${matches(schema)}`,
        `Objects with \`${property}\` must match its dependent schema.`,
      ),
    );
  }
  for (const [property, required] of Object.entries(assertions.dependentRequired ?? {})) {
    if (required.length === 0) continue;
    parts.push(
      refine(
        `!(${quote(property)} in Object(value)) || [${required.map(quote).join(', ')}].every((key) => key in Object(value))`,
        `Objects with \`${property}\` must also have ${required.map((r) => `\`${r}\``).join(', ')}.`,
      ),
    );
  }
  return parts.join('');
}

function zodBase(
  schema: Exclude<SchemaIR, { kind: 'ref' }>,
  zc: ZodContext,
  z: string,
  inGetter: boolean,
): string {
  switch (schema.kind) {
    case 'string': {
      // Schemas validate the JSON wire format. With `types.dates: 'Date'` the values are converted
      // after validation, so their format is checked here.
      const format = zc.ctx.config.types.dates === 'Date' ? dateFormat(schema) : undefined;
      if (format === 'date') return `${z}.iso.date()`;
      if (format === 'date-time') return `${z}.iso.datetime({ offset: true })`;
      let expression = `${z}.string()`;
      if (schema.constraints?.minLength !== undefined)
        expression += `.min(${schema.constraints.minLength})`;
      if (schema.constraints?.maxLength !== undefined)
        expression += `.max(${schema.constraints.maxLength})`;
      return expression;
    }
    case 'number':
    case 'integer': {
      let expression = schema.kind === 'integer' ? `${z}.number().int()` : `${z}.number()`;
      const c = schema.constraints;
      if (c?.minimum !== undefined) expression += `.min(${c.minimum})`;
      if (c?.maximum !== undefined) expression += `.max(${c.maximum})`;
      if (c?.exclusiveMinimum !== undefined) expression += `.gt(${c.exclusiveMinimum})`;
      if (c?.exclusiveMaximum !== undefined) expression += `.lt(${c.exclusiveMaximum})`;
      if (c?.multipleOf !== undefined) expression += `.multipleOf(${c.multipleOf})`;
      return expression;
    }
    case 'boolean':
      return `${z}.boolean()`;
    case 'null':
      return `${z}.null()`;
    case 'binary':
      return `${z}.instanceof(Blob)`;
    case 'unknown':
      return `${z}.unknown()`;
    case 'never':
      return `${z}.never()`;
    case 'enum': {
      if (schema.values.length > 0 && schema.values.every((v) => typeof v === 'string')) {
        return `${z}.enum([${schema.values.map((v) => literal(v)).join(', ')}])`;
      }
      const primitives = schema.values.filter(
        (v): v is string | number | boolean | null => v === null || typeof v !== 'object',
      );
      if (primitives.length !== schema.values.length) return `${z}.unknown()`;
      return union(
        z,
        primitives.map((v) => literalSchema(z, v)),
      );
    }
    case 'array': {
      const items = zodExpression(schema.items, zc, inGetter);
      let expression =
        schema.prefixItems === undefined
          ? `${z}.array(${items})`
          : `${z}.tuple([${schema.prefixItems.map((p) => zodExpression(p, zc, inGetter)).join(', ')}]${schema.items.kind === 'never' ? '' : `, ${items}`})`;
      if (schema.prefixItems === undefined) {
        if (schema.constraints?.minItems !== undefined)
          expression += `.min(${schema.constraints.minItems})`;
        if (schema.constraints?.maxItems !== undefined)
          expression += `.max(${schema.constraints.maxItems})`;
      }
      return expression;
    }
    case 'object':
      return zodObject(schema, zc, z, inGetter);
    case 'union': {
      const discriminator = schema.discriminator;
      const variants = schema.variants.map((variant) => {
        const expression = zodExpression(variant, zc, inGetter);
        const values =
          discriminator === undefined || variant.kind !== 'ref'
            ? []
            : discriminator.mapping.filter((m) => m.target === variant.target).map((m) => m.value);
        if (values.length === 0 || discriminator === undefined) return expression;
        const tag = union(
          z,
          values.map((v) => literalSchema(z, v)),
        );
        return `${z}.intersection(${expression}, ${z}.looseObject({ ${propertyKey(discriminator.propertyName)}: ${tag} }))`;
      });
      return union(z, variants);
    }
    case 'intersection':
      return intersection(
        z,
        schema.members.map((member) => zodExpression(member, zc, inGetter)),
      );
  }
}

function zodObject(
  schema: Extract<SchemaIR, { kind: 'object' }>,
  zc: ZodContext,
  z: string,
  inGetter: boolean,
): string {
  const additional = schema.additionalProperties;
  if (schema.properties.length === 0) {
    if (additional === false) return `${z}.strictObject({})`;
    // Inside a getter, references are evaluated lazily already and need no `z.lazy`.
    return `${z}.record(${z}.string(), ${additional === undefined ? `${z}.unknown()` : zodExpression(additional, zc, inGetter)})`;
  }
  const members = schema.properties.map((property) => {
    const lazy = hasRef(property.schema);
    let value = zodExpression(property.schema, zc, lazy);
    if (!property.required) value += '.optional()';
    const key = propertyKey(property.name);
    return lazy
      ? `get ${key}() {
  return ${value};
}`
      : `${key}: ${value}`;
  });
  const factory = additional === false ? 'strictObject' : 'looseObject';
  let expression = `${z}.${factory}({\n${members.map((m) => `  ${m.replace(/\n/g, '\n  ')},`).join('\n')}\n})`;
  if (additional !== undefined && additional !== false && additional.kind !== 'unknown') {
    expression += `.catchall(${zodExpression(additional, zc)})`;
  }
  return expression;
}

/** A Zod module per model: `zod/<model>` exporting `<Model>Schema`. */
export function generateZodModel(model: ModelSymbol, ctx: EmitContext): ModuleOutput | undefined {
  if (model.zodName === undefined || model.zodModule === undefined) return undefined;
  const name = model.zodName;
  const module = model.zodModule;
  const outputs = renderAll(module, ctx, (imports: ImportManager, lang: Lang) => {
    imports.declare(name);
    const summary = `Zod schema for {@link ${model.name}}.`;
    // The schema validates the wire format: with `types.dates: 'Date'`, dates are strings there.
    const declared = (): string =>
      model.datesName === undefined
        ? imports.add(model.module, model.name, { typeOnly: true })
        : 'unknown';
    if (lang === 'dts') {
      const z = imports.add('zod', 'z', { typeOnly: true, external: true });
      return `${renderJsDoc({ summary, tags: [] })}export declare const ${name}: ${z}.ZodType<${declared()}>;\n`;
    }
    const zc: ZodContext = { imports, ctx, self: { id: model.id, name } };
    let expression = zodExpression(model.definition.schema, zc, false);
    const z = imports.add('zod', 'z', { typeOnly: false, external: true });
    for (const { property, values } of inheritedDiscriminators(model, ctx)) {
      const tag = union(
        z,
        values.map((v) => literalSchema(z, v)),
      );
      expression = `${z}.intersection(${expression}, ${z}.looseObject({ ${propertyKey(property)}: ${tag} }))`;
    }
    const doc = renderJsDoc({ summary, tags: [] });
    if (!ctx.project.graph.recursiveSchemas().has(model.id))
      return `${doc}export const ${name} = ${expression};\n`;
    // Recursive schemas are cast to their model type: Zod's inference cannot type a schema that
    // refers to itself through `z.lazy`, and on large cycles it exceeds TypeScript's
    // instantiation depth. A cast rather than an annotation, because Zod types optional
    // properties as `T | undefined`, which `exactOptionalPropertyTypes` would reject.
    const zodType = `${imports.add('zod', 'z', { typeOnly: true, external: true })}.ZodType<${declared()}>`;
    return lang === 'js'
      ? `${doc}export const ${name} = /** @type {${zodType}} */ (${expression});\n`
      : `${doc}export const ${name} = ${expression} as ${zodType};\n`;
  });
  return {
    module,
    origin: 'core:zod',
    ...outputs,
    exports: [{ name, kind: 'schema', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}

/** Zod expression validating the data an operation resolves with. */
export function responseValidator(
  plan: OperationPlan,
  imports: ImportManager,
  ctx: EmitContext,
): string {
  const zc: ZodContext = { imports, ctx };
  const bodySchema = (response: PlannedResponse): string => {
    const media = response.media;
    if (media === undefined) return `${zName(imports)}.undefined()`;
    if (media.schema.kind === 'binary' || plan.parseAs === 'blob')
      return `${zName(imports)}.instanceof(Blob)`;
    // Validators run inside functions, so references are already evaluated lazily.
    return zodExpression(media.schema, zc, true);
  };
  const members = [...new Set(plan.success.map(bodySchema))];
  if (members.length === 0) return `${zName(imports)}.unknown()`;
  return members.length === 1 ? (members[0] ?? '') : union(zName(imports), members);
}

/**
 * Zod expression validating a request body before it is sent. With several media types,
 * `selected` is the expression of the chosen media type and the schema is picked from it.
 * Pre-encoded bodies (binary, XML and other raw formats) are not validated.
 */
export function requestValidator(
  plan: OperationPlan,
  imports: ImportManager,
  ctx: EmitContext,
  selected?: string,
): string | undefined {
  if (plan.body === undefined) return undefined;
  const schemaOf = (media: MediaTypeIR): string => {
    const kind = bodyKind(media);
    return kind === 'raw' || kind === 'binary'
      ? `${zName(imports)}.unknown()`
      : zodExpression(media.schema, { imports, ctx }, true);
  };
  const preferred = schemaOf(plan.body.media);
  if (plan.body.alternatives.length === 0 || selected === undefined) return preferred;
  let expression = preferred;
  for (const media of [...plan.body.alternatives].reverse()) {
    const schema = schemaOf(media);
    if (schema !== preferred)
      expression = `${selected} === ${quote(media.mediaType)} ? ${schema} : ${expression}`;
  }
  return expression === preferred ? preferred : `(${expression})`;
}

/** The `zod/index` barrel, separate from the main barrel so Zod stays optional. */
export function generateZodBarrel(
  ctx: EmitContext,
  modules: readonly ModuleOutput[],
): ModuleOutput {
  const outputs = renderAll(
    'zod/index',
    ctx,
    (imports) =>
      `${modules.map((m) => `export * from '${imports.specifier(m.module)}';`).join('\n')}\n`,
  );
  const exports: GeneratedExport[] = modules.flatMap((m) => m.exports);
  return { module: 'zod/index', origin: 'core:zod-barrel', ...outputs, exports };
}
