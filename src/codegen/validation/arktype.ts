import { dateFormat } from '../../analysis/dates.ts';
import type { ModelSymbol } from '../../analysis/types.ts';
import type { SchemaAssertions, SchemaIR } from '../../ir/types.ts';
import { renderAll, type EmitContext, type ModuleOutput } from '../context.ts';
import type { ImportManager, Lang } from '../imports.ts';
import { inheritedDiscriminators } from '../models.ts';
import { literal, propertyKey, quote, renderJsDoc } from '../printer.ts';
import { wireType, type Validator } from './shared.ts';

/**
 * ArkType (v2) schema generation, mirroring the Zod schemas:
 *
 * - Objects keep unknown properties (ArkType's default); `additionalProperties: false` rejects
 *   them (`onUndeclaredKey('reject')`) and typed additional properties are checked by `rest()`.
 * - ArkType resolves definitions eagerly and has no lazy references, so references inside schema
 *   modules go through the generated `lazy()` helper (`arktype/support`), which resolves the
 *   target when data is validated and keeps the target's error paths. Intersections use
 *   `allOf()`, because ArkType rejects contradictory intersections when they are defined, which
 *   would make importing the module throw.
 * - Each schema is typed as `Type<Model>` with `.as<Model>()`.
 * - Formats and patterns are documentation only and are not enforced.
 */
const SUPPORT = 'arktype/support';

interface ArkContext {
  readonly imports: ImportManager;
  readonly ctx: EmitContext;
  /** References need no `lazy()`: the expression is evaluated when data is validated. */
  readonly deferred: boolean;
}

const type = (imports: ImportManager): string =>
  imports.add('arktype', 'type', { typeOnly: false, external: true });

const typeType = (imports: ImportManager, of: string): string =>
  `${imports.add('arktype', 'Type', { typeOnly: true, external: true })}<${of}>`;

const support = (imports: ImportManager, name: 'lazy' | 'allOf' | 'rest'): string =>
  imports.add(SUPPORT, name, { typeOnly: false });

/**
 * An object key in ArkType's definition syntax: a trailing `?` marks optional properties and
 * leading `[`, `...` and `+` start index signatures, spreads and options, so those are escaped.
 */
export function arkKey(name: string, optional: boolean): string {
  let key = /^(\[|\.\.\.|\+)/.test(name) ? `\\${name}` : name;
  if (key.endsWith('?')) key = `${key.slice(0, -1)}\\?`;
  return propertyKey(optional ? `${key}?` : key);
}

function reference(id: string, ac: ArkContext): string {
  const model = ac.ctx.project.modelById.get(id);
  if (model?.schemaName === undefined || model.schemaModule === undefined)
    return `${type(ac.imports)}.unknown`;
  const schema = ac.imports.add(model.schemaModule, model.schemaName, { typeOnly: false });
  if (ac.deferred) return schema;
  // An explicit return type: inferring it would read the schema's type while it is being declared.
  const declared = typeType(ac.imports, wireType(model, ac.imports));
  const lazy = support(ac.imports, 'lazy');
  return ac.imports.lang === 'js'
    ? `${lazy}(/** @returns {${declared}} */ () => ${schema})`
    : `${lazy}((): ${declared} => ${schema})`;
}

function union(t: () => string, members: readonly string[]): string {
  const [first, ...rest] = members;
  if (first === undefined) return `${t()}.never`;
  return rest.reduce((left, right) => `${left}.or(${right})`, first);
}

export function arkExpression(schema: SchemaIR, ac: ArkContext): string {
  const base =
    schema.kind === 'ref'
      ? reference(schema.target, ac)
      : `${arkBase(schema, ac)}${narrows(schema.assertions, ac)}`;
  return schema.nullable === true && schema.kind !== 'null'
    ? `${base}.or(${type(ac.imports)}.null)`
    : base;
}

/** `.narrow()` calls enforcing `not`, conditionals and dependent schemas or properties. */
function narrows(assertions: SchemaAssertions | undefined, ac: ArkContext): string {
  if (assertions === undefined) return '';
  // Nested schemas are evaluated inside the callbacks, so references need no `lazy()`.
  const inner: ArkContext = { ...ac, deferred: true };
  const matches = (schema: SchemaIR): string => `${arkExpression(schema, inner)}.allows(value)`;
  const narrow = (condition: string, description: string): string =>
    `.narrow((value, ctx) => ${condition} || ctx.mustBe(${quote(description)}))`;
  const parts: string[] = [];
  if (assertions.not !== undefined)
    parts.push(narrow(`!${matches(assertions.not)}`, 'a value that does not match `not`'));
  const conditional = assertions.conditional;
  if (conditional !== undefined) {
    const whenTrue = conditional.whenTrue === undefined ? 'true' : matches(conditional.whenTrue);
    const whenFalse = conditional.whenFalse === undefined ? 'true' : matches(conditional.whenFalse);
    parts.push(
      narrow(
        `(${matches(conditional.condition)} ? ${whenTrue} : ${whenFalse})`,
        'a value matching the `then`/`else` schema selected by `if`',
      ),
    );
  }
  for (const [property, schema] of Object.entries(assertions.dependentSchemas ?? {})) {
    parts.push(
      narrow(
        `!(${quote(property)} in Object(value)) || ${matches(schema)}`,
        `an object matching the dependent schema of \`${property}\``,
      ),
    );
  }
  for (const [property, required] of Object.entries(assertions.dependentRequired ?? {})) {
    if (required.length === 0) continue;
    parts.push(
      narrow(
        `!(${quote(property)} in Object(value)) || [${required.map(quote).join(', ')}].every((key) => key in Object(value))`,
        `an object with ${required.map((r) => `\`${r}\``).join(', ')} when it has \`${property}\``,
      ),
    );
  }
  return parts.join('');
}

