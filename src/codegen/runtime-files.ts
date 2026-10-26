import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResolvedConfig } from '../config/resolved.ts';
import { header, importExtension } from './context.ts';
import type { GeneratedFile } from './types.ts';

/** Runtime modules emitted into every client, in dependency order. */
const COMMON_RUNTIME = [
  'types',
  'errors',
  'serialization',
  'signal',
  'client',
  'middleware',
] as const;

/** `src/codegen` and `dist/codegen` both sit two levels below the package root. */
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

const cache = new Map<string, string>();

/** A built template, e.g. `runtime/client.ts` or `mocks/support.js`. */
function readTemplate(file: string): string {
  let content = cache.get(file);
  if (content === undefined) {
    try {
      content = readFileSync(path.join(ASSETS, file), 'utf8');
    } catch (error) {
      throw new Error(
        `Runtime template ${file} is missing. Run \`node scripts/build-assets.ts runtime\` (or reinstall the package).`,
        { cause: error },
      );
    }
    cache.set(file, content);
  }
  return content;
}

export function runtimeModules(config: ResolvedConfig): string[] {
  return [
    ...COMMON_RUNTIME,
    ...(config.types.dates === 'Date' ? ['dates'] : []),
    config.client.adapter,
  ];
}

/**
 * Emits the runtime files for the configured language and adapter, and the mocks support module
 * with `features.mocks`.
 */
export function generateRuntimeFiles(config: ResolvedConfig): GeneratedFile[] {
  const extension = importExtension(config);
  const rewrite = (source: string): string =>
    source.replace(
      /(from\s+['"])\.\/([\w-]+)\.js(['"])/g,
      (_match, start: string, name: string, end: string) => `${start}./${name}${extension}${end}`,
    );
  const templates: { name: string; origin: string }[] = runtimeModules(config).map((name) => ({
    name: `runtime/${name}`,
    origin: 'core:runtime',
  }));
  if (config.features.mocks !== false)
    templates.push({ name: 'mocks/support', origin: 'core:mocks' });
  const files: GeneratedFile[] = [];
  for (const { name, origin } of templates) {
    const variants: [string, string][] =
      config.output.language === 'typescript'
        ? [['ts', `${name}.ts`]]
        : [
            ['js', `${name}.js`],
            ['d.ts', `${name}.d.ts`],
          ];
    for (const [extensionName, file] of variants) {
      // The `.js` runtime is type-stripped TypeScript without JSDoc; its types come from the
      // `.d.ts` next to it, so `checkJs` projects that include the output skip checking it.
      const nocheck = extensionName === 'js' ? '// @ts-nocheck\n' : '';
      files.push({
        path: `${name}.${extensionName}`,
        content: header(config) + nocheck + rewrite(readTemplate(file)),
        origin,
      });
    }
  }
  return files;
}
