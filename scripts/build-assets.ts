/**
 * Builds non-TypeScript-compiled package assets:
 *
 * - `assets/runtime/`: the runtime emitted into generated clients. Each template in
 *   `src/templates/runtime/*.ts` is published as `.ts` (TypeScript output), `.js` and `.d.ts`
 *   (JavaScript output).
 * - `assets/dashboard/`: the bundled dashboard web app.
 *
 * Usage: `node scripts/build-assets.ts [runtime|dashboard]`
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEMPLATE_DIR = path.join(ROOT, 'src', 'templates', 'runtime');
const RUNTIME_OUT = path.join(ROOT, 'assets', 'runtime');
const DASHBOARD_ENTRY = path.join(ROOT, 'src', 'dashboard', 'client', 'main.tsx');
const DASHBOARD_OUT = path.join(ROOT, 'assets', 'dashboard');

export async function buildRuntimeTemplates(): Promise<string[]> {
  const files = (await readdir(TEMPLATE_DIR))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .sort();
  await rm(RUNTIME_OUT, { recursive: true, force: true });
  await mkdir(RUNTIME_OUT, { recursive: true });

  const declarations = new Map<string, string>();
  const program = ts.createProgram(
    files.map((file) => path.join(TEMPLATE_DIR, file)),
    {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      strict: true,
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true,
      removeComments: false,
    },
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => ROOT,
        getNewLine: () => '\n',
      }),
    );
  }
  program.emit(undefined, (fileName, text) => {
    declarations.set(path.basename(fileName), text);
  });

  for (const file of files) {
    const source = await readFile(path.join(TEMPLATE_DIR, file), 'utf8');
    const base = file.slice(0, -'.ts'.length);
    const js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
        removeComments: false,
      },
    }).outputText;
    const dts = declarations.get(`${base}.d.ts`);
    if (dts === undefined) throw new Error(`No declarations emitted for ${file}`);
    await writeFile(path.join(RUNTIME_OUT, `${base}.ts`), source);
    await writeFile(path.join(RUNTIME_OUT, `${base}.js`), js);
    await writeFile(path.join(RUNTIME_OUT, `${base}.d.ts`), dts);
  }
  return files;
}

/**
 * Bundles the dashboard (React, Radix primitives, Tailwind CSS) with Vite into fixed file names:
 * `app.js`, `app.css`, `fonts/*.woff2` and `favicon.svg` (the brand mark). The server serves
 * exactly these files.
 */
export async function buildDashboard(): Promise<void> {
  const [{ build }, { default: tailwind }] = await Promise.all([
    import('vite'),
    import('@tailwindcss/vite'),
  ]);
  await rm(DASHBOARD_OUT, { recursive: true, force: true });
  await build({
    configFile: false,
    root: path.dirname(DASHBOARD_ENTRY),
    base: '/assets/',
    logLevel: 'warn',
    publicDir: false,
    plugins: [tailwind()],
    // Always the production JSX transform: Vite derives it from NODE_ENV, which is `test` when the
    // test suite's setup builds the bundle, and the development transform's jsxDEV does not exist
    // in React's production build.
    oxc: { jsx: { runtime: 'automatic', development: false } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: DASHBOARD_OUT,
      emptyOutDir: true,
      assetsDir: '',
      cssCodeSplit: false,
      sourcemap: false,
      target: 'es2022',
      reportCompressedSize: false,
      // One bundle on purpose: the dashboard is served locally and loads once.
      chunkSizeWarningLimit: 2048,
      rolldownOptions: {
        input: DASHBOARD_ENTRY,
        output: {
          entryFileNames: 'app.js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: (asset) =>
            asset.names.some((name) => name.endsWith('.css')) ? 'app.css' : 'fonts/[name][extname]',
        },
        onwarn(warning, warn) {
          // Radix and cmdk mark their modules "use client" for React Server Components.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          warn(warning);
        },
      },
    },
  });
  await writeFile(
    path.join(DASHBOARD_OUT, 'favicon.svg'),
    await readFile(path.join(ROOT, 'brand', 'mark.svg'), 'utf8'),
  );
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const target = process.argv[2];
  if (target === undefined || target === 'runtime') {
    const files = await buildRuntimeTemplates();
    console.log(`runtime templates: ${files.join(', ')}`);
  }
  if (target === undefined || target === 'dashboard') {
    await buildDashboard();
    console.log('dashboard bundle built');
  }
}

/** Writes `config.schema.json` (JSON Schema for JSON and YAML config files) to the package root. */
export async function buildConfigSchema(): Promise<string> {
  const { configJsonSchema } = await import('../src/config/validate.ts');
  const file = path.join(ROOT, 'config.schema.json');
  await writeFile(file, `${JSON.stringify(configJsonSchema(), null, 2)}\n`);
  return file;
}
