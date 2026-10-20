import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../helpers.ts';
import { generateCase, listFiles, OUTPUT_ROOT } from '../../support/generate.ts';
import {
  BROWSER,
  CHECK_JS,
  javascriptSyntaxErrors,
  NODE,
  typecheck,
} from '../../support/typescript.ts';
import type { UserConfig } from '../../../src/config/types.ts';
import {
  ADVANCED_CONSUMER,
  FEATURES_CONSUMER,
  PETSTORE_CONSUMER,
  SWAGGER2_CONSUMER,
} from './consumers.ts';

interface Spec {
  readonly name: string;
  readonly input: string;
  readonly version: '2.0' | '3.0' | '3.1';
  readonly consumer: string | undefined;
  readonly config?: Partial<UserConfig>;
}

const SPECS: readonly Spec[] = [
  { name: 'petstore30', input: 'petstore-3.0.yaml', version: '3.0', consumer: PETSTORE_CONSUMER },
  { name: 'features31', input: 'features-3.1.yaml', version: '3.1', consumer: FEATURES_CONSUMER },
  { name: 'swagger20', input: 'petstore-2.0.json', version: '2.0', consumer: SWAGGER2_CONSUMER },
  { name: 'external30', input: 'external/openapi.yaml', version: '3.0', consumer: undefined },
  { name: 'ids31', input: 'ids-3.1.yaml', version: '3.1', consumer: undefined },
  {
    name: 'advanced31',
    input: 'advanced-3.1.yaml',
    version: '3.1',
    consumer: ADVANCED_CONSUMER,
    config: {
      types: { dates: 'Date' },
      features: { validation: { library: 'zod', request: true } },
    },
  },
];

const ADAPTERS = ['fetch', 'axios'] as const;

async function writeConsumer(caseName: string, source: string, extension = '.ts'): Promise<string> {
  const file = path.join(OUTPUT_ROOT, `${caseName}.consumer${extension}`);
  await writeFile(file, source.replaceAll('__API__', `./${caseName}/index.js`));
  return file;
}

describe.each(SPECS)('$name', (spec) => {
  describe.each(ADAPTERS)('%s adapter', (adapter) => {
    it('TypeScript output compiles in strict browser and Node.js projects', async () => {
      const name = `compile-${spec.name}-ts-${adapter}`;
      const { directory } = await generateCase(name, {
        ...spec.config,
        spec: { version: spec.version, input: fixture(spec.input) },
        client: { adapter },
      });
      const files = await listFiles(directory, '.ts');
      const roots =
        spec.consumer === undefined ? files : [...files, await writeConsumer(name, spec.consumer)];
      expect(typecheck(roots, BROWSER)).toEqual([]);
      // tests/.output/package.json ("type": "module") is written once by the global setup.
      expect(typecheck(roots, NODE)).toEqual([]);
    });

    it('JavaScript output is valid JS with declarations that type-check', async () => {
      const name = `compile-${spec.name}-js-${adapter}`;
      const { directory } = await generateCase(name, {
        ...spec.config,
        spec: { version: spec.version, input: fixture(spec.input) },
        output: { language: 'javascript', declarations: true },
        client: { adapter },
      });
      for (const file of await listFiles(directory, '.js')) {
        const errors = javascriptSyntaxErrors(file, await readFile(file, 'utf8'));
        expect(errors, path.relative(directory, file)).toEqual([]);
      }
      const declarations = await listFiles(directory, '.d.ts');
      expect(declarations.length).toBe((await listFiles(directory, '.js')).length);
      const roots =
        spec.consumer === undefined
          ? declarations
          : [...declarations, await writeConsumer(name, spec.consumer)];
      expect(typecheck(roots, BROWSER)).toEqual([]);
    });

    it('JavaScript output without declarations is typed through JSDoc', async () => {
      const name = `compile-${spec.name}-jsdoc-${adapter}`;
      const { directory } = await generateCase(name, {
        ...spec.config,
        spec: { version: spec.version, input: fixture(spec.input) },
        output: { language: 'javascript', declarations: false },
        client: { adapter },
      });
      // Like a tsconfig \`include\`, a .d.ts shadows the .js file with the same name (the runtime).
      const all = await listFiles(directory);
      const jsFiles = all.filter(
        (f) =>
          f.endsWith('.d.ts') || (f.endsWith('.js') && !all.includes(f.replace(/\.js$/, '.d.ts'))),
      );
      const roots =
        spec.consumer === undefined
          ? jsFiles
          : [...jsFiles, await writeConsumer(name, spec.consumer)];
      expect(typecheck(roots, CHECK_JS)).toEqual([]);
    });
  });
});
