import type { JsonValue, NumberConstraints } from '../../ir/types.ts';
import { appendPointer } from '../../loader/pointer.ts';
import { isRecord } from '../../utils/object.ts';
import { bool, has, num, str, toJsonValue, type Cursor, type ParseContext } from '../context.ts';

export interface TypeInfo {
  /** Declared types, or `undefined` when `type` is absent. */
  readonly types: readonly string[] | undefined;
  readonly nullable: boolean;
}

/**
 * Version-specific schema semantics. The converter is shared; everything that differs between
 * Swagger 2.0 Schema Objects, the OpenAPI 3.0 schema subset and JSON Schema 2020-12 (OpenAPI 3.1)
 * lives behind this interface.
 */
export interface SchemaDialect {
  /** `oas31` is JSON Schema 2020-12 with the OpenAPI vocabulary, shared by OpenAPI 3.1 and 3.2. */
  readonly name: 'swagger2' | 'oas30' | 'oas31';
  readonly label: string;
  /** Whether keywords next to `$ref` take effect (3.1) or are ignored (2.0, 3.0). */
  readonly refSiblings: 'apply' | 'ignore';
  /** Whether `true`/`false` are valid schemas. */
  readonly booleanSchemas: boolean;
  /** Path prefix of reusable schemas in the root document. */
  readonly componentsPointer: string;
  readTypes(cursor: Cursor, ctx: ParseContext): TypeInfo;
  readNumberConstraints(cursor: Cursor, ctx: ParseContext): NumberConstraints | undefined;
  readExamples(cursor: Cursor): JsonValue[] | undefined;
  /** For `type: string` schemas: whether the value is raw bytes. */
  isBinaryString(cursor: Cursor): boolean;
  /** Reads the discriminator property name and explicit mapping. */
  readDiscriminator(cursor: Cursor, ctx: ParseContext): RawDiscriminator | undefined;
  /**
   * Keywords that are not part of this dialect but are honored because they are common in
   * real-world documents. Each use is reported as a warning.
   */
  readonly foreignKeywords: ReadonlySet<string>;
}

export interface RawDiscriminator {
  readonly propertyName: string;
  readonly mapping: readonly {
    readonly value: string;
    readonly target: string;
    readonly at: Cursor;
  }[];
  /** OpenAPI 3.2: the schema for absent or unmapped values (a name or a reference). */
  readonly defaultMapping?: { readonly target: string; readonly at: Cursor };
  readonly at: Cursor;
}

const SIMPLE_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']);

function readTypeKeyword(
  cursor: Cursor,
  ctx: ParseContext,
  label: string,
  allowArray: boolean,
): string[] | undefined {
  if (!isRecord(cursor.value) || !has(cursor, 'type')) return undefined;
  const raw = cursor.value.type;
  const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : undefined;
  if (list === undefined || !list.every((t): t is string => typeof t === 'string')) {
    ctx.error('schema/invalid-type', '`type` must be a string or an array of strings.', cursor);
    return undefined;
  }
  if (Array.isArray(raw) && !allowArray) {
    ctx.warning(
      'schema/type-array',
      `Type arrays (${JSON.stringify(raw)}) are not part of ${label}; they are interpreted as a union.`,
      cursor,
      { hint: 'Use oneOf, or declare the document as OpenAPI 3.1.' },
    );
  }
  return list;
}

function legacyNumberConstraints(cursor: Cursor): NumberConstraints | undefined {
  const minimum = num(cursor, 'minimum');
  const maximum = num(cursor, 'maximum');
  const exclusiveMin = bool(cursor, 'exclusiveMinimum') === true;
  const exclusiveMax = bool(cursor, 'exclusiveMaximum') === true;
  const multipleOf = num(cursor, 'multipleOf');
  const result: Record<string, number> = {};
  if (minimum !== undefined) result[exclusiveMin ? 'exclusiveMinimum' : 'minimum'] = minimum;
  if (maximum !== undefined) result[exclusiveMax ? 'exclusiveMaximum' : 'maximum'] = maximum;
  if (multipleOf !== undefined) result.multipleOf = multipleOf;
  return Object.keys(result).length === 0 ? undefined : result;
}

function singleExample(cursor: Cursor): JsonValue[] | undefined {
  if (!has(cursor, 'example')) return undefined;
  const value = toJsonValue(isRecord(cursor.value) ? cursor.value.example : undefined);
  return value === undefined ? undefined : [value];
}

function objectDiscriminator(
  cursor: Cursor,
  ctx: ParseContext,
  defaults = false,
): RawDiscriminator | undefined {
  if (!isRecord(cursor.value) || !has(cursor, 'discriminator')) return undefined;
  const at: Cursor = {
    ...cursor,
    pointer: appendPointer(cursor.pointer, 'discriminator'),
    value: cursor.value.discriminator,
  };
  const propertyName = str(at, 'propertyName');
  if (propertyName === undefined) {
    ctx.error('schema/invalid-discriminator', 'discriminator.propertyName must be a string.', at);
    return undefined;
  }
  const mapping: { value: string; target: string; at: Cursor }[] = [];
  const rawMapping = isRecord(at.value) ? at.value.mapping : undefined;
  if (isRecord(rawMapping)) {
    for (const [value, target] of Object.entries(rawMapping)) {
      if (typeof target === 'string') {
        mapping.push({
          value,
          target,
          at: { doc: at.doc, pointer: appendPointer(at.pointer, 'mapping', value), value: target },
        });
      }
    }
  }
  const defaultMapping = defaults ? str(at, 'defaultMapping') : undefined;
  return {
    propertyName,
    mapping,
    ...(defaultMapping === undefined
      ? {}
      : {
          defaultMapping: {
            target: defaultMapping,
            at: {
              doc: at.doc,
              pointer: appendPointer(at.pointer, 'defaultMapping'),
              value: defaultMapping,
            },
          },
        }),
    at,
  };
}

