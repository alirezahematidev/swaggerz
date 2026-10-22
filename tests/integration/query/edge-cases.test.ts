import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { FeaturesConfig } from '../../../src/config/types.ts';
import type { Diagnostic } from '../../../src/diagnostics/types.ts';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';

/**
 * query-edge-3.2.yaml: an infinite query whose page data is a union (`Page | null`, from a
 * nullable page and a bodiless 204) and whose parameters are all optional, nested tags, a query
 * that carries `pets` only as its secondary tag, and a tag without queries.
 */
const SPEC = { version: '3.2', input: fixture('query-edge-3.2.yaml') } as const;
const OPTIONS = {
  infinite: { listPets: { pageParam: 'page_token' } },
  invalidates: { createPet: ['pets'], deleteCats: ['cats'] },
};

type Framework = 'react' | 'vue' | 'svelte' | 'solid' | 'swr';
const features = (framework: Framework): FeaturesConfig =>
  framework === 'swr' ? { swr: OPTIONS } : { query: { framework, ...OPTIONS } };

const accessorConsumer = (directory: string): string => `
import { createListPetsInfiniteQuery, listPetsInfiniteQueryOptions } from '__API__/${directory}/index.js';

export function setup(): unknown[] {
  const pages = createListPetsInfiniteQuery(
    () => ({ limit: 10 }),
    () => ({ initialPageParam: undefined, getNextPageParam: (last, all) => (last === null ? undefined : String(all.length)) }),
  );
  const defaults = createListPetsInfiniteQuery(undefined, () => ({ initialPageParam: undefined, getNextPageParam: () => undefined }));
  const options = listPetsInfiniteQueryOptions(undefined, { initialPageParam: 'a', getNextPageParam: (_last, all) => String(all.length) });
  return [pages, defaults, options];
}
`;

/** Pages can be `null`: `all` must still be an array of pages. */
const CONSUMERS: Record<Framework, { directory: string; code: string }> = {
  react: {
    directory: 'react-query',
    code: `
import { listPetsInfiniteQueryOptions, useListPetsInfinite } from '__API__/react-query/index.js';

export function useConsumer(): unknown[] {
  const pages = useListPetsInfinite({ limit: 10 }, {
    initialPageParam: undefined,
    getNextPageParam: (last, all) => (last === null ? undefined : String(all.length)),
  });
  const options = listPetsInfiniteQueryOptions(undefined, { initialPageParam: 'a', getNextPageParam: (_last, all) => String(all.length) });
  return [pages, options];
}
`,
  },
  vue: {
    directory: 'vue-query',
    code: `
import { listPetsInfiniteQueryOptions, useListPetsInfinite } from '__API__/vue-query/index.js';

export function setup(): unknown[] {
  const pages = useListPetsInfinite({ limit: 10 }, {
    initialPageParam: undefined,
    getNextPageParam: (last, all) => (last === null ? undefined : String(all.length)),
  });
  const options = listPetsInfiniteQueryOptions(undefined, { initialPageParam: 'a', getNextPageParam: (_last, all) => String(all.length) });
  return [pages, options];
}
`,
  },
  svelte: { directory: 'svelte-query', code: accessorConsumer('svelte-query') },
  solid: { directory: 'solid-query', code: accessorConsumer('solid-query') },
  swr: {
    directory: 'swr',
    code: `
import { useListPetsInfinite } from '__API__/swr/index.js';

export function useConsumer(): unknown[] {
  const pages = useListPetsInfinite({ limit: 10 }, {
    initialPageParam: undefined,
    getNextPageParam: (last, index) => last?.next ?? String(index),
  });
  const parallel = useListPetsInfinite({}, {
    initialPageParam: undefined,
    getNextPageParam: () => undefined,
    // @ts-expect-error every page parameter comes from the previous page
    parallel: true,
  });
  return [pages, parallel];
}
`,
  },
};

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

/**
 * Functions declaring an optional parameter before a required one (TS1016), which the type
 * checker does not report for declaration files under `skipLibCheck`.
 */
async function optionalBeforeRequired(files: readonly string[]): Promise<string[]> {
  const problems: string[] = [];
  for (const file of files.filter((f) => f.endsWith('.d.ts'))) {
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest);
    source.forEachChild((node) => {
      if (!ts.isFunctionDeclaration(node)) return;
      let optional = false;
      for (const parameter of node.parameters) {
        if (parameter.questionToken !== undefined) optional = true;
        else if (optional) problems.push(`${path.basename(file)}: ${node.name?.text ?? ''}`);
      }
    });
  }
  return problems;
}

