import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { UserConfig } from '../../../src/config/types.ts';
import { DocumentParseError, parseDocumentText } from '../../../src/loader/parse.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { makeConfig, withTempDir } from '../../helpers.ts';

/**
 * Property-based fuzzing of the untrusted input path: specification text and documents built from
 * random parts must produce files or diagnostics, never an exception or an internal error. A
 * failure prints the seed and the smallest document that reproduces it.
 * `FUZZ_RUNS=10000 pnpm vitest run tests/unit/fuzz` runs a longer campaign.
 */
const RUNS = Number(process.env.FUZZ_RUNS ?? 100);

/** Schema names, including ones that have broken generators: reserved words, prototype keys, comment ends. */
const NAMES = [
  'Pet',
  'pet',
  '__proto__',
  'constructor',
  'default',
  'class',
  'Error',
  'Promise',
  '0',
  'a-b',
  'a.b',
  '*/',
  'Ünï',
] as const;
const name = fc.oneof(fc.constantFrom(...NAMES), fc.string({ maxLength: 8 }));
const pointer = (segment: string): string => segment.replaceAll('~', '~0').replaceAll('/', '~1');
const junk = fc.jsonValue({ maxDepth: 2 });
const segment = fc.stringMatching(/^[a-z_][a-z0-9_-]{0,5}$/);
/** Milliseconds per test, generous enough for long campaigns. */
const TIMEOUT = Math.max(10_000, RUNS * 30);

/** Parameters are unique by location and name (anything else by its content). */
function parameterKey(parameter: unknown): string {
  if (
    typeof parameter === 'object' &&
    parameter !== null &&
    'in' in parameter &&
    'name' in parameter
  )
    return `${String(parameter.in)} ${String(parameter.name)}`;
  return fc.stringify(parameter);
}

/**
 * Documents of one specification version. Well-formed documents only reference schemas they
 * define and keep parameters valid, so they reach code generation; hostile ones put junk anywhere.
 */
