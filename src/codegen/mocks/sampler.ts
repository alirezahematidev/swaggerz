import { dateFormat } from '../../analysis/dates.ts';
import type { ModelSymbol } from '../../analysis/types.ts';
import type {
  JsonValue,
  MediaTypeIR,
  ObjectSchema,
  PropertyIR,
  SchemaDefinition,
  SchemaIR,
  SourceRef,
} from '../../ir/types.ts';
import { getOwn, isRecord, setOwn, stableStringify } from '../../utils/object.ts';
import type { EmitContext } from '../context.ts';
import { inheritedDiscriminators } from '../models.ts';
import type { ResponseKind } from '../operation-plan.ts';
import { samplePattern } from './pattern.ts';
import { byName, fit, formatted, Random, words } from './random.ts';

/**
 * A fixture value before it is printed: literals, `Date` and `Blob` values, calls of other
 * fixture factories, and the objects and arrays around them.
 */
export type MockValue =
  | { readonly kind: 'json'; readonly value: JsonValue }
  /** `new Date(value)` (with `types.dates: 'Date'`). */
  | { readonly kind: 'date'; readonly value: string }
  | { readonly kind: 'blob'; readonly text: string; readonly type?: string }
  /** A call of the model's fixture factory (`makePet()`). */
  | { readonly kind: 'fixture'; readonly model: string }
  /** `{ ...spreads, key: value }`: entries override what the spreads contain. */
  | {
      readonly kind: 'object';
      readonly spreads: readonly MockValue[];
      readonly entries: readonly (readonly [string, MockValue])[];
    }
  | { readonly kind: 'array'; readonly items: readonly MockValue[] }
  /** No value can satisfy the schema. */
  | { readonly kind: 'never' };

/** Where values are generated for: the root's name for messages, its source for locations. */
interface Scope {
  readonly label: string;
  readonly root: string;
  readonly source: SourceRef | undefined;
  /** Models whose fixtures must not be called, because they lead back to the root. */
  readonly cycle: ReadonlySet<string>;
  /**
   * Set when the value has a shape TypeScript cannot check against the type (spreads of values
   * whose declared types are wider than the value): the root is then emitted with a cast.
   */
  readonly flags: { risky: boolean };
  /** How many `allOf`s are being merged around the current value (references inlined). */
  readonly inline: { depth: number };
}

/** An `allOf` of object types as one object type. */
interface FlatObject {
  readonly properties: readonly PropertyIR[];
  readonly additional: SchemaIR | undefined;
  /** A member allows no property at all (`Record<string, never>`). */
  readonly closed: boolean;
  /** Members type a property differently than any value can be (`Date & string`). */
  readonly risky: boolean;
}

/** A `Blob` in a materialized value. */
const BLOB = Symbol('blob');
/** A fixture call in a shallow materialized value: assumed to match (checked on its own). */
const ANY = Symbol('any');

const MAX_HOPS = 64;
const MAX_ITEMS = 100;
/** Nested `allOf` merges around one value. */
const MAX_INLINE = 8;

const json = (value: JsonValue): MockValue => ({ kind: 'json', value });

/** A copy of a schema without the keywords applied before it is sampled. */
function withoutAssertions(schema: SchemaIR): SchemaIR {
  const { assertions: _assertions, examples: _examples, default: _default, ...rest } = schema;
  return rest;
}

/** Characters as JSON Schema counts them (code points) and as the validators do (UTF-16 units). */
function lengths(text: string): readonly [number, number] {
  return [text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '_').length, text.length];
}

function decimals(value: number): number {
  const text = String(value);
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent !== null) return Number(exponent[1]);
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(Math.min(digits, 20)));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

/**
 * Generates fixture values: examples from the specification where they fit their schema,
 * otherwise deterministic values that satisfy it. One sampler serves a whole generation, so every
 * model is sampled (and every problem reported) once.
 */
export class MockSampler {
  readonly #ctx: EmitContext;
  readonly #definitions: ReadonlyMap<string, SchemaDefinition>;
  readonly #fixtures = new Map<string, MockValue>();
  readonly #inProgress = new Set<string>();
  readonly #unfit = new WeakSet<MockValue>();

  constructor(ctx: EmitContext) {
    this.#ctx = ctx;
    this.#definitions = new Map(ctx.project.ir.schemas.map((d) => [d.id, d]));
  }

  /** The value a model's fixture factory returns. */
  fixture(model: ModelSymbol): MockValue {
    const cached = this.#fixtures.get(model.id);
    if (cached !== undefined) return cached;
    this.#inProgress.add(model.id);
    const scope: Scope = {
      label: model.name,
      root: model.id,
      source: model.definition.source,
      cycle: this.#ctx.project.graph.cycleOf(model.id),
      flags: { risky: false },
      inline: { depth: 0 },
    };
    let value = this.#sample(model.definition.schema, model.id, scope);
    if (value === undefined) {
      this.#report(
        scope,
        'mock/unsatisfiable',
        `\`${model.name}\` has no finite value: it requires itself, so its fixture cannot be generated.`,
      );
      value = { kind: 'never' };
    }
    // Subtypes of a discriminated base carry their discriminator value.
    for (const { property, values } of inheritedDiscriminators(model, this.#ctx)) {
      const tag = values[0];
      if (tag !== undefined) value = withEntry(value, property, json(tag));
    }
    this.#check(value, model.definition.schema, scope);
    if (scope.flags.risky) this.#unfit.add(value);
    this.#inProgress.delete(model.id);
    this.#fixtures.set(model.id, value);
    return value;
  }

