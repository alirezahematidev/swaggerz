/**
 * Where `date` and `date-time` values sit inside a value. Generated per model (only for models
 * that contain dates); references to other models are functions so recursive and mutually
 * dependent models resolve lazily.
 */
export type DateShape =
  | 'date'
  | 'date-time'
  | (() => DateShape)
  | { readonly array: DateShape }
  | { readonly tuple: readonly (DateShape | null)[]; readonly rest?: DateShape }
  | { readonly object: Readonly<Record<string, DateShape>>; readonly rest?: DateShape }
  | { readonly anyOf: readonly DateShape[] }
  | { readonly discriminator: string; readonly mapping: Readonly<Record<string, DateShape>> };

type Mode = 'revive' | 'encode';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function leaf(value: unknown, format: 'date' | 'date-time', mode: Mode): unknown {
  if (mode === 'revive') {
    if (typeof value !== 'string') return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value;
  const iso = value.toISOString();
  // Dates are calendar days at UTC midnight (as `new Date('2026-01-31')` creates them).
  return format === 'date' ? iso.slice(0, 10) : iso;
}

function walk(value: unknown, shape: DateShape, mode: Mode): unknown {
  if (value === null || value === undefined) return value;
  if (typeof shape === 'function') return walk(value, shape(), mode);
  if (shape === 'date' || shape === 'date-time') return leaf(value, shape, mode);
  if ('array' in shape) {
    if (!Array.isArray(value)) return value;
    const items: readonly unknown[] = value;
    return items.map((item) => walk(item, shape.array, mode));
  }
  if ('tuple' in shape) {
    if (!Array.isArray(value)) return value;
    const items: readonly unknown[] = value;
    return items.map((item, index) => {
      const itemShape = index < shape.tuple.length ? shape.tuple[index] : shape.rest;
      return itemShape === null || itemShape === undefined ? item : walk(item, itemShape, mode);
    });
  }
  if ('object' in shape) {
    if (!isObject(value)) return value;
    // Revive mutates freshly parsed data; encode copies so callers' objects stay untouched.
    const target = mode === 'revive' ? value : { ...value };
    for (const key of Object.keys(target)) {
      const fieldShape = Object.prototype.hasOwnProperty.call(shape.object, key)
        ? shape.object[key]
        : shape.rest;
      if (fieldShape !== undefined) target[key] = walk(target[key], fieldShape, mode);
    }
    return target;
  }
  if ('discriminator' in shape) {
    if (!isObject(value)) return value;
    const tag = value[shape.discriminator];
    // Own properties only: a tag such as `__proto__` must not reach `Object.prototype`.
    const variant =
      typeof tag === 'string' && Object.prototype.hasOwnProperty.call(shape.mapping, tag)
        ? shape.mapping[tag]
        : undefined;
    return variant === undefined ? value : walk(value, variant, mode);
  }
  // Without a discriminator, every variant's dates are converted.
  let result: unknown = value;
  for (const variant of shape.anyOf) result = walk(result, variant, mode);
  return result;
}

/** Converts `date`/`date-time` strings of response data to `Date` objects (in place). */
export function reviveDates(value: unknown, shape: DateShape): unknown {
  return walk(value, shape, 'revive');
}

/**
 * Converts `Date` values to their wire form: `YYYY-MM-DD` for `date` and ISO 8601 for
 * `date-time`. Returns a copy; the input is not modified.
 */
export function encodeDates(value: unknown, shape: DateShape): unknown {
  return walk(value, shape, 'encode');
}
