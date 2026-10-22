import path from 'node:path';
import type {
  DiscriminatorIR,
  JsonValue,
  ObjectSchema,
  PropertyIR,
  SchemaAssertions,
  SchemaDefinition,
  SchemaIR,
  SchemaMeta,
  StringConstraints,
} from '../../ir/types.ts';
import { looksLikeReference } from '../../loader/refs.ts';
import { appendPointer, lastSegment, parsePointer } from '../../loader/pointer.ts';
import { isRecord } from '../../utils/object.ts';
import { compareStrings } from '../../utils/strings.ts';
import {
  bool,
  child,
  entries,
  has,
  items,
  num,
  readExtensions,
  str,
  toJsonValue,
  type Cursor,
  type ParseContext,
} from '../context.ts';
import { readStringArray } from '../shared.ts';
import { isKnownType, type RawDiscriminator, type SchemaDialect } from './dialects.ts';

interface NameCandidate {
  readonly name: string;
  /** Lower wins: 0 root component, 1 root alias, 2 external component, 3 $defs, 4 title, 5 derived. */
  readonly priority: number;
  readonly alias: boolean;
}

interface DefinitionBuilder {
  readonly id: string;
  readonly cursor: Cursor;
  readonly names: NameCandidate[];
  schema: SchemaIR | undefined;
  /** Raw discriminator of an allOf-polymorphic base, resolved in {@link SchemaConverter.finalize}. */
  baseDiscriminator?: RawDiscriminator;
}

/** Keywords that affect only validation and cannot be expressed in TypeScript types. */
const VALIDATION_ONLY_KEYWORDS = [
  'propertyNames',
  'contains',
  'minContains',
  'maxContains',
  'unevaluatedItems',
  'unevaluatedProperties',
];

/** Keywords that change the shape of values but are not supported. */
const UNSUPPORTED_SHAPE_KEYWORDS = ['$dynamicRef', '$recursiveRef'];

/**
 * Restrictions kept as {@link SchemaAssertions}: not representable in types, enforced by
 * generated Zod schemas. `not` exists in every dialect; the others only in OpenAPI 3.1.
 */
const ASSERTION_KEYWORDS_31 = ['if', 'then', 'else', 'dependentSchemas', 'dependentRequired'];

const NUMBER_KEYWORDS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
];
const STRING_KEYWORDS = ['minLength', 'maxLength', 'pattern'];

const META_KEYS = new Set([
  '$ref',
  'description',
  'summary',
  'title',
  'deprecated',
  'readOnly',
  'writeOnly',
  'example',
  'examples',
  'default',
  '$comment',
  '$id',
  '$anchor',
  '$schema',
]);

const REF_CHAIN_LIMIT = 64;
/** Inline schema nesting limit; protects against stack exhaustion from hostile documents. */
const MAX_NESTING = 512;

/**
 * Converts raw schema objects into {@link SchemaIR}. Referenced schemas become named
 * {@link SchemaDefinition}s that are converted exactly once, which also makes recursive schemas
 * safe to process.
 */
export class SchemaConverter {
  readonly #ctx: ParseContext;
  readonly #dialect: SchemaDialect;
  readonly #definitions = new Map<string, DefinitionBuilder>();
  readonly #pending: DefinitionBuilder[] = [];
  /** Current inline nesting depth (references do not add depth: they are converted separately). */
  #depth = 0;
  /** > 0 while converting `not`/`if`/… subschemas, where typeless constraints imply a type. */
  #assertionDepth = 0;
  readonly #reported = new Set<string>();
  /** Definition locations already reported as part of a circular `$ref` chain. */
  readonly #circular = new Set<string>();

  constructor(ctx: ParseContext, dialect: SchemaDialect) {
    this.#ctx = ctx;
    this.#dialect = dialect;
  }

  get dialect(): SchemaDialect {
    return this.#dialect;
  }

  /** Registers a reusable schema declared in the root document (components or definitions). */
  registerComponent(cursor: Cursor): void {
    this.#definitionAt(cursor);
  }