  /** The default body of a response: its example, or a value generated from its schema. */
  responseBody(
    media: MediaTypeIR,
    kind: ResponseKind,
    label: string,
    source: SourceRef,
  ): MockValue {
    const scope: Scope = {
      label,
      root: label,
      source,
      cycle: new Set(),
      flags: { risky: false },
      inline: { depth: 0 },
    };
    const random = new Random(label);
    if (kind === 'binary') {
      const type = media.mediaType.includes('*') ? undefined : media.mediaType;
      return { kind: 'blob', text: words(random), ...(type === undefined ? {} : { type }) };
    }
    const example = media.examples.find((e) => e.value !== undefined)?.value;
    if (kind === 'text') {
      if (typeof example === 'string') return json(example);
      const schema = media.schema;
      const textual =
        schema.kind === 'string' ||
        (schema.kind === 'enum' && schema.values.every((v) => typeof v === 'string'));
      return textual ? (this.#sample(schema, label, scope) ?? json('')) : json(words(random));
    }
    if (example !== undefined) {
      if (this.#conforms(example, media.schema)) return this.#fromJson(example, media.schema);
      this.#invalidExample(scope, label, 'example');
    }
    const value = this.#sample(media.schema, label, scope) ?? { kind: 'never' };
    this.#check(value, media.schema, scope);
    if (scope.flags.risky) this.#unfit.add(value);
    return value;
  }

  /** A string for a response header, or `undefined` when the header has no simple value. */
  headerValue(schema: SchemaIR, label: string, source: SourceRef): string | undefined {
    const scope: Scope = {
      label,
      root: label,
      source,
      cycle: new Set(),
      flags: { risky: false },
      inline: { depth: 0 },
    };
    const value = this.#sample(schema, label, scope);
    const data = value === undefined ? undefined : this.#materialize(value, true);
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean')
      return String(data);
    if (Array.isArray(data) && data.every((item) => typeof item !== 'object' || item === null))
      return data.map(String).join(',');
    return undefined;
  }

  // Sampling --------------------------------------------------------------------------------------

  /**
   * A value for `schema`, or `undefined` when every value would call a fixture factory of the
   * root's cycle (and so never return).
   */
  #sample(schema: SchemaIR, path: string, scope: Scope, name?: string): MockValue | undefined {
    const example = schema.examples?.[0];
    if (example !== undefined) {
      if (this.#conforms(example, schema)) return this.#fromJson(example, schema);
      this.#invalidExample(scope, path, 'example');
    }
    const scalar =
      schema.kind === 'string' ||
      schema.kind === 'number' ||
      schema.kind === 'integer' ||
      schema.kind === 'boolean' ||
      schema.kind === 'enum';
    if (scalar && schema.default !== undefined) {
      if (this.#conforms(schema.default, schema)) return this.#fromJson(schema.default, schema);
      this.#invalidExample(scope, path, 'default value');
    }
    const value = this.#sampleNode(schema, path, scope, name);
    if (value === undefined || schema.assertions === undefined) return value;
    return this.#assert(schema, value, path, scope, name);
  }

  /** A value for the node itself: no example, default or assertions. */
  #sampleNode(schema: SchemaIR, path: string, scope: Scope, name?: string): MockValue | undefined {
    switch (schema.kind) {
      case 'ref': {
        if (scope.cycle.has(schema.target))
          return schema.nullable === true ? json(null) : undefined;
        const model = this.#ctx.project.modelById.get(schema.target);
        return model?.fixtureName === undefined ? json(null) : { kind: 'fixture', model: model.id };
      }
      case 'string':
        return this.#string(schema, path, scope, name);
      case 'number':
      case 'integer':
        return json(this.#number(schema, path, scope));
      case 'boolean':
        return json(new Random(path).next() < 0.5);
      case 'null':
        return json(null);
      case 'enum': {
        const value = schema.values.find((v) => v !== null) ?? schema.values[0];
        if (value !== undefined) return json(value);
        this.#report(scope, 'mock/unsatisfiable', `${this.#at(scope, path)} has an empty enum.`);
        return { kind: 'never' };
      }
      case 'binary':
        return { kind: 'blob', text: words(new Random(path)) };
      case 'unknown':
        return json({});
      case 'never':
        this.#report(scope, 'mock/unsatisfiable', `${this.#at(scope, path)} accepts no value.`);
        return { kind: 'never' };
      case 'array':
        return this.#array(schema, path, scope);
      case 'object':
        return this.#object(schema, path, scope);
      case 'union':
        return this.#union(schema, path, scope);
      case 'intersection':
        return this.#intersection(schema, path, scope);
    }
  }

  #string(
    schema: Extract<SchemaIR, { kind: 'string' }>,
    path: string,
    scope: Scope,
    name: string | undefined,
  ): MockValue {
    const random = new Random(path);
    const format = dateFormat(schema);
    if (format !== undefined) {
      const value = formatted(format, random) ?? '';
      return this.#ctx.config.types.dates === 'Date' ? { kind: 'date', value } : json(value);
    }
    const minLength = schema.constraints?.minLength ?? 0;
    const maxLength = schema.constraints?.maxLength ?? Infinity;
    const pattern = schema.constraints?.pattern;
    if (pattern !== undefined) {
      const sampled = samplePattern(pattern, random, minLength, maxLength);
      if (sampled !== undefined) return json(sampled);
      this.#report(
        scope,
        'mock/unsupported-pattern',
        `No string matching the pattern of ${this.#at(scope, path)} could be generated; the fixture does not match it.`,
        'Add an `example` that matches the pattern.',
        'info',
      );
    }
    const text =
      (schema.format === undefined ? undefined : formatted(schema.format, random)) ??
      (name === undefined ? undefined : byName(name, random)) ??
      words(random);
    return json(fit(text, random, minLength, maxLength));
  }

  #number(
    schema: Extract<SchemaIR, { kind: 'number' | 'integer' }>,
    path: string,
    scope: Scope,
  ): number {
    const random = new Random(path);
    const integer = schema.kind === 'integer';
    const c = schema.constraints ?? {};
    let low = c.minimum ?? -Infinity;
    let high = c.maximum ?? Infinity;
    let lowOpen = false;
    let highOpen = false;
    if (c.exclusiveMinimum !== undefined && c.exclusiveMinimum >= low) {
      low = c.exclusiveMinimum;
      lowOpen = true;
    }
    if (c.exclusiveMaximum !== undefined && c.exclusiveMaximum <= high) {
      high = c.exclusiveMaximum;
      highOpen = true;
    }
    // Without bounds, values between 1 and 1000; next to one bound, within 1000 of it (and not
    // negative below a positive maximum).
    if (low === -Infinity && high === Infinity) [low, high] = [1, 1000];
    else if (low === -Infinity) low = high > 0 ? 0 : high - 1000;
    else if (high === Infinity) high = low + 1000;
    const fits = (value: number): boolean =>
      (lowOpen ? value > low : value >= low) &&
      (highOpen ? value < high : value <= high) &&
      (!integer || Number.isInteger(value));
    let step = c.multipleOf ?? (integer ? 1 : undefined);
    if (step !== undefined && step > 0) {
      // Integers that are multiples of a fraction: the smallest integer multiple of it.
      if (integer && !Number.isInteger(step)) {
        const fraction = step;
        const factor = Array.from({ length: 1000 }, (_, index) => index + 1).find((n) =>
          Number.isInteger(round(n * fraction, 10)),
        );
        step = factor === undefined ? fraction : round(factor * fraction, 10);
      }
      const digits = decimals(step);
      let first = Math.ceil(low / step);
      let last = Math.floor(high / step);
      if (!fits(round(first * step, digits))) first++;
      if (!fits(round(last * step, digits))) last--;
      if (first <= last) return round(random.int(first, last) * step, digits);
    } else {
      const value = round(low + random.next() * (high - low), 2);
      if (fits(value)) return value;
      if (fits((low + high) / 2)) return (low + high) / 2;
    }
    this.#report(
      scope,
      'mock/unsatisfiable',
      `No number satisfies the bounds of ${this.#at(scope, path)}.`,
    );
    return Number.isFinite(low) ? low : 0;
  }

  #array(
    schema: Extract<SchemaIR, { kind: 'array' }>,
    path: string,
    scope: Scope,
  ): MockValue | undefined {
    const prefix = schema.prefixItems ?? [];
    const minItems = schema.constraints?.minItems ?? 0;
    const maxItems = schema.constraints?.maxItems ?? Infinity;
    // Tuples need every prefix item (their type does); other arrays get one item, or `minItems`.
    const rest =
      schema.items.kind === 'never'
        ? 0
        : Math.max(minItems - prefix.length, prefix.length === 0 ? 1 : 0);
    const count = Math.min(prefix.length + rest, Math.max(maxItems, prefix.length), MAX_ITEMS);
    if (minItems > MAX_ITEMS)
      this.#report(
        scope,
        'mock/unsatisfiable',
        `${this.#at(scope, path)} requires more than ${MAX_ITEMS} items.`,
      );
    const items: MockValue[] = [];
    for (let index = 0; index < count; index++) {
      const item = this.#sample(prefix[index] ?? schema.items, `${path}/${index}`, scope);
      if (item === undefined) {
        if (index < Math.max(minItems, prefix.length)) return undefined;
        break;
      }
      // Items that cannot have a value are left out where the array may be shorter.
      if (item.kind === 'never' && index >= Math.max(minItems, prefix.length)) break;
      items.push(item);
    }
    return { kind: 'array', items };
  }

  #object(schema: ObjectSchema, path: string, scope: Scope): MockValue | undefined {
    const maxProperties = schema.constraints?.maxProperties ?? Infinity;
    let budget = maxProperties - schema.properties.filter((p) => p.required).length;
    const entries: (readonly [string, MockValue])[] = [];
    for (const property of schema.properties) {
      if (!property.required && (budget <= 0 || property.schema.kind === 'never')) continue;
      const value = this.#sample(property.schema, `${path}/${property.name}`, scope, property.name);
      if (value === undefined) {
        if (property.required) return undefined;
        continue;
      }
      // An optional property that cannot have a value is left out.
      if (value.kind === 'never' && !property.required) continue;
      if (!property.required) budget--;
      entries.push([property.name, value]);
    }
    const minProperties = schema.constraints?.minProperties ?? 0;
    const additional = schema.additionalProperties;
    // Only types with an index signature accept other properties in an object literal.
    if (additional !== undefined && additional !== false) {
      for (let index = 1; entries.length < minProperties && index <= MAX_ITEMS; index++) {
        const key = `property${index}`;
        if (schema.properties.some((p) => p.name === key)) continue;
        const value = this.#sample(additional, `${path}/${key}`, scope);
        if (value === undefined) break;
        entries.push([key, value]);
      }
    }
    return { kind: 'object', spreads: [], entries };
  }

  #union(
    schema: Extract<SchemaIR, { kind: 'union' }>,
    path: string,
    scope: Scope,
  ): MockValue | undefined {
    const variants = [
      ...schema.variants.filter((v) => v.kind !== 'null'),
      ...schema.variants.filter((v) => v.kind === 'null'),
    ];
    const discriminator = schema.discriminator;
    let impossible = false;
    for (const variant of variants) {
      const tag =
        discriminator === undefined || variant.kind !== 'ref'
          ? undefined
          : discriminator.mapping.find((m) => m.target === variant.target)?.value;
      // A variant whose own discriminator property excludes its mapped value has no value: its
      // type (`Cat & { petType: 'cat' }`) is `never`.
      if (tag !== undefined && discriminator !== undefined) {
        const declared = this.#objectView(variant, 0).properties.get(discriminator.propertyName);
        if (declared !== undefined && !this.#conforms(tag, declared)) {
          impossible = true;
          continue;
        }
      }
      const value = this.#sample(variant, path, scope);
      if (value === undefined) continue;
      if (tag === undefined || discriminator === undefined) return value;
      // A value that cannot be spread (a fixture of a nullable model) is returned untagged.
      if (!this.#isObjectValue(value)) {
        scope.flags.risky = true;
        return value;
      }
      return withEntry(value, discriminator.propertyName, json(tag));
    }
    if (schema.nullable === true) return json(null);
    if (!impossible) return undefined;
    this.#report(
      scope,
      'mock/unsatisfiable',
      `No variant of ${this.#at(scope, path)} can have its discriminator value: each one's \`${discriminator?.propertyName ?? ''}\` excludes the value the mapping gives it.`,
      'Correct the discriminator mapping, or the values the variants allow.',
    );
    return { kind: 'never' };
  }

  #intersection(
    schema: Extract<SchemaIR, { kind: 'intersection' }>,
    path: string,
    scope: Scope,
  ): MockValue | undefined {
    // Object types become one object type: spreading the members' fixtures would type their
    // properties as each member declares them (optional in one, required in another).
    const flat = this.#flatten(schema, 0);
    if (flat !== undefined) {
      if (flat.risky) scope.flags.risky = true;
      // Merged references are inlined: a recursive model merged with another ends somewhere.
      if (scope.inline.depth >= MAX_INLINE) return undefined;
      // `Record<string, never> & { a: string }` has no value at all.
      if (flat.closed && flat.properties.length > 0) {
        scope.flags.risky = true;
        this.#report(
          scope,
          'mock/unsatisfiable',
          `${this.#at(scope, path)} combines an object that allows no properties with objects that declare some, so its type has no value.`,
        );
      }
      scope.inline.depth++;
      try {
        return this.#object(
          {
            kind: 'object',
            properties: flat.properties,
            ...(flat.additional === undefined ? {} : { additionalProperties: flat.additional }),
          },
          path,
          scope,
        );
      } finally {
        scope.inline.depth--;
      }
    }
    const sampled: MockValue[] = [];
    for (const member of schema.members) {
      const value = this.#sample(member, path, scope);
      if (value === undefined) return undefined;
      sampled.push(value);
    }
    // Members that contribute nothing (`{}`) are left out.
    const parts = sampled.filter((part) => !isEmptyObject(part));
    const [first = sampled[0]] = parts;
    if (parts.length <= 1) {
      // TypeScript sees the remaining member's type, not the intersection.
      if (sampled.length > 1) scope.flags.risky = true;
      return first;
    }
    // Unions of objects among the members: their fixtures are spread.
    if (parts.every((part) => this.#isObjectValue(part))) {
      scope.flags.risky = true;
      let merged: MockValue = { kind: 'object', spreads: [], entries: [] };
      for (const part of parts) merged = mergeObjects(merged, part);
      return merged;
    }
    // Scalars (`type: string` next to a `oneOf` of constants): a value every member accepts.
    const fitting = parts.find((part) => {
      const data = this.#materialize(part, true);
      return data !== undefined && this.#conforms(data, schema);
    });
    // Values of one kind type as the members do (`string & 'START'`); a `Date` next to a string
    // (`Date & string`) does not.
    if (fitting === undefined || parts.some((part) => part.kind !== fitting.kind))
      scope.flags.risky = true;
    return fitting ?? first;
  }

  /**
   * Whether a model's type is one object type without an index signature, whose `Partial` can be
   * spread over its fixture. The `Partial` of a union is a union of partials (spreading it loses
   * the discriminator's type), and that of an index signature adds `undefined` to it.
   */
  overridable(schema: SchemaIR): boolean {
    const flat = this.#flatten(schema, 0);
    return (
      flat !== undefined &&
      flat.properties.length > 0 &&
      !flat.closed &&
      flat.additional === undefined
    );
  }

  /** An object type, or an `allOf` of object types, as one object type; otherwise `undefined`. */
  #flatten(schema: SchemaIR, hops: number): FlatObject | undefined {
    if (hops > MAX_HOPS) return undefined;
    switch (schema.kind) {
      case 'object': {
        const additional =
          schema.additionalProperties === false ? undefined : schema.additionalProperties;
        return {
          properties: schema.properties,
          additional,
          closed: schema.additionalProperties === false && schema.properties.length === 0,
          risky: false,
        };
      }
      // `T & unknown` is `T`.
      case 'unknown':
        return schema.assertions === undefined
          ? { properties: [], additional: undefined, closed: false, risky: false }
          : undefined;
      case 'ref': {
        const target = this.#definitions.get(schema.target)?.schema;
        return target === undefined ? undefined : this.#flatten(target, hops + 1);
      }
      case 'intersection': {
        const flats: FlatObject[] = [];
        for (const member of schema.members) {
          const flat = this.#flatten(member, hops + 1);
          if (flat === undefined) return undefined;
          flats.push(flat);
        }
        const properties: PropertyIR[] = [];
        let risky = flats.some((flat) => flat.risky);
        const dates = this.#ctx.config.types.dates === 'Date';
        for (const property of flats.flatMap((flat) => flat.properties)) {
          const index = properties.findIndex((p) => p.name === property.name);
          const existing = properties[index];
          if (existing === undefined) {
            properties.push(property);
            continue;
          }
          // A `date-time` string and a plain one are typed `Date & string` with `types.dates: 'Date'`.
          if (
            dates &&
            existing.schema.kind === 'string' &&
            property.schema.kind === 'string' &&
            (dateFormat(existing.schema) === undefined) !==
              (dateFormat(property.schema) === undefined)
          )
            risky = true;
          properties[index] = {
            name: property.name,
            required: existing.required || property.required,
            schema: this.#merge(existing.schema, property.schema, 0),
          };
        }
        return {
          properties,
          additional: flats.find((flat) => flat.additional !== undefined)?.additional,
          closed: flats.some((flat) => flat.closed),
          risky,
        };
      }
      default:
        return undefined;
    }
  }

  /** Whether a value is an object at runtime, so it can be spread into another. */
  #isObjectValue(value: MockValue): boolean {
    switch (value.kind) {
      case 'object':
        return true;
      case 'json':
        return isRecord(value.value);
      case 'fixture': {
        // A nullable model's fixture is typed `T | null`, which a spread turns into `{}`.
        const schema = this.#definitions.get(value.model)?.schema;
        return schema !== undefined && schema.nullable !== true && this.#objectLike(schema, 0);
      }
      default:
        return false;
    }
  }

  #objectLike(schema: SchemaIR, hops: number): boolean {
    if (hops > MAX_HOPS) return false;
    switch (schema.kind) {
      case 'object':
        return true;
      case 'ref': {
        const target = this.#definitions.get(schema.target)?.schema;
        return target !== undefined && this.#objectLike(target, hops + 1);
      }
      case 'intersection':
        return schema.members.every((m) => this.#objectLike(m, hops + 1));
      case 'union':
        return schema.variants.every((v) => this.#objectLike(v, hops + 1));
      default:
        return false;
    }
  }

  /**
   * Applies `if`/`then`/`else`, `dependentSchemas` and `dependentRequired` by sampling again with
   * the schemas they select merged in, and `not` by trying other values.
   */
  #assert(
    schema: SchemaIR,
    value: MockValue,
    path: string,
    scope: Scope,
    name?: string,
  ): MockValue {
    const assertions = schema.assertions;
    if (assertions === undefined) return value;
    const base = withoutAssertions(schema);
    let refined = base;
    let current = value;
    const data = this.#materialize(current, true);
    if (data !== undefined) {
      const conditional = assertions.conditional;
      if (conditional !== undefined) {
        const branch = this.#conforms(data, conditional.condition)
          ? conditional.whenTrue
          : conditional.whenFalse;
        if (branch !== undefined) refined = this.#merge(refined, branch, 0);
      }
      if (isRecord(data)) {
        for (const [property, dependent] of Object.entries(assertions.dependentSchemas ?? {}))
          if (Object.hasOwn(data, property)) refined = this.#merge(refined, dependent, 0);
        for (const [property, required] of Object.entries(assertions.dependentRequired ?? {}))
          if (Object.hasOwn(data, property))
            refined = this.#merge(refined, requiredProperties(required), 0);
      }
      if (refined !== base) current = this.#sampleNode(refined, path, scope, name) ?? current;
    }
    const not = assertions.not;
    if (not !== undefined) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const sampled = this.#materialize(current, true);
        if (sampled === undefined || !this.#conforms(sampled, not)) break;
        current = this.#sampleNode(refined, `${path}#${attempt}`, scope, name) ?? current;
      }
    }
    return current;
  }

  // Schemas ---------------------------------------------------------------------------------------

  /**
   * One schema satisfying both, as far as their keywords can be combined: constraints of the same
   * type are intersected, object properties merged and enum values filtered. Otherwise `base`.
   */
  #merge(base: SchemaIR, extra: SchemaIR, hops: number): SchemaIR {
    if (extra.kind === 'unknown' || hops > MAX_HOPS) return base;
    if (extra.kind === 'ref') {
      if (base.kind === 'ref' && base.target === extra.target) return base;
      const target = this.#definitions.get(extra.target)?.schema;
      return target === undefined ? base : this.#merge(base, target, hops + 1);
    }
    if (base.kind === 'unknown') return withoutAssertions(extra);
    if (base.kind === 'ref') {
      const target = this.#definitions.get(base.target)?.schema;
      return target === undefined ? base : this.#merge(target, extra, hops + 1);
    }
    if (base.kind === 'enum') {
      const values = base.values.filter((value) => this.#conforms(value, extra));
      return values.length === 0 ? base : { ...base, values };
    }
    if (extra.kind === 'enum') {
      const values = extra.values.filter((value) => this.#conforms(value, base));
      return values.length === 0
        ? base
        : { kind: 'enum', values, ...(base.nullable === true ? { nullable: true } : {}) };
    }
    if (base.kind === 'string' && extra.kind === 'string') {
      const a = base.constraints ?? {};
      const b = extra.constraints ?? {};
      const minLength = Math.max(a.minLength ?? 0, b.minLength ?? 0);
      const maxLength = Math.min(a.maxLength ?? Infinity, b.maxLength ?? Infinity);
      const pattern = b.pattern ?? a.pattern;
      return {
        ...base,
        ...(base.format === undefined && extra.format !== undefined
          ? { format: extra.format }
          : {}),
        constraints: {
          ...(minLength > 0 ? { minLength } : {}),
          ...(maxLength < Infinity ? { maxLength } : {}),
          ...(pattern === undefined ? {} : { pattern }),
        },
      };
    }
    if (
      (base.kind === 'number' || base.kind === 'integer') &&
      (extra.kind === 'number' || extra.kind === 'integer')
    ) {
      const a = base.constraints ?? {};
      const b = extra.constraints ?? {};
      const pick = (
        x: number | undefined,
        y: number | undefined,
        choose: (...n: number[]) => number,
      ): number | undefined => (x === undefined ? y : y === undefined ? x : choose(x, y));
      const minimum = pick(a.minimum, b.minimum, Math.max);
      const maximum = pick(a.maximum, b.maximum, Math.min);
      const exclusiveMinimum = pick(a.exclusiveMinimum, b.exclusiveMinimum, Math.max);
      const exclusiveMaximum = pick(a.exclusiveMaximum, b.exclusiveMaximum, Math.min);
      const multipleOf = a.multipleOf ?? b.multipleOf;
      return {
        ...base,
        kind: base.kind === 'integer' || extra.kind === 'integer' ? 'integer' : 'number',
        constraints: {
          ...(minimum === undefined ? {} : { minimum }),
          ...(maximum === undefined ? {} : { maximum }),
          ...(exclusiveMinimum === undefined ? {} : { exclusiveMinimum }),
          ...(exclusiveMaximum === undefined ? {} : { exclusiveMaximum }),
          ...(multipleOf === undefined ? {} : { multipleOf }),
        },
      };
    }
    if (base.kind === 'object' && extra.kind === 'object') {
      const properties: PropertyIR[] = base.properties.map((property) => {
        const other = extra.properties.find((p) => p.name === property.name);
        return other === undefined
          ? property
          : {
              name: property.name,
              required: property.required || other.required,
              schema: this.#merge(property.schema, other.schema, hops + 1),
            };
      });
      const added = extra.properties.filter((p) => !base.properties.some((q) => q.name === p.name));
      // Properties only the extra schema declares cannot be added to a closed object.
      if (base.additionalProperties === false) return { ...base, properties };
      return { ...base, properties: [...properties, ...added] };
    }
    if (base.kind === 'array' && extra.kind === 'array' && base.prefixItems === undefined) {
      const a = base.constraints ?? {};
      const b = extra.constraints ?? {};
      const minItems = Math.max(a.minItems ?? 0, b.minItems ?? 0);
      const maxItems = Math.min(a.maxItems ?? Infinity, b.maxItems ?? Infinity);
      return {
        ...base,
        items: this.#merge(base.items, extra.items, hops + 1),
        constraints: {
          ...(minItems > 0 ? { minItems } : {}),
          ...(maxItems < Infinity ? { maxItems } : {}),
        },
      };
    }
    if (base.kind === 'intersection') return { ...base, members: [...base.members, extra] };
    // Schemas that cannot be combined keyword by keyword are sampled as their intersection.
    return { kind: 'intersection', members: [base, withoutAssertions(extra)] };
  }

  // Examples --------------------------------------------------------------------------------------

  /**
   * Whether a (materialized) value matches a schema: the checks the generated validators make,
   * and the shape the generated types require. Patterns and formats other than dates are not
   * checked: validators do not enforce them, and patterns would have to be executed.
   */
  #conforms(value: unknown, schema: SchemaIR, hops = 0, open = false): boolean {
    if (value === ANY) return true;
    if (value === null && schema.nullable === true) return true;
    if (!this.#conformsNode(value, schema, hops, open)) return false;
    const assertions = schema.assertions;
    if (assertions === undefined) return true;
    if (assertions.not !== undefined && this.#conforms(value, assertions.not, hops)) return false;
    const conditional = assertions.conditional;
    if (conditional !== undefined) {
      const branch = this.#conforms(value, conditional.condition, hops)
        ? conditional.whenTrue
        : conditional.whenFalse;
      if (branch !== undefined && !this.#conforms(value, branch, hops)) return false;
    }
    if (!isRecord(value)) return true;
    for (const [property, dependent] of Object.entries(assertions.dependentSchemas ?? {}))
      if (Object.hasOwn(value, property) && !this.#conforms(value, dependent, hops)) return false;
    for (const [property, required] of Object.entries(assertions.dependentRequired ?? {}))
      if (Object.hasOwn(value, property) && !required.every((key) => Object.hasOwn(value, key)))
        return false;
    return true;
  }

  #conformsNode(value: unknown, schema: SchemaIR, hops: number, open: boolean): boolean {
    switch (schema.kind) {
      case 'ref': {
        if (hops > MAX_HOPS) return true;
        const target = this.#definitions.get(schema.target)?.schema;
        return target === undefined || this.#conforms(value, target, hops + 1, open);
      }
      case 'string': {
        if (typeof value !== 'string') return false;
        const [points, units] = lengths(value);
        const c = schema.constraints ?? {};
        if (Math.min(points, units) < (c.minLength ?? 0)) return false;
        if (Math.max(points, units) > (c.maxLength ?? Infinity)) return false;
        // With `types.dates: 'Date'`, the validators check the wire format of dates.
        const format = this.#ctx.config.types.dates === 'Date' ? dateFormat(schema) : undefined;
        if (format === 'date') return DATE.test(value) && !Number.isNaN(Date.parse(value));
        if (format === 'date-time')
          return DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
        return true;
      }
      case 'number':
      case 'integer': {
        if (typeof value !== 'number' || !Number.isFinite(value)) return false;
        if (schema.kind === 'integer' && !Number.isInteger(value)) return false;
        const c = schema.constraints ?? {};
        if (c.minimum !== undefined && value < c.minimum) return false;
        if (c.maximum !== undefined && value > c.maximum) return false;
        if (c.exclusiveMinimum !== undefined && value <= c.exclusiveMinimum) return false;
        if (c.exclusiveMaximum !== undefined && value >= c.exclusiveMaximum) return false;
        if (c.multipleOf !== undefined) {
          const ratio = value / c.multipleOf;
          if (Math.abs(ratio - Math.round(ratio)) > 1e-9) return false;
        }
        return true;
      }
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      case 'binary':
        return value === BLOB;
      case 'unknown':
        return true;
      case 'never':
        return false;
      case 'enum': {
        const key = stableStringify(value);
        return schema.values.some((candidate) => stableStringify(candidate) === key);
      }
      case 'array': {
        if (!Array.isArray(value)) return false;
        const items: readonly unknown[] = value;
        const c = schema.constraints ?? {};
        const prefix = schema.prefixItems ?? [];
        if (items.length < Math.max(c.minItems ?? 0, prefix.length)) return false;
        if (items.length > (c.maxItems ?? Infinity)) return false;
        return items.every((item, index) =>
          this.#conforms(item, prefix[index] ?? schema.items, hops),
        );
      }
      case 'object': {
        if (!isRecord(value)) return false;
        for (const property of schema.properties) {
          if (!Object.hasOwn(value, property.name)) {
            if (property.required) return false;
            continue;
          }
          if (!this.#conforms(value[property.name], property.schema, hops)) return false;
        }
        const additional = schema.additionalProperties;
        if (additional === undefined || (additional === false && open)) return true;
        for (const key of Object.keys(value)) {
          if (schema.properties.some((p) => p.name === key)) continue;
          if (additional === false || !this.#conforms(value[key], additional, hops)) return false;
        }
        return true;
      }
      case 'union': {
        const discriminator = schema.discriminator;
        return schema.variants.some((variant) => {
          const values =
            discriminator === undefined || variant.kind !== 'ref'
              ? []
              : discriminator.mapping
                  .filter((m) => m.target === variant.target)
                  .map((m) => m.value);
          if (values.length > 0 && discriminator !== undefined) {
            const tag = isRecord(value) ? getOwn(value, discriminator.propertyName) : undefined;
            if (typeof tag !== 'string' || !values.includes(tag)) return false;
          }
          return this.#conforms(value, variant, hops);
        });
      }
      case 'intersection':
        return schema.members.every((member) => this.#conforms(value, member, hops, true));
    }
  }

  /**
   * A JSON example as a value of `schema`'s type: properties the type does not declare are left
   * out (object literals cannot have them), dates become `Date` values with `types.dates: 'Date'`.
   */
  #fromJson(value: JsonValue, schema: SchemaIR, hops = 0): MockValue {
    if (value === null || hops > MAX_HOPS) return json(value);
    switch (schema.kind) {
      case 'ref': {
        const target = this.#definitions.get(schema.target)?.schema;
        return target === undefined ? json(value) : this.#fromJson(value, target, hops + 1);
      }
      case 'string':
        return typeof value === 'string' &&
          dateFormat(schema) !== undefined &&
          this.#ctx.config.types.dates === 'Date'
          ? { kind: 'date', value }
          : json(value);
      case 'array': {
        if (!Array.isArray(value)) return json(value);
        const prefix = schema.prefixItems ?? [];
        return {
          kind: 'array',
          items: value.map((item, index) =>
            this.#fromJson(item, prefix[index] ?? schema.items, hops),
          ),
        };
      }
      case 'union': {
        const variant = schema.variants.find((v) => this.#conforms(value, v, hops));
        return variant === undefined ? json(value) : this.#fromJson(value, variant, hops);
      }
      case 'intersection': {
        if (Array.isArray(value)) {
          const items = this.#arrayItems(schema, hops);
          return items === undefined
            ? json(value)
            : { kind: 'array', items: value.map((item) => this.#fromJson(item, items, hops)) };
        }
        if (isRecord(value)) return this.#fromJsonObject(value, schema, hops);
        // A scalar, as its first constrained member reads it (a date, with `types.dates: 'Date'`).
        const member = schema.members.find((m) => !isNeutral(m));
        return member === undefined ? json(value) : this.#fromJson(value, member, hops + 1);
      }
      case 'object':
        return isRecord(value) ? this.#fromJsonObject(value, schema, hops) : json(value);
      default:
        return json(value);
    }
  }

  #fromJsonObject(value: { [key: string]: JsonValue }, schema: SchemaIR, hops: number): MockValue {
    const view = this.#objectView(schema, hops);
    const entries: (readonly [string, MockValue])[] = [];
    for (const [key, item] of Object.entries(value)) {
      const declared = view.properties.get(key) ?? view.rest;
      if (declared !== undefined) entries.push([key, this.#fromJson(item, declared, hops)]);
    }
    return { kind: 'object', spreads: [], entries };
  }

  /** The items of the arrays an intersection combines (as one schema), if it combines any. */
  #arrayItems(schema: SchemaIR, hops: number): SchemaIR | undefined {
    const items: SchemaIR[] = [];
    const visit = (node: SchemaIR, depth: number): void => {
      if (depth > MAX_HOPS) return;
      if (node.kind === 'ref') {
        const target = this.#definitions.get(node.target)?.schema;
        if (target !== undefined) visit(target, depth + 1);
      } else if (node.kind === 'intersection') {
        for (const member of node.members) visit(member, depth + 1);
      } else if (node.kind === 'array') {
        items.push(node.items);
      }
    };
    visit(schema, hops);
    return combine(items);
  }

  /**
   * The properties an object type declares, through intersections and references (a property
   * several members declare has all their schemas), and the schema of other properties:
   * `undefined` when the type has no index signature.
   */
  #objectView(
    schema: SchemaIR,
    hops: number,
  ): { readonly properties: ReadonlyMap<string, SchemaIR>; readonly rest: SchemaIR | undefined } {
    const declared = new Map<string, SchemaIR[]>();
    let rest: SchemaIR | undefined;
    const visit = (node: SchemaIR, depth: number): void => {
      if (depth > MAX_HOPS) return;
      if (node.kind === 'ref') {
        const target = this.#definitions.get(node.target)?.schema;
        if (target !== undefined) visit(target, depth + 1);
      } else if (node.kind === 'intersection') {
        // `T & unknown` is `T`: an unconstrained member allows no other keys.
        for (const member of node.members) if (!isNeutral(member)) visit(member, depth + 1);
      } else if (node.kind === 'object') {
        for (const property of node.properties)
          declared.set(property.name, [...(declared.get(property.name) ?? []), property.schema]);
        if (node.additionalProperties !== undefined && node.additionalProperties !== false)
          rest ??= node.additionalProperties;
        // Without properties, the type is a `Record`, which accepts any key.
        else if (node.properties.length === 0 && node.additionalProperties === undefined)
          rest ??= { kind: 'unknown' };
      } else if (node.kind === 'unknown' || node.kind === 'union') {
        rest ??= { kind: 'unknown' };
      }
    };
    visit(schema, hops);
    const properties = new Map<string, SchemaIR>();
    for (const [name, schemas] of declared) {
      const combined = combine(schemas);
      if (combined !== undefined) properties.set(name, combined);
    }
    return { properties, rest };
  }

  /**
   * The JSON a value stands for (`Blob`s as a marker). Fixture calls are followed when `deep`,
   * and otherwise assumed to match (each fixture is checked on its own). `undefined` when the
   * value cannot be computed (`never`, or a fixture that is being generated).
   */
  #materialize(value: MockValue, deep: boolean): unknown {
    switch (value.kind) {
      case 'json':
      case 'date':
        return value.value;
      case 'blob':
        return BLOB;
      case 'never':
        return undefined;
      case 'fixture': {
        if (!deep) return ANY;
        const model = this.#ctx.project.modelById.get(value.model);
        if (model === undefined || this.#inProgress.has(model.id)) return undefined;
        return this.#materialize(this.fixture(model), deep);
      }
      case 'array': {
        const items = value.items.map((item) => this.#materialize(item, deep));
        return items.includes(undefined) ? undefined : items;
      }
      case 'object': {
        const result: Record<string, unknown> = {};
        // Spreads are followed even in shallow mode: the entries next to them are checked against
        // a schema that also requires the spread's properties.
        for (const spread of value.spreads) {
          const data = this.#materialize(spread, true);
          if (data === undefined) return deep ? undefined : ANY;
          if (isRecord(data))
            for (const [key, item] of Object.entries(data)) setOwn(result, key, item);
        }
        for (const [key, item] of value.entries) {
          const data = this.#materialize(item, deep);
          if (data === undefined) return undefined;
          setOwn(result, key, data);
        }
        return result;
      }
    }
  }

  // Diagnostics -----------------------------------------------------------------------------------

  /**
   * Whether a value matched its schema when it was generated: generated code casts the others,
   * so that it compiles when a schema cannot be satisfied.
   */
  fits(value: MockValue): boolean {
    return !this.#unfit.has(value);
  }

  /** Reports a fixture that does not match its schema (its fixture calls are checked separately). */
  #check(value: MockValue, schema: SchemaIR, scope: Scope): void {
    const data = this.#materialize(value, false);
    if (data === undefined || this.#conforms(data, schema)) return;
    this.#unfit.add(value);
    this.#report(
      scope,
      'mock/unsatisfiable',
      `The generated fixture of \`${scope.label}\` does not match its schema: its constraints contradict each other or cannot be combined.`,
      'Add an `example` that matches the schema.',
    );
  }

  #invalidExample(scope: Scope, path: string, what: 'example' | 'default value'): void {
    this.#report(
      scope,
      'mock/invalid-example',
      `The ${what} of ${this.#at(scope, path)} does not match its schema; the fixture uses a generated value instead.`,
      `Correct the ${what}.`,
    );
  }

  /** `Pet.tags[0].name` for a path below the scope's root. */
  #at(scope: Scope, path: string): string {
    const suffix = path.startsWith(scope.root) ? path.slice(scope.root.length) : '';
    const segments = suffix
      .split('/')
      .filter((segment) => segment !== '')
      .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`));
    return `\`${scope.label}${segments.join('')}\``;
  }

  #report(
    scope: Scope,
    code: string,
    message: string,
    hint?: string,
    severity: 'warning' | 'info' = 'warning',
  ): void {
    this.#ctx.report?.({
      code,
      severity,
      message,
      ...(scope.source === undefined ? {} : { source: scope.source }),
      ...(hint === undefined ? {} : { hint }),
    });
  }
}