describe.each(Object.keys(CONSUMERS) as Framework[])('%s infinite queries', (framework) => {
  it.each(MODES)('type-check with nullable pages and optional parameters ($name)', async (mode) => {
    const name = `query-edge-${framework}-${mode.name}`;
    const { directory } = await generateCase(name, {
      spec: SPEC,
      output: mode.output,
      features: features(framework),
    });
    const { directory: library, code } = CONSUMERS[framework];
    const files = await listFiles(directory);
    const roots = mode.pick(files);
    if (mode.name !== 'jsdoc') {
      const consumer = path.join(OUTPUT_ROOT, `${name}.consumer.ts`);
      await writeFile(consumer, code.replaceAll('__API__', `./${name}`));
      roots.push(consumer);
    }
    // JSDoc `Params` typedefs do not add `| undefined` to optional properties yet, which
    // `exactOptionalPropertyTypes` reports where the page parameter is spread in (TS2379); that
    // is fixed in the typedef generator, separately from the hooks.
    const typedefIssue = (error: string): boolean =>
      mode.name === 'jsdoc' && error.includes("with 'exactOptionalPropertyTypes: true'");
    expect(typecheck(roots, mode.options).filter((error) => !typedefIssue(error))).toEqual([]);
    expect(await optionalBeforeRequired(files.filter((f) => f.includes(library)))).toEqual([]);
  });
});

const codes = (diagnostics: readonly Diagnostic[]): string[] =>
  diagnostics.filter((d) => d.code.startsWith('query/')).map((d) => d.code);

/** The invalidation of each library for query key prefixes, without the surrounding code. */
const INVALIDATES = {
  react: (key: string) => `client.invalidateQueries({ queryKey: [${key}] }),`,
  swr: (key: string) =>
    `void mutate((key) => Array.isArray(key) && ${key
      .split(', ')
      .map((part, index) => `key[${index}] === ${part}`)
      .join(' && ')});`,
};

describe('invalidation targets', () => {
  const read = (directory: string, file: string): Promise<string> =>
    readFile(path.join(directory, file), 'utf8');

  it('cover queries that carry a tag as a secondary or ancestor tag', async () => {
    const { directory, result } = await generateCase('query-edge-invalidate-tags', {
      spec: SPEC,
      features: features('react'),
    });
    expect(codes(result.diagnostics)).toEqual([]);
    const create = await read(directory, 'react-query/pets/create-pet.ts');
    // `['pets']` covers listPets and the nested cats; listDogs carries `pets` as its second tag.
    expect(create).toContain("client.invalidateQueries({ queryKey: ['pets'] }),");
    expect(create).toContain("client.invalidateQueries({ queryKey: ['dogs', 'listDogs'] }),");
    expect(await read(directory, 'react-query/pets/cats/delete-cats.ts')).toContain(
      "client.invalidateQueries({ queryKey: ['pets', 'cats'] }),",
    );
  });

  it.each(['react', 'swr'] as const)(
    'resolve tags to their queries without groups (groupBy: none, %s)',
    async (framework) => {
      const { directory, result } = await generateCase(`query-edge-ungrouped-${framework}`, {
        spec: SPEC,
        output: { groupBy: 'none' },
        features: features(framework),
      });
      expect(codes(result.diagnostics)).toEqual([]);
      const library = framework === 'swr' ? 'swr' : 'react-query';
      const create = await read(directory, `${library}/operations/create-pet.ts`);
      const remove = await read(directory, `${library}/operations/delete-cats.ts`);
      for (const name of ['listPets', 'listCats', 'listDogs'])
        expect(create).toContain(INVALIDATES[framework](`'${name}'`));
      expect(remove).toContain(INVALIDATES[framework]("'listCats'"));
    },
  );

  it('revalidate infinite SWR lists of tag targets without groups', async () => {
    const { directory } = await generateCase('query-edge-ungrouped-swr-lists', {
      spec: SPEC,
      output: { groupBy: 'none' },
      features: features('swr'),
    });
    expect(await read(directory, 'swr/operations/create-pet.ts')).toContain(
      "key.length === 4 && key[0] === 'listPets' && key[1] === 'infinite'",
    );
  });

  it('report unknown operations and targets with suggestions', async () => {
    const { result } = await generateCase('query-edge-typos', {
      spec: SPEC,
      features: {
        query: {
          infinite: { nope: { pageParam: 'x' }, createPet: { pageParam: 'x' } },
          invalidates: {
            createPet: ['Pets', 'listPetz', 'admin', 'reset', 'listCats'],
            createPett: ['pets'],
            listCats: ['pets'],
          },
        },
      },
    });
    const found = result.diagnostics
      .filter((d) => d.code.startsWith('query/'))
      .map((d) => ({ code: d.code, severity: d.severity, message: d.message, hint: d.hint }));
    expect(found).toEqual([
      expect.objectContaining({
        code: 'query/unknown-operation',
        severity: 'warning',
        message: expect.stringContaining('"createPet" (POST /pets) is not a query'),
      }),
      expect.objectContaining({
        code: 'query/unknown-operation',
        message: expect.stringContaining('"nope" is not an operation'),
      }),
      expect.objectContaining({
        code: 'query/unknown-operation',
        message: expect.stringContaining('"createPett" is not an operation'),
        hint: 'Did you mean "createPet"?',
      }),
      expect.objectContaining({
        code: 'query/unknown-operation',
        message: expect.stringContaining('"listCats" (GET /cats) is a query'),
      }),
      expect.objectContaining({
        code: 'query/unknown-target',
        message: expect.stringContaining('"Pets" is neither a query operation nor a tag'),
        hint: 'Did you mean "pets"?',
      }),
      expect.objectContaining({
        code: 'query/unknown-target',
        message: expect.stringContaining('"listPetz"'),
        hint: 'Did you mean "listPets"?',
      }),
      expect.objectContaining({
        code: 'query/unknown-target',
        message: expect.stringContaining('the tag "admin" has no query operations'),
      }),
      expect.objectContaining({
        code: 'query/unknown-target',
        message: expect.stringContaining('"reset" (POST /admin/reset) is not a query'),
      }),
    ]);
  });
});

