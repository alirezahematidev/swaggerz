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
import {
  dateNear,
  Fake,
  generateText,
  matchesPattern,
  Random,
  samplePattern,
  type DateWhen,
  type FixtureOptions,
  type TextKind,
  type XmlShape,
} from '../../templates/mocks/fake.ts';
import { getOwn, isRecord, setOwn, stableStringify } from '../../utils/object.ts';
import type { EmitContext } from '../context.ts';
import { inheritedDiscriminators } from '../models.ts';
import type { ResponseKind } from '../operation-plan.ts';
import { isXml, xmlShape } from './encodings.ts';
import {
  booleanRate,
  dateWhen,
  isCollection,
  isPageProperty,
  numberRange,
  singular,
  textKind,
} from './semantics.ts';

/**
 * How a fixture makes a value: a recipe printed as calls of the `Fake` of `mocks/fake.ts`. Every
 * generated node carries the value it makes for the examples (seed `0`) and how to vary it for
 * other seeds; `key` names the value within its fixture, which seeds the variation.
 */
export type MockValue =
  // Constants.
  /** `literal`: the value's type is a literal type (`'cat'`, `true`), which it keeps. */
  | { readonly kind: 'json'; readonly value: JsonValue; readonly literal?: boolean }
  /** `new Date(value)` (with `types.dates: 'Date'`). */
  | { readonly kind: 'date'; readonly value: string }
  /** A call of the model's fixture factory (`makePet(undefined, f.at(key))`). */
  | { readonly kind: 'fixture'; readonly model: string; readonly key: string }
  /** `{ ...spreads, key: value }`; `optional` properties are left out by some seeds. */
  | {
      readonly kind: 'object';
      readonly spreads: readonly MockValue[];
      readonly entries: readonly (readonly [string, MockValue])[];
      readonly optional?: readonly string[];
      readonly path?: string;
      /** The entry that is the fixture's `id`, remembered so requests for it get the fixture. */
      readonly id?: string;
    }
  | { readonly kind: 'array'; readonly items: readonly MockValue[] }
  /** No value can satisfy the schema. */
  | { readonly kind: 'never' }
  // Generated.
  | {
      readonly kind: 'text';
      readonly key: string;
      readonly value: string;
      readonly text: TextKind;
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly kind: 'pattern';
      readonly key: string;
      readonly value: string;
      readonly pattern: string;
      readonly min: number;
      readonly max: number;
      readonly text?: TextKind;
    }
  | {
      readonly kind: 'int';
      readonly key: string;
      readonly value: number;
      readonly min: number;
      readonly max: number;
    }
  | {
      readonly kind: 'number';
      readonly key: string;
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly digits: number;
      readonly exclusive: 'none' | 'min' | 'max' | 'both';
    }
  | {
      readonly kind: 'multiple';
      readonly key: string;
      readonly value: number;
      readonly first: number;
      readonly last: number;
      readonly step: number;
      readonly digits: number;
    }
  | { readonly kind: 'bool'; readonly key: string; readonly value: boolean; readonly rate: number }
  | {
      readonly kind: 'when';
      readonly key: string;
      readonly value: string;
      readonly format: 'date' | 'date-time' | 'time';
      readonly when: DateWhen;
      /** A `Date` (`types.dates: 'Date'`) rather than its string. */
      readonly asDate: boolean;
    }
  | {
      readonly kind: 'pick';
      readonly key: string;
      readonly values: readonly [JsonValue, ...JsonValue[]];
    }
  | { readonly kind: 'oneOf'; readonly key: string; readonly options: readonly MockValue[] }
  | { readonly kind: 'nullable'; readonly key: string; readonly value: MockValue }
  /** `count` items for the examples, `min` to `max` otherwise, each made by `item`. */
  | {
      readonly kind: 'list';
      readonly key: string;
      readonly count: number;
      readonly min: number;
      readonly max: number;
      readonly item: MockValue;
      readonly unique: boolean;
    }
  /** Generated keys of a map (`additionalProperties`). */
  | {
      readonly kind: 'record';
      readonly key: string;
      readonly count: number;
      readonly min: number;
      readonly max: number;
      readonly value: MockValue;
    }
  /** File content of a media type: a picture, a PDF… */
  | { readonly kind: 'file'; readonly key: string; readonly mediaType: string }
  /** The specification's example (a constant) for seed `0`, `make` otherwise. */
  | { readonly kind: 'example'; readonly value: MockValue; readonly make: MockValue }
  /** A value written as XML, or items as a sequential media type (JSON Lines, SSE…). */
  | {
      readonly kind: 'encoded';
      readonly encoding: 'xml' | 'sequence';
      readonly value: MockValue;
      readonly mediaType: string;
      readonly shape?: XmlShape;
    };

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

