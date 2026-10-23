import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, typecheck } from '../../support/typescript.ts';

/**
 * JSON Schema semantics that the three validation libraries do not share by default: decimal
 * `multipleOf`, integers beyond 2^53, string lengths in characters, properties named like `Object.prototype` members, `allOf` with a closed member and
 * `patternProperties` of an open object. Every library must agree with JSON Schema (and with the
 * generated TypeScript types).
 */

const SPEC = `openapi: 3.1.0
info: { title: Validation edge cases, version: '1' }
paths:
  /things:
    post:
      operationId: createThing
      requestBody:
        content: { application/json: { schema: { $ref: '#/components/schemas/Thing' } } }
      responses:
        '200':
          description: ok
          content: { application/json: { schema: { $ref: '#/components/schemas/Derived' } } }
components:
  schemas:
    Price:
      type: object
      properties:
        amount: { type: number, multipleOf: 0.01 }
    Big:
      type: object
      properties:
        id: { type: integer, format: int64 }
    Thing:
      type: object
      required: [name]
      properties:
        name: { type: string }
        nick: { type: string }
    Short:
      type: object
      properties:
        s: { type: string, minLength: 1, maxLength: 1 }
    Inherited:
      type: object
      properties:
        constructor: { type: string }
        toString: { type: string }
    Base:
      type: object
      additionalProperties: false
      properties:
        a: { type: string }
    Derived:
      allOf:
        - $ref: '#/components/schemas/Base'
        - type: object
          properties:
            b: { type: string }
    Tags:
      type: object
      patternProperties:
        '^x-': { type: string }
    Empty:
      type: object
      additionalProperties: false
    WithEmpty:
      allOf:
        - $ref: '#/components/schemas/Empty'
        - type: object
          properties:
            c: { type: string }
`;

type Accepts = (schema: unknown, value: unknown) => boolean;

const LIBRARIES: readonly {
  library: 'zod' | 'valibot' | 'arktype';
  accepts: Accepts;
  /**
   * Whether an `allOf` with a closed member without properties accepts properties another member
   * declares. Zod 4 intersections reject only keys that no member knows.
   */
  emptyMemberAcceptsOthers: boolean;
}[] = [
  {
    library: 'zod',
    emptyMemberAcceptsOthers: true,
    accepts: (schema, value) =>
      (schema as { safeParse(value: unknown): { success: boolean } }).safeParse(value).success,
  },
  {
    library: 'valibot',
    emptyMemberAcceptsOthers: false,
    accepts: (schema, value) => v.safeParse(schema as v.GenericSchema, value).success,
  },
  {
    library: 'arktype',
    emptyMemberAcceptsOthers: false,
    accepts: (schema, value) => (schema as { allows(value: unknown): boolean }).allows(value),
  },
];

describe.each(LIBRARIES)('$library schemas', ({ library, accepts, emptyMemberAcceptsOthers }) => {
  it('follow JSON Schema where the libraries differ by default', async () => {
    const input = path.join(OUTPUT_ROOT, 'specs', 'validation-edge.yaml');
    await mkdir(path.dirname(input), { recursive: true });
    await writeFile(input, SPEC);
    const { directory } = await generateCase(`validation-edge-${library}`, {
      spec: { version: '3.1', input },
      features: { validation: { library, request: true } },
    });
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
    const schemas = (await import(
      pathToFileURL(path.join(directory, library, 'index.ts')).href
    )) as Record<string, unknown>;
    const check = (name: string, value: unknown): boolean => accepts(schemas[name], value);

    // Decimal multiples, within floating-point precision.
    expect(check('PriceSchema', { amount: 0.07 })).toBe(true);
    expect(check('PriceSchema', { amount: 19.99 })).toBe(true);
    expect(check('PriceSchema', { amount: 0.005 })).toBe(false);

    // int64 values beyond Number.MAX_SAFE_INTEGER are still integers.
    expect(check('BigSchema', { id: 1_700_000_000_000_000_000 })).toBe(true);
    expect(check('BigSchema', { id: 1.5 })).toBe(false);

    expect(check('ThingSchema', { name: 'a', nick: 'b' })).toBe(true);
    expect(check('ThingSchema', { name: 'a', nick: 1 })).toBe(false);

    // Lengths count characters, not UTF-16 code units.
    expect(check('ShortSchema', { s: '😀' })).toBe(true);
    expect(check('ShortSchema', { s: 'ab' })).toBe(false);
    expect(check('ShortSchema', { s: '' })).toBe(false);

    // Inherited names are not present unless the object has them.
    expect(check('InheritedSchema', {})).toBe(true);
    expect(check('InheritedSchema', { constructor: 'x', toString: 'y' })).toBe(true);
    expect(check('InheritedSchema', { constructor: 1 })).toBe(false);

    // allOf reads like the TypeScript intersection: Base's closedness does not reject `b`.
    expect(check('DerivedSchema', { a: 'x', b: 'y' })).toBe(true);
    expect(check('DerivedSchema', { a: 1, b: 'y' })).toBe(false);

    // A closed member without properties keeps rejecting properties in Valibot and ArkType, as
    // its type (Record<string, never>) does, and the schema matches that type.
    expect(check('WithEmptySchema', {})).toBe(true);
    expect(check('WithEmptySchema', { c: 'x' })).toBe(emptyMemberAcceptsOthers);

    // An open object with patternProperties keeps other keys.
    expect(check('TagsSchema', { 'x-a': 's', other: 1 })).toBe(true);
  });

  it('accept every RFC 3339 date-time when dates are converted', async () => {
    const input = path.join(OUTPUT_ROOT, 'specs', 'validation-dates.yaml');
    await mkdir(path.dirname(input), { recursive: true });
    await writeFile(
      input,
      `openapi: 3.1.0
info: { title: Dates, version: '1' }
paths: {}
components:
  schemas:
    Event:
      type: object
      properties:
        at: { type: string, format: date-time }
`,
    );
    const { directory } = await generateCase(`validation-dates-${library}`, {
      spec: { version: '3.1', input },
      types: { dates: 'Date' },
      features: { validation: library },
    });
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
    const { EventSchema } = (await import(
      pathToFileURL(path.join(directory, library, 'event.ts')).href
    )) as { EventSchema: unknown };
    const at = (value: string): boolean => accepts(EventSchema, { at: value });
    expect(at('2026-01-01T10:00:00Z')).toBe(true);
    expect(at('2026-01-01t10:00:00z')).toBe(true);
    expect(at('2026-01-01T10:00:00.123+02:00')).toBe(true);
    expect(at('2026-01-01')).toBe(false);
    expect(at('2026-01-01T10:00:00')).toBe(false);
    expect(at('2026-13-45T10:00:00Z')).toBe(false);
  });
});