const isTextMediaType = (mediaType: string): boolean =>
  /^text\//i.test(mediaType) || /[/+]json$/i.test(mediaType) || /[/+]xml$/i.test(mediaType);

export const swagger2Dialect: SchemaDialect = {
  name: 'swagger2',
  label: 'Swagger 2.0',
  refSiblings: 'ignore',
  booleanSchemas: false,
  componentsPointer: '/definitions',
  readTypes(cursor, ctx) {
    const types = readTypeKeyword(cursor, ctx, 'Swagger 2.0', false);
    const nullable = bool(cursor, 'x-nullable') === true || bool(cursor, 'nullable') === true;
    return { types, nullable };
  },
  readNumberConstraints: (cursor) => legacyNumberConstraints(cursor),
  readExamples: singleExample,
  isBinaryString: (cursor) => str(cursor, 'format') === 'binary',
  readDiscriminator(cursor, ctx) {
    if (!isRecord(cursor.value) || !has(cursor, 'discriminator')) return undefined;
    const value = cursor.value.discriminator;
    const at: Cursor = {
      ...cursor,
      pointer: appendPointer(cursor.pointer, 'discriminator'),
      value,
    };
    if (typeof value !== 'string') {
      ctx.error(
        'schema/invalid-discriminator',
        'In Swagger 2.0, discriminator must be a property name.',
        at,
      );
      return undefined;
    }
    return { propertyName: value, mapping: [], at };
  },
  foreignKeywords: new Set([
    'oneOf',
    'anyOf',
    'not',
    'nullable',
    'writeOnly',
    'deprecated',
    'const',
  ]),
};

export const oas30Dialect: SchemaDialect = {
  name: 'oas30',
  label: 'OpenAPI 3.0',
  refSiblings: 'ignore',
  booleanSchemas: false,
  componentsPointer: '/components/schemas',
  readTypes(cursor, ctx) {
    const types = readTypeKeyword(cursor, ctx, 'OpenAPI 3.0', false);
    if (types?.includes('null') === true) {
      ctx.warning(
        'schema/null-type',
        'The "null" type is not part of OpenAPI 3.0; use `nullable: true`.',
        cursor,
      );
    }
    return { types, nullable: bool(cursor, 'nullable') === true };
  },
  readNumberConstraints: (cursor) => legacyNumberConstraints(cursor),
  readExamples: singleExample,
  isBinaryString: (cursor) => str(cursor, 'format') === 'binary',
  readDiscriminator: objectDiscriminator,
  foreignKeywords: new Set(['const', 'prefixItems']),
};

/** JSON Schema 2020-12 with the OpenAPI vocabulary (OpenAPI 3.1 and 3.2). */
function jsonSchemaDialect(label: string, discriminatorDefaults: boolean): SchemaDialect {
  return {
    name: 'oas31',
    label,
    refSiblings: 'apply',
    booleanSchemas: true,
    componentsPointer: '/components/schemas',
    readTypes(cursor, ctx) {
      const types = readTypeKeyword(cursor, ctx, label, true);
      if (has(cursor, 'nullable')) {
        ctx.warning(
          'schema/nullable-31',
          `\`nullable\` is not part of ${label} and is ignored.`,
          cursor,
          { hint: 'Use `type: [<type>, "null"]` or `oneOf` with `{ type: "null" }`.' },
        );
      }
      if (types === undefined) return { types, nullable: false };
      const nonNull = types.filter((t) => t !== 'null');
      if (nonNull.length === 0) return { types: ['null'], nullable: false };
      return { types: nonNull, nullable: nonNull.length !== types.length };
    },
    readNumberConstraints(cursor, ctx) {
      const raw = isRecord(cursor.value) ? cursor.value : {};
      if (typeof raw.exclusiveMinimum === 'boolean' || typeof raw.exclusiveMaximum === 'boolean') {
        ctx.warning(
          'schema/exclusive-boolean',
          `Boolean exclusiveMinimum/exclusiveMaximum are OpenAPI 3.0 syntax; in ${label} they are numbers.`,
          cursor,
        );
        return legacyNumberConstraints(cursor);
      }
      const result: Record<string, number> = {};
      for (const key of [
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'multipleOf',
      ] as const) {
        const value = num(cursor, key);
        if (value !== undefined) result[key] = value;
      }
      return Object.keys(result).length === 0 ? undefined : result;
    },
    readExamples(cursor) {
      const raw = isRecord(cursor.value) ? cursor.value.examples : undefined;
      const list = Array.isArray(raw) ? raw.map((value) => toJsonValue(value) ?? null) : [];
      const single = singleExample(cursor) ?? [];
      const all = [...list, ...single];
      return all.length === 0 ? undefined : all;
    },
    isBinaryString(cursor) {
      if (str(cursor, 'format') === 'binary') return true;
      const mediaType = str(cursor, 'contentMediaType');
      return (
        mediaType !== undefined &&
        str(cursor, 'contentEncoding') === undefined &&
        !isTextMediaType(mediaType)
      );
    },
    readDiscriminator: (cursor, ctx) => objectDiscriminator(cursor, ctx, discriminatorDefaults),
    foreignKeywords: new Set(),
  };
}

export const oas31Dialect: SchemaDialect = jsonSchemaDialect('OpenAPI 3.1', false);

/** OpenAPI 3.2 adds `discriminator.defaultMapping`. */
export const oas32Dialect: SchemaDialect = jsonSchemaDialect('OpenAPI 3.2', true);

export function isKnownType(type: string): boolean {
  return SIMPLE_TYPES.has(type);
}
