import { writeFile } from 'node:fs/promises';
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