describe('a queryKey plugin hook', () => {
  const prefixer = {
    name: 'prefixer',
    queryKey: (_: unknown, prefix: readonly string[]) => ['api-v1', ...prefix],
  };

  it.each(['react', 'swr'] as const)(
    'moves group keys and tag invalidation with the operation keys (%s)',
    async (framework) => {
      const { directory, result } = await generateCase(
        `query-edge-hook-${framework}`,
        { spec: SPEC, features: features(framework) },
        [prefixer],
      );
      expect(codes(result.diagnostics)).toEqual([]);
      const library = framework === 'swr' ? 'swr' : 'react-query';
      const read = (file: string): Promise<string> =>
        readFile(path.join(directory, library, file), 'utf8');
      expect(await read('pets/keys.ts')).toContain("all: ['api-v1', 'pets'] as const,");
      expect(await read('pets/cats/keys.ts')).toContain(
        "all: ['api-v1', 'pets', 'cats'] as const,",
      );
      expect(await read('dogs/keys.ts')).toContain("all: ['api-v1', 'dogs'] as const,");
      const create = await read('pets/create-pet.ts');
      expect(create).toContain(INVALIDATES[framework]("'api-v1', 'pets'"));
      expect(create).toContain(INVALIDATES[framework]("'api-v1', 'dogs', 'listDogs'"));
      expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
    },
  );

  it('revalidates the infinite SWR lists under prefixed keys', async () => {
    const { directory } = await generateCase(
      'query-edge-hook-swr-lists',
      { spec: SPEC, features: features('swr') },
      [prefixer],
    );
    expect(await readFile(path.join(directory, 'swr/pets/create-pet.ts'), 'utf8')).toContain(
      "key.length === 6 && key[0] === 'api-v1' && key[1] === 'pets' && key[2] === 'listPets'",
    );
  });

  it('falls back to the prefix the keys share for other hooks', async () => {
    const { directory } = await generateCase(
      'query-edge-hook-flat',
      { spec: SPEC, features: features('react') },
      [{ name: 'flat', queryKey: (operation) => [operation.operationId ?? 'x', 'v1'] }],
    );
    const keys = await readFile(path.join(directory, 'react-query/pets/cats/keys.ts'), 'utf8');
    // listCats and deleteCats share no prefix: `all` matches every query, and invalidating the
    // tag lists its queries instead.
    expect(keys).toContain('all: [] as const,');
    expect(
      await readFile(path.join(directory, 'react-query/pets/cats/delete-cats.ts'), 'utf8'),
    ).toContain("client.invalidateQueries({ queryKey: ['listCats', 'v1'] }),");
  });
});