function documents(hostile: boolean): fc.Arbitrary<unknown> {
  return fc.constantFrom('2.0', '3.0.3', '3.1.1', '3.2.0').chain((version) => {
    const swagger2 = version === '2.0';
    const or = (arbitrary: fc.Arbitrary<unknown>): fc.Arbitrary<unknown> =>
      hostile ? fc.oneof({ weight: 6, arbitrary }, { weight: 1, arbitrary: junk }) : arbitrary;
    const prefix = swagger2 ? '#/definitions/' : '#/components/schemas/';
    const ref = (hostile ? name : fc.constantFrom(...NAMES)).map((n) => ({
      $ref: `${prefix}${pointer(n)}`,
    }));

    const { schema } = fc.letrec<{ schema: unknown }>((tie) => ({
      schema: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        or(
          fc.record(
            {
              type: fc.constantFrom('string', 'integer', 'number', 'boolean', 'object', 'array'),
              format: fc.constantFrom('date-time', 'date', 'binary', 'int64', 'uuid', 'byte'),
              description: fc.string(),
              ...(swagger2 ? {} : { nullable: fc.boolean() }),
            },
            { requiredKeys: ['type'] },
          ),
        ),
        ref,
        or(
          fc.record(
            {
              type: fc.constant('object'),
              properties: fc.dictionary(name, tie('schema'), { maxKeys: 4 }),
              required: fc.array(name, { maxLength: 3 }),
              additionalProperties: fc.oneof(fc.boolean(), tie('schema')),
              readOnly: fc.boolean(),
            },
            { requiredKeys: ['type', 'properties'] },
          ),
        ),
        or(fc.record({ type: fc.constant('array'), items: tie('schema') })),
        or(fc.record({ allOf: fc.array(tie('schema'), { minLength: 1, maxLength: 3 }) })),
        ...(swagger2
          ? []
          : [
              or(fc.record({ oneOf: fc.array(tie('schema'), { minLength: 1, maxLength: 3 }) })),
              or(fc.record({ anyOf: fc.array(tie('schema'), { minLength: 1, maxLength: 3 }) })),
            ]),
        or(
          fc.record({
            type: fc.constantFrom('string', 'integer'),
            enum: fc.uniqueArray(fc.oneof(fc.string(), fc.integer()), {
              minLength: 1,
              maxLength: 4,
            }),
          }),
        ),
        ...(hostile ? [junk] : []),
      ),
    }));

    const parameter = (location: fc.Arbitrary<string>): fc.Arbitrary<unknown> =>
      or(
        fc
          .tuple(
            fc.record({ name, in: location, required: fc.boolean() }),
            swagger2
              ? fc.record({ type: fc.constantFrom('string', 'integer', 'boolean', 'number') })
              : fc.record({ schema }),
          )
          .map(([base, type]) => ({ ...base, ...type })),
      );
    const content = (types: readonly string[]): fc.Arbitrary<unknown> =>
      fc.dictionary(fc.constantFrom(...types), fc.record({ schema }), { minKeys: 1, maxKeys: 2 });
    const response = or(
      swagger2
        ? fc.record({ description: fc.string(), schema }, { requiredKeys: ['description'] })
        : fc.record(
            {
              description: fc.string(),
              content: content(['application/json', 'application/octet-stream', 'text/plain']),
            },
            { requiredKeys: ['description'] },
          ),
    );
    const operation = (pathParameters: readonly string[]): fc.Arbitrary<unknown> =>
      fc
        .record(
          {
            operationId: name,
            tags: fc.array(name, { maxLength: 2 }),
            summary: fc.string(),
            deprecated: fc.boolean(),
            parameters: fc.uniqueArray(
              parameter(fc.constantFrom('query', 'header', ...(swagger2 ? [] : ['cookie']))),
              { maxLength: 3, selector: parameterKey },
            ),
            ...(swagger2
              ? {}
              : {
                  requestBody: or(
                    fc.record({
                      required: fc.boolean(),
                      content: content([
                        'application/json',
                        'multipart/form-data',
                        'application/x-www-form-urlencoded',
                        'application/octet-stream',
                      ]),
                    }),
                  ),
                }),
            responses: fc.dictionary(
              fc.constantFrom('200', '201', '204', '404', 'default'),
              response,
              {
                minKeys: 1,
                maxKeys: 3,
              },
            ),
          },
          { requiredKeys: ['responses'] },
        )
        .map((op) => ({
          ...op,
          parameters: [
            ...pathParameters.map((p) => ({
              name: p,
              in: 'path',
              required: true,
              ...(swagger2 ? { type: 'string' } : { schema: { type: 'string' } }),
            })),
            ...(op.parameters ?? []),
          ],
        }));

    const template = fc
      .uniqueArray(fc.record({ text: segment, parameter: fc.boolean() }), {
        maxLength: 3,
        selector: (s) => s.text,
      })
      .chain((segments) => {
        const pathParameters = segments.filter((s) => s.parameter).map((s) => s.text);
        const methods = ['get', 'put', 'post', 'delete', 'patch'];
        return fc.tuple(
          fc.constant(`/${segments.map((s) => (s.parameter ? `{${s.text}}` : s.text)).join('/')}`),
          fc
            .subarray(version === '3.2.0' ? [...methods, 'query'] : methods, { minLength: 1 })
            .chain((chosen) =>
              fc.tuple(
                ...chosen.map((method) =>
                  fc.tuple(fc.constant(method), or(operation(pathParameters))),
                ),
              ),
            )
            .map((entries) => Object.fromEntries(entries)),
        );
      });
    const paths = fc
      .uniqueArray(hostile ? fc.oneof(template, fc.tuple(fc.string(), junk)) : template, {
        maxLength: 4,
        // Templates that differ only in parameter names are the same path.
        selector: ([key]) => key.replaceAll(/\{[^}]*\}/g, '{}'),
      })
      .map((entries) => Object.fromEntries(entries));

    // Every name in NAMES is defined, so well-formed references resolve.
    const schemas = fc
      .tuple(
        fc.tuple(...NAMES.map((n) => fc.tuple(fc.constant(n), schema))),
        hostile ? fc.dictionary(name, schema, { maxKeys: 3 }) : fc.constant({}),
      )
      .map(([named, extra]) => ({ ...Object.fromEntries(named), ...extra }));

    return fc.tuple(fc.string(), paths, schemas).map(([title, pathItems, definitions]) => {
      const info = { title, version: '1' };
      return swagger2
        ? { swagger: version, info, paths: pathItems, definitions }
        : { openapi: version, info, paths: pathItems, components: { schemas: definitions } };
    });
  });
}

const features = fc.constantFrom<UserConfig['features'] | undefined>(
  undefined,
  { reactQuery: true, validation: { library: 'zod', request: true } },
  { query: { framework: 'vue' }, validation: { library: 'valibot', request: true } },
  { swr: true, validation: { library: 'arktype', request: true } },
);

describe('fuzzing', () => {
  it(
    'parses any text into data or a parse error',
    () => {
      const parse = (text: string, json: boolean): void => {
        try {
          parseDocumentText(text, json ? 'json' : 'yaml');
        } catch (error) {
          // Anything else fails the property and is reported with the input.
          if (!(error instanceof DocumentParseError)) throw error;
        }
      };
      const property = fc.property(
        fc.string({ unit: 'binary', maxLength: 200 }),
        fc.boolean(),
        parse,
      );
      expect(() => fc.assert(property, { numRuns: RUNS * 10 })).not.toThrow();
    },
    TIMEOUT,
  );

  it.each([
    ['well-formed', false],
    ['hostile', true],
  ])(
    'compiles %s documents into files or diagnostics',
    (_, hostile) =>
      withTempDir(async (dir) => {
        const input = path.join(dir, 'openapi.json');
        await fc.assert(
          fc.asyncProperty(documents(hostile), features, async (spec, feature) => {
            await writeFile(input, JSON.stringify(spec));
            const config = makeConfig(
              {
                spec: { version: 'auto', input },
                output: { directory: path.join(dir, 'out') },
                ...(feature === undefined ? {} : { features: feature }),
              },
              dir,
            );
            const result = await compile({ config });
            expect(result.diagnostics.filter((d) => d.code === 'internal/error')).toEqual([]);
            expect(result.ok && result.files.length === 0).toBe(false);
          }),
          { numRuns: RUNS },
        );
      }),
    TIMEOUT,
  );
});