  /** Converts the schema at `cursor`, which may be a `$ref`. */
  convert(cursor: Cursor): SchemaIR {
    if (this.#depth >= MAX_NESTING) {
      if (this.#depth === MAX_NESTING) {
        this.#ctx.error(
          'schema/too-deep',
          `Schema nesting exceeds ${MAX_NESTING} levels; deeper schemas are typed as unknown.`,
          cursor,
        );
      }
      return { kind: 'unknown' };
    }
    this.#depth++;
    try {
      return this.#convertNode(cursor);
    } finally {
      this.#depth--;
    }
  }

  #convertNode(cursor: Cursor): SchemaIR {
    const raw = cursor.value;
    if (typeof raw === 'boolean') {
      if (!this.#dialect.booleanSchemas) {
        this.#ctx.error(
          'schema/invalid',
          `Boolean schemas are not allowed in ${this.#dialect.label}.`,
          cursor,
        );
        return { kind: 'unknown' };
      }
      return raw ? { kind: 'unknown' } : { kind: 'never' };
    }
    if (!isRecord(raw)) {
      this.#ctx.error('schema/invalid', 'Expected a schema object.', cursor);
      return { kind: 'unknown' };
    }
    if (typeof raw.$ref === 'string') return this.#convertRef(cursor, raw.$ref);
    return this.#convertInline(cursor);
  }

  /** Returns the definition id for a `$ref` string, registering the definition if needed. */
  definitionForRef(ref: string, at: Cursor): string | undefined {
    const resolved = this.#ctx.store.resolve(ref, at.doc, at.pointer);
    if (resolved === undefined) return undefined;
    return this.#definitionAt({
      doc: resolved.doc,
      pointer: resolved.pointer,
      value: resolved.value,
    });
  }

  /** Completes allOf-based discriminators and returns all definitions sorted by id. */
  finalize(): SchemaDefinition[] {
    this.#drain();
    this.#resolveBaseDiscriminators();
    const result: SchemaDefinition[] = [];
    for (const builder of this.#definitions.values()) {
      const sorted = [...builder.names].sort(
        (a, b) => a.priority - b.priority || compareStrings(a.name, b.name),
      );
      const name = sorted[0]?.name ?? 'Schema';
      const aliases = [
        ...new Set(sorted.filter((c) => c.priority <= 1 && c.name !== name).map((c) => c.name)),
      ].sort(compareStrings);
      result.push({
        id: builder.id,
        name,
        aliases,
        schema: builder.schema ?? { kind: 'unknown' },
        source: this.#ctx.sourceRef(builder.cursor),
      });
    }
    return result.sort((a, b) => compareStrings(a.id, b.id));
  }

  // ---------------------------------------------------------------------------------------------

  /** Converts every registered definition, including those discovered while converting. */
  #drain(): void {
    // The queue grows while it is processed; an index avoids O(n) `shift()` calls.
    for (let index = 0; index < this.#pending.length; index++) {
      const builder = this.#pending[index];
      if (builder === undefined) continue;
      const { cursor } = builder;
      builder.schema = { ...this.convert(cursor), source: this.#ctx.sourceRef(cursor) };
      const discriminator =
        isRecord(cursor.value) && !has(cursor, 'oneOf') && !has(cursor, 'anyOf')
          ? this.#dialect.readDiscriminator(cursor, this.#ctx)
          : undefined;
      if (discriminator !== undefined) builder.baseDiscriminator = discriminator;
    }
    this.#pending.length = 0;
  }

  #idFor(cursor: Cursor): string {
    return `${this.#ctx.store.documentKey(cursor.doc)}#${cursor.pointer}`;
  }

  #isPureRef(value: unknown): value is { $ref: string } {
    if (!isRecord(value) || typeof value.$ref !== 'string') return false;
    return Object.keys(value).every(
      (key) => key === '$ref' || key === 'description' || key === 'summary' || key.startsWith('x-'),
    );
  }

  /**
   * Follows pure `$ref` chains to the final schema, registers it and converts it on first use.
   */
  #definitionAt(start: Cursor): string | undefined {
    let cursor = start;
    // Names of pure-$ref components along the chain become aliases of the final schema.
    const chain: NameCandidate[] = [];
    const seen = new Set<string>();
    for (let depth = 0; this.#isPureRef(cursor.value); depth++) {
      const key = this.#idFor(cursor);
      if (seen.has(key) || depth > REF_CHAIN_LIMIT) {
        if (![...seen].some((member) => this.#circular.has(member))) {
          this.#ctx.error(
            'ref/circular',
            'Circular $ref chain: these schemas only refer to each other.',
            cursor,
          );
        }
        for (const member of seen) this.#circular.add(member);
        return undefined;
      }
      seen.add(key);
      const derived = this.#nameFromLocation(cursor);
      if (derived !== undefined)
        chain.push(derived.priority === 0 ? { ...derived, priority: 1, alias: true } : derived);
      const resolved = this.#ctx.store.resolve(cursor.value.$ref, cursor.doc, cursor.pointer);
      if (resolved === undefined) return undefined;
      cursor = { doc: resolved.doc, pointer: resolved.pointer, value: resolved.value };
    }
    const id = this.#idFor(cursor);
    let builder = this.#definitions.get(id);
    const isNew = builder === undefined;
    if (builder === undefined) {
      builder = { id, cursor, names: [], schema: undefined };
      this.#definitions.set(id, builder);
      const own = this.#nameFromLocation(cursor);
      if (own !== undefined) builder.names.push(own);
      const title = str(cursor, 'title');
      if (title !== undefined && title.trim() !== '')
        builder.names.push({ name: title, priority: 4, alias: false });
      if (builder.names.length === 0)
        builder.names.push({ name: this.#derivedName(cursor), priority: 5, alias: false });
    }
    builder.names.push(...chain);
    // Conversion is deferred to a work queue: a $ref only needs the target id, and converting
    // eagerly would make the call stack as deep as the longest chain of references.
    if (isNew) this.#pending.push(builder);
    return id;
  }

  #nameFromLocation(cursor: Cursor): NameCandidate | undefined {
    const segments = parsePointer(cursor.pointer) ?? [];
    const isRoot = cursor.doc.url === this.#ctx.store.root.url;
    const [first, second, third] = segments;
    if (
      segments.length === 3 &&
      first === 'components' &&
      second === 'schemas' &&
      third !== undefined
    ) {
      return { name: third, priority: isRoot ? 0 : 2, alias: false };
    }
    if (segments.length === 2 && first === 'definitions' && second !== undefined) {
      return { name: second, priority: isRoot ? 0 : 2, alias: false };
    }
    if (segments.length >= 2 && segments.at(-2) === '$defs') {
      const name = segments.at(-1);
      if (name !== undefined) return { name, priority: 3, alias: false };
    }
    if (segments.length === 0 && !isRoot) {
      const title = str(cursor, 'title');
      const base = path.basename(cursor.doc.display).replace(/\.(ya?ml|json)$/i, '');
      return { name: title ?? base, priority: title === undefined ? 4 : 3, alias: false };
    }
    return undefined;
  }

  #derivedName(cursor: Cursor): string {
    const skip = new Set([
      'components',
      'schemas',
      'definitions',
      '$defs',
      'properties',
      'items',
      'allOf',
      'oneOf',
      'anyOf',
      'not',
      'paths',
      'content',
      'schema',
      'responses',
      'parameters',
      'requestBody',
      'additionalProperties',
    ]);
    const parts = (parsePointer(cursor.pointer) ?? []).filter(
      (s) => !skip.has(s) && !/^\d+$/.test(s),
    );
    const base =
      cursor.doc.url === this.#ctx.store.root.url
        ? []
        : [path.basename(cursor.doc.display).replace(/\.(ya?ml|json)$/i, '')];
    const name = [...base, ...parts].join(' ');
    return name.trim() === '' ? 'Schema' : name;
  }

  #convertRef(cursor: Cursor, ref: string): SchemaIR {
    const id = this.definitionForRef(ref, cursor);
    const raw = cursor.value as Record<string, unknown>;
    const siblingKeys = Object.keys(raw).filter(
      (key) => !META_KEYS.has(key) && !key.startsWith('x-'),
    );
    let meta: SchemaMeta;
    if (this.#dialect.refSiblings === 'apply') {
      meta = this.#readMeta(cursor);
    } else {
      // In Swagger 2.0 and OpenAPI 3.0, siblings of $ref are ignored. A description is kept for
      // documentation only; it never changes the generated type.
      const description = str(cursor, 'description');
      meta = description === undefined ? {} : { description };
      if (siblingKeys.length > 0) {
        this.#ctx.warning(
          'schema/ref-siblings-ignored',
          `Keywords next to $ref are ignored in ${this.#dialect.label}: ${siblingKeys.join(', ')}.`,
          cursor,
          { hint: 'Wrap the reference in allOf to combine it with other keywords.' },
        );
      }
    }
    const refNode: SchemaIR = id === undefined ? { kind: 'unknown' } : { kind: 'ref', target: id };
    if (this.#dialect.refSiblings === 'apply' && siblingKeys.length > 0) {
      const rest = this.#convertInline(cursor, { ignoreMeta: true });
      const { nullable, ...restWithoutNull } = rest;
      const isOnlyNull = rest.kind === 'null';
      if (isOnlyNull) return { ...refNode, ...meta, nullable: true };
      if (rest.kind === 'unknown')
        return { ...refNode, ...meta, ...(nullable === true ? { nullable } : {}) };
      return {
        kind: 'intersection',
        members: [refNode, restWithoutNull],
        ...meta,
        ...(nullable === true ? { nullable } : {}),
      };
    }
    return { ...refNode, ...meta };
  }

  #readMeta(cursor: Cursor): SchemaMeta {
    const meta: { -readonly [K in keyof SchemaMeta]: SchemaMeta[K] } = {};
    const title = str(cursor, 'title');
    if (title !== undefined) meta.title = title;
    const description = str(cursor, 'description');
    if (description !== undefined) meta.description = description;
    const deprecated = bool(cursor, 'deprecated') ?? bool(cursor, 'x-deprecated');
    if (deprecated === true) meta.deprecated = true;
    if (bool(cursor, 'readOnly') === true) meta.readOnly = true;
    if (bool(cursor, 'writeOnly') === true) meta.writeOnly = true;
    if (has(cursor, 'default')) {
      const value = toJsonValue((cursor.value as Record<string, unknown>).default);
      if (value !== undefined) meta.default = value;
    }
    const examples = this.#dialect.readExamples(cursor);
    if (examples !== undefined) meta.examples = examples;
    const format = str(cursor, 'format');
    if (format !== undefined) meta.format = format;
    const extensions = readExtensions(cursor);
    if (Object.keys(extensions).length > 0) meta.extensions = extensions;
    return meta;
  }

  #reportKeywords(cursor: Cursor): void {
    if (!isRecord(cursor.value)) return;
    for (const keyword of this.#dialect.foreignKeywords) {
      if (has(cursor, keyword)) {
        this.#ctx.warning(
          'schema/foreign-keyword',
          `\`${keyword}\` is not part of ${this.#dialect.label}; it is interpreted with its OpenAPI 3.x meaning.`,
          cursor,
        );
      }
    }
    const oas31 = this.#dialect.name === 'oas31';
    const unsupported = oas31
      ? UNSUPPORTED_SHAPE_KEYWORDS
      : [...UNSUPPORTED_SHAPE_KEYWORDS, ...ASSERTION_KEYWORDS_31];
    for (const keyword of unsupported) {
      if (has(cursor, keyword)) {
        this.#ctx.warning(
          'schema/unsupported-keyword',
          `\`${keyword}\` is not supported and is ignored; the generated type may be wider than the schema.`,
          cursor,
        );
      }
    }
    for (const keyword of ['not', ...(oas31 ? ASSERTION_KEYWORDS_31 : [])]) {
      if (has(cursor, keyword)) {
        this.#ctx.info(
          'schema/assertion-keyword',
          `\`${keyword}\` cannot be expressed in TypeScript types (they may be wider than the schema); generated Zod schemas enforce it.`,
          cursor,
        );
      }
    }
    for (const keyword of VALIDATION_ONLY_KEYWORDS) {
      if (has(cursor, keyword)) {
        this.#ctx.info(
          'schema/validation-only-keyword',
          `\`${keyword}\` only affects validation and is not reflected in types.`,
          cursor,
        );
      }
    }
  }

  #convertInline(cursor: Cursor, options: { ignoreMeta?: boolean } = {}): SchemaIR {
    this.#reportKeywords(cursor);
    const meta = options.ignoreMeta === true ? {} : this.#readMeta(cursor);
    const { types, nullable } = this.#dialect.readTypes(cursor, this.#ctx);
    const raw = cursor.value as Record<string, unknown>;

    let core: SchemaIR | undefined;
    if (has(cursor, 'const')) {
      const value = toJsonValue(raw.const);
      core = { kind: 'enum', values: value === undefined ? [] : [value], isConst: true };
    } else if (Array.isArray(raw.enum)) {
      core = this.#convertEnum(child(cursor, 'enum'), types);
    } else if (types === undefined) {
      if (
        has(cursor, 'properties') ||
        has(cursor, 'additionalProperties') ||
        has(cursor, 'patternProperties') ||
        has(cursor, 'required')
      ) {
        core = this.#convertTyped(cursor, 'object');
      } else if (has(cursor, 'items') || has(cursor, 'prefixItems')) {
        core = this.#convertTyped(cursor, 'array');
      } else if (this.#dialect.name === 'oas31' && this.#dialect.isBinaryString(cursor)) {
        core = { kind: 'binary' };
      } else if (this.#assertionDepth > 0) {
        // In assertions the instance's shape is known; `{ maximum: 100 }` constrains a number.
        const numeric = NUMBER_KEYWORDS.some((keyword) => has(cursor, keyword));
        const textual = STRING_KEYWORDS.some((keyword) => has(cursor, keyword));
        if (numeric !== textual) core = this.#convertTyped(cursor, numeric ? 'number' : 'string');
      }
    } else if (types.length === 1 && types[0] !== undefined) {
      core = this.#convertTyped(cursor, types[0]);
    } else {
      core = {
        kind: 'union',
        combinator: 'type',
        variants: types.map((type) => this.#convertTyped(cursor, type)),
      };
    }

    const members: SchemaIR[] = [];
    if (Array.isArray(raw.allOf)) {
      if (raw.allOf.length === 0)
        this.#ctx.warning('schema/empty-composition', '`allOf` is empty.', cursor);
      members.push(...items(child(cursor, 'allOf')).map((member) => this.convert(member)));
    }
    for (const combinator of ['oneOf', 'anyOf'] as const) {
      const list = raw[combinator];
      if (!Array.isArray(list)) continue;
      if (list.length === 0) {
        this.#ctx.warning('schema/empty-composition', `\`${combinator}\` is empty.`, cursor);
        continue;
      }
      let variants = items(child(cursor, combinator)).map((variant) => this.convert(variant));
      // `oneOf: [X, { type: 'null' }]` is the idiomatic nullable reference.
      const nullVariants: SchemaIR[] = variants.filter((v) => v.kind === 'null');
      let unionNullable = false;
      if (nullVariants.length > 0 && nullVariants.length < variants.length) {
        variants = variants.filter((v) => !nullVariants.includes(v));
        unionNullable = true;
      }
      const discriminator = this.#unionDiscriminator(cursor, variants);
      const union: SchemaIR =
        variants.length === 1 && variants[0] !== undefined && discriminator === undefined
          ? { ...variants[0], ...(unionNullable ? { nullable: true } : {}) }
          : {
              kind: 'union',
              combinator,
              variants,
              ...(discriminator === undefined ? {} : { discriminator }),
              ...(unionNullable ? { nullable: true } : {}),
            };
      members.push(union);
    }

    let result: SchemaIR;
    if (members.length === 0) {
      result = core ?? { kind: 'unknown' };
    } else {
      const parts = core !== undefined && !isEmptyObject(core) ? [core, ...members] : members;
      result =
        parts.length === 1 && parts[0] !== undefined
          ? parts[0]
          : { kind: 'intersection', members: parts };
    }
    const assertions = this.#readAssertions(cursor);
    const merged: SchemaIR = {
      ...result,
      ...meta,
      ...(assertions === undefined ? {} : { assertions }),
    };
    return nullable ? { ...merged, nullable: true } : merged;
  }

  #readAssertions(cursor: Cursor): SchemaAssertions | undefined {
    this.#assertionDepth++;
    try {
      return this.#readAssertionKeywords(cursor);
    } finally {
      this.#assertionDepth--;
    }
  }

  #readAssertionKeywords(cursor: Cursor): SchemaAssertions | undefined {
    const assertions: {
      not?: SchemaIR;
      conditional?: NonNullable<SchemaAssertions['conditional']>;
      dependentSchemas?: Record<string, SchemaIR>;
      dependentRequired?: Record<string, readonly string[]>;
    } = {};
    if (has(cursor, 'not')) assertions.not = this.convert(child(cursor, 'not'));
    if (this.#dialect.name === 'oas31') {
      // `then` and `else` have no effect without `if`.
      if (has(cursor, 'if') && (has(cursor, 'then') || has(cursor, 'else'))) {
        assertions.conditional = {
          condition: this.convert(child(cursor, 'if')),
          ...(has(cursor, 'then') ? { whenTrue: this.convert(child(cursor, 'then')) } : {}),
          ...(has(cursor, 'else') ? { whenFalse: this.convert(child(cursor, 'else')) } : {}),
        };
      }
      const dependentSchemas = entries(child(cursor, 'dependentSchemas'));
      if (dependentSchemas.length > 0) {
        assertions.dependentSchemas = Object.fromEntries(
          dependentSchemas.map(([name, schema]) => [name, this.convert(schema)]),
        );
      }
      const dependentRequired = entries(child(cursor, 'dependentRequired'));
      if (dependentRequired.length > 0) {
        assertions.dependentRequired = Object.fromEntries(
          dependentRequired.map(([name, list]) => [name, readStringArray(list)]),
        );
      }
    }
    return Object.keys(assertions).length > 0 ? assertions : undefined;
  }

  #convertEnum(cursor: Cursor, types: readonly string[] | undefined): SchemaIR {
    const values = (cursor.value as unknown[])
      .map((v) => toJsonValue(v))
      .filter((v): v is JsonValue => v !== undefined);
    if (values.length === 0) {
      this.#ctx.warning('schema/empty-enum', 'Empty `enum`: no value is valid.', cursor);
      return { kind: 'never' };
    }
    if (types !== undefined && types.length === 1) {
      const expected = types[0];
      const mismatched = values.filter((v) => v !== null && !matchesType(v, expected ?? ''));
      if (mismatched.length > 0) {
        this.#ctx.warning(
          'schema/enum-type-mismatch',
          `Enum values ${mismatched.map((v) => JSON.stringify(v)).join(', ')} do not match type "${expected ?? ''}".`,
          cursor,
        );
      }
    }
    return { kind: 'enum', values };
  }

  #convertTyped(cursor: Cursor, type: string): SchemaIR {
    switch (type) {
      case 'string': {
        if (this.#dialect.isBinaryString(cursor)) return { kind: 'binary' };
        const constraints = stringConstraints(cursor);
        return constraints === undefined ? { kind: 'string' } : { kind: 'string', constraints };
      }
      case 'number':
      case 'integer': {
        const constraints = this.#dialect.readNumberConstraints(cursor, this.#ctx);
        return constraints === undefined ? { kind: type } : { kind: type, constraints };
      }
      case 'boolean':
        return { kind: 'boolean' };
      case 'null':
        return { kind: 'null' };
      case 'object':
        return this.#convertObject(cursor);
      case 'array':
        return this.#convertArray(cursor);
      case 'file':
        if (this.#dialect.name === 'swagger2') return { kind: 'binary' };
        break;
      default:
        break;
    }
    if (!isKnownType(type)) {
      this.#ctx.error('schema/invalid-type', `Unknown type "${type}".`, child(cursor, 'type'));
    }
    return { kind: 'unknown' };
  }

  #convertObject(cursor: Cursor): ObjectSchema {
    const raw = cursor.value as Record<string, unknown>;
    const required = new Set(
      Array.isArray(raw.required)
        ? raw.required.filter((r): r is string => typeof r === 'string')
        : [],
    );
    const properties: PropertyIR[] = [];
    const declared = new Set<string>();
    for (const [name, propertyCursor] of entries(child(cursor, 'properties'))) {
      declared.add(name);
      properties.push({ name, required: required.has(name), schema: this.convert(propertyCursor) });
    }
    for (const name of required) {
      if (!declared.has(name))
        properties.push({ name, required: true, schema: { kind: 'unknown' } });
    }

    let additionalProperties: SchemaIR | false | undefined;
    if (raw.additionalProperties === false) additionalProperties = false;
    else if (raw.additionalProperties === true) additionalProperties = { kind: 'unknown' };
    else if (isRecord(raw.additionalProperties))
      additionalProperties = this.convert(child(cursor, 'additionalProperties'));

    if (isRecord(raw.patternProperties)) {
      const patterns = entries(child(cursor, 'patternProperties')).map(([, value]) =>
        this.convert(value),
      );
      // Keys that match no pattern are additional properties: anything, unless
      // `additionalProperties` says otherwise. (An open object stays open: its pattern schemas
      // only describe some of its keys.)
      const variants: SchemaIR[] = [
        ...(additionalProperties === false ? [] : [additionalProperties ?? { kind: 'unknown' }]),
        ...patterns,
      ];
      additionalProperties =
        variants.length === 1 && variants[0] !== undefined
          ? variants[0]
          : { kind: 'union', combinator: 'anyOf', variants };
    }

    const minProperties = num(cursor, 'minProperties');
    const maxProperties = num(cursor, 'maxProperties');
    const constraints = {
      ...(minProperties === undefined ? {} : { minProperties }),
      ...(maxProperties === undefined ? {} : { maxProperties }),
    };
    return {
      kind: 'object',
      properties,
      ...(additionalProperties === undefined ? {} : { additionalProperties }),
      ...(Object.keys(constraints).length === 0 ? {} : { constraints }),
    };
  }

  #convertArray(cursor: Cursor): SchemaIR {
    const raw = cursor.value as Record<string, unknown>;
    let itemsSchema: SchemaIR = { kind: 'unknown' };
    let prefixItems: SchemaIR[] | undefined;
    if (Array.isArray(raw.items)) {
      this.#ctx.warning(
        'schema/tuple-items',
        `Array-form \`items\` is not supported in ${this.#dialect.label}; it is interpreted as a tuple.`,
        cursor,
        {
          hint: this.#dialect.name === 'oas31' ? 'Use prefixItems.' : 'Use a single items schema.',
        },
      );
      prefixItems = items(child(cursor, 'items')).map((item) => this.convert(item));
      itemsSchema = isRecord(raw.additionalItems)
        ? this.convert(child(cursor, 'additionalItems'))
        : { kind: 'unknown' };
    } else if (has(cursor, 'items')) {
      itemsSchema = this.convert(child(cursor, 'items'));
    } else if (this.#dialect.name !== 'oas31' && !has(cursor, 'prefixItems')) {
      this.#ctx.info(
        'schema/array-without-items',
        'Array schema without `items`; elements are typed as unknown.',
        cursor,
      );
    }
    if (Array.isArray(raw.prefixItems)) {
      prefixItems = items(child(cursor, 'prefixItems')).map((item) => this.convert(item));
      if (raw.items === false) itemsSchema = { kind: 'never' };
      else if (!has(cursor, 'items')) itemsSchema = { kind: 'unknown' };
    }
    const minItems = num(cursor, 'minItems');
    const maxItems = num(cursor, 'maxItems');
    const uniqueItems = bool(cursor, 'uniqueItems');
    const constraints = {
      ...(minItems === undefined ? {} : { minItems }),
      ...(maxItems === undefined ? {} : { maxItems }),
      ...(uniqueItems === true ? { uniqueItems } : {}),
    };
    return {
      kind: 'array',
      items: itemsSchema,
      ...(prefixItems === undefined ? {} : { prefixItems }),
      ...(Object.keys(constraints).length === 0 ? {} : { constraints }),
    };
  }

  #unionDiscriminator(cursor: Cursor, variants: readonly SchemaIR[]): DiscriminatorIR | undefined {
    const raw = this.#dialect.readDiscriminator(cursor, this.#ctx);
    if (raw === undefined) return undefined;
    const mapping = this.#explicitMapping(raw);
    // OpenAPI 3.2: the default schema applies to absent or unmapped values, so it gets no value.
    const defaultTarget =
      raw.defaultMapping === undefined ? undefined : this.#mappingTarget(raw.defaultMapping);
    const mapped = new Set(mapping.map((entry) => entry.target));
    for (const variant of variants) {
      if (variant.kind !== 'ref' || mapped.has(variant.target) || variant.target === defaultTarget)
        continue;
      const value = this.#implicitDiscriminatorValue(variant.target);
      if (value !== undefined) mapping.push({ value, target: variant.target });
    }
    return {
      propertyName: raw.propertyName,
      mapping,
      ...(defaultTarget === undefined ? {} : { defaultTarget }),
    };
  }

  #explicitMapping(raw: RawDiscriminator): { value: string; target: string }[] {
    const result: { value: string; target: string }[] = [];
    for (const entry of raw.mapping) {
      const id = this.#mappingTarget(entry);
      if (id !== undefined) result.push({ value: entry.value, target: id });
    }
    return result;
  }

  /** The definition id a mapping value (a schema name or a reference) points to. */
  #mappingTarget(entry: { readonly target: string; readonly at: Cursor }): string | undefined {
    const ref = looksLikeReference(entry.target)
      ? entry.target
      : `#${appendPointer(this.#dialect.componentsPointer, entry.target)}`;
    // Plain schema names refer to the root document's reusable schemas.
    const base = looksLikeReference(entry.target) ? entry.at.doc : this.#ctx.store.root;
    const resolved = this.#ctx.store.resolve(ref, base, entry.at.pointer);
    if (resolved === undefined) return undefined;
    return this.#definitionAt({
      doc: resolved.doc,
      pointer: resolved.pointer,
      value: resolved.value,
    });
  }

  #implicitDiscriminatorValue(id: string): string | undefined {
    const builder = this.#definitions.get(id);
    if (builder === undefined) return undefined;
    const explicit = str(builder.cursor, 'x-discriminator-value');
    if (explicit !== undefined) return explicit;
    const own = this.#nameFromLocation(builder.cursor);
    return own?.name ?? lastSegment(builder.cursor.pointer);
  }

  /** Adds implicit mappings (children that `allOf` a polymorphic base) to base discriminators. */
  #resolveBaseDiscriminators(): void {
    for (const builder of [...this.#definitions.values()].sort((a, b) =>
      compareStrings(a.id, b.id),
    )) {
      const raw = builder.baseDiscriminator;
      if (raw === undefined || builder.schema === undefined) continue;
      const mapping = this.#explicitMapping(raw);
      const mapped = new Set(mapping.map((entry) => entry.target));
      const children = [...this.#definitions.values()]
        .filter((candidate) => directAllOfRefs(candidate.schema).includes(builder.id))
        .sort((a, b) => compareStrings(a.id, b.id));
      for (const childDef of children) {
        if (mapped.has(childDef.id)) continue;
        const value = this.#implicitDiscriminatorValue(childDef.id);
        if (value !== undefined) mapping.push({ value, target: childDef.id });
      }
      const discriminator: DiscriminatorIR = { propertyName: raw.propertyName, mapping };
      const schema = builder.schema;
      if (schema.kind === 'object') {
        builder.schema = { ...schema, discriminator };
      } else if (schema.kind === 'intersection') {
        const index = schema.members.findIndex((m) => m.kind === 'object');
        const target = schema.members[index];
        if (target?.kind === 'object') {
          const members = [...schema.members];
          members[index] = { ...target, discriminator };
          builder.schema = { ...schema, members };
        }
      } else {
        const key = `${builder.id}:discriminator`;
        if (!this.#reported.has(key)) {
          this.#reported.add(key);
          this.#ctx.warning(
            'schema/discriminator-ignored',
            'A discriminator without oneOf/anyOf is only supported on object schemas.',
            raw.at,
          );
        }
      }
    }
  }
}

