/**
 * Fixture generation from schemas: the generated factories are imported and their values checked
 * for the examples (seed 0) and for other seeds.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UserConfig } from '../../../src/config/types.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { generateCase, OUTPUT_ROOT } from '../../support/generate.ts';

type Fixture = (...args: unknown[]) => unknown;

interface Generated {
  /** A fixture factory by name; object fixtures are called without overrides. */
  readonly make: (name: string, options?: object) => unknown;
  readonly file: (name: string) => string;
  readonly diagnostics: readonly Diagnostic[];
}

/** Generates an OpenAPI 3.1 document (paths and components as YAML) with mocks enabled. */
async function generate(
  name: string,
  body: string,
  extra: Partial<UserConfig> = {},
): Promise<Generated> {
  const input = path.join(OUTPUT_ROOT, `${name}.yaml`);
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeFile(
    input,
    `openapi: 3.1.0\ninfo:\n  title: Mocks\n  version: '1'\nservers:\n  - url: https://api.example.com\n${body}`,
  );
  const { directory, result } = await generateCase(name, {
    ...extra,
    spec: { version: '3.1', input },
    features: { mocks: 'msw', ...extra.features },
  });
  const mocks = (await import(
    pathToFileURL(path.join(directory, 'mocks', 'index.ts')).href
  )) as Record<string, Fixture>;
  return {
    make: (fixture, options) => {
      const make = mocks[fixture];
      if (make === undefined) throw new Error(`${fixture} is not generated`);
      return make.length >= 2 ? make(undefined, options) : make(options);
    },
    file: (file) => {
      const found = result.files.find((f) => f.path === file);
      if (found === undefined) throw new Error(`${file} is not generated`);
      return found.content;
    },
    diagnostics: result.diagnostics,
  };
}

const SEEDS = Array.from({ length: 30 }, (_, index) => ({ seed: index + 1 }));

