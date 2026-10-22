import { dateFormat } from '../analysis/dates.ts';
import type { ProjectModel } from '../analysis/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import type { DiscriminatorIR, JsonValue, SchemaIR } from '../ir/types.ts';
import { someSchema } from '../ir/utils.ts';
import type { ImportManager } from './imports.ts';
import { schemaDoc } from './jsdoc.ts';
import { propertyKey, quote, renderJsDoc } from './printer.ts';

export interface TypeContext {
  readonly imports: ImportManager;
  readonly project: ProjectModel;
  readonly config: ResolvedConfig;
  /** Models declared in the current module (id → local name). */
  readonly local?: ReadonlyMap<string, string>;
  /** Binary values in request bodies accept more input types than responses produce. */
  readonly direction?: 'input' | 'output';
  /**
   * Replaces an array or tuple type that is not nested in an object type by a reference (JSDoc
   * typedefs of recursive models; see `jsTypedef`). Not applied inside object types.
   */
  readonly hoistArray?: ((type: string) => string) | undefined;
}

/**
 * A printed type and its top-level operator, so that nesting it adds parentheses where needed
 * without re-parsing the text (which may contain comments and string literals).
 */
export interface PrintedType {
  readonly text: string;
  /** `union` for `A | B`, `intersection` for `A & B`, `undefined` for everything else. */
  readonly operator: 'union' | 'intersection' | undefined;
}

const UNKNOWN: PrintedType = { text: 'unknown', operator: undefined };
const NULL: PrintedType = { text: 'null', operator: undefined };

const atom = (text: string): PrintedType => ({ text, operator: undefined });

/**
 * Parenthesizes a type inside an array, union or intersection: unions and intersections inside
 * arrays, unions inside intersections and (for readability) intersections inside unions.
 */
export function wrapType(type: PrintedType, inside: 'array' | 'union' | 'intersection'): string {
  const needs = type.operator !== undefined && (inside === 'array' || type.operator !== inside);
  return needs ? `(${type.text})` : type.text;
}

function literalType(value: JsonValue): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === 'boolean') return String(value);
  return undefined;
}

/** Joins types with an operator, dropping duplicates; a single member is wrapped as before. */
function combine(types: readonly PrintedType[], operator: 'union' | 'intersection'): PrintedType {
  const unique = types.filter(
    (type, index) => types.findIndex((other) => other.text === type.text) === index,
  );
  const parts = unique.map((type) => wrapType(type, operator));
  const only = unique[0];
  if (unique.length === 1 && only !== undefined)
    return parts[0] === only.text ? only : atom(parts[0] ?? only.text);
  return { text: parts.join(operator === 'union' ? ' | ' : ' & '), operator };
}

function unionOf(types: readonly PrintedType[]): PrintedType {
  if (types.some((type) => type.text === 'unknown')) return UNKNOWN;
  const withoutNever = types.length > 1 ? types.filter((type) => type.text !== 'never') : types;
  return combine(withoutNever.length === 0 ? types : withoutNever, 'union');
}

/**
 * Prints a TypeScript type for a schema. In `js` mode the output is a single-line type for use
 * inside JSDoc tags; otherwise object types are multi-line with property documentation.
 */
export function printType(schema: SchemaIR, ctx: TypeContext, indent = ''): string {
  return printTypeNode(schema, ctx, indent).text;
}

/** Like {@link printType}, with the type's top-level operator for {@link wrapType}. */
export function printTypeNode(schema: SchemaIR, ctx: TypeContext, indent = ''): PrintedType {
  const base = printBase(schema, ctx, indent);
  if (schema.nullable !== true || base.text === 'unknown' || base.text === 'null') return base;
  return unionOf([base, NULL]);
}

function refName(target: string, ctx: TypeContext): string {
  const local = ctx.local?.get(target);
  if (local !== undefined) return local;
  const model = ctx.project.modelById.get(target);
  if (model === undefined) return 'unknown';
  return ctx.imports.add(model.module, model.name, { typeOnly: true });
}

/** The types binary values have: `Blob` in responses, also raw bytes in request bodies. */
export function binaryType(ctx: TypeContext): PrintedType {
  const global = (name: string): string => ctx.imports.global(name);
  return ctx.direction === 'input'
    ? {
        text: `${global('Blob')} | ${global('ArrayBuffer')} | ${global('ArrayBufferView')}`,
        operator: 'union',
      }
    : atom(global('Blob'));
}

