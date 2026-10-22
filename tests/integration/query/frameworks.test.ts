import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';
import {
  queryFeatures,
  SOLID_CONSUMER,
  SVELTE_CONSUMER,
  SWR_CONSUMER,
  VUE_CONSUMER,
} from './consumers.ts';

const FRAMEWORKS = [
  { framework: 'vue', directory: 'vue-query', pkg: '@tanstack/vue-query', consumer: VUE_CONSUMER },
  {
    framework: 'svelte',
    directory: 'svelte-query',
    pkg: '@tanstack/svelte-query',
    consumer: SVELTE_CONSUMER,
  },
  {
    framework: 'solid',
    directory: 'solid-query',
    pkg: '@tanstack/solid-query',
    consumer: SOLID_CONSUMER,
  },
  { framework: 'swr', directory: 'swr', pkg: 'swr', consumer: SWR_CONSUMER },
] as const;

const MODES = [
  {
    name: 'ts',
    output: {},
    options: BROWSER,
    pick: (files: string[]) => files.filter((f) => f.endsWith('.ts')),
  },
  {
    name: 'js',
    output: { language: 'javascript', declarations: true },
    options: BROWSER,
    pick: (files: string[]) => files.filter((f) => f.endsWith('.d.ts')),
  },
  {
    name: 'jsdoc',
    output: { language: 'javascript', declarations: false },
    options: CHECK_JS,
    pick: (files: string[]) =>
      files.filter(
        (f) =>
          f.endsWith('.d.ts') ||
          (f.endsWith('.js') && !files.includes(f.replace(/\.js$/, '.d.ts'))),
      ),
  },
] as const;

describe.each(FRAMEWORKS)('$framework hooks', ({ framework, directory, pkg, consumer }) => {
  it.each(MODES)('type-check in $name output with the fetch and axios adapters', async (mode) => {
    for (const adapter of ['fetch', 'axios'] as const) {
      const name = `query-${framework}-${mode.name}-${adapter}`;
      const { directory: output } = await generateCase(name, {
        spec: { version: '3.1', input: fixture('features-3.1.yaml') },
        output: mode.output,
        client: { adapter },
        features: queryFeatures(framework),
      });
      const file = path.join(OUTPUT_ROOT, `${name}.consumer.ts`);
      await writeFile(file, consumer.replaceAll('__API__', `./${name}`));
      expect(typecheck([...mode.pick(await listFiles(output)), file], mode.options)).toEqual([]);
    }
  });

  it(`imports ${pkg} only from ${directory}/`, async () => {
    const { result } = await generateCase(`query-${framework}-isolation`, {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: queryFeatures(framework),
    });
    const importers = result.files.filter((f) => f.content.includes(`'${pkg}`)).map((f) => f.path);
    expect(importers.length).toBeGreaterThan(0);
    expect(importers.every((p) => p.startsWith(`${directory}/`))).toBe(true);
    expect(result.files.some((f) => f.path.startsWith('react-query/'))).toBe(false);
  });

  it('nests key factories like OpenAPI 3.2 tags', async () => {
    const name = `query-${framework}-features32`;
    const { directory: output, result } = await generateCase(name, {
      spec: { version: '3.2', input: fixture('features-3.2.yaml') },
      features: queryFeatures(framework),
    });
    const keys = result.files.find((f) => f.path === `${directory}/pets/cats/keys.ts`)?.content;
    expect(keys).toContain("all: ['pets', 'cats'] as const,");
    expect(typecheck(await listFiles(output, '.ts'), BROWSER)).toEqual([]);
  });
});

describe('features.query', () => {
  it('generates React hooks for `true` and keeps `reactQuery` as an alias', async () => {
    for (const [name, features] of [
      ['query-true', { query: true }],
      ['query-alias', { reactQuery: true }],
    ] as const) {
      const { result } = await generateCase(name, {
        spec: { version: '3.1', input: fixture('features-3.1.yaml') },
        features,
      });
      expect(result.files.some((f) => f.path === 'react-query/shapes/get-shape.ts')).toBe(true);
    }
  });

  it('names Svelte and Solid primitives create…Query and create…Mutation', async () => {
    const { result } = await generateCase('query-svelte-names', {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: queryFeatures('svelte'),
    });
    const hooks = result.files
      .flatMap((f) => f.exports ?? [])
      .filter((e) => e.kind === 'hook')
      .map((e) => e.name);
    expect(hooks).toContain('createGetShapeQuery');
    expect(hooks).toContain('createCreateShapeMutation');
    expect(hooks).toContain('createListShapesInfiniteQuery');
  });
});
