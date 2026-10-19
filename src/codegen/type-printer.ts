import { dateFormat } from '../analysis/dates.ts';
import type { ProjectModel } from '../analysis/types.ts';
import type { ResolvedConfig } from '../config/resolved.ts';
import type { DiscriminatorIR, JsonValue, SchemaIR } from '../ir/types.ts';
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
}

const BINARY_OUTPUT = 'Blob';
const BINARY_INPUT = 'Blob | ArrayBuffer | ArrayBufferView';

/** Parenthesizes a type when needed inside an array, union or intersection. */
export function wrapType(type: string, inside: 'array' | 'union' | 'intersection'): string {
  const hasTopLevel = (operator: string): boolean => {
    let depth = 0;
    let inString = false;
    for (let i = 0; i < type.length; i++) {
      const char = type[i];
      if (char === "'" && type[i - 1] !== '\\') inString = !inString;
      if (inString) continue;
      if (char === '(' || char === '{' || char === '[' || char === '<') depth++;
      else if (char === ')' || char === '}' || char === ']' || char === '>') depth--;
      else if (depth === 0 && type.startsWith(operator, i)) return true;
    }
    return false;
  };
  const needs =
    inside === 'array'
      ? hasTopLevel(' | ') || hasTopLevel(' & ')
      : inside === 'intersection'
        ? hasTopLevel(' | ')
        : hasTopLevel(' & ');
  return needs ? `(${type})` : type;
}

function literalType(value: JsonValue): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === 'boolean') return String(value);
  return undefined;
}

function unionOf(types: readonly string[]): string {
  const unique = [...new Set(types)];
  if (unique.includes('unknown')) return 'unknown';
  const withoutNever = unique.length > 1 ? unique.filter((t) => t !== 'never') : unique;
  return withoutNever.map((t) => wrapType(t, 'union')).join(' | ');
}

/**
 * Prints a TypeScript type for a schema. In `js` mode the output is a single-line type for use
 * inside JSDoc tags; otherwise object types are multi-line with property documentation.
 */
export function printType(schema: SchemaIR, ctx: TypeContext, indent = ''): string {
  const base = printBase(schema, ctx, indent);
  if (schema.nullable !== true || base === 'unknown' || base === 'null') return base;
  return unionOf([base, 'null']);
}

function refName(target: string, ctx: TypeContext): string {
  const local = ctx.local?.get(target);
  if (local !== undefined) return local;
  const model = ctx.project.modelById.get(target);
  if (model === undefined) return 'unknown';
  return ctx.imports.add(model.module, model.name, { typeOnly: true });
}

function printBase(schema: SchemaIR, ctx: TypeContext, indent: string): string {
  switch (schema.kind) {
    case 'ref':
      return refName(schema.target, ctx);
    case 'string':
      return ctx.config.types.dates === 'Date' && dateFormat(schema) !== undefined
        ? 'Date'
        : 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'binary':
      return ctx.direction === 'input' ? BINARY_INPUT : BINARY_OUTPUT;
    case 'unknown':
      return 'unknown';
    case 'never':
      return 'never';
    case 'enum': {
      const literals = schema.values.map(literalType);
      if (literals.some((l) => l === undefined)) return 'unknown';
      return unionOf(literals.filter((l): l is string => l !== undefined));
    }
    case 'array': {
      const items = printType(schema.items, ctx, indent);
      if (schema.prefixItems !== undefined) {
        const prefix = schema.prefixItems.map((item) => printType(item, ctx, indent));
        const rest = schema.items.kind === 'never' ? [] : [`...${wrapType(items, 'array')}[]`];
        return `[${[...prefix, ...rest].join(', ')}]`;
      }
      return `${wrapType(items, 'array')}[]`;
    }
    case 'object':
      return printObject(schema, ctx, indent);
    case 'union': {
      const variants = schema.variants.map((variant) => {
        const printed = printType(variant, ctx, indent);
        const values = discriminatorValues(schema.discriminator, variant);
        if (values.length === 0 || schema.discriminator === undefined) return printed;
        const tag = `{ ${propertyKey(schema.discriminator.propertyName)}: ${values.map(quote).join(' | ')} }`;
        return `${wrapType(printed, 'intersection')} & ${tag}`;
      });
      return unionOf(variants);
    }
    case 'intersection': {
      const members = schema.members
        .map((member) => printType(member, ctx, indent))
        .filter((m) => m !== 'unknown');
      if (members.length === 0) return 'unknown';
      return [...new Set(members)].map((m) => wrapType(m, 'intersection')).join(' & ');
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
): string {
  const { properties, additionalProperties } = schema;
  const additional =
    additionalProperties === undefined || additionalProperties === false
      ? undefined
      : printType(additionalProperties, ctx, indent);
  if (properties.length === 0) {
    if (additionalProperties === false) return 'Record<string, never>';
    return `Record<string, ${additional ?? 'unknown'}>`;
  }
  const jsdoc = ctx.imports.lang === 'js';
  const withDocs = !jsdoc && ctx.config.features.jsdoc;
  const readonlyModifier = ctx.config.types.readonlyProperties && ctx.direction !== 'input';
  const memberIndent = `${indent}  `;
  const printed = properties.map((property) => printType(property.schema, ctx, memberIndent));
  const members = properties.map((property, index) => {
    const modifier = readonlyModifier && property.schema.readOnly === true ? 'readonly ' : '';
    const optional = property.required ? '' : '?';
    const member = `${modifier}${propertyKey(property.name)}${optional}: ${printed[index] ?? 'unknown'};`;
    return { doc: withDocs ? renderJsDoc(schemaDoc(property.schema), memberIndent) : '', member };
  });
  if (additional !== undefined) {
    // An index signature must accept every declared property type.
    const valueTypes = [additional, ...printed];
    if (properties.some((p) => !p.required)) valueTypes.push('undefined');
    members.push({ doc: '', member: `[key: string]: ${unionOf(valueTypes)};` });
  }
  if (jsdoc) return `{ ${members.map((m) => m.member).join(' ')} }`;
  return `{\n${members.map((m) => `${m.doc}${memberIndent}${m.member}`).join('\n')}\n${indent}}`;
}