function printBase(schema: SchemaIR, ctx: TypeContext, indent: string): PrintedType {
  switch (schema.kind) {
    case 'ref':
      return atom(refName(schema.target, ctx));
    case 'string':
      return atom(
        ctx.config.types.dates === 'Date' && dateFormat(schema) !== undefined
          ? ctx.imports.global('Date')
          : 'string',
      );
    case 'number':
    case 'integer':
      return atom('number');
    case 'boolean':
      return atom('boolean');
    case 'null':
      return NULL;
    case 'binary':
      return binaryType(ctx);
    case 'unknown':
      return UNKNOWN;
    case 'never':
      return atom('never');
    case 'enum': {
      const literals = schema.values.map(literalType);
      if (literals.some((l) => l === undefined)) return UNKNOWN;
      return unionOf(literals.filter((l): l is string => l !== undefined).map(atom));
    }
    case 'array': {
      // Items are never hoisted themselves: the hoisted array type defers them.
      const inner: TypeContext = { ...ctx, hoistArray: undefined };
      const items = printTypeNode(schema.items, inner, indent);
      let text: string;
      if (schema.prefixItems !== undefined) {
        const prefix = schema.prefixItems.map((item) => printType(item, inner, indent));
        const rest = schema.items.kind === 'never' ? [] : [`...${wrapType(items, 'array')}[]`];
        text = `[${[...prefix, ...rest].join(', ')}]`;
      } else {
        text = `${wrapType(items, 'array')}[]`;
      }
      return atom(ctx.hoistArray === undefined ? text : ctx.hoistArray(text));
    }
    case 'object':
      return printObject(schema, { ...ctx, hoistArray: undefined }, indent);
    case 'union': {
      // `unknown` absorbs the other members; returning early also avoids importing them.
      if (schema.variants.some((variant) => variant.kind === 'unknown')) return UNKNOWN;
      const variants = schema.variants.map((variant): PrintedType => {
        const printed = printTypeNode(variant, ctx, indent);
        const values = discriminatorValues(schema.discriminator, variant);
        if (values.length === 0 || schema.discriminator === undefined) return printed;
        const tag = `{ ${propertyKey(schema.discriminator.propertyName)}: ${values.map(quote).join(' | ')} }`;
        return { text: `${wrapType(printed, 'intersection')} & ${tag}`, operator: 'intersection' };
      });
      return unionOf(variants);
    }
    case 'intersection': {
      const members = schema.members
        .map((member) => printTypeNode(member, ctx, indent))
        .filter((m) => m.text !== 'unknown');
      if (members.length === 0) return UNKNOWN;
      return combine(members, 'intersection');
    }
  }
}

function discriminatorValues(
  discriminator: DiscriminatorIR | undefined,
  variant: SchemaIR,
): string[] {
  if (discriminator === undefined || variant.kind !== 'ref') return [];
  return discriminator.mapping
    .filter((entry) => entry.target === variant.target)
    .map((entry) => entry.value);
}

function printObject(
  schema: Extract<SchemaIR, { kind: 'object' }>,
  ctx: TypeContext,
  indent: string,
): PrintedType {
  const { properties, additionalProperties } = schema;
  const record = ctx.imports.global('Record');
  const additional =
    additionalProperties === undefined || additionalProperties === false
      ? undefined
      : printTypeNode(additionalProperties, ctx, indent);
  if (properties.length === 0) {
    if (additionalProperties === false) return atom(`${record}<string, never>`);
    // TypeScript defers recursive references inside object types but not through the `Record`
    // alias: `type T = Record<string, T> | U` is a circularity error, `{ [key: string]: T }` is not.
    const recursive = ctx.project.graph.recursiveSchemas();
    if (
      additionalProperties !== undefined &&
      someSchema(additionalProperties, (node) => node.kind === 'ref' && recursive.has(node.target))
    )
      return atom(`{ [key: string]: ${additional?.text ?? 'unknown'} }`);
    return atom(`${record}<string, ${additional?.text ?? 'unknown'}>`);
  }
  const jsdoc = ctx.imports.lang === 'js';
  const withDocs = !jsdoc && ctx.config.features.jsdoc;
  const readonlyModifier = ctx.config.types.readonlyProperties && ctx.direction !== 'input';
  const memberIndent = `${indent}  `;
  const printed = properties.map((property) => printTypeNode(property.schema, ctx, memberIndent));
  const members = properties.map((property, index) => {
    const modifier = readonlyModifier && property.schema.readOnly === true ? 'readonly ' : '';
    const optional = property.required ? '' : '?';
    const member = `${modifier}${propertyKey(property.name)}${optional}: ${printed[index]?.text ?? 'unknown'};`;
    return { doc: withDocs ? renderJsDoc(schemaDoc(property.schema), memberIndent) : '', member };
  });
  if (additional !== undefined) {
    // An index signature must accept every declared property type.
    const valueTypes = [additional, ...printed];
    if (properties.some((p) => !p.required)) valueTypes.push(atom('undefined'));
    members.push({ doc: '', member: `[key: string]: ${unionOf(valueTypes).text};` });
  }
  if (jsdoc) return atom(`{ ${members.map((m) => m.member).join(' ')} }`);
  return atom(
    `{\n${members.map((m) => `${m.doc}${memberIndent}${m.member}`).join('\n')}\n${indent}}`,
  );
}