/** What a value is, beyond its schema: where it sits and what its name says. */
interface Leaf {
  /** The value's key within its fixture (`owner.name`); `''` for the fixture's own value. */
  readonly key: string;
  /** The property name, which suggests realistic values (`email`, `price`). */
  readonly name?: string | undefined;
  /** The model or property the value belongs to (`name` of a `User`). */
  readonly owner?: string | undefined;
  /** The items of a list or a page: there are more of them. */
  readonly collection?: boolean;
  /** A fixture's own value, whose `id` is remembered. */
  readonly root?: boolean;
  /** The media type of a binary value. */
  readonly mediaType?: string;
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

/** A `Blob` in an evaluated value. */
const BLOB = Symbol('blob');
/** A fixture call in a shallow evaluated value: assumed to match (checked on its own). */
const ANY = Symbol('any');

const MAX_HOPS = 64;
const MAX_ITEMS = 100;
/** Nested `allOf` merges around one value. */
const MAX_INLINE = 8;
/** The seeds every fixture is tried with before its values vary: those that fail stay constant. */
const TRIALS: readonly FixtureOptions[] = [
  ...Array.from({ length: 8 }, (_, index) => ({ seed: index + 1 })),
  { seed: 0, empty: true },
  { seed: 5, empty: true },
];
/** The `Fake` of the examples. */
const CANONICAL = new Fake();

const json = (value: JsonValue): MockValue => ({ kind: 'json', value });
/** A constant whose type is its literal type: a discriminator value, a `const` or an enum value. */
const literal = (value: JsonValue): MockValue =>
  value === null || typeof value === 'object'
    ? json(value)
    : { kind: 'json', value, literal: true };

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
/** Properties that identify a fixture. */
const IDS = new Set(['id', '_id', 'uuid']);

/**
 * Generates fixture recipes: examples from the specification where they fit their schema, and
 * realistic values that satisfy it for other seeds. Every recipe is tried with a few seeds against
 * its schema; one that fails keeps its examples for every seed. One sampler serves a whole
 * generation, so every model is sampled (and every problem reported) once.
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

  /** The recipe of a model's fixture factory. */
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
    let value = this.#sample(model.definition.schema, model.id, scope, {
      key: '',
      owner: model.name,
      root: true,
    });
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
      if (tag !== undefined) value = withEntry(value, property, literal(tag));
    }
    value = this.#settle(value, model.definition.schema, scope);
    this.#inProgress.delete(model.id);
    this.#fixtures.set(model.id, value);
    return value;
  }

  /** Whether a model's fixture takes overrides: its type is one object type and so is its value. */
  takesOverrides(model: ModelSymbol): boolean {
    return this.overridable(model.definition.schema) && isObjectRecipe(this.fixture(model));
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
    const random = Random.of(label);
    if (kind === 'binary') return { kind: 'file', key: '', mediaType: media.mediaType };
    const example = media.examples.find((e) => e.value !== undefined)?.value;
    if (kind === 'text') {
      if (typeof example === 'string') return json(example);
      // Sequential media types (OpenAPI 3.2 `itemSchema`): items, written as the type writes them.
      if (media.itemSchema !== undefined) {
        const items: SchemaIR = { kind: 'array', items: media.itemSchema };
        const value = this.#sample(items, label, scope, { key: '', collection: true });
        if (value !== undefined)
          return {
            kind: 'encoded',
            encoding: 'sequence',
            mediaType: media.mediaType,
            value: this.#settle(value, items, scope),
          };
      }
      const schema = media.schema;
      const textual =
        schema.kind === 'string' ||
        (schema.kind === 'enum' && schema.values.every((v) => typeof v === 'string'));
      if (textual) return this.#sample(schema, label, scope, { key: '' }) ?? json('');
      // XML: a value of the schema, written as its XML Objects describe.
      if (isXml(media.mediaType)) {
        const value = this.#sample(schema, label, scope, { key: '', collection: true });
        if (value !== undefined)
          return {
            kind: 'encoded',
            encoding: 'xml',
            mediaType: media.mediaType,
            value: this.#settle(value, schema, scope),
            shape: this.xmlShape(schema),
          };
      }
      return json(generateText('paragraph', random));
    }
    const leaf: Leaf = { key: '', collection: true };
    if (example !== undefined) {
      if (this.#conforms(example, media.schema)) {
        const constant = this.#fromJson(example, media.schema);
        const make = this.#sample(media.schema, label, scope, leaf);
        return make === undefined
          ? constant
          : this.#settle({ kind: 'example', value: constant, make }, media.schema, scope);
      }
      this.#invalidExample(scope, label, 'example');
    }
    const value = this.#sample(media.schema, label, scope, leaf) ?? { kind: 'never' };
    return this.#settle(value, media.schema, scope);
  }

  /** The recipe of a value of `schema` that is not a model's, e.g. a webhook request. */
  value(schema: SchemaIR, label: string, source: SourceRef | undefined, owner: string): MockValue {
    const scope: Scope = {
      label,
      root: label,
      source,
      cycle: new Set(),
      flags: { risky: false },
      inline: { depth: 0 },
    };
    const value = this.#sample(schema, label, scope, { key: '', owner }) ?? { kind: 'never' };
    return this.#settle(value, schema, scope);
  }

  /** A string for a response header, or `undefined` when the header has no simple value. */
  headerValue(
    schema: SchemaIR,
    label: string,
    source: SourceRef,
    name: string,
  ): string | undefined {
    const scope: Scope = {
      label,
      root: label,
      source,
      cycle: new Set(),
      flags: { risky: false },
      inline: { depth: 0 },
    };
    const value = this.#sample(schema, label, scope, { key: '', name });
    const data = value === undefined ? undefined : this.#evaluate(value, CANONICAL, true);
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean')
      return String(data);
    if (Array.isArray(data) && data.every((item) => typeof item !== 'object' || item === null))
      return data.map(String).join(',');
    return undefined;
  }

  #names: ReadonlyMap<string, string> | undefined;

  /** Model names by definition id, which name XML root elements. */
  #modelNames(): ReadonlyMap<string, string> {
    this.#names ??= new Map(this.#ctx.project.models.map((model) => [model.id, model.name]));
    return this.#names;
  }

  /** How values of `schema` are written in XML. */
  xmlShape(schema: SchemaIR): XmlShape {
    return xmlShape(schema, this.#definitions, this.#modelNames());
  }

  /** The properties of an object type (through references and `allOf`), by name. */
  objectProperties(schema: SchemaIR): ReadonlyMap<string, SchemaIR> {
    return this.#objectView(schema, 0).properties;
  }

  /** The items of an array type (through references), or `undefined` for other types. */
  arrayItemsOf(schema: SchemaIR, hops = 0): SchemaIR | undefined {
    if (hops > MAX_HOPS) return undefined;
    if (schema.kind === 'array') return schema.prefixItems === undefined ? schema.items : undefined;
    if (schema.kind !== 'ref') return undefined;
    const target = this.#definitions.get(schema.target)?.schema;
    return target === undefined ? undefined : this.arrayItemsOf(target, hops + 1);
  }

  /** `'string'` or `'number'` for schemas of plain strings (not dates) or numbers. */
  scalarType(schema: SchemaIR, hops = 0): 'string' | 'number' | undefined {
    if (hops > MAX_HOPS) return undefined;
    if (schema.kind === 'string') return dateFormat(schema) === undefined ? 'string' : undefined;
    if (schema.kind === 'number' || schema.kind === 'integer') return 'number';
    if (schema.kind !== 'ref') return undefined;
    const target = this.#definitions.get(schema.target)?.schema;
    return target === undefined ? undefined : this.scalarType(target, hops + 1);
  }

  /**
   * Checks a root value: a value that does not match its schema is cast; one whose variants do
   * not all match keeps its examples for every seed.
   */
  #settle(value: MockValue, schema: SchemaIR, scope: Scope): MockValue {
    this.#check(value, schema, scope);
    const unfit = scope.flags.risky || this.#unfit.has(value);
    if (!unfit && (!varies(value) || this.#verify(value, schema))) return value;
    const frozen = this.#freeze(value, CANONICAL);
    if (unfit) this.#unfit.add(frozen);
    return frozen;
  }

  /** Whether the value every trial seed makes matches the schema. */
  #verify(value: MockValue, schema: SchemaIR): boolean {
    return TRIALS.every((options) => {
      const data = this.#evaluate(value, new Fake(options), false);
      return data === undefined || this.#conforms(data, schema);
    });
  }

  // Sampling --------------------------------------------------------------------------------------

  /**
   * A recipe for `schema`, or `undefined` when every value would call a fixture factory of the
   * root's cycle (and so never return).
   */
  #sample(schema: SchemaIR, path: string, scope: Scope, leaf: Leaf): MockValue | undefined {
    let canonical: JsonValue | undefined;
    const example = schema.examples?.[0];
    if (example !== undefined) {
      if (this.#conforms(example, schema)) canonical = example;
      else this.#invalidExample(scope, path, 'example');
    }
    const scalar =
      schema.kind === 'string' ||
      schema.kind === 'number' ||
      schema.kind === 'integer' ||
      schema.kind === 'boolean' ||
      schema.kind === 'enum';
    if (canonical === undefined && scalar && schema.default !== undefined) {
      if (this.#conforms(schema.default, schema)) canonical = schema.default;
      else this.#invalidExample(scope, path, 'default value');
    }
    // Examples of objects, arrays and references: the example for the examples' seed.
    if (canonical !== undefined && (!scalar || canonical === null)) {
      const constant = this.#fromJson(canonical, schema);
      let make = this.#sampleNode(schema, path, scope, leaf);
      if (make !== undefined && schema.assertions !== undefined)
        make = this.#assert(schema, make, path, scope, leaf);
      return make === undefined || !varies(make)
        ? constant
        : { kind: 'example', value: constant, make };
    }
    const value = this.#sampleNode(schema, path, scope, leaf, canonical);
    if (value === undefined) return undefined;
    const asserted =
      schema.assertions === undefined ? value : this.#assert(schema, value, path, scope, leaf);
    // Nullable values are `null` for some seeds.
    const nullable =
      schema.nullable === true &&
      schema.kind !== 'union' &&
      schema.kind !== 'null' &&
      !(asserted.kind === 'json' && asserted.value === null);
    return nullable ? { kind: 'nullable', key: leaf.key, value: asserted } : asserted;
  }

  /** A recipe for the node itself: no example, default or assertions. */
  #sampleNode(
    schema: SchemaIR,
    path: string,
    scope: Scope,
    leaf: Leaf,
    canonical?: JsonValue,
  ): MockValue | undefined {
    switch (schema.kind) {
      case 'ref': {
        if (scope.cycle.has(schema.target))
          return schema.nullable === true ? json(null) : undefined;
        const model = this.#ctx.project.modelById.get(schema.target);
        return model?.fixtureName === undefined
          ? json(null)
          : { kind: 'fixture', model: model.id, key: leaf.key };
      }
      case 'string':
        return this.#string(schema, path, scope, leaf, canonical);
      case 'number':
      case 'integer':
        return this.#number(schema, path, scope, leaf, canonical);
      case 'boolean': {
        const rate = booleanRate(leaf.name);
        const value =
          typeof canonical === 'boolean'
            ? canonical
            : rate === 0.5
              ? Random.of(path).next() < 0.5
              : rate > 0.5;
        return { kind: 'bool', key: leaf.key, value, rate };
      }
      case 'null':
        return json(null);
      case 'enum':
        return this.#enum(schema, path, scope, leaf, canonical);
      case 'binary':
        return { kind: 'file', key: leaf.key, mediaType: leaf.mediaType ?? '' };
      case 'unknown':
        return json({});
      case 'never':
        this.#report(scope, 'mock/unsatisfiable', `${this.#at(scope, path)} accepts no value.`);
        return { kind: 'never' };
      case 'array':
        return this.#array(schema, path, scope, leaf);
      case 'object':
        return this.#object(schema, path, scope, leaf);
      case 'union':
        return this.#union(schema, path, scope, leaf);
      case 'intersection':
        return this.#intersection(schema, path, scope, leaf);
    }
  }

  #string(
    schema: Extract<SchemaIR, { kind: 'string' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
    canonical: JsonValue | undefined,
  ): MockValue {
    const random = Random.of(path);
    const example = typeof canonical === 'string' ? canonical : undefined;
    const format = dateFormat(schema) ?? (schema.format === 'time' ? 'time' : undefined);
    if (format !== undefined) {
      const when = dateWhen(leaf.name);
      return {
        kind: 'when',
        key: leaf.key,
        value: example ?? dateNear(undefined, format, when, random),
        format,
        when,
        asDate: format !== 'time' && this.#ctx.config.types.dates === 'Date',
      };
    }
    const c = schema.constraints ?? {};
    const min = c.minLength ?? 0;
    const max = c.maxLength ?? Infinity;
    let kind = textKind(leaf.name, leaf.owner, schema.format, example);
    if (c.contentEncoding === 'base64' || c.contentEncoding === 'base64url') kind = 'base64';
    else if (c.contentMediaType !== undefined && /json/i.test(c.contentMediaType)) kind = 'json';
    const pattern = c.pattern;
    if (pattern !== undefined) {
      let value = example;
      // Realistic text of the property's kind when it matches, otherwise any matching string.
      if (kind !== undefined)
        for (let attempt = 0; value === undefined && attempt < 5; attempt++) {
          const candidate = generateText(kind, random, '', min, max);
          if (matchesPattern(pattern, candidate) === true) value = candidate;
        }
      value ??= samplePattern(pattern, random, min, max);
      if (value !== undefined)
        return {
          kind: 'pattern',
          key: leaf.key,
          value,
          pattern,
          min,
          max,
          ...(kind === undefined ? {} : { text: kind }),
        };
      this.#report(
        scope,
        'mock/unsupported-pattern',
        `No string matching the pattern of ${this.#at(scope, path)} could be generated; the fixture does not match it.`,
        'Add an `example` that matches the pattern.',
        'info',
      );
    }
    const text = kind ?? (example === undefined ? 'words' : 'like');
    return {
      kind: 'text',
      key: leaf.key,
      value: example ?? generateText(text, random, '', min, max),
      text,
      min,
      max,
    };
  }

  #number(
    schema: Extract<SchemaIR, { kind: 'number' | 'integer' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
    canonical: JsonValue | undefined,
  ): MockValue {
    const random = Random.of(path);
    const integer = schema.kind === 'integer';
    const example = typeof canonical === 'number' ? canonical : undefined;
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
    const range = numberRange(leaf.name, integer);
    if (range !== undefined && Math.max(low, range.min) <= Math.min(high, range.max)) {
      // The name's range, where the schema allows it.
      if (range.min > low) [low, lowOpen] = [range.min, false];
      if (range.max < high) [high, highOpen] = [range.max, false];
    } else if (low === -Infinity && high === Infinity && example !== undefined) {
      // Around the example.
      const size = Math.max(Math.abs(example), 10);
      [low, high] =
        example >= 0
          ? [Math.max(0, example - size), example + size]
          : [example - size, example + size];
    }
    // Without bounds, values between 1 and 100 (1000 for numbers); next to one bound, within 1000
    // of it (and not negative below a positive maximum).
    if (low === -Infinity && high === Infinity) [low, high] = [1, integer ? 100 : 1000];
    else if (low === -Infinity) low = high > 0 ? 0 : high - 1000;
    else if (high === Infinity) high = low + (integer ? 100 : 1000);
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
      if (first <= last) {
        const value = example ?? round(random.int(first, last) * step, digits);
        return step === 1 && c.multipleOf === undefined
          ? { kind: 'int', key: leaf.key, value, min: first, max: last }
          : { kind: 'multiple', key: leaf.key, value, first, last, step, digits };
      }
    } else {
      const digits = range?.digits ?? 2;
      const exclusive = lowOpen ? (highOpen ? 'both' : 'min') : highOpen ? 'max' : 'none';
      let value = example ?? round(low + random.next() * (high - low), digits);
      if (!fits(value)) value = (low + high) / 2;
      if (fits(value))
        return { kind: 'number', key: leaf.key, value, min: low, max: high, digits, exclusive };
    }
    this.#report(
      scope,
      'mock/unsatisfiable',
      `No number satisfies the bounds of ${this.#at(scope, path)}.`,
    );
    return json(example ?? (Number.isFinite(low) ? low : 0));
  }

  #enum(
    schema: Extract<SchemaIR, { kind: 'enum' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
    canonical: JsonValue | undefined,
  ): MockValue {
    const values = [
      ...schema.values.filter((v) => v !== null),
      ...schema.values.filter((v) => v === null),
    ];
    // The example comes first: it is the examples' value.
    if (canonical !== undefined) {
      const key = stableStringify(canonical);
      const index = values.findIndex((v) => stableStringify(v) === key);
      if (index > 0) values.unshift(...values.splice(index, 1));
    }
    const [first, ...rest] = values;
    if (first === undefined) {
      this.#report(scope, 'mock/unsatisfiable', `${this.#at(scope, path)} has an empty enum.`);
      return { kind: 'never' };
    }
    // Objects and arrays among the values stay constant: their literal types would widen.
    if (rest.length === 0 || values.some((v) => typeof v === 'object' && v !== null))
      return literal(first);
    return { kind: 'pick', key: leaf.key, values: [first, ...rest] };
  }

  #array(
    schema: Extract<SchemaIR, { kind: 'array' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
  ): MockValue | undefined {
    const prefix = schema.prefixItems ?? [];
    const minItems = schema.constraints?.minItems ?? 0;
    const maxItems = schema.constraints?.maxItems ?? Infinity;
    if (minItems > MAX_ITEMS)
      this.#report(
        scope,
        'mock/unsatisfiable',
        `${this.#at(scope, path)} requires more than ${MAX_ITEMS} items.`,
      );
    const itemName = leaf.name === undefined ? undefined : singular(leaf.name);
    const itemLeaf = (key: string): Leaf => ({ key, name: itemName, owner: leaf.owner });
    // Tuples need every prefix item (their type does), and the items `minItems` adds.
    if (prefix.length > 0) {
      const count = Math.min(
        Math.max(prefix.length, minItems),
        Math.max(maxItems, prefix.length),
        MAX_ITEMS,
      );
      const items: MockValue[] = [];
      for (let index = 0; index < count; index++) {
        const item = this.#sample(
          prefix[index] ?? schema.items,
          `${path}/${index}`,
          scope,
          itemLeaf(`${leaf.key}[${index}]`),
        );
        if (item === undefined) {
          if (index < Math.max(minItems, prefix.length)) return undefined;
          break;
        }
        if (item.kind === 'never' && index >= Math.max(minItems, prefix.length)) break;
        items.push(item);
      }
      return { kind: 'array', items };
    }
    if (schema.items.kind === 'never') return json([]);
    const item = this.#sample(schema.items, `${path}/items`, scope, itemLeaf(''));
    // Items that lead back to the root, or cannot have a value, are left out where they may be.
    if (item === undefined) return minItems > 0 ? undefined : json([]);
    if (item.kind === 'never' && minItems === 0) return json([]);
    const collection = leaf.collection === true || isCollection(leaf.name);
    const objects = this.#objectLike(schema.items, 0);
    const [usual, most] = collection ? [6, 12] : objects ? [2, 4] : [1, 3];
    const unique = schema.constraints?.uniqueItems === true;
    // Unique items of an enum or a boolean: there are only so many.
    const distinct = unique ? this.#distinct(schema.items) : Infinity;
    const min = Math.min(minItems, MAX_ITEMS);
    const max = Math.max(min, Math.min(maxItems, Math.max(most, min), distinct, MAX_ITEMS));
    const count = Math.min(Math.max(usual, min), max);
    return { kind: 'list', key: leaf.key, count, min, max, item, unique };
  }

  /** How many different values a schema has, when that is a small number. */
  #distinct(schema: SchemaIR, hops = 0): number {
    if (hops > MAX_HOPS) return Infinity;
    if (schema.kind === 'enum') return schema.values.length;
    if (schema.kind === 'boolean') return schema.nullable === true ? 3 : 2;
    if (schema.kind === 'ref') {
      const target = this.#definitions.get(schema.target)?.schema;
      return target === undefined ? Infinity : this.#distinct(target, hops + 1);
    }
    return Infinity;
  }

  #object(schema: ObjectSchema, path: string, scope: Scope, leaf: Leaf): MockValue | undefined {
    const maxProperties = schema.constraints?.maxProperties ?? Infinity;
    const minProperties = schema.constraints?.minProperties ?? 0;
    // Leaving properties out could break `minProperties` or `maxProperties`.
    const droppable = minProperties === 0 && maxProperties === Infinity;
    let budget = maxProperties - schema.properties.filter((p) => p.required).length;
    // A page: its array holds the listed items (`{ users: [...], total, nextCursor }`).
    const page = schema.properties.some((p) => isPageProperty(p.name));
    const entries: (readonly [string, MockValue])[] = [];
    const optional: string[] = [];
    for (const property of schema.properties) {
      if (!property.required && (budget <= 0 || property.schema.kind === 'never')) continue;
      const value = this.#sample(
        property.schema,
        `${path}/${property.name}`,
        scope,
        page ? { ...child(leaf, property.name), collection: true } : child(leaf, property.name),
      );
      if (value === undefined) {
        if (property.required) return undefined;
        continue;
      }
      // An optional property that cannot have a value is left out.
      if (value.kind === 'never' && !property.required) continue;
      if (!property.required) {
        budget--;
        if (droppable) optional.push(property.name);
      }
      entries.push([property.name, value]);
    }
    const spreads: MockValue[] = [];
    const additional = schema.additionalProperties;
    // Only types with an index signature accept other properties in an object literal.
    if (additional !== undefined && additional !== false) {
      const missing = Math.max(0, minProperties - entries.length);
      const value = this.#sample(additional, `${path}/*`, scope, {
        key: '',
        owner: leaf.name ?? leaf.owner,
      });
      if (schema.properties.length === 0 && value !== undefined && value.kind !== 'never') {
        // A map: a few generated keys.
        const max = Math.max(missing, Math.min(maxProperties, 3));
        spreads.push({
          kind: 'record',
          key: leaf.key,
          count: Math.min(Math.max(missing, 2), max),
          min: missing,
          max,
          value,
        });
      } else {
        for (let index = 1; entries.length < minProperties && index <= MAX_ITEMS; index++) {
          const key = `property${index}`;
          if (schema.properties.some((p) => p.name === key)) continue;
          const extra = this.#sample(additional, `${path}/${key}`, scope, child(leaf, key));
          if (extra === undefined) break;
          entries.push([key, extra]);
        }
      }
    }
    const id = leaf.root === true ? entries.find(([name]) => IDS.has(name))?.[0] : undefined;
    return {
      kind: 'object',
      spreads,
      entries,
      ...(optional.length === 0 ? {} : { optional, path: leaf.key }),
      ...(id === undefined ? {} : { id }),
    };
  }

  #union(
    schema: Extract<SchemaIR, { kind: 'union' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
  ): MockValue | undefined {
    const discriminator = schema.discriminator;
    let impossible = false;
    const options: MockValue[] = [];
    for (const variant of schema.variants.filter((v) => v.kind !== 'null')) {
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
      const value = this.#sample(variant, path, scope, leaf);
      if (value === undefined) continue;
      if (tag === undefined || discriminator === undefined) {
        options.push(value);
      } else if (!this.#isObjectValue(value)) {
        // A value that cannot be spread (a fixture of a nullable model) is used untagged.
        scope.flags.risky = true;
        options.push(value);
      } else {
        options.push(withEntry(value, discriminator.propertyName, literal(tag)));
      }
    }
    const nullable = schema.nullable === true || schema.variants.some((v) => v.kind === 'null');
    const [first] = options;
    if (first === undefined) {
      if (nullable) return json(null);
      if (!impossible) return undefined;
      this.#report(
        scope,
        'mock/unsatisfiable',
        `No variant of ${this.#at(scope, path)} can have its discriminator value: each one's \`${discriminator?.propertyName ?? ''}\` excludes the value the mapping gives it.`,
        'Correct the discriminator mapping, or the values the variants allow.',
      );
      return { kind: 'never' };
    }
    const value: MockValue =
      options.length === 1 ? first : { kind: 'oneOf', key: leaf.key, options };
    return nullable ? { kind: 'nullable', key: leaf.key, value } : value;
  }

  #intersection(
    schema: Extract<SchemaIR, { kind: 'intersection' }>,
    path: string,
    scope: Scope,
    leaf: Leaf,
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
          leaf,
        );
      } finally {
        scope.inline.depth--;
      }
    }
    const sampled: MockValue[] = [];
    for (const member of schema.members) {
      const value = this.#sample(member, path, scope, leaf);
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
      const data = this.#evaluate(part, CANONICAL, true);
      return data !== undefined && this.#conforms(data, schema);
    });
    // Values of one kind type as the members do (`string & 'START'`); a `Date` next to a string
    // (`Date & string`) does not.
    if (fitting === undefined || parts.some((part) => scalarKind(part) !== scalarKind(fitting)))
      scope.flags.risky = true;
    return this.#freeze(fitting ?? first ?? { kind: 'never' }, CANONICAL);
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
      case 'example':
        return this.#isObjectValue(value.value) && this.#isObjectValue(value.make);
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
   * the schemas they select merged in, and `not` by trying other values. The result is constant:
   * other values could select other branches.
   */
  #assert(schema: SchemaIR, value: MockValue, path: string, scope: Scope, leaf: Leaf): MockValue {
    const assertions = schema.assertions;
    if (assertions === undefined) return value;
    const base = withoutAssertions(schema);
    let refined = base;
    let current = value;
    const data = this.#evaluate(current, CANONICAL, true);
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
      if (refined !== base) current = this.#sampleNode(refined, path, scope, leaf) ?? current;
    }
    const not = assertions.not;
    if (not !== undefined) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const sampled = this.#evaluate(current, CANONICAL, true);
        if (sampled === undefined || !this.#conforms(sampled, not)) break;
        current = this.#sampleNode(refined, `${path}#${attempt}`, scope, leaf) ?? current;
      }
    }
    return this.#freeze(current, CANONICAL);
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
      const uniqueItems = a.uniqueItems === true || b.uniqueItems === true;
      return {
        ...base,
        items: this.#merge(base.items, extra.items, hops + 1),
        constraints: {
          ...(minItems > 0 ? { minItems } : {}),
          ...(maxItems < Infinity ? { maxItems } : {}),
          ...(uniqueItems ? { uniqueItems } : {}),
        },
      };
    }
    if (base.kind === 'intersection') return { ...base, members: [...base.members, extra] };
    // Schemas that cannot be combined keyword by keyword are sampled as their intersection.
    return { kind: 'intersection', members: [base, withoutAssertions(extra)] };
  }

  // Examples --------------------------------------------------------------------------------------

  /**
   * Whether an (evaluated) value matches a schema: the checks the generated validators make, the
   * shape the generated types require, and `uniqueItems`. Patterns and formats other than dates
   * are not checked: validators do not enforce them, and patterns would have to be executed.
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
        if (c.uniqueItems === true && !items.includes(ANY)) {
          const keys = items.map((item) => stableStringify(item as JsonValue));
          if (new Set(keys).size !== keys.length) return false;
        }
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
        const c = schema.constraints ?? {};
        const count = Object.keys(value).length;
        if (count < (c.minProperties ?? 0) || count > (c.maxProperties ?? Infinity)) return false;
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
   * A JSON example as a constant of `schema`'s type: properties the type does not declare are
   * left out (object literals cannot have them), dates become `Date` values with
   * `types.dates: 'Date'`.
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
      case 'enum':
        return literal(value);
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
   * The value a recipe makes with `fake`, as the printed code would (`Blob`s as a marker).
   * Fixture calls are followed when `deep`, and otherwise assumed to match (each fixture is
   * checked on its own). `undefined` when the value cannot be computed (`never`, or a fixture
   * that is being generated).
   */
  #evaluate(value: MockValue, fake: Fake, deep: boolean): unknown {
    const items = (list: readonly unknown[]): unknown =>
      list.includes(undefined) ? undefined : list;
    switch (value.kind) {
      case 'json':
      case 'date':
        return value.value;
      case 'file':
        return BLOB;
      case 'never':
        return undefined;
      case 'fixture': {
        if (!deep) return ANY;
        const model = this.#ctx.project.modelById.get(value.model);
        if (model === undefined || this.#inProgress.has(model.id)) return undefined;
        return this.#evaluate(this.fixture(model), new Fake(fake.at(value.key)), deep);
      }
      case 'array':
        return items(value.items.map((item) => this.#evaluate(item, fake, deep)));
      case 'object': {
        const result: Record<string, unknown> = {};
        // Spreads are followed even in shallow mode: the entries next to them are checked against
        // a schema that also requires the spread's properties.
        for (const spread of value.spreads) {
          const data = this.#evaluate(spread, fake, true);
          if (data === undefined) return deep ? undefined : ANY;
          if (isRecord(data))
            for (const [key, item] of Object.entries(data)) setOwn(result, key, item);
        }
        for (const [key, item] of value.entries) {
          const data = this.#evaluate(item, fake, deep);
          if (data === undefined) return undefined;
          setOwn(result, key, data);
        }
        return value.optional === undefined
          ? result
          : fake.optional(value.path ?? '', result, value.optional);
      }
      case 'text':
        return fake.text(value.key, value.value, value.text, value.min, value.max);
      case 'pattern':
        return fake.pattern(
          value.key,
          value.value,
          value.pattern,
          value.min,
          value.max,
          value.text,
        );
      case 'int':
        return fake.int(value.key, value.value, value.min, value.max);
      case 'number':
        return fake.number(
          value.key,
          value.value,
          value.min,
          value.max,
          value.digits,
          value.exclusive,
        );
      case 'multiple':
        return fake.multiple(
          value.key,
          value.value,
          value.first,
          value.last,
          value.step,
          value.digits,
        );
      case 'bool':
        return fake.bool(value.key, value.value, value.rate);
      case 'when':
        return fake.date(value.key, value.value, value.format, value.when);
      case 'pick':
        return fake.pick(value.key, value.values);
      case 'oneOf':
        return fake.oneOf(value.key, value.options.length, (index) => {
          const option = value.options[index];
          return option === undefined ? undefined : this.#evaluate(option, fake, deep);
        });
      case 'nullable':
        return fake.nullable(value.key, () => this.#evaluate(value.value, fake, deep));
      case 'list':
        return items(
          fake.array(
            value.key,
            value.count,
            value.min,
            value.max,
            (item) => this.#evaluate(value.item, item, deep),
            value.unique,
          ),
        );
      case 'record': {
        const record = fake.record(value.key, value.count, value.min, value.max, (item) =>
          this.#evaluate(value.value, item, deep),
        );
        return Object.values(record).includes(undefined) ? undefined : record;
      }
      case 'example':
        return fake.example((examples) =>
          this.#evaluate(examples ? value.value : value.make, fake, deep),
        );
      // Text, whose value was checked before it was encoded.
      case 'encoded':
        return '';
    }
  }

  /**
   * The constant a recipe makes with `fake`: the same value for every seed. Lists keep the items
   * the fake makes (different ones), fixture calls and files stay, keyed by where they are.
   */
  #freeze(value: MockValue, fake: Fake, prefix = ''): MockValue {
    const at = (key: string): string => `${prefix}${key}`;
    switch (value.kind) {
      case 'json':
      case 'date':
      case 'never':
        return value;
      case 'fixture':
        return { ...value, key: at(value.key) };
      case 'file':
        return { ...value, key: at(value.key) };
      case 'text':
      case 'pattern':
      case 'int':
      case 'number':
      case 'multiple':
      case 'bool':
        return json(this.#evaluate(value, fake, false) as JsonValue);
      case 'pick':
        return literal(fake.pick(value.key, value.values));
      case 'when': {
        const made = fake.date(value.key, value.value, value.format, value.when);
        return value.asDate ? { kind: 'date', value: made } : json(made);
      }
      case 'oneOf':
        return fake.oneOf(value.key, value.options.length, (index) =>
          this.#freeze(value.options[index] ?? { kind: 'never' }, fake, prefix),
        );
      case 'nullable':
        return (
          fake.nullable(value.key, () => this.#freeze(value.value, fake, prefix)) ?? json(null)
        );
      case 'list':
        return {
          kind: 'array',
          items: fake.array(value.key, value.count, value.min, value.max, (item, index) =>
            this.#freeze(value.item, item, `${prefix}${value.key}[${index}].`),
          ),
        };
      case 'record':
        return {
          kind: 'object',
          spreads: [],
          entries: Object.entries(
            fake.record(value.key, value.count, value.min, value.max, (item, name) =>
              this.#freeze(value.value, item, `${prefix}${value.key}{${name}}.`),
            ),
          ),
        };
      case 'object': {
        const entries = value.entries.map(
          ([key, item]) => [key, this.#freeze(item, fake, prefix)] as const,
        );
        const kept = new Set(
          Object.keys(
            value.optional === undefined
              ? Object.fromEntries(entries)
              : fake.optional(value.path ?? '', Object.fromEntries(entries), value.optional),
          ),
        );
        return {
          kind: 'object',
          spreads: value.spreads.map((spread) => this.#freeze(spread, fake, prefix)),
          entries: entries.filter(([key]) => kept.has(key)),
          ...(value.id === undefined ? {} : { id: value.id }),
        };
      }
      case 'array':
        return {
          kind: 'array',
          items: value.items.map((item) => this.#freeze(item, fake, prefix)),
        };
      case 'example':
        return fake.example((examples) =>
          examples ? value.value : this.#freeze(value.make, fake, prefix),
        );
      case 'encoded':
        return { ...value, value: this.#freeze(value.value, fake, prefix) };
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
    const data = this.#evaluate(value, CANONICAL, false);
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
      .map((segment) =>
        /^\d+$/.test(segment) ? `[${segment}]` : segment === 'items' ? '[0]' : `.${segment}`,
      );
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

/** The leaf of a property of an object value. */
function child(leaf: Leaf, name: string): Leaf {
  return {
    key: leaf.key === '' ? name : `${leaf.key}.${name}`,
    name,
    // The properties of a fixture belong to its model; those of an inline object to its property.
    owner: leaf.root === true ? leaf.owner : (leaf.name ?? leaf.owner),
  };
}

/** Whether a recipe is an object literal, or an example of one: such fixtures take overrides. */
export function isObjectRecipe(value: MockValue): boolean {
  return (
    value.kind === 'object' ||
    (value.kind === 'example' && value.value.kind === 'object' && value.make.kind === 'object')
  );
}

/** Whether a recipe makes different values for different seeds. */
export function varies(value: MockValue): boolean {
  switch (value.kind) {
    case 'json':
    case 'date':
    case 'never':
    case 'fixture':
    case 'file':
      return false;
    case 'object':
      return (
        value.optional !== undefined ||
        [...value.spreads, ...value.entries.map(([, v]) => v)].some(varies)
      );
    case 'array':
      return value.items.some(varies);
    case 'encoded':
      return varies(value.value);
    default:
      return true;
  }
}

/** Whether a recipe uses the `Fake` (`f`) of its fixture. */
export function usesFake(value: MockValue): boolean {
  switch (value.kind) {
    case 'json':
    case 'date':
    case 'never':
      return false;
    case 'object':
      return (
        value.optional !== undefined ||
        value.id !== undefined ||
        [...value.spreads, ...value.entries.map(([, v]) => v)].some(usesFake)
      );
    case 'array':
      return value.items.some(usesFake);
    case 'example':
      return true;
    default:
      return true;
  }
}

/** What kind of scalar a constant is, to tell a `Date` from a string. */
function scalarKind(value: MockValue): string {
  return value.kind === 'date' || (value.kind === 'when' && value.asDate) ? 'date' : 'other';
}

/** A value with one more (or replaced) property; values that are not object literals are spread. */
function withEntry(value: MockValue, key: string, entry: MockValue): MockValue {
  if (value.kind === 'object') {
    const optional = value.optional?.filter((name) => name !== key);
    const { optional: _optional, path: _path, ...rest } = value;
    return {
      ...rest,
      entries: [...value.entries.filter(([k]) => k !== key), [key, entry]],
      ...(optional === undefined || optional.length === 0
        ? {}
        : { optional, path: value.path ?? '' }),
    };
  }
  if (value.kind === 'example')
    return {
      kind: 'example',
      value: withEntry(value.value, key, entry),
      make: withEntry(value.make, key, entry),
    };
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