/** A value with one more (or replaced) property; values that are not object literals are spread. */
function withEntry(value: MockValue, key: string, entry: MockValue): MockValue {
  if (value.kind === 'object')
    return { ...value, entries: [...value.entries.filter(([k]) => k !== key), [key, entry]] };
  return { kind: 'object', spreads: [value], entries: [[key, entry]] };
}

/** Two object values as one: spreads first, then entries (later ones win). */
function mergeObjects(target: MockValue, part: MockValue): MockValue {
  if (target.kind !== 'object') return target;
  if (part.kind === 'object') {
    const keys = new Set(part.entries.map(([key]) => key));
    return {
      kind: 'object',
      spreads: [...target.spreads, ...part.spreads],
      entries: [...target.entries.filter(([key]) => !keys.has(key)), ...part.entries],
    };
  }
  if (part.kind === 'json' && isRecord(part.value)) {
    let result: MockValue = target;
    for (const [key, item] of Object.entries(part.value))
      result = withEntry(result, key, json(item));
    return result;
  }
  return { ...target, spreads: [...target.spreads, part] };
}

/** One schema for several (their intersection), or `undefined` for none. */
function combine(schemas: readonly SchemaIR[]): SchemaIR | undefined {
  const constrained = schemas.filter((schema) => !isNeutral(schema));
  const [first, ...others] = constrained;
  if (first === undefined) return schemas[0];
  return others.length === 0 ? first : { kind: 'intersection', members: constrained };
}

/** An unconstrained schema (`{}`): `T & unknown` is `T`. */
function isNeutral(schema: SchemaIR): boolean {
  return schema.kind === 'unknown' && schema.assertions === undefined && schema.nullable !== true;
}

/** An object value that contributes nothing to an intersection (`{}`). */
function isEmptyObject(value: MockValue): boolean {
  if (value.kind === 'object') return value.spreads.length === 0 && value.entries.length === 0;
  return value.kind === 'json' && isRecord(value.value) && Object.keys(value.value).length === 0;
}

/** An object schema that only requires properties (`dependentRequired`). */
function requiredProperties(names: readonly string[]): SchemaIR {
  return {
    kind: 'object',
    properties: names.map((name) => ({ name, required: true, schema: { kind: 'unknown' } })),
  };
}
