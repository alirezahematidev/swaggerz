import { dateFormat } from '../../analysis/dates.ts';
import type { ModelSymbol } from '../../analysis/types.ts';
import type { JsonValue, SchemaAssertions, SchemaIR } from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager } from '../imports.ts';
import { inheritedDiscriminators } from '../models.ts';
import { literal, propertyKey, quote, renderJsDoc } from '../printer.ts';
import {
  acceptsAnything,
  DATE_TIME_PATTERN,
  intersectionMembers,
  isInheritedOptional,
  ownPropertiesFunction,
  wireType,
  VALID_DATE,
  type Validator,
} from './shared.ts';

/**
 * Valibot (v1) schema generation, mirroring the Zod schemas:
 *
 * - Objects are `v.looseObject`, so unknown properties are kept; `additionalProperties: false`
 *   becomes `v.strictObject` and typed additional properties `v.objectWithRest`. Optional
 *   properties are `v.exactOptional`, matching `exactOptionalPropertyTypes` (the client removes
 *   `undefined` properties from request bodies before validating them).
 * - Inside schema modules every reference is `v.lazy` with an explicitly typed getter, so modules
 *   can refer to each other in any order and recursively without TypeScript inferring a type from
 *   its own initializer. Each schema is typed as `v.GenericSchema<Model>`.
 * - Formats and patterns are documentation only and are not enforced.
 */
interface ValibotContext {
  readonly imports: ImportManager;
  readonly ctx: EmitContext;
  /** References need no `v.lazy`: the expression is evaluated when data is validated. */
  readonly deferred: boolean;
  /** Models copied into `allOf` on the way here (see `intersectionMembers`). */
  readonly inlined?: ReadonlySet<string>;
}

const v = (imports: ImportManager): string =>
  imports.namespace('valibot', 'v', { typeOnly: false });

/** `v.GenericSchema<T>` usable in a type position. */
function genericSchema(imports: ImportManager, type: string): string {
  return `${imports.namespace('valibot', 'v', { typeOnly: true })}.GenericSchema<${type}>`;
}

function literalSchema(n: string, value: JsonValue): string {
  return value === null ? `${n}.null()` : `${n}.literal(${literal(value)})`;
}

function union(n: string, members: readonly string[]): string {
  if (members.length === 0) return `${n}.never()`;
  if (members.length === 1) return members[0] ?? `${n}.never()`;
  return `${n}.union([${members.join(', ')}])`;
}

function pipe(n: string, base: string, actions: readonly string[]): string {
  return actions.length === 0 ? base : `${n}.pipe(${base}, ${actions.join(', ')})`;
}

function reference(id: string, vc: ValibotContext): string {
  const model = vc.ctx.project.modelById.get(id);
  const n = v(vc.imports);
  if (model?.schemaName === undefined || model.schemaModule === undefined) return `${n}.unknown()`;
  const schema = vc.imports.add(model.schemaModule, model.schemaName, { typeOnly: false });
  if (vc.deferred) return schema;
  // An explicit return type: inferring it would read the schema's type while it is being declared.
  const type = genericSchema(vc.imports, wireType(model, vc.imports));
  return vc.imports.lang === 'js'
    ? `${n}.lazy(/** @returns {${type}} */ () => ${schema})`
    : `${n}.lazy((): ${type} => ${schema})`;
}

export function valibotExpression(schema: SchemaIR, vc: ValibotContext): string {
  const n = v(vc.imports);
  const base =
    schema.kind === 'ref'
      ? reference(schema.target, vc)
      : pipe(n, valibotBase(schema, vc, n), checks(schema.assertions, vc, n));
  return schema.nullable === true && schema.kind !== 'null' ? `${n}.nullable(${base})` : base;
}