function arkBase(schema: Exclude<SchemaIR, { kind: 'ref' }>, ac: ArkContext): string {
  // Imported on first use: a schema made only of references never mentions `type`.
  const t = (): string => type(ac.imports);
  switch (schema.kind) {
    case 'string': {
      // Schemas validate the JSON wire format; with `types.dates: 'Date'` the strings are
      // converted after validation, so their format is checked here.
      const format = ac.ctx.config.types.dates === 'Date' ? dateFormat(schema) : undefined;
      if (format === 'date') return `${t()}('string.date.iso').and(/^\\d{4}-\\d{2}-\\d{2}$/)`;
      if (format === 'date-time') return `${t()}('string.date.iso').and(/^\\d{4}-\\d{2}-\\d{2}T/)`;
      let expression = `${t()}.string`;
      if (schema.constraints?.minLength !== undefined)
        expression += `.atLeastLength(${schema.constraints.minLength})`;
      if (schema.constraints?.maxLength !== undefined)
        expression += `.atMostLength(${schema.constraints.maxLength})`;
      return expression;
    }
    case 'number':
    case 'integer': {
      let expression = schema.kind === 'integer' ? `${t()}('number.integer')` : `${t()}.number`;
      const c = schema.constraints;
      if (c?.minimum !== undefined) expression += `.atLeast(${c.minimum})`;
      if (c?.maximum !== undefined) expression += `.atMost(${c.maximum})`;
      if (c?.exclusiveMinimum !== undefined) expression += `.moreThan(${c.exclusiveMinimum})`;
      if (c?.exclusiveMaximum !== undefined) expression += `.lessThan(${c.exclusiveMaximum})`;
      if (c?.multipleOf !== undefined) {
        // ArkType's divisors are integers; other multiples are checked with a tolerance.
        expression += Number.isInteger(c.multipleOf)
          ? `.divisibleBy(${c.multipleOf})`
          : `.narrow((value, ctx) => Math.abs(value / ${c.multipleOf} - Math.round(value / ${c.multipleOf})) < 1e-9 || ctx.mustBe(${quote(`a multiple of ${c.multipleOf}`)}))`;
      }
      return expression;
    }
    case 'boolean':
      return `${t()}.boolean`;
    case 'null':
      return `${t()}.null`;
    case 'binary':
      return `${t()}.instanceOf(Blob)`;
    case 'unknown':
      return `${t()}.unknown`;
    case 'never':
      return `${t()}.never`;
    case 'enum': {
      const primitives = schema.values.filter(
        (value): value is string | number | boolean | null =>
          value === null || typeof value !== 'object',
      );
      if (primitives.length !== schema.values.length) return `${t()}.unknown`;
      if (primitives.length === 0) return `${t()}.never`;
      return `${t()}.enumerated(${primitives.map((value) => literal(value)).join(', ')})`;
    }
    case 'array': {
      const items = arkExpression(schema.items, ac);
      if (schema.prefixItems !== undefined) {
        const prefix = schema.prefixItems.map((item) => arkExpression(item, ac));
        const rest = schema.items.kind === 'never' ? [] : [`'...'`, `${items}.array()`];
        return `${t()}([${[...prefix, ...rest].join(', ')}])`;
      }
      let expression = `${items}.array()`;
      if (schema.constraints?.minItems !== undefined)
        expression += `.atLeastLength(${schema.constraints.minItems})`;
      if (schema.constraints?.maxItems !== undefined)
        expression += `.atMostLength(${schema.constraints.maxItems})`;
      return expression;
    }
    case 'object':
      return arkObject(schema, ac);
    case 'union': {
      const discriminator = schema.discriminator;
      const variants = schema.variants.map((variant) => {
        const expression = arkExpression(variant, ac);
        const values =
          discriminator === undefined || variant.kind !== 'ref'
            ? []
            : discriminator.mapping.filter((m) => m.target === variant.target).map((m) => m.value);
        if (values.length === 0 || discriminator === undefined) return expression;
        return `${expression}.and(${t()}({ ${arkKey(discriminator.propertyName, false)}: ${t()}.enumerated(${values.map(quote).join(', ')}) }))`;
      });
      return union(t, variants);
    }
    case 'intersection': {
      const members = schema.members.map((member) => arkExpression(member, ac));
      return members.length === 1
        ? (members[0] ?? `${t()}.unknown`)
        : `${support(ac.imports, 'allOf')}(${members.join(', ')})`;
    }
  }
}