function directAllOfRefs(schema: SchemaIR | undefined): string[] {
  if (schema?.kind !== 'intersection') return [];
  return schema.members.flatMap((m) => (m.kind === 'ref' ? [m.target] : []));
}

function isEmptyObject(schema: SchemaIR): boolean {
  return (
    schema.kind === 'object' &&
    schema.properties.length === 0 &&
    schema.additionalProperties === undefined &&
    schema.discriminator === undefined
  );
}

function matchesType(value: JsonValue, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function stringConstraints(cursor: Cursor): StringConstraints | undefined {
  const result: { -readonly [K in keyof StringConstraints]: StringConstraints[K] } = {};
  const minLength = num(cursor, 'minLength');
  if (minLength !== undefined) result.minLength = minLength;
  const maxLength = num(cursor, 'maxLength');
  if (maxLength !== undefined) result.maxLength = maxLength;
  const pattern = str(cursor, 'pattern');
  if (pattern !== undefined) result.pattern = pattern;
  const contentMediaType = str(cursor, 'contentMediaType');
  if (contentMediaType !== undefined) result.contentMediaType = contentMediaType;
  const contentEncoding = str(cursor, 'contentEncoding');
  if (contentEncoding !== undefined) result.contentEncoding = contentEncoding;
  return Object.keys(result).length === 0 ? undefined : result;
}
