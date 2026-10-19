/**
 * Verifies that generated code type-checks with the oldest and newest supported versions of
 * TypeScript and TanStack Query. Dependencies are installed into `.compat/` (network required).
 *
 * Usage: node scripts/compat.ts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../src/api.ts';
import type { UserConfig } from '../src/config/types.ts';
import { FEATURES_CONSUMER, PETSTORE_CONSUMER } from '../tests/integration/codegen/consumers.ts';
import {
  REACT_QUERY_CONFIG,
  REACT_QUERY_CONSUMER,
} from '../tests/integration/react-query/config.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORK = path.join(ROOT, '.compat');

/** Package aliases installed side by side. */
const DEPENDENCIES: Record<string, string> = {
  'ts-5.0': 'npm:typescript@5.0.4',
  'ts-6': 'npm:typescript@~6.0.3',
  'ts-7': 'npm:typescript@^7.0.2',
  '@tanstack/react-query': '5.0.0',
  react: '^19.2.0',
  '@types/react': '^19.2.0',
  axios: '1.0.0',
  zod: '4.0.15',
};

const COMPILERS = [
  { name: 'TypeScript 5.0', bin: 'ts-5.0', modern: false },
  { name: 'TypeScript 6', bin: 'ts-6', modern: true },
  { name: 'TypeScript 7 (native)', bin: 'ts-7', modern: true },
];

interface Case {
  readonly name: string;
  readonly config: Omit<UserConfig, 'output'> & { output?: UserConfig['output'] };
  readonly consumer: string;
  readonly declarations?: boolean;
}

const fixture = (name: string): string => path.join(ROOT, 'fixtures', 'specs', name);
const CASES: readonly Case[] = [
  {
    name: 'petstore-fetch',
    config: { spec: { version: '3.0', input: fixture('petstore-3.0.yaml') } },
    consumer: PETSTORE_CONSUMER,
  },
  {
    name: 'petstore-axios',
    config: {
      spec: { version: '3.0', input: fixture('petstore-3.0.yaml') },
      client: { adapter: 'axios' },
    },
    consumer: PETSTORE_CONSUMER,
  },
  {
    name: 'features',
    config: { spec: { version: '3.1', input: fixture('features-3.1.yaml') } },
    consumer: FEATURES_CONSUMER,
  },
  {
    name: 'react-query',
    config: {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: REACT_QUERY_CONFIG,
    },
    consumer: REACT_QUERY_CONSUMER.replaceAll(
      '__API__/react-query/index.js',
      '__API__/react-query/index.js',
    ),
  },
  {
    name: 'zod',
    config: {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: { validation: { library: 'zod', request: true } },
    },
    consumer: FEATURES_CONSUMER,
  },
  {
    name: 'react-query-js',
    config: {
      spec: { version: '3.1', input: fixture('features-3.1.yaml') },
      features: REACT_QUERY_CONFIG,
      output: { language: 'javascript' },
    },
    consumer: REACT_QUERY_CONSUMER,
    declarations: true,
  },
];

async function install(): Promise<void> {
  const manifest = JSON.stringify(
    { name: 'compat', private: true, type: 'module', dependencies: DEPENDENCIES },
    null,
    2,
  );
  const file = path.join(WORK, 'package.json');
  const current = existsSync(file) ? await readFile(file, 'utf8') : '';
  if (current === manifest && existsSync(path.join(WORK, 'node_modules'))) return;
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  await writeFile(file, manifest);
  console.log('Installing compatibility dependencies…');
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--loglevel=error', '--legacy-peer-deps'],
    { cwd: WORK, stdio: 'inherit' },
  );
}

async function prepare(testCase: Case): Promise<string> {
  const directory = path.join(WORK, 'cases', testCase.name);
  await rm(directory, { recursive: true, force: true });
  const result = await generate({
    cwd: WORK,
    config: {
      ...testCase.config,
      output: { ...testCase.config.output, directory: path.join(directory, 'api') },
    },
  });
  if (!result.ok) throw new Error(`Generation failed for ${testCase.name}`);
  const consumer = testCase.consumer
    .replaceAll('__API__', './api')
    .replace("'./api/index.js'", "'./api/index.js'");
  await writeFile(
    path.join(directory, 'consumer.ts'),
    consumer.replace(/from '\.\/api'/g, "from './api/index.js'"),
  );
  return directory;
}

function tsconfig(modern: boolean, javascript: boolean): Record<string, unknown> {
  return {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      types: [],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noImplicitReturns: true,
      noPropertyAccessFromIndexSignature: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      skipLibCheck: true,
      noEmit: true,
      typeRoots: ['../../node_modules/@types'],
      ...(modern && !javascript ? { erasableSyntaxOnly: true } : {}),
    },
    include: javascript ? ['api/**/*.d.ts', 'consumer.ts'] : ['api/**/*.ts', 'consumer.ts'],
  };
}

await install();
const rows: string[] = [];
let failed = false;
for (const testCase of CASES) {
  const directory = await prepare(testCase);
  for (const compiler of COMPILERS) {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify(tsconfig(compiler.modern, testCase.declarations === true), null, 2),
    );
    const tsc = path.join(WORK, 'node_modules', compiler.bin, 'bin', 'tsc');
    const run = spawnSync(process.execPath, [tsc, '-p', directory], { encoding: 'utf8' });
    const ok = run.status === 0;
    failed ||= !ok;
    rows.push(`| ${testCase.name} | ${compiler.name} | ${ok ? 'pass' : 'FAIL'} |`);
    if (!ok) console.error(`\n${testCase.name} with ${compiler.name}:\n${run.stdout}${run.stderr}`);
  }
}
const versions = JSON.parse(
  await readFile(
    path.join(WORK, 'node_modules', '@tanstack', 'react-query', 'package.json'),
    'utf8',
  ),
) as { version: string };
console.log(
  `\nTanStack Query ${versions.version}, axios ${DEPENDENCIES.axios}, zod ${DEPENDENCIES.zod}\n`,
);
console.log('| Case | Compiler | Result |\n| --- | --- | --- |');
console.log(rows.join('\n'));
process.exitCode = failed ? 1 : 0;
