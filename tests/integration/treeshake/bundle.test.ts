import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { rollup } from 'rollup';
import { build as viteBuild } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { largeSpec } from '../../../scripts/large-spec.ts';
import { generateCase, OUTPUT_ROOT } from '../../support/generate.ts';

const RESOURCES = 200; // 1,000 operations and 602 models
const USED = ['getResource7', 'listResource42', 'createResource3'];
const EXTERNAL = ['@tanstack/react-query', 'react', 'axios'];
const ROOT = path.join(OUTPUT_ROOT, 'treeshake');
const sizes: Record<string, number> = {};

/** Operation ids that appear in a bundle, from the `operationId` strings of request descriptors. */
function operationIds(code: string): string[] {
  return [
    ...new Set(
      [...code.matchAll(/(?:get|list|create|update|delete)Resource\d+/g)].map((m) => m[0]),
    ),
  ].filter((id) => code.includes(`"${id}"`) || code.includes(`'${id}'`));
}

async function entry(name: string, source: string): Promise<string> {
  const file = path.join(ROOT, `${name}.entry.ts`);
  await writeFile(file, source);
  return file;
}

async function bundleWithEsbuild(
  file: string,
  external: readonly string[] = EXTERNAL,
): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    external: [...external],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  return result.outputFiles[0]?.text ?? '';
}

async function bundleWithRollup(file: string): Promise<string> {
  const bundle = await rollup({
    input: file,
    external: EXTERNAL,
    logLevel: 'silent',
    treeshake: true,
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();
  return output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n');
}

async function bundleWithVite(file: string): Promise<string> {
  const result = await viteBuild({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry: file, formats: ['es'], fileName: 'bundle' },
      rollupOptions: { external: EXTERNAL },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs
    .flatMap((out) => ('output' in out ? out.output : []))
    .map((chunk) => ('code' in chunk ? chunk.code : ''))
    .join('\n');
}

beforeAll(async () => {
  await mkdir(ROOT, { recursive: true });
  const spec = path.join(ROOT, 'large.json');
  await writeFile(spec, JSON.stringify(largeSpec({ resources: RESOURCES })));
  await generateCase('treeshake/ts', {
    spec: { version: '3.0', input: spec },
    features: { reactQuery: true },
  });
  await generateCase('treeshake/js', {
    spec: { version: '3.0', input: spec },
    output: { language: 'javascript' },
  });
}, 120_000);

const BARREL_IMPORT = (
  dir: string,
): string => `import { ${USED.join(', ')} } from './${dir}/index.js';
export const run = () => Promise.all([getResource7({ id: '1' }), listResource42({ limit: 5 }), createResource3({ body: { name: 'x' } })]);
`;

describe('tree-shaking of a 1,000-operation client', () => {
  it('keeps only imported operations when importing through the barrel (esbuild, TypeScript output)', async () => {
    const code = await bundleWithEsbuild(await entry('barrel-ts', BARREL_IMPORT('ts')));
    sizes['esbuild: 3 operations via barrel'] = code.length;
    expect(operationIds(code).sort()).toEqual([...USED].sort());
    expect(code).not.toContain('/resources-99');
  });

  it('keeps only imported operations when importing modules directly (esbuild)', async () => {
    const code = await bundleWithEsbuild(
      await entry(
        'direct-ts',
        `import { getResource7 } from './ts/resources-7/get-resource7.js';
export const run = () => getResource7({ id: '1' });
`,
      ),
    );
    sizes['esbuild: 1 operation via direct import'] = code.length;
    expect(operationIds(code)).toEqual(['getResource7']);
  });

  it('removes unused operations with Rollup (JavaScript output)', async () => {
    const code = await bundleWithRollup(await entry('barrel-js', BARREL_IMPORT('js')));
    sizes['rollup: 3 operations via barrel (unminified)'] = code.length;
    expect(operationIds(code).sort()).toEqual([...USED].sort());
  });

  it('removes unused operations with Vite (production build)', async () => {
    const code = await bundleWithVite(await entry('barrel-vite', BARREL_IMPORT('ts')));
    sizes['vite: 3 operations via barrel'] = code.length;
    expect(operationIds(code).sort()).toEqual([...USED].sort());
  });

  it('keeps React Query hooks independent per operation', async () => {
    // React and TanStack Query are bundled (not external) as in a real app, so their
    // `sideEffects: false` metadata applies; the baseline uses `useQuery` directly.
    const code = await bundleWithEsbuild(
      await entry('react-query', "export { useGetResource7 } from './ts/react-query/index.js';\n"),
      [],
    );
    const baseline = await bundleWithEsbuild(
      await entry(
        'react-query-baseline',
        "export { useQuery, queryOptions } from '@tanstack/react-query';\n",
      ),
      [],
    );
    sizes['esbuild: 1 React Query hook via barrel, minus TanStack Query itself'] =
      code.length - baseline.length;
    expect(operationIds(code)).toEqual(['getResource7']);
    expect(code.length - baseline.length).toBeLessThan(
      (sizes['esbuild: 1 operation via direct import'] ?? 0) + 2_000,
    );
  });

  it('is a small fraction of the full client', async () => {
    const full = await bundleWithEsbuild(await entry('full', "export * from './ts/index.js';\n"));
    sizes['esbuild: entire client (1,000 operations)'] = full.length;
    expect(operationIds(full)).toHaveLength(RESOURCES * 5);
    await writeFile(path.join(ROOT, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
    // The shared runtime is a fixed cost; each additional operation adds only its own module.
    const one = sizes['esbuild: 1 operation via direct import'] ?? Infinity;
    const three = sizes['esbuild: 3 operations via barrel'] ?? Infinity;
    const perOperation = (three - one) / 2;
    expect(perOperation).toBeLessThan(((full.length - one) / (RESOURCES * 5)) * 3);
    expect(three / full.length).toBeLessThan(0.1);
  });
});