describe('fixture generation', () => {
  it('prefers examples and defaults that match, and reports those that do not', async () => {
    const { make, diagnostics } = await generate(
      'fixtures-examples',
      `paths: {}
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
`,
    );
    expect(make('makePet')).toEqual({ name: 'Rex', size: expect.any(Number), status: 'sold' });
    expect(make('makePet')).toHaveProperty(
      'size',
      expect.toSatisfy((n: number) => n <= 10),
    );
    expect(make('makeOwner')).toEqual({ name: 'Ada' });
    // Other seeds vary within the schema; an object example applies to seed 0 only.
    for (const options of SEEDS) {
      const pet = make('makePet', options) as { size: number; status?: string };
      expect(pet.size).toBeLessThanOrEqual(10);
      expect([undefined, 'available', 'sold']).toContain(pet.status);
    }
    expect(
      new Set(SEEDS.map((options) => (make('makeOwner', options) as { name: string }).name)).size,
    ).toBeGreaterThan(5);
    const invalid = diagnostics.filter((d) => d.code === 'mock/invalid-example');
    expect(invalid.map((d) => d.message)).toEqual([
      'The example of `Pet.size` does not match its schema; the fixture uses a generated value instead.',
    ]);
    expect(invalid[0]?.severity).toBe('warning');
    expect(invalid[0]?.location?.pointer).toBe('/components/schemas/Pet');
  });

  it('satisfies constraints, formats, conditionals and dependent schemas for every seed', async () => {
    const { make, diagnostics } = await generate(
      'fixtures-constraints',
      `paths: {}
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
          uniqueItems: true
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
    Flags:
      type: array
      uniqueItems: true
      items:
        type: string
        enum: [a, b]
`,
    );
    for (const options of [undefined, ...SEEDS]) {
      const item = make('makeItem', options) as Record<string, unknown>;
      expect(item['code']).toMatch(/^.{6}$/);
      expect([0.25, 0.5, 0.75, 1]).toContain(item['price']);
      expect(item['count']).toBe(3);
      const tags = item['tags'] as string[];
      expect(tags.length).toBeGreaterThanOrEqual(3);
      expect(new Set(tags).size).toBe(tags.length);
      for (const tag of tags) expect(tag).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
      const value = item['value'] as number;
      expect(item['kind'] !== 'percent' || (value >= 5 && value <= 6)).toBe(true);
      expect(item['currency'] ?? 'any').toMatch(/^.{3}$/);
      const flags = make('makeFlags', options) as string[];
      expect(new Set(flags).size).toBe(flags.length);
    }
    expect(diagnostics.filter((d) => d.code.startsWith('mock/'))).toEqual([]);
  });

  it('never recurses forever, and reports schemas that require themselves', async () => {
    const { make, file, diagnostics } = await generate(
      'fixtures-recursion',
      `paths: {}
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
`,
    );
    expect(make('makeNode')).toEqual({ name: expect.any(String), children: [], sibling: null });
    // Other seeds leave the optional `sibling` out sometimes; it is always `null` otherwise.
    for (const options of SEEDS) {
      const node = make('makeNode', options) as Record<string, unknown>;
      expect(node).toMatchObject({ name: expect.any(String), children: [] });
      expect(node['sibling'] ?? null).toBeNull();
    }
    expect(
      diagnostics.filter((d) => d.code === 'mock/unsatisfiable').map((d) => d.message),
    ).toEqual([
      '`Loop` has no finite value: it requires itself, so its fixture cannot be generated.',
    ]);
    expect(file('mocks/models/loop.ts')).toContain('return (undefined as never);');
  });

  it('tags discriminated union members and subtypes, and covers every member', async () => {
    const { make, file } = await generate(
      'fixtures-discriminators',
      `paths: {}
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
        - $ref: '#/components/schemas/Square'
      discriminator:
        propertyName: kind
        mapping:
          round: '#/components/schemas/Circle'
          square: '#/components/schemas/Square'
    Circle:
      type: object
      required: [kind, radius]
      properties:
        kind:
          type: string
        radius:
          type: number
    Square:
      type: object
      required: [kind, side]
      properties:
        kind:
          type: string
        side:
          type: number
`,
    );
    // `allOf` members become one object; the subtype carries its discriminator value.
    for (const options of [undefined, ...SEEDS])
      expect(make('makeCat', options)).toMatchObject({ petType: 'cat' });
    expect(file('mocks/models/cat.ts')).toContain('overrides?: Partial<Cat>');
    // Unions take no overrides: the `Partial` of a union would lose the discriminator's type.
    expect(file('mocks/models/shape.ts')).toContain(
      'export function makeShape(options?: FixtureOptions): Shape {',
    );
    expect(make('makeShape')).toMatchObject({ kind: 'round', radius: expect.any(Number) });
    const kinds = new Set(
      SEEDS.map((options) => (make('makeShape', options) as { kind: string }).kind),
    );
    expect(kinds).toEqual(new Set(['round', 'square']));
    for (const options of SEEDS) {
      const shape = make('makeShape', options) as Record<string, unknown>;
      expect(shape['kind'] === 'round' ? 'radius' in shape : 'side' in shape).toBe(true);
    }
  });

  it('reports patterns no string matches', async () => {
    const { diagnostics } = await generate(
      'fixtures-patterns',
      `paths: {}
components:
  schemas:
    Code:
      type: string
      pattern: '^(?=x)y$'
`,
    );
    expect(diagnostics.filter((d) => d.code === 'mock/unsupported-pattern')).toMatchObject([
      { severity: 'info', hint: 'Add an `example` that matches the pattern.' },
    ]);
  });

  it('keeps example data when allOf members declare the same property', async () => {
    const { make } = await generate(
      'fixtures-allof-example',
      `paths: {}
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
`,
    );
    expect(make('makeItems')).toEqual({ data: [{ id: 'a', note: 'kept by the open member' }] });
  });

  it('leaves out values that cannot exist, and casts values that cannot match', async () => {
    const { make, file, diagnostics } = await generate(
      'fixtures-impossible',
      `paths: {}
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
`,
    );
    // The implicit mapping gives `Track` the value 'Track', which its own `type` excludes.
    expect(make('makePlayer')).toEqual({});
    expect(file('mocks/models/code.ts')).toMatch(/return '.*' as unknown as Code;/);
    expect(
      diagnostics.filter((d) => d.code === 'mock/unsatisfiable').map((d) => d.message),
    ).toEqual([
      'The generated fixture of `Code` does not match its schema: its constraints contradict each other or cannot be combined.',
      "No variant of `Player.item` can have its discriminator value: each one's `type` excludes the value the mapping gives it.",
    ]);
  });

  it('merges allOf members as their types do', async () => {
    const { make, file, diagnostics } = await generate(
      'fixtures-allof',
      `paths: {}
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
`,
    );
    for (const options of [undefined, ...SEEDS]) {
      // A member requiring what another declares: the merged object has the property.
      expect(make('makeRequiredWindow', options)).toEqual({
        day: expect.any(String),
        hour: expect.any(String),
      });
      // `unknown` in one member does not replace the other member's type.
      expect(make('makeMessageResource', options)).toEqual({
        type: 'message',
        id: expect.any(String),
      });
      // `type: string` next to constants: a value both accept.
      expect(make('makeAction', options)).toBe('START');
    }
    // A map: a few generated keys. It takes no overrides: their `Partial` would add `undefined`
    // to its values.
    expect(Object.keys(make('makeTags') as object).length).toBeGreaterThan(0);
    expect(file('mocks/models/tags.ts')).toContain(
      'export function makeTags(options?: FixtureOptions): Tags {',
    );
    expect(diagnostics.filter((d) => d.code.startsWith('mock/'))).toEqual([]);
  });

  it('merges arrays and leaves out keys only an unconstrained member allows', async () => {
    const { make, file } = await generate(
      'fixtures-allof-arrays',
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
    // Both members' items: accounts that are also owners.
    const { accounts } = make('makeEnrichedItem') as { accounts: object[] };
    expect(accounts.length).toBeGreaterThan(0);
    for (const account of accounts)
      expect(account).toEqual({ id: expect.any(String), owner: expect.any(String) });
    // `{ required: [policy] }` types `policy` as `unknown`, which `Policy` narrows: no `day`.
    expect(make('makeChange')).toEqual({ policy: { plan: 'weekly' } });
    // `Date & string` has no value: the fixture is cast.
    expect(file('mocks/models/stamped.ts')).toMatch(/as unknown as Stamped;/);
  });

  it('converts dates with types.dates: Date', async () => {
    const { make } = await generate(
      'fixtures-dates',
      `paths: {}
components:
  schemas:
    Event:
      type: object
      required: [at, on, createdAt]
      properties:
        at:
          type: string
          format: date-time
          example: '2026-01-02T03:04:05Z'
        on:
          type: string
          format: date
        createdAt:
          type: string
          format: date-time
          example: '2026-06-01T00:00:00Z'
`,
      { types: { dates: 'Date' } },
    );
    expect(make('makeEvent')).toEqual({
      at: new Date('2026-01-02T03:04:05Z'),
      on: expect.any(Date),
      createdAt: new Date('2026-06-01T00:00:00Z'),
    });
    for (const options of SEEDS) {
      const event = make('makeEvent', options) as Record<string, Date>;
      expect(event['at']).toBeInstanceOf(Date);
      // `createdAt` lies before its example.
      expect(event['createdAt']!.getTime()).toBeLessThan(Date.parse('2026-06-01T00:00:00Z'));
    }
  });

  it('claims its names after the client, without renaming it', async () => {
    const { file } = await generate(
      'fixtures-names',
      `paths:
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
`,
    );
    expect(file('mocks/handlers.ts')).toContain('export function mockHandlers(');
    expect(file('mocks/handlers.ts')).toContain('mockHandlers2(options)');
    expect(file('mocks/default/handlers.ts')).toContain('export function mockHandlers2(');
    expect(file('default/handlers.ts')).toContain('export function handlers(');
    expect(file('mocks/models/pet.ts')).toContain(
      'export function makePet(options?: FixtureOptions): Pet {',
    );
  });
});

describe('realistic values', () => {
  const REALISTIC = `paths: {}
components:
  schemas:
    Member:
      type: object
      required: [name, email, username]
      properties:
        name:
          type: string
        email:
          type: string
          format: email
          example: ada@acme.dev
        username:
          type: string
        manager:
          type: object
          required: [name, email]
          properties:
            name:
              type: string
            email:
              type: string
              format: email
    MemberPage:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/Member'
        nextCursor:
          type: [string, 'null']
    Task:
      type: object
      required: [title, description]
      properties:
        title:
          type: string
          example: Fix the login redirect on Safari
        description:
          type: string
          example: Users on Safari see a blank page after they sign in. It started with the last deploy.
    Problem:
      type: object
      required: [type, title, status, detail]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri-reference
    ValidationProblem:
      allOf:
        - $ref: '#/components/schemas/Problem'
        - type: object
          required: [errors]
          properties:
            errors:
              type: array
              minItems: 1
              items:
                type: object
                required: [field, message]
                properties:
                  field:
                    type: string
                  message:
                    type: string
    ErrorResponse:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          example: NOT_FOUND
        message:
          type: string
    ValidationError:
      type: object
      required: [title, status]
      properties:
        title:
          type: string
          example: Validation failed
        status:
          type: integer
          example: 422
    PetGoneError:
      type: object
      required: [title, status]
      properties:
        title:
          type: string
        status:
          type: integer
      example:
        title: The pet was adopted
        status: 410
`;
  let make: Generated['make'];

  beforeAll(async () => {
    ({ make } = await generate('fixtures-realistic', REALISTIC));
  });

  const seeds = Array.from({ length: 60 }, (_, index) => ({ seed: index + 1 }));
  const LOREM = /\b(lorem|ipsum|dolor|amet|incididunt|ullamco|veniam|tempor|labore)\b/;
  const ascii = (text: string): string =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  it('give lists items outside empty states', () => {
    for (const options of [...seeds, ...SEEDS.map(({ seed }) => ({ seed: seed + 1000 }))]) {
      const page = make('makeMemberPage', options) as { items: unknown[] };
      expect(page.items.length).toBeGreaterThan(0);
    }
    expect(make('makeMemberPage', { seed: 3, empty: true })).toMatchObject({ items: [] });
  });

  it('name one person per object: name, email and username agree', () => {
    interface Person {
      readonly name: string;
      readonly email: string;
    }
    const local = (person: Person): string => {
      const [first = '', last = ''] = person.name.split(' ');
      return `${ascii(first)}.${ascii(last)}`;
    };
    const members = seeds.map(
      (options) => make('makeMember', options) as Person & { username: string; manager?: Person },
    );
    for (const member of members) {
      expect(member.email).toBe(`${local(member)}@acme.dev`);
      expect(member.username.replace(/\d+$/, '')).toBe(local(member));
    }
    // An inline object names a person of its own.
    const managers = members.flatMap((member) =>
      member.manager === undefined ? [] : [[member, member.manager] as const],
    );
    expect(managers.length).toBeGreaterThan(10);
    for (const [, manager] of managers) expect(manager.email.split('@')[0]).toBe(local(manager));
    expect(managers.some(([member, manager]) => manager.name !== member.name)).toBe(true);
  });

  it('vary text instead of repeating the example word for word', () => {
    const tasks = seeds.map((options) => make('makeTask', options) as Record<string, string>);
    expect(tasks.filter((task) => task['title'] === 'Fix the login redirect on Safari')).toEqual(
      [],
    );
    expect(tasks.filter((task) => task['description']?.startsWith('Users on Safari'))).toEqual([]);
    expect(new Set(tasks.map((task) => task['title'])).size).toBeGreaterThan(30);
  });

  it('describe one error status per error body', () => {
    const REASONS: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Content',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    const kebab = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const problems = [
      make('makeProblem'),
      ...seeds.map((options) => make('makeProblem', options)),
    ] as Record<string, string | number>[];
    for (const problem of problems) {
      const status = problem['status'] as number;
      expect(problem['title']).toBe(REASONS[status]);
      expect(problem['type']).toMatch(new RegExp(`/problems/${kebab(REASONS[status] ?? '')}$`));
      expect(problem['detail']).toMatch(/^[A-Z].*\.$/);
      expect(problem['detail']).not.toMatch(LOREM);
      expect(problem['instance'] ?? 'urn:uuid:x').toMatch(/^urn:uuid:/);
    }
    expect(new Set(problems.map((problem) => problem['status'])).size).toBeGreaterThan(4);
    // The examples describe 404; a body sent with a status describes it, for every seed.
    expect(problems[0]).toMatchObject({ status: 404, title: 'Not Found' });
    for (const options of [{}, ...seeds.slice(0, 10)])
      expect(make('makeProblem', { ...options, status: 500 })).toMatchObject({
        status: 500,
        title: 'Internal Server Error',
      });
    // Statuses that are not errors are no status to describe.
    expect(make('makeProblem', { status: 200 })).toEqual(make('makeProblem'));
    // The errors of single fields name a field and what is wrong with it.
    for (const options of seeds.slice(0, 10)) {
      const problem = make('makeValidationProblem', { ...options, status: 422 }) as {
        title: string;
        errors: { field: string; message: string }[];
      };
      expect(problem.title).toBe('Unprocessable Content');
      for (const error of problem.errors) {
        expect(error.field).toMatch(/^[a-zA-Z]+$/);
        expect(error.message).toMatch(/^[A-Z].*\.$/);
        expect(error.message).not.toMatch(LOREM);
      }
    }
    // Codes are written the way the example writes them.
    expect(make('makeErrorResponse', { status: 500 })).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(make('makeErrorResponse', { seed: 4, status: 429 })).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: expect.stringMatching(/^[A-Z].*\.$/),
    });
  });

  it('keep the examples of an error model for the status they describe', () => {
    expect(make('makeValidationError', { status: 422 })).toEqual({
      title: 'Validation failed',
      status: 422,
    });
    expect(make('makeValidationError', { status: 500 })).toEqual({
      title: 'Internal Server Error',
      status: 500,
    });
    expect(make('makePetGoneError')).toEqual({ title: 'The pet was adopted', status: 410 });
    expect(make('makePetGoneError', { status: 410 })).toEqual({
      title: 'The pet was adopted',
      status: 410,
    });
    expect(make('makePetGoneError', { status: 503 })).toEqual({
      title: 'Service Unavailable',
      status: 503,
    });
  });
});
