import { isRecord } from '../utils/object.ts';
import { suggest } from '../utils/strings.ts';

/** A problem found while validating configuration. `path` uses dot notation. */
export interface ConfigIssue {
  readonly path: string;
  readonly message: string;
  readonly hint?: string;
}

/** A JSON Schema (draft 2020-12) fragment describing what a {@link Check} accepts. */
export type JsonSchema = { readonly [keyword: string]: unknown };

/**
 * Validates one value and describes itself as JSON Schema. The same definitions validate configs
 * at runtime and produce `config.schema.json` for editor completion in JSON and YAML configs.
 */
export interface Check {
  (value: unknown, path: string, issues: ConfigIssue[]): void;
  readonly schema: JsonSchema;
  /** Only valid in JavaScript/TypeScript configs (functions); omitted from the JSON Schema. */
  readonly codeOnly?: boolean;
}

function check(
  validate: (value: unknown, path: string, issues: ConfigIssue[]) => void,
  schema: JsonSchema,
  codeOnly = false,
): Check {
  return Object.assign(validate, { schema, ...(codeOnly ? { codeOnly } : {}) });
}

const describe = (value: unknown): string =>
  value === null ? 'null' : Array.isArray(value) ? 'an array' : `a ${typeof value}`;

export const t = {
  string(options: { nonEmpty?: boolean } = {}): Check {
    return check(
      (value, path, issues) => {
        if (typeof value !== 'string') {
          issues.push({ path, message: `Expected a string but received ${describe(value)}.` });
        } else if (options.nonEmpty === true && value.trim() === '') {
          issues.push({ path, message: 'Expected a non-empty string.' });
        }
      },
      { type: 'string', ...(options.nonEmpty === true ? { minLength: 1 } : {}) },
    );
  },
  boolean(): Check {
    return check(
      (value, path, issues) => {
        if (typeof value !== 'boolean') {
          issues.push({ path, message: `Expected a boolean but received ${describe(value)}.` });
        }
      },
      { type: 'boolean' },
    );
  },
  number(options: { min?: number; max?: number; integer?: boolean } = {}): Check {
    return check(
      (value, path, issues) => {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          issues.push({ path, message: `Expected a number but received ${describe(value)}.` });
          return;
        }
        if (options.integer === true && !Number.isInteger(value)) {
          issues.push({ path, message: 'Expected an integer.' });
        }
        if (options.min !== undefined && value < options.min) {
          issues.push({ path, message: `Expected a value >= ${options.min}.` });
        }
        if (options.max !== undefined && value > options.max) {
          issues.push({ path, message: `Expected a value <= ${options.max}.` });
        }
      },
      {
        type: options.integer === true ? 'integer' : 'number',
        ...(options.min === undefined ? {} : { minimum: options.min }),
        ...(options.max === undefined ? {} : { maximum: options.max }),
      },
    );
  },
  literal(...values: readonly (string | number | boolean)[]): Check {
    return check(
      (value, path, issues) => {
        if (!values.includes(value as string | number | boolean)) {
          const list = values.map((v) => JSON.stringify(v)).join(', ');
          const guess = typeof value === 'string' ? suggest(value, values.map(String)) : undefined;
          // YAML and JSON read an unquoted `3.0` as the number 3.
          const quoted =
            typeof value === 'number'
              ? values.find((v) => typeof v === 'string' && v.trim() !== '' && Number(v) === value)
              : undefined;
          const hint =
            quoted !== undefined
              ? `Quote the value: ${JSON.stringify(quoted)} is a string option, but an unquoted ${String(quoted)} is read as a number.`
              : guess === undefined
                ? undefined
                : `Did you mean "${guess}"?`;
          issues.push({
            path,
            message: `Expected one of ${list} but received ${value === undefined ? 'undefined' : typeof value === 'function' ? describe(value) : typeof value === 'number' ? `the number ${JSON.stringify(value)}` : JSON.stringify(value)}.`,
            ...(hint === undefined ? {} : { hint }),
          });
        }
      },
      values.length === 1 ? { const: values[0] } : { enum: values },
    );
  },
  func(): Check {
    return check(
      (value, path, issues) => {
        if (typeof value !== 'function') {
          issues.push({ path, message: `Expected a function but received ${describe(value)}.` });
        }
      },
      {},
      true,
    );
  },
  array(item: Check): Check {
    return check(
      (value, path, issues) => {
        if (!Array.isArray(value)) {
          issues.push({ path, message: `Expected an array but received ${describe(value)}.` });
          return;
        }
        value.forEach((entry, index) => {
          item(entry, `${path}[${index}]`, issues);
        });
      },
      { type: 'array', items: item.schema },
      item.codeOnly,
    );
  },
  /** A fixed-length array, e.g. `[specifier, options]`. Trailing elements may be omitted. */
  tuple(items: readonly Check[], options: { minItems?: number } = {}): Check {
    const minItems = options.minItems ?? items.length;
    return check(
      (value, path, issues) => {
        if (!Array.isArray(value) || value.length < minItems || value.length > items.length) {
          issues.push({
            path,
            message: `Expected an array of ${minItems === items.length ? items.length : `${minItems} to ${items.length}`} items but received ${describe(value)}.`,
          });
          return;
        }
        value.forEach((entry, index) => {
          items[index]?.(entry, `${path}[${index}]`, issues);
        });
      },
      {
        type: 'array',
        prefixItems: items.map((item) => item.schema),
        minItems,
        maxItems: items.length,
      },
    );
  },
  /** Any JSON value. */
  unknown(): Check {
    return check(() => undefined, {});
  },
  record(item: Check): Check {
    return check(
      (value, path, issues) => {
        if (!isRecord(value)) {
          issues.push({ path, message: `Expected an object but received ${describe(value)}.` });
          return;
        }
        for (const [key, entry] of Object.entries(value)) item(entry, `${path}.${key}`, issues);
      },
      { type: 'object', additionalProperties: item.schema },
      item.codeOnly,
    );
  },
  object(shape: Record<string, Check>, options: { required?: readonly string[] } = {}): Check {
    const properties = Object.fromEntries(
      Object.entries(shape)
        .filter(([, entry]) => entry.codeOnly !== true)
        .map(([key, entry]) => [key, entry.schema]),
    );
    return check(
      (value, path, issues) => {
        if (!isRecord(value)) {
          issues.push({ path, message: `Expected an object but received ${describe(value)}.` });
          return;
        }
        for (const key of options.required ?? []) {
          if (value[key] === undefined) {
            issues.push({ path: join(path, key), message: 'This option is required.' });
          }
        }
        for (const [key, entry] of Object.entries(value)) {
          // Own properties only: `constructor`, `toString` or `__proto__` are unknown options.
          const entryCheck = Object.hasOwn(shape, key) ? shape[key] : undefined;
          if (entryCheck === undefined) {
            const guess = suggest(key, Object.keys(shape));
            issues.push({
              path: join(path, key),
              message: 'Unknown option.',
              hint:
                guess === undefined
                  ? `Supported options: ${Object.keys(shape).join(', ')}.`
                  : `Did you mean "${guess}"?`,
            });
            continue;
          }
          if (entry !== undefined) entryCheck(entry, join(path, key), issues);
        }
      },
      {
        type: 'object',
        properties,
        ...(options.required === undefined || options.required.length === 0
          ? {}
          : { required: options.required }),
        additionalProperties: false,
      },
      Object.keys(properties).length === 0 && Object.keys(shape).length > 0,
    );
  },
  union(checks: readonly Check[], expected: string): Check {
    const schemas = checks.filter((c) => c.codeOnly !== true).map((c) => c.schema);
    return check(
      (value, path, issues) => {
        const results = checks.map((branch) => {
          const local: ConfigIssue[] = [];
          branch(value, path, local);
          return local;
        });
        if (results.some((r) => r.length === 0)) return;
        // Prefer the branch that got furthest (issues on nested paths) for a precise message.
        const nested = results.find((r) => r.every((issue) => issue.path !== path));
        if (nested !== undefined) issues.push(...nested);
        else
          issues.push({ path, message: `Expected ${expected} but received ${describe(value)}.` });
      },
      schemas.length === 1 ? (schemas[0] ?? {}) : { anyOf: schemas },
      schemas.length === 0,
    );
  },
  /** Marks a check as valid only in JavaScript/TypeScript configs (left out of the JSON Schema). */
  codeOnly(inner: Check): Check {
    return check(
      (value, path, issues) => {
        inner(value, path, issues);
      },
      inner.schema,
      true,
    );
  },
  /** Attaches documentation (and an optional default) to the JSON Schema of a check. */
  doc(inner: Check, description: string, extra: { default?: unknown } = {}): Check {
    return check(
      (value, path, issues) => {
        inner(value, path, issues);
      },
      { ...inner.schema, description, markdownDescription: description, ...extra },
      inner.codeOnly,
    );
  },
};

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
