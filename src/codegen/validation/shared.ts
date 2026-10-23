import type { ModelSymbol } from '../../analysis/types.ts';
import type { ValidationLibrary } from '../../config/types.ts';
import type { SchemaIR } from '../../ir/types.ts';
import type { EmitContext, ModuleOutput } from '../context.ts';
import type { ImportManager, Lang } from '../imports.ts';

/**
 * What the operation generator and the schema modules need from a validation library. Each
 * library prints schemas in its own idiom; the choice of which schema validates what is shared.
 */
export interface Validator {
  readonly library: ValidationLibrary;
  /** Display name, e.g. `Zod`. */
  readonly label: string;
  /** Expression for `schema` evaluated when data is validated: references need no deferral. */
  inline(schema: SchemaIR, imports: ImportManager, ctx: EmitContext): string;
  union(members: readonly string[], imports: ImportManager): string;
  unknown(imports: ImportManager): string;
  undefined(imports: ImportManager): string;
  blob(imports: ImportManager): string;
  /** An expression that validates `value` with `schema` and returns it, or throws. */
  parse(schema: string, value: string, imports: ImportManager): string;
  /** The schema module of a model (`zod/pet`, `valibot/pet`, `arktype/pet`). */
  model(model: ModelSymbol, ctx: EmitContext): ModuleOutput | undefined;
  /** Modules shared by the schema modules (ArkType's reference helpers). */
  support?(ctx: EmitContext): ModuleOutput[];
}

/**
 * The type a model's schema validates: the model type, or `unknown` with `types.dates: 'Date'`
 * for models containing dates (schemas check the wire format, where dates are strings).
 */
export function wireType(model: ModelSymbol, imports: ImportManager): string {
  return model.datesName === undefined
    ? imports.add(model.module, model.name, { typeOnly: true })
    : 'unknown';
}

type ObjectSchema = Extract<SchemaIR, { kind: 'object' }>;

/**
 * RFC 3339 `date-time` (the separator and the UTC designator may be lower case), as a regular
 * expression literal. Validators also check that the value is a real date (`Date.parse`).
 */
export const DATE_TIME_PATTERN =
  '/^\\d{4}-\\d{2}-\\d{2}[Tt]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:[Zz]|[+-]\\d{2}:\\d{2})$/';

/** A predicate on a string: a date `Date.parse` understands. */
export const VALID_DATE = '(value) => !Number.isNaN(Date.parse(value))';

/**
 * Names every object inherits from `Object.prototype`. The libraries look properties up with
 * `key in value`, which finds them on objects that omit them, so optional properties with these
 * names need their own check.
 */
const INHERITED_NAMES: ReadonlySet<string> = new Set([
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  '__proto__',
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
]);

/** Whether an optional property of the object has a name every object inherits. */
export function isInheritedOptional(property: ObjectSchema['properties'][number]): boolean {
  return !property.required && INHERITED_NAMES.has(property.name);
}

/**
 * A function copying a plain object onto a `null` prototype, so that `key in value` only finds
 * its own properties; other values are returned as they are.
 */
export function ownPropertiesFunction(lang: Lang): string {
  const empty =
    lang === 'js'
      ? '/** @type {object} */ (Object.create(null))'
      : '(Object.create(null) as object)';
  const param = lang === 'js' ? '/** @param {unknown} value */ (value)' : '(value: unknown)';
  return `${param} =>\n  typeof value === 'object' && value !== null && !Array.isArray(value)\n    ? Object.assign(${empty}, value)\n    : value`;
}

/** Whether a schema accepts every value, e.g. a union with an unconstrained member. */
export function acceptsAnything(schema: SchemaIR): boolean {
  if (schema.assertions !== undefined) return false;
  if (schema.kind === 'unknown') return true;
  return schema.kind === 'union' && schema.variants.some(acceptsAnything);
}

/** The object schema `schema` is, directly or through a reference to a model. */
export function objectView(schema: SchemaIR, ctx: EmitContext): ObjectSchema | undefined {
  if (schema.kind === 'object') return schema;
  if (schema.kind !== 'ref') return undefined;
  const target = ctx.project.modelById.get(schema.target)?.definition.schema;
  return target?.kind === 'object' && schema.nullable !== true ? target : undefined;
}

/**
 * `allOf` members as the TypeScript intersection type reads them: a member's
 * `additionalProperties: false` does not reject the properties other members declare, because the
 * member's TypeScript type (`{ a: string }`) cannot express it. Such closed members become open
 * (`relaxed`); when every member is closed, properties none of them declares are still rejected
 * (`closedKeys`). A closed member without properties keeps rejecting every property, as its type
 * (`Record<string, never>`) does. Zod intersections behave like this on their own.
 *
 * `inlined` holds the models already copied on the way to this `allOf`; the members must be
 * printed with the returned `inlined`. A model whose copy contains this `allOf` again (a closed
 * model that refers to itself through `allOf`) is copied once and referenced, closed, below that.
 */
export function intersectionMembers(
  members: readonly SchemaIR[],
  ctx: EmitContext,
  inlined: ReadonlySet<string> = new Set(),
): {
  readonly relaxed: readonly SchemaIR[];
  readonly closedKeys?: readonly string[];
  readonly inlined: ReadonlySet<string>;
} {
  const views = members.map((member) =>
    member.kind === 'ref' && inlined.has(member.target) ? undefined : objectView(member, ctx),
  );
  const relaxable = (view: ObjectSchema | undefined): view is ObjectSchema =>
    view?.additionalProperties === false && view.properties.length > 0;
  if (members.length < 2 || !views.some(relaxable)) return { relaxed: members, inlined };
  const copied = new Set(inlined);
  const relaxed = members.map((member, index) => {
    const view = views[index];
    if (!relaxable(view)) return member;
    // A reference to a closed model is replaced by an open copy of the model's object.
    if (member.kind === 'ref') copied.add(member.target);
    const { additionalProperties: _closed, ...open } = view;
    return open satisfies ObjectSchema;
  });
  if (!views.every(relaxable)) return { relaxed, inlined: copied };
  const keys = [...new Set(views.flatMap((view) => view.properties.map((p) => p.name)))];
  return { relaxed, closedKeys: keys, inlined: copied };
}
