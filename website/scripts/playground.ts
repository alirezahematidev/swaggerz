/**
 * Builds the browser compiler (`playground/compiler.ts` with Node.js shims) into
 * `src/generated/compiler.js`, then proves it: the bundle compiles the fixture specifications in
 * Node.js and must produce exactly the files the CLI's pipeline produces for them.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';
import { loadConfig } from '../../src/config/load.ts';
import type { UserConfig } from '../../src/config/types.ts';
import { compile } from '../../src/pipeline/compile.ts';
import { DriftError, GENERATED, ROOT, WEBSITE } from './data/output.ts';

const SHIMS = path.join(WEBSITE, 'playground', 'shims');
const OUTFILE = path.join(GENERATED, 'compiler.js');

/** Gzipped size the compiler may reach; the playground page's budget is 600 KB in all. */
const BUDGET = 350_000;

const NODE_MODULES: Record<string, string> = {
  'node:fs/promises': 'fs-promises.ts',
  'node:fs': 'fs.ts',
  'node:path': 'path.ts',
  'node:url': 'url.ts',
  'node:crypto': 'crypto.ts',
  'node:util': 'util.ts',
};

async function embeddedFiles(): Promise<string> {
  const files: Record<string, string> = {};
  for (const set of ['runtime', 'mocks']) {
    const directory = path.join(ROOT, 'assets', set);
    for (const name of (await readdir(directory)).sort()) {
      files[`/assets/${set}/${name}`] = await readFile(path.join(directory, name), 'utf8');
    }
  }
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  files['/package.json'] = JSON.stringify({ name: pkg.name, version: pkg.version, bin: pkg.bin });
  return `export const files = ${JSON.stringify(files)};`;
}

const shims: esbuild.Plugin = {
  name: 'node-shims',
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => {
      const shim = NODE_MODULES[args.path];
      if (shim === undefined) {
        return {
          errors: [{ text: `${args.path} has no browser shim (imported by ${args.importer})` }],
        };
      }
      return { path: path.join(SHIMS, shim) };
    });
    build.onResolve({ filter: /^virtual:embedded-files$/ }, () => ({
      path: 'embedded-files',
      namespace: 'embedded',
    }));
    build.onLoad({ filter: /.*/, namespace: 'embedded' }, async () => ({
      contents: await embeddedFiles(),
      loader: 'js',
    }));
  },
};

export async function buildCompiler(): Promise<{ bytes: number; gzip: number }> {
  const result = await esbuild.build({
    entryPoints: [path.join(WEBSITE, 'playground', 'compiler.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    outfile: OUTFILE,
    plugins: [shims],
    logLevel: 'warning',
    metafile: true,
  });
  const code = await readFile(OUTFILE);
  const gzip = gzipSync(code).length;
  if (gzip > BUDGET) {
    throw new DriftError('The browser compiler is over its size budget:', [
      `${Math.round(gzip / 1000)} kB gzipped, budget ${BUDGET / 1000} kB`,
    ]);
  }
  void result;
  return { bytes: code.length, gzip };
}

/** Single-document fixtures, which need no external references. */
const FIXTURES: readonly { file: string; version: '2.0' | '3.0' | '3.1' | '3.2' }[] = [
  { file: 'petstore-2.0.json', version: '2.0' },
  { file: 'petstore-3.0.yaml', version: '3.0' },
  { file: 'edge-cases-3.0.yaml', version: '3.0' },
  { file: 'lint-3.0.yaml', version: '3.0' },
  { file: 'features-3.1.yaml', version: '3.1' },
  { file: 'advanced-3.1.yaml', version: '3.1' },
  { file: 'ids-3.1.yaml', version: '3.1' },
  { file: 'query-edge-3.2.yaml', version: '3.2' },
];

const VARIANTS: readonly Omit<UserConfig, 'spec'>[] = [
  {},
  {
    output: { language: 'javascript' },
    client: { adapter: 'axios' },
    features: { query: { framework: 'vue' }, validation: 'valibot' },
  },
  { features: { swr: true, validation: 'arktype' }, types: { dates: 'Date', readWrite: 'merged' } },
  { features: { query: true, validation: 'zod', mocks: 'msw' }, types: { dates: 'Date' } },
];

interface Compiler {
  compileInBrowser(input: { files: Record<string, string>; config: UserConfig }): Promise<{
    ok: boolean;
    files: { path: string; content: string }[];
  }>;
}

export async function verifyCompiler(): Promise<number> {
  const compiler = (await import(`${pathToFileURL(OUTFILE).href}?v=${Date.now()}`)) as Compiler;
  const problems: string[] = [];
  let compared = 0;
  for (const fixture of FIXTURES) {
    const text = await readFile(path.join(ROOT, 'fixtures', 'specs', fixture.file), 'utf8');
    for (const [index, variant] of VARIANTS.entries()) {
      const config: UserConfig = {
        ...variant,
        spec: { version: fixture.version, input: `./${fixture.file}`, refs: { external: 'none' } },
      };
      const browser = await compiler.compileInBrowser({ files: { [fixture.file]: text }, config });
      const loaded = await loadConfig({
        cwd: path.join(ROOT, 'fixtures', 'specs'),
        inlineConfig: config,
        env: {},
      });
      const node = await compile({ config: loaded.config, plugins: loaded.plugins });
      const label = `${fixture.file} (variant ${index})`;
      if (browser.ok !== node.ok) {
        problems.push(
          `${label}: the browser compiler says ok=${browser.ok}, the CLI's pipeline ok=${node.ok}`,
        );
        continue;
      }
      const expected = new Map(node.files.map((file) => [file.path, file.content]));
      const actual = new Map(browser.files.map((file) => [file.path, file.content]));
      for (const [file, content] of expected) {
        if (!actual.has(file)) problems.push(`${label}: ${file} is missing in the browser`);
        else if (actual.get(file) !== content)
          problems.push(`${label}: ${file} differs in the browser`);
      }
      for (const file of actual.keys()) {
        if (!expected.has(file))
          problems.push(`${label}: ${file} is only generated in the browser`);
      }
      compared += expected.size;
    }
  }
  if (problems.length > 0) {
    throw new DriftError('The browser compiler and the CLI disagree:', problems.slice(0, 30));
  }
  return compared;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const size = await buildCompiler();
  const compared = await verifyCompiler();
  console.log(
    `Built the browser compiler (${Math.round(size.bytes / 1000)} kB, ${Math.round(size.gzip / 1000)} kB gzipped); ${compared} files match the CLI.`,
  );
}
