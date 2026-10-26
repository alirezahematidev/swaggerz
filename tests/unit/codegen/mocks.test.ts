import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { samplePattern } from '../../../src/codegen/mocks/pattern.ts';
import { formatted, Random } from '../../../src/codegen/mocks/random.ts';
import type { UserConfig } from '../../../src/config/types.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { makeConfig, withTempDir } from '../../helpers.ts';

/** Compiles an OpenAPI 3.1 document (paths and components as YAML) with mocks enabled. */
async function generate(
  body: string,
  extra: Partial<UserConfig> = {},
): Promise<{ file: (name: string) => string; diagnostics: readonly Diagnostic[] }> {
  return withTempDir(async (directory) => {
    const input = path.join(directory, 'openapi.yaml');
    await writeFile(
      input,
      `openapi: 3.1.0\ninfo:\n  title: Mocks\n  version: '1'\nservers:\n  - url: https://api.example.com\n${body}`,
    );
    const result = await compile({
      config: makeConfig(
        {
          ...extra,
          spec: { version: '3.1', input },
          features: { mocks: 'msw', ...extra.features },
        },
        directory,
      ),
    });
    return {
      file: (name) => {
        const found = result.files.find((f) => f.path === name);
        if (found === undefined)
          throw new Error(`${name} is not among ${result.files.map((f) => f.path).join(', ')}`);
        return found.content;
      },
      diagnostics: result.diagnostics,
    };
  });
}

/** What a fixture factory returns on one line, without the `...overrides` entry. */
function returned(content: string): string {
  const match = /return ([\s\S]*?);\n\}/.exec(content);
  return (match?.[1] ?? '')
    .replace(/,?\s*\.\.\.overrides/, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*([}\]])/g, ' $1')
    .replace(/\{ \}/g, '{}');
}

describe('pattern sampling', () => {
  it.each([
    '^[A-Z]{3}-\\d{4}$',
    '^\\w+@example\\.(com|org)$',
    '^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$',
    '^[^\\s/]+/[^\\s/]+$',
    '^v\\d+(\\.\\d+){2}(-[a-z]+)?$',
    '[\\s\\S]{3}',
    '^\\u0041\\x42\\u{43}[\\-_.]$',
    '^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])$',
  ])('generates a string matching %s', (pattern) => {
    const text = samplePattern(pattern, new Random(pattern));
    expect(text).toBeDefined();
    expect(new RegExp(pattern, 'u').test(text ?? '')).toBe(true);
  });

  it('reaches a minimum length through unbounded quantifiers and respects the maximum', () => {
    const text = samplePattern('^\\d+$', new Random('x'), 8);
    expect(text).toMatch(/^\d{8,}$/);
    expect(samplePattern('^\\d{5}$', new Random('x'), 0, 3)).toBeUndefined();
  });

  it('gives up on syntax it does not support instead of running the pattern', () => {
    for (const pattern of ['^(?=a)a$', '^(a)\\1$', '^\\p{L}+$', '^(a', '[z-a]'])
      expect(samplePattern(pattern, new Random(pattern))).toBeUndefined();
  });

  it('is deterministic for a seed', () => {
    expect(samplePattern('^[a-z]{12}$', new Random('seed'))).toBe(
      samplePattern('^[a-z]{12}$', new Random('seed')),
    );
    expect(formatted('uuid', new Random('a'))).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(formatted('date-time', new Random('a'))).toBe(formatted('date-time', new Random('a')));
  });
});