function arkObject(schema: Extract<SchemaIR, { kind: 'object' }>, ac: ArkContext): string {
  const t = (): string => type(ac.imports);
  const additional = schema.additionalProperties;
  if (schema.properties.length === 0) {
    if (additional === false) return `${t()}({}).onUndeclaredKey('reject')`;
    return `${t()}.Record(${t()}.string, ${additional === undefined ? `${t()}.unknown` : arkExpression(additional, ac)})`;
  }
  const entries = schema.properties.map(
    (property) =>
      `${arkKey(property.name, !property.required)}: ${arkExpression(property.schema, ac)}`,
  );
  const object = `${t()}({\n${entries.map((entry) => `  ${entry.replace(/\n/g, '\n  ')},`).join('\n')}\n})`;
  if (additional === false) return `${object}.onUndeclaredKey('reject')`;
  if (additional !== undefined && additional.kind !== 'unknown') {
    const known = schema.properties.map((property) => quote(property.name)).join(', ');
    return `${support(ac.imports, 'rest')}(${object}, [${known}], ${arkExpression(additional, ac)})`;
  }
  return object;
}

/** An ArkType module per model: `arktype/<model>` exporting `<Model>Schema`. */
function generateArkTypeModel(model: ModelSymbol, ctx: EmitContext): ModuleOutput | undefined {
  if (model.schemaName === undefined || model.schemaModule === undefined) return undefined;
  const name = model.schemaName;
  const module = model.schemaModule;
  const outputs = renderAll(module, ctx, (imports, lang) => {
    imports.declare(name);
    const doc = renderJsDoc({ summary: `ArkType schema for {@link ${model.name}}.`, tags: [] });
    const wire = wireType(model, imports);
    if (lang === 'dts') return `${doc}export declare const ${name}: ${typeType(imports, wire)};\n`;
    const ac: ArkContext = { imports, ctx, deferred: false };
    let expression = arkExpression(model.definition.schema, ac);
    for (const { property, values } of inheritedDiscriminators(model, ctx)) {
      const t = type(imports);
      expression = `${expression}.and(${t}({ ${arkKey(property, false)}: ${t}.enumerated(${values.map(quote).join(', ')}) }))`;
    }
    // `.as<T>()` names the type ArkType would otherwise infer from the (lazily typed) definition.
    return lang === 'js'
      ? `${doc}export const ${name} = /** @type {${typeType(imports, wire)}} */ (/** @type {unknown} */ (${expression}));\n`
      : `${doc}export const ${name} = ${expression}.as<${wire}>();\n`;
  });
  return {
    module,
    origin: 'core:validation',
    ...outputs,
    exports: [{ name, kind: 'schema', typeOnly: false }],
    sources: { schemas: [model.id] },
  };
}

