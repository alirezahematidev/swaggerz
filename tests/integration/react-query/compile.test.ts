import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import { BROWSER, CHECK_JS, typecheck } from '../../support/typescript.ts';
import { REACT_QUERY_CONFIG, REACT_QUERY_CONSUMER as CONSUMER } from './config.ts';

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

describe.each(MODES)('React Query $name output', (mode) => {
  it.each(['fetch', 'axios'] as const)(
    'type-checks hooks and options with the %s adapter',
    async (adapter) => {
      const name = `rq-compile-${mode.name}-${adapter}`;
      const { directory } = await generateCase(name, {
        spec: { version: '3.1', input: fixture('features-3.1.yaml') },
        output: mode.output,
        client: { adapter },
        features: REACT_QUERY_CONFIG,
      });
      const consumer = path.join(OUTPUT_ROOT, `${name}.consumer.ts`);
      await writeFile(consumer, CONSUMER.replaceAll('__API__', `./${name}`));
      expect(typecheck([...mode.pick(await listFiles(directory)), consumer], mode.options)).toEqual(
        [],
      );
    },
  );
});

describe('React Query for operations without a response body', () => {
  it('does not import types the hooks do not use', async () => {
    // logoutUser has no response body: its query data is `null` and its response type unused.
    const { directory } = await generateCase('rq-petstore', {
      spec: { version: '3.0', input: fixture('petstore-3.0.yaml') },
      features: { reactQuery: true },
    });
    expect(typecheck(await listFiles(directory, '.ts'), BROWSER)).toEqual([]);
  });
});

describe('React Query with OpenAPI 3.2', () => {
  it('nests key factories like tags and makes QUERY operations queries', async () => {
    const name = 'rq-features32';
    const { directory } = await generateCase(name, {
      spec: { version: '3.2', input: fixture('features-3.2.yaml') },
      features: { reactQuery: { invalidates: { copyDocument: ['pets'] } } },
    });
    const read = (file: string): Promise<string> => readFile(path.join(directory, file), 'utf8');
    expect(await read('react-query/pets/keys.ts')).toContain("all: ['pets'] as const,");
    expect(await read('react-query/pets/cats/keys.ts')).toContain(
      "all: ['pets', 'cats'] as const,",
    );
    expect(await read('react-query/pets/cats/get-pet.ts')).toContain(
      "return ['pets', 'cats', 'getPet', params];",
    );
    // QUERY is safe: a query hook whose key includes the query document.
    const search = await read('react-query/pets/search-pets.ts');
    expect(search).toContain('export function useSearchPets');
    expect(search).toContain("return ['pets', 'searchPets', params];");
    // Invalidating the parent tag covers the nested one.
    expect(await read('react-query/documents/copy-document.ts')).toContain(
      "client.invalidateQueries({ queryKey: ['pets'] })",
    );
    const consumer = path.join(OUTPUT_ROOT, `${name}.consumer.ts`);
    await writeFile(
      consumer,
      `import { petsCatsKeys, petsKeys, useSearchPets } from './${name}/react-query/index.js';
export function usage() {
  const all: readonly ['pets'] = petsKeys.all;
  const cats: readonly ['pets', 'cats'] = petsCatsKeys.all;
  return [all, cats, useSearchPets({ body: { name: 'Tom' } }).data];
}
`,
    );
    expect(typecheck([...(await listFiles(directory, '.ts')), consumer], BROWSER)).toEqual([]);
  });
});

describe('React Query isolation', () => {
  it('keeps React out of operation modules and the main barrel', async () => {
    const { result } = await generateCase('rq-isolation', {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: REACT_QUERY_CONFIG,
    });
    const reactImporters = result.files
      .filter((f) => f.content.includes('@tanstack/react-query'))
      .map((f) => f.path);
    expect(reactImporters.length).toBeGreaterThan(0);
    expect(reactImporters.every((p) => p.startsWith('react-query/'))).toBe(true);
  });

  it('generates nothing React-related when disabled', async () => {
    const { result } = await generateCase('rq-disabled', {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
    });
    expect(
      result.files.some(
        (f) => f.path.startsWith('react-query/') || f.content.includes('react-query'),
      ),
    ).toBe(false);
  });
});