describe('fixture generation', () => {
  it('prefers examples and defaults that match, and reports those that do not', async () => {
    const { file, diagnostics } = await generate(`paths: {}
components:
  schemas:
    Pet:
      type: object
      required: [name, size]
      properties:
        name:
          type: string
          example: Rex
        size:
          type: integer
          maximum: 10
          example: 99
        status:
          type: string
          enum: [available, sold]
          default: sold
    Owner:
      type: object
      required: [name]
      properties:
        name:
          type: string
      example:
        name: Ada
        unknown: dropped
`);
    expect(returned(file('mocks/models/pet.ts'))).toMatch(
      /^\{ name: 'Rex', size: \d+, status: 'sold' \}$/,
    );
    expect(returned(file('mocks/models/owner.ts'))).toBe("{ name: 'Ada' }");
    const invalid = diagnostics.filter((d) => d.code === 'mock/invalid-example');
    expect(invalid.map((d) => d.message)).toEqual([
      'The example of `Pet.size` does not match its schema; the fixture uses a generated value instead.',
    ]);
    expect(invalid[0]?.severity).toBe('warning');
    expect(invalid[0]?.location?.pointer).toBe('/components/schemas/Pet');
  });

  it('satisfies constraints, formats, conditionals and dependent schemas', async () => {
    const { file, diagnostics } = await generate(`paths: {}
components:
  schemas:
    Item:
      type: object
      required: [code, price, count, tags, kind, value]
      properties:
        code:
          type: string
          minLength: 6
          maxLength: 6
        price:
          type: number
          exclusiveMinimum: 0
          maximum: 1
          multipleOf: 0.25
        count:
          type: integer
          minimum: 3
          maximum: 3
        tags:
          type: array
          minItems: 3
          items:
            type: string
            format: uuid
        kind:
          type: string
          enum: [percent, amount]
        value:
          type: number
        currency:
          type: string
      if:
        properties:
          kind:
            const: percent
      then:
        properties:
          value:
            minimum: 5
            maximum: 6
      dependentSchemas:
        currency:
          properties:
            currency:
              maxLength: 3
              minLength: 3
`);
    const item = returned(file('mocks/models/item.ts'));
    expect(item).toMatch(/code: '.{6}'/);
    expect(item).toMatch(/price: (0\.25|0\.5|0\.75|1),/);
    expect(item).toContain('count: 3,');
    expect(item.match(/'[0-9a-f]{8}-[0-9a-f]{4}-4/g)).toHaveLength(3);
    expect(item).toContain("kind: 'percent'");
    expect(item).toMatch(/value: [56](\.\d+)?,/);
    expect(item).toMatch(/currency: '.{3}'/);
    expect(diagnostics.filter((d) => d.code.startsWith('mock/'))).toEqual([]);
  });

  it('never recurses forever, and reports schemas that require themselves', async () => {
    const { file, diagnostics } = await generate(`paths: {}
components:
  schemas:
    Node:
      type: object
      required: [name, children]
      properties:
        name:
          type: string
        children:
          type: array
          items:
            $ref: '#/components/schemas/Node'
        parent:
          $ref: '#/components/schemas/Node'
        sibling:
          oneOf:
            - $ref: '#/components/schemas/Node'
            - type: 'null'
    Loop:
      type: object
      required: [next]
      properties:
        next:
          $ref: '#/components/schemas/Loop'
`);
    expect(returned(file('mocks/models/node.ts'))).toMatch(
      /^\{ name: '[a-z ]+', children: \[\], sibling: null \}$/,
    );
    expect(
      diagnostics.filter((d) => d.code === 'mock/unsatisfiable').map((d) => d.message),
    ).toEqual([
      '`Loop` has no finite value: it requires itself, so its fixture cannot be generated.',
    ]);
    expect(file('mocks/models/loop.ts')).toContain('return (undefined as never);');
  });

  it('tags discriminated union members and subtypes', async () => {
    const { file } = await generate(`paths: {}
components:
  schemas:
    Pet:
      type: object
      required: [petType]
      properties:
        petType:
          type: string
      discriminator:
        propertyName: petType
        mapping:
          cat: '#/components/schemas/Cat'
    Cat:
      allOf:
        - $ref: '#/components/schemas/Pet'
        - type: object
          properties:
            lives:
              type: integer
    Shape:
      oneOf:
        - $ref: '#/components/schemas/Circle'
      discriminator:
        propertyName: kind
        mapping:
          round: '#/components/schemas/Circle'
    Circle:
      type: object
      required: [kind]
      properties:
        kind:
          type: string
`);
    // `allOf` members become one object; the subtype carries its discriminator value.
    expect(returned(file('mocks/models/cat.ts'))).toMatch(/^\{ lives: \d+, petType: 'cat' \}$/);
    expect(file('mocks/models/cat.ts')).toContain('overrides?: Partial<Cat>');
    // Unions take no overrides: the `Partial` of a union would lose the discriminator's type.
    expect(file('mocks/models/shape.ts')).toContain(
      "export function makeShape(): Shape {\n  return { ...makeCircle(), kind: 'round' };",
    );
  });

  it('reports patterns it cannot generate a string for', async () => {
    const { diagnostics } = await generate(`paths: {}
components:
  schemas:
    Code:
      type: string
      pattern: '^(?!x)[a-z]+$'
`);
    expect(diagnostics.filter((d) => d.code === 'mock/unsupported-pattern')).toMatchObject([
      { severity: 'info', hint: 'Add an `example` that matches the pattern.' },
    ]);
  });

  it('keeps example data when allOf members declare the same property', async () => {
    const { file } = await generate(`paths: {}
components:
  schemas:
    Collection:
      type: object
      properties:
        data:
          type: array
          items:
            type: object
    Item:
      type: object
      required: [id]
      properties:
        id:
          type: string
    Items:
      allOf:
        - $ref: '#/components/schemas/Collection'
        - type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Item'
      example:
        data:
          - id: a
            note: kept by the open member
`);
    expect(returned(file('mocks/models/items.ts'))).toBe(
      "{ data: [{ id: 'a', note: 'kept by the open member' }] }",
    );
  });

  it('leaves out values that cannot exist, and casts values that cannot match', async () => {
    const { file, diagnostics } = await generate(`paths: {}
components:
  schemas:
    Track:
      type: object
      required: [type]
      properties:
        type:
          type: string
          enum: [track]
    Player:
      type: object
      properties:
        item:
          oneOf:
            - $ref: '#/components/schemas/Track'
          discriminator:
            propertyName: type
    Code:
      type: string
      minLength: 5
      maxLength: 2
`);
    // The implicit mapping gives `Track` the value 'Track', which its own `type` excludes.
    expect(returned(file('mocks/models/player.ts'))).toBe('{}');
    expect(file('mocks/models/code.ts')).toMatch(/return '.*' as unknown as Code;/);
    expect(
      diagnostics.filter((d) => d.code === 'mock/unsatisfiable').map((d) => d.message),
    ).toEqual([
      'The generated fixture of `Code` does not match its schema: its constraints contradict each other or cannot be combined.',
      "No variant of `Player.item` can have its discriminator value: each one's `type` excludes the value the mapping gives it.",
    ]);
  });

  it('merges allOf members as their types do', async () => {
    const { file, diagnostics } = await generate(`paths: {}
components:
  schemas:
    Window:
      type: object
      properties:
        day:
          type: string
        hour:
          type: string
    RequiredWindow:
      allOf:
        - $ref: '#/components/schemas/Window'
        - required: [day, hour]
    Message:
      type: object
      required: [type]
      properties:
        type:
          type: string
          enum: [message]
    MessageResource:
      allOf:
        - $ref: '#/components/schemas/Message'
        - type: object
          required: [id, type]
          properties:
            id:
              type: string
            type: {}
    Action:
      type: string
      oneOf:
        - const: START
        - const: STOP
    Tags:
      type: object
      additionalProperties:
        type: string
`);
    // A member requiring what another declares: the merged object has the property.
    expect(returned(file('mocks/models/required-window.ts'))).toMatch(
      /^\{ day: '[^']+', hour: '[^']+' \}$/,
    );
    // `unknown` in one member does not replace the other member's type.
    expect(returned(file('mocks/models/message-resource.ts'))).toMatch(
      /^\{ type: 'message', id: '[^']+' \}$/,
    );
    // `type: string` next to constants: a value both accept.
    expect(returned(file('mocks/models/action.ts'))).toBe("'START'");
    // A `Record` takes no overrides: their `Partial` would add `undefined` to its values.
    expect(file('mocks/models/tags.ts')).toContain('export function makeTags(): Tags {');
    expect(diagnostics.filter((d) => d.code.startsWith('mock/'))).toEqual([]);
  });

  it('merges arrays and leaves out keys only an unconstrained member allows', async () => {
    const { file } = await generate(
      `paths: {}
components:
  schemas:
    Account:
      type: object
      required: [id]
      properties:
        id:
          type: string
    Owner:
      type: object
      required: [owner]
      properties:
        owner:
          type: string
    Item:
      type: object
      required: [accounts]
      properties:
        accounts:
          type: array
          items:
            $ref: '#/components/schemas/Account'
    EnrichedItem:
      allOf:
        - $ref: '#/components/schemas/Item'
        - type: object
          required: [accounts]
          properties:
            accounts:
              type: array
              items:
                $ref: '#/components/schemas/Owner'
    Policy:
      type: object
      properties:
        plan:
          type: string
    Change:
      allOf:
        - required: [policy]
        - type: object
          properties:
            policy:
              $ref: '#/components/schemas/Policy'
      example:
        policy:
          plan: weekly
          day: SUN
    Stamped:
      allOf:
        - type: object
          required: [at]
          properties:
            at:
              type: string
              format: date-time
        - type: object
          properties:
            at:
              type: string
`,
      { types: { dates: 'Date' } },
    );
    // Both members' items: an account that is also an owner.
    expect(returned(file('mocks/models/enriched-item.ts'))).toMatch(
      /^\{ accounts: \[\{ id: '[^']+', owner: '[^']+' \}\] \}$/,
    );
    // `{ required: [policy] }` types `policy` as `unknown`, which `Policy` narrows: no `day`.
    expect(returned(file('mocks/models/change.ts'))).toBe("{ policy: { plan: 'weekly' } }");
    // `Date & string` has no value: the fixture is cast.
    expect(file('mocks/models/stamped.ts')).toMatch(/as unknown as Stamped;/);
  });

  it('converts dates with types.dates: Date', async () => {
    const { file } = await generate(
      `paths: {}
components:
  schemas:
    Event:
      type: object
      required: [at, on]
      properties:
        at:
          type: string
          format: date-time
          example: '2026-01-02T03:04:05Z'
        on:
          type: string
          format: date
`,
      { types: { dates: 'Date' } },
    );
    expect(returned(file('mocks/models/event.ts'))).toMatch(
      /^\{ at: new Date\('2026-01-02T03:04:05Z'\), on: new Date\('\d{4}-\d{2}-\d{2}'\) \}$/,
    );
  });

  it('claims its names after the client, without renaming it', async () => {
    const { file } = await generate(`paths:
  /handlers:
    get:
      operationId: handlers
      responses:
        '204':
          description: No content.
components:
  schemas:
    Pet:
      type: string
`);
    expect(file('mocks/handlers.ts')).toContain('export function mockHandlers(');
    expect(file('mocks/handlers.ts')).toContain('mockHandlers2(options)');
    expect(file('mocks/default/handlers.ts')).toContain('export function mockHandlers2(');
    expect(file('default/handlers.ts')).toContain('export function handlers(');
    expect(file('mocks/models/pet.ts')).toContain('export function makePet(): Pet {');
  });
});