/** `arktype/support`: the reference, intersection and additional-properties helpers. */
function generateSupport(ctx: EmitContext): ModuleOutput[] {
  const module = SUPPORT;
  const body = (imports: ImportManager, lang: Lang): string => {
    for (const name of ['lazy', 'allOf', 'rest']) imports.declare(name);
    const T = (of: string): string => typeType(imports, of);
    const ts = lang === 'ts';
    const docs = (summary: string, jsTags: readonly string[]): string =>
      renderJsDoc({
        summary,
        tags:
          lang === 'js'
            ? jsTags.map((text) => ({
                tag: text.split(' ')[0] ?? '',
                text: text.slice(text.indexOf(' ') + 1),
              }))
            : [],
      });
    const lazyDoc = docs(
      'A reference resolved when data is validated, so schemas can refer to each other in any order and to themselves. Errors keep their paths.',
      ['template T', `param {() => ${T('T')}} get`, `returns {${T('T')}}`],
    );
    const allOfDoc = docs(
      'The intersection of schemas. ArkType rejects contradictory intersections when they are defined; those are checked when data is validated instead, so the module still loads.',
      [`param {...${T('unknown')}} types`, `returns {${T('unknown')}}`],
    );
    const restDoc = docs(
      'An object schema whose properties other than `known` must match `additional` (JSON Schema `additionalProperties`).',
      [
        'template T',
        `param {${T('T')}} object`,
        'param {readonly string[]} known',
        `param {${T('unknown')}} additional`,
        `returns {${T('T')}}`,
      ],
    );
    if (lang === 'dts') {
      return [
        `${lazyDoc}export declare function lazy<T>(get: () => ${T('T')}): ${T('T')};\n`,
        `${allOfDoc}export declare function allOf(...types: ${T('unknown')}[]): ${T('unknown')};\n`,
        `${restDoc}export declare function rest<T>(object: ${T('T')}, known: readonly string[], additional: ${T('unknown')}): ${T('T')};\n`,
      ].join('\n');
    }
    const t = type(imports);
    // Through `unknown`: TypeScript cannot relate ArkType's types of a generic `T`.
    const cast = (target: string, expression: string): string =>
      ts
        ? `(${expression} as unknown as ${T(target)})`
        : `/** @type {${T(target)}} */ (/** @type {unknown} */ (${expression}))`;
    const annotate = (target: string): string => (ts ? `: ${T(target)}` : '');
    const forward = (path: string): string =>
      `for (const error of result)\n      ctx.error({\n        expected: error.expected,\n        actual: error.actual,\n        problem: error.problem,\n        relativePath: ${path},\n      });`;
    return [
      `${lazyDoc}export function lazy${ts ? `<T>(get: () => ${T('T')}): ${T('T')}` : '(get)'} {\n` +
        `  const reference${annotate('unknown')} = ${t}.unknown.narrow((data, ctx) => {\n` +
        `    // ArkType may already ask while reducing the definition that contains the reference,\n` +
        `    // possibly before the target is initialized; answering no only keeps branches apart.\n` +
        `    let target${ts ? `: ${T('unknown')}` : ''};\n    try {\n      target = ${cast('unknown', 'get()')};\n    } catch {\n      return false;\n    }\n` +
        `    const result = target(data);\n    if (!(result instanceof ${t}.errors)) return true;\n    ${forward('[...error.path]')}\n    return false;\n  });\n` +
        `  return ${cast('T', 'reference')};\n}\n`,
      `${allOfDoc}export function allOf${ts ? `(...types: ${T('unknown')}[]): ${T('unknown')}` : '(...types)'} {\n` +
        `  try {\n    let result${annotate('unknown')} = types[0] ?? ${t}.unknown;\n` +
        `    for (const member of types.slice(1)) result = result.and(member);\n    return result;\n  } catch {\n` +
        `    return ${t}.unknown.narrow(\n      (data, ctx) =>\n        types.every((member) => member.allows(data)) || ctx.mustBe('a value matching every member of allOf'),\n    );\n  }\n}\n`,
      `${restDoc}export function rest${ts ? `<T>(object: ${T('T')}, known: readonly string[], additional: ${T('unknown')}): ${T('T')}` : '(object, known, additional)'} {\n` +
        `  const others${annotate('unknown')} = ${t}.unknown.narrow((data, ctx) => {\n` +
        `    if (typeof data !== 'object' || data === null) return true;\n    let valid = true;\n` +
        `    for (const [key, value] of Object.entries(data)) {\n      if (known.includes(key)) continue;\n` +
        `      const result = additional(value);\n      if (!(result instanceof ${t}.errors)) continue;\n      valid = false;\n` +
        `      ${forward('[key, ...error.path]').replace(/\n/g, '\n  ')}\n    }\n    return valid;\n  });\n` +
        `  return ${cast('T', `${cast('unknown', 'object')}.and(others)`)};\n}\n`,
    ].join('\n');
  };
  return [
    {
      module,
      origin: 'core:validation',
      ...renderAll(module, ctx, body),
      exports: [
        { name: 'lazy', kind: 'runtime', typeOnly: false },
        { name: 'allOf', kind: 'runtime', typeOnly: false },
        { name: 'rest', kind: 'runtime', typeOnly: false },
      ],
    },
  ];
}

/** ArkType 2. */
export const ARKTYPE: Validator = {
  library: 'arktype',
  label: 'ArkType',
  inline: (schema, imports, ctx) => arkExpression(schema, { imports, ctx, deferred: true }),
  union: (members, imports) => union(() => type(imports), members),
  unknown: (imports) => `${type(imports)}.unknown`,
  undefined: (imports) => `${type(imports)}.undefined`,
  blob: (imports) => `${type(imports)}.instanceOf(Blob)`,
  parse: (schema, value) => `${schema}.assert(${value})`,
  model: generateArkTypeModel,
  support: generateSupport,
};
