import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { startMockServer, type MockServer } from '../../support/mock-server.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';

const VALIDATION = { validation: { library: 'zod', request: true } } as const;

const CONSUMER = `
import { ShapeSchema, TreeNodeSchema, CatSchema } from '__API__/zod/index.js';

export function parse(input: unknown): unknown[] {
  const shape = ShapeSchema.parse(input);
  const measure: number = shape.kind === 'circle' ? shape.radius : shape.width;
  const tree = TreeNodeSchema.parse(input);
  const child: string | undefined = tree.children?.[0]?.value;
  const cat = CatSchema.parse(input);
  const petType: 'Cat' = cat.petType;
  return [measure, child, petType];
}
`;

describe('Zod schema generation', () => {
  it.each([
    ['ts', {}, BROWSER, (f: string[]) => f.filter((x) => x.endsWith('.ts'))],
    [
      'js',
      { language: 'javascript', declarations: true },
      BROWSER,
      (f: string[]) => f.filter((x) => x.endsWith('.d.ts')),
    ],
    [
      'jsdoc',
      { language: 'javascript', declarations: false },
      CHECK_JS,
      (f: string[]) =>
        f.filter(
          (x) =>
            x.endsWith('.d.ts') || (x.endsWith('.js') && !f.includes(x.replace(/\.js$/, '.d.ts'))),
        ),
    ],
  ] as const)(
    'compiles %s output with recursive, polymorphic and mutually recursive schemas',
    async (name, output, options, pick) => {
      for (const [spec, version] of [
        ['features-3.1.yaml', '3.1'],
        ['features-3.2.yaml', '3.2'],
        ['external/openapi.yaml', '3.0'],
      ] as const) {
        const caseName = `zod-${name}-${spec.split('/')[0]?.replace('.yaml', '') ?? spec}`;
        const { directory } = await generateCase(caseName, {
          spec: { version, input: fixture(spec) },
          output,
          features: VALIDATION,
        });
        const roots = pick(await listFiles(directory));
        if (spec === 'features-3.1.yaml' && name !== 'jsdoc') {
          const consumer = path.join(OUTPUT_ROOT, `${caseName}.consumer.ts`);
          await writeFile(consumer, CONSUMER.replaceAll('__API__', `./${caseName}`));
          roots.push(consumer);
        }
        expect(typecheck(roots, options)).toEqual([]);
      }
    },
  );

  it('validates OpenAPI 3.2 discriminators with a default mapping', async () => {
    const { directory } = await generateCase('zod-default-mapping', {
      spec: { version: '3.2', input: fixture('features-3.2.yaml') },
      features: VALIDATION,
    });
    const { PetSchema } = (await import(
      pathToFileURL(path.join(directory, 'zod', 'pet.ts')).href
    )) as { PetSchema: { safeParse(value: unknown): { success: boolean } } };
    expect(PetSchema.safeParse({ kind: 'cat', name: 'Tom' }).success).toBe(true);
    // Without the property, or with an unmapped value, the default schema applies.
    expect(PetSchema.safeParse({ name: 'Rex' }).success).toBe(true);
    expect(PetSchema.safeParse({ kind: 'parrot', name: 'Polly' }).success).toBe(true);
    expect(PetSchema.safeParse({ kind: 'cat' }).success).toBe(false);
  });

  it('keeps Zod out of the main barrel and models', async () => {
    const { result } = await generateCase('zod-isolation', {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: { validation: { library: 'zod', response: false } },
    });
    const importers = result.files
      .filter((f) => f.content.includes("from 'zod'"))
      .map((f) => f.path);
    expect(importers.length).toBeGreaterThan(0);
    expect(importers.every((p) => p.startsWith('zod/'))).toBe(true);
  });
});

describe('runtime validation', () => {
  let server: MockServer;
  let api: Record<string, (...args: unknown[]) => Promise<unknown>> & {
    client: { setConfig(config: Record<string, unknown>): void };
    RequestError: new (...args: never[]) => Error;
  };

  beforeAll(async () => {
    server = await startMockServer();
    const { directory } = await generateCase('zod-runtime', {
      spec: { version: '3.0', input: fixture('petstore-3.0.yaml') },
      features: VALIDATION,
    });
    api = (await import(pathToFileURL(path.join(directory, 'index.ts')).href)) as typeof api;
    api.client.setConfig({ baseUrl: server.url });
  });

  afterAll(async () => {
    await server.close();
  });

  it('accepts valid responses and keeps unknown properties', async () => {
    server.respond(() => ({ body: { id: 1, name: 'Rex', photoUrls: [], extra: 'kept' } }));
    await expect(api.getPetById!({ petId: 1 })).resolves.toEqual({
      id: 1,
      name: 'Rex',
      photoUrls: [],
      extra: 'kept',
    });
  });

  it('rejects invalid responses with a validation RequestError', async () => {
    server.respond(() => ({ body: { id: 'not-a-number', name: 'Rex', photoUrls: [] } }));
    const error = (await api.getPetById!({ petId: 1 }).catch((e: unknown) => e)) as Error & {
      kind: string;
      cause: unknown;
    };
    expect(error).toBeInstanceOf(api.RequestError);
    expect(error.kind).toBe('validation');
    expect((error.cause as Error).name).toBe('ZodError');
  });

  it('validates request bodies before sending', async () => {
    server.respond(() => ({ status: 201, body: { id: 1, name: 'x', photoUrls: [] } }));
    const error = (await api.addPet!({ body: { name: 'x' } }).catch((e: unknown) => e)) as Error & {
      kind: string;
    };
    expect(error).toMatchObject({ name: 'RequestError', kind: 'validation' });
    expect(server.requests).toHaveLength(0);
    await expect(api.addPet!({ body: { name: 'x', photoUrls: [] } })).resolves.toMatchObject({
      id: 1,
    });
  });
});