/** `v.check()` actions enforcing `not`, conditionals and dependent schemas or properties. */
function checks(assertions: SchemaAssertions | undefined, vc: ValibotContext, n: string): string[] {
  if (assertions === undefined) return [];
  // Nested schemas are evaluated inside the callbacks, so references need no `v.lazy`.
  const inner: ValibotContext = { ...vc, deferred: true };
  const matches = (schema: SchemaIR): string =>
    `${n}.is(${valibotExpression(schema, inner)}, value)`;
  const check = (condition: string, message: string): string =>
    `${n}.check((value) => ${condition}, ${quote(message)})`;
  const actions: string[] = [];
  if (assertions.not !== undefined)
    actions.push(check(`!${matches(assertions.not)}`, 'Must not match the `not` schema.'));
  const conditional = assertions.conditional;
  if (conditional !== undefined) {
    const whenTrue = conditional.whenTrue === undefined ? 'true' : matches(conditional.whenTrue);
    const whenFalse = conditional.whenFalse === undefined ? 'true' : matches(conditional.whenFalse);
    actions.push(
      check(
        `(${matches(conditional.condition)} ? ${whenTrue} : ${whenFalse})`,
        'Must match the `then`/`else` schema selected by `if`.',
      ),
    );
  }
  for (const [property, schema] of Object.entries(assertions.dependentSchemas ?? {})) {
    actions.push(
      check(
        `!(${quote(property)} in Object(value)) || ${matches(schema)}`,
        `Objects with \`${property}\` must match its dependent schema.`,
      ),
    );
  }
  for (const [property, required] of Object.entries(assertions.dependentRequired ?? {})) {
    if (required.length === 0) continue;
    actions.push(
      check(
        `!(${quote(property)} in Object(value)) || [${required.map(quote).join(', ')}].every((key) => key in Object(value))`,
        `Objects with \`${property}\` must also have ${required.map((r) => `\`${r}\``).join(', ')}.`,
      ),
    );
  }
  return actions;
}

function valibotBase(
  schema: Exclude<SchemaIR, { kind: 'ref' }>,
  vc: ValibotContext,
  n: string,
): string {
  switch (schema.kind) {
    case 'string': {
      // Schemas validate the JSON wire format; with `types.dates: 'Date'` the strings are
      // converted after validation, so their format is checked here.
      const format = vc.ctx.config.types.dates === 'Date' ? dateFormat(schema) : undefined;
      if (format === 'date') return `${n}.pipe(${n}.string(), ${n}.isoDate())`;
      if (format === 'date-time')
        return `${n}.pipe(${n}.string(), ${n}.regex(${DATE_TIME_PATTERN}), ${n}.check(${VALID_DATE}, 'Invalid date-time.'))`;
      // JSON Schema counts characters (code points), `v.minLength` UTF-16 code units: a string is
      // only counted when its code units could exceed the bound.
      const actions: string[] = [];
      const min = schema.constraints?.minLength;
      const max = schema.constraints?.maxLength;
      if (min !== undefined)
        actions.push(
          `${n}.check((value) => value.length >= ${2 * min} || [...value].length >= ${min}, ${quote(`Must have at least ${min} characters.`)})`,
        );
      if (max !== undefined)
        actions.push(
          `${n}.check((value) => value.length <= ${max} || [...value].length <= ${max}, ${quote(`Must have at most ${max} characters.`)})`,
        );
      return pipe(n, `${n}.string()`, actions);
    }
    case 'number':
    case 'integer': {
      const actions: string[] = schema.kind === 'integer' ? [`${n}.integer()`] : [];
      const c = schema.constraints;
      if (c?.minimum !== undefined) actions.push(`${n}.minValue(${c.minimum})`);
      if (c?.maximum !== undefined) actions.push(`${n}.maxValue(${c.maximum})`);
      if (c?.exclusiveMinimum !== undefined) actions.push(`${n}.gtValue(${c.exclusiveMinimum})`);
      if (c?.exclusiveMaximum !== undefined) actions.push(`${n}.ltValue(${c.exclusiveMaximum})`);
      if (c?.multipleOf !== undefined) {
        // `v.multipleOf` uses `%`, which rejects decimal multiples such as 19.99 of 0.01.
        const m = c.multipleOf;
        actions.push(
          Number.isInteger(m)
            ? `${n}.multipleOf(${m})`
            : `${n}.check((value) => Math.abs(value / ${m} - Math.round(value / ${m})) < 1e-9, ${quote(`Must be a multiple of ${m}.`)})`,
        );
      }
      return pipe(n, `${n}.number()`, actions);
    }
    case 'boolean':
      return `${n}.boolean()`;
    case 'null':
      return `${n}.null()`;
    case 'binary':
      return `${n}.instance(Blob)`;
    case 'unknown':
      return `${n}.unknown()`;
    case 'never':
      return `${n}.never()`;
    case 'enum': {
      if (schema.values.length > 0 && schema.values.every((value) => typeof value === 'string'))
        return `${n}.picklist([${schema.values.map((value) => literal(value)).join(', ')}])`;
      const primitives = schema.values.filter(
        (value): value is string | number | boolean | null =>
          value === null || typeof value !== 'object',
      );
      if (primitives.length !== schema.values.length) return `${n}.unknown()`;
      return union(
        n,
        primitives.map((value) => literalSchema(n, value)),
      );
    }
    case 'array': {
      const items = valibotExpression(schema.items, vc);
      if (schema.prefixItems !== undefined) {
        const prefix = schema.prefixItems.map((item) => valibotExpression(item, vc)).join(', ');
        return schema.items.kind === 'never'
          ? `${n}.strictTuple([${prefix}])`
          : `${n}.tupleWithRest([${prefix}], ${items})`;
      }
      const actions: string[] = [];
      if (schema.constraints?.minItems !== undefined)
        actions.push(`${n}.minLength(${schema.constraints.minItems})`);
      if (schema.constraints?.maxItems !== undefined)
        actions.push(`${n}.maxLength(${schema.constraints.maxItems})`);
      return pipe(n, `${n}.array(${items})`, actions);
    }
    case 'object':
      return valibotObject(schema, vc, n);
    case 'union': {
      const discriminator = schema.discriminator;
      const variants = schema.variants.map((variant) => {
        const expression = valibotExpression(variant, vc);
        const values =
          discriminator === undefined || variant.kind !== 'ref'
            ? []
            : discriminator.mapping.filter((m) => m.target === variant.target).map((m) => m.value);
        if (values.length === 0 || discriminator === undefined) return expression;
        return `${n}.intersect([${expression}, ${n}.looseObject({ ${propertyKey(discriminator.propertyName)}: ${n}.picklist([${values.map(quote).join(', ')}]) })])`;
      });
      return union(n, variants);
    }
    case 'intersection': {
      const { relaxed, closedKeys, inlined } = intersectionMembers(
        schema.members,
        vc.ctx,
        vc.inlined,
      );
      const members = relaxed.map((member) => valibotExpression(member, { ...vc, inlined }));
      if (members.length === 1) return members[0] ?? `${n}.unknown()`;
      const intersection = `${n}.intersect([${members.join(', ')}])`;
      if (closedKeys === undefined) return intersection;
      return `${n}.pipe(${intersection}, ${n}.check((value) => Object.keys(Object(value)).every((key) => [${closedKeys.map(quote).join(', ')}].includes(key)), 'Must not have properties that no member of allOf declares.'))`;
    }
  }
}

function valibotObject(
  schema: Extract<SchemaIR, { kind: 'object' }>,
  vc: ValibotContext,
  n: string,
): string {
  const declared = schema.additionalProperties;
  // Additional properties that accept anything are the same as undeclared ones.
  const additional =
    declared !== false && declared !== undefined && acceptsAnything(declared)
      ? undefined
      : declared;
  if (schema.properties.length === 0) {
    if (additional === false) return `${n}.strictObject({})`;
    return `${n}.record(${n}.string(), ${additional === undefined ? `${n}.unknown()` : valibotExpression(additional, vc)})`;
  }
  const entries = schema.properties.map((property) => {
    const value = valibotExpression(property.schema, vc);
    return `${propertyKey(property.name)}: ${property.required ? value : `${n}.exactOptional(${value})`}`;
  });
  const shape = `{\n${entries.map((entry) => `  ${entry.replace(/\n/g, '\n  ')},`).join('\n')}\n}`;
  const object =
    additional === false
      ? `${n}.strictObject(${shape})`
      : additional !== undefined
        ? `${n}.objectWithRest(${shape}, ${valibotExpression(additional, vc)})`
        : `${n}.looseObject(${shape})`;
  // Valibot looks properties up with `in`: optional properties named like `Object.prototype`
  // members (`constructor`) are checked on a copy that has only the object's own properties.
  if (!schema.properties.some(isInheritedOptional)) return object;
  return `${n}.pipe(\n  ${n}.unknown(),\n  ${n}.transform(${ownPropertiesFunction(vc.imports.lang).replace(/\n/g, '\n  ')}),\n  ${object.replace(/\n/g, '\n  ')},\n)`;
}

/** A Valibot module per model: `valibot/<model>` exporting `<Model>Schema`. */
function generateValibotModel(model: ModelSymbol, ctx: EmitContext): ModuleOutput | undefined {
  if (model.schemaName === undefined || model.schemaModule === undefined) return undefined;
  const name = model.schemaName;
  const module = model.schemaModule;
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const doc = renderJsDoc({ summary: `Valibot schema for {@link ${model.name}}.`, tags: [] });
    const type = genericSchema(imports, wireType(model, imports));
    if (lang === 'dts') return `${doc}export declare const ${name}: ${type};\n`;
    const vc: ValibotContext = { imports, ctx, deferred: false };
    const n = v(imports);
    let expression = valibotExpression(model.definition.schema, vc);
    const tags = inheritedDiscriminators(model, ctx).map(
      ({ property, values }) =>
        `${n}.looseObject({ ${propertyKey(property)}: ${n}.picklist([${values.map(quote).join(', ')}]) })`,
    );
    if (tags.length > 0) expression = `${n}.intersect([${[expression, ...tags].join(', ')}])`;
    return lang === 'js'
      ? `${doc}export const ${name} = /** @type {${type}} */ (${expression});\n`
      : `${doc}export const ${name} = ${expression} as ${type};\n`;
  });
  return {
    module,
    origin: 'core:validation',
    ...outputs,
    exports: [{ name, kind: 'schema', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}

/** Valibot 1. */
export const VALIBOT: Validator = {
  library: 'valibot',
  label: 'Valibot',
  inline: (schema, imports, ctx) => valibotExpression(schema, { imports, ctx, deferred: true }),
  union: (members, imports) => union(v(imports), members),
  unknown: (imports) => `${v(imports)}.unknown()`,
  undefined: (imports) => `${v(imports)}.undefined()`,
  blob: (imports) => `${v(imports)}.instance(Blob)`,
  parse: (schema, value, imports) => `${v(imports)}.parse(${schema}, ${value})`,
  model: generateValibotModel,
};
