import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SwaggerzError } from '../diagnostics/bag.ts';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import { isRecord } from '../utils/object.ts';
import type { ConfigIssue } from './schema.ts';
import type { PluginEntry } from './types.ts';
import { pluginObjectCheck } from './validate.ts';

/** Conditions used to pick an entry point from a package's `exports`. */
const CONDITIONS: ReadonlySet<string> = new Set(['import', 'node', 'module', 'default']);

type PluginReference = string | readonly [specifier: string, options?: unknown];

function isReference(entry: PluginEntry): entry is PluginReference {
  return typeof entry === 'string' || Array.isArray(entry);
}

/**
 * Loads plugin entries: plugin objects are kept, module references (`'./plugin.ts'`,
 * `'package'` or `[specifier, options]`) are imported with Node's module loader. A referenced
 * module must default-export a plugin object or a function that receives the options and
 * returns (or resolves to) one. Paths resolve against `root`, the config file's directory.
 */
export async function loadPluginEntries(
  entries: readonly PluginEntry[],
  root: string,
  configFile?: string,
): Promise<SwaggerzPlugin[]> {
  const plugins: SwaggerzPlugin[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!isReference(entry)) {
      plugins.push(entry);
      continue;
    }
    const [specifier, options]: readonly [string, unknown?] =
      typeof entry === 'string' ? [entry] : entry;
    const hasOptions = typeof entry !== 'string' && entry.length > 1;
    const fail = (message: string, hint?: string): never => {
      throw new SwaggerzError(`Failed to load plugin ${specifier}`, [
        {
          code: 'config/plugin-load-failed',
          severity: 'error',
          message: `plugins[${index}] (${JSON.stringify(specifier)}): ${message}`,
          ...(hint === undefined ? {} : { hint }),
          ...(configFile === undefined ? {} : { location: { file: configFile } }),
        },
      ]);
    };

    const file = resolveSpecifier(specifier, root);
    if (file === undefined) {
      return fail(
        'module not found.',
        'Use a path relative to the config file (starting with ./) or install the package.',
      );
    }
    let module: unknown;
    try {
      module = await import(pathToFileURL(file).href);
    } catch (error) {
      return fail(
        `could not be imported: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const exported = isRecord(module) && 'default' in module ? module.default : module;
    let plugin: unknown = exported;
    if (typeof exported === 'function') {
      try {
        plugin = await (exported as (options?: unknown) => unknown)(options);
      } catch (error) {
        return fail(
          `the plugin factory threw: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (hasOptions) {
      return fail(
        'options were given, but the module exports a plugin object instead of a function.',
        'Export a function that receives the options and returns the plugin.',
      );
    }
    const issues: ConfigIssue[] = [];
    pluginObjectCheck(plugin, '', issues);
    if (issues.length > 0) {
      return fail(
        `the default export is not a plugin: ${issues.map((i) => `${i.path === '' ? '' : `${i.path}: `}${i.message}`).join(' ')}`,
        'Default-export an object with a `name` and hooks (use definePlugin), or a function returning one.',
      );
    }
    plugins.push(plugin as SwaggerzPlugin);
  }
  return plugins;
}

function resolveSpecifier(specifier: string, root: string): string | undefined {
  if (specifier.startsWith('file:')) return fileURLToPath(specifier);
  if (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    path.isAbsolute(specifier)
  ) {
    const file = path.resolve(root, specifier);
    return existsSync(file) ? file : undefined;
  }
  try {
    return createRequire(path.join(root, 'noop.js')).resolve(specifier);
  } catch {
    // ESM-only packages often export only an `import` condition, which require.resolve skips.
    return resolvePackageExport(specifier, root);
  }
}

function resolvePackageExport(specifier: string, root: string): string | undefined {
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? '');
  const subpath = `.${specifier.slice(name.length)}`;
  for (let directory = root; ; directory = path.dirname(directory)) {
    const packageDirectory = path.join(directory, 'node_modules', name);
    const manifestFile = path.join(packageDirectory, 'package.json');
    if (existsSync(manifestFile)) {
      const manifest: unknown = JSON.parse(readFileSync(manifestFile, 'utf8'));
      if (!isRecord(manifest)) return undefined;
      if (manifest.exports !== undefined) {
        const target = exportTarget(manifest.exports, subpath);
        return target === undefined ? undefined : path.join(packageDirectory, target);
      }
      const main = typeof manifest.main === 'string' ? manifest.main : 'index.js';
      return path.join(packageDirectory, subpath === '.' ? main : subpath);
    }
    if (path.dirname(directory) === directory) return undefined;
  }
}

function exportTarget(exports: unknown, subpath: string): string | undefined {
  if (typeof exports === 'string' || Array.isArray(exports)) {
    return subpath === '.' ? conditionalTarget(exports) : undefined;
  }
  if (!isRecord(exports)) return undefined;
  const keys = Object.keys(exports);
  if (keys.some((key) => key.startsWith('.'))) return conditionalTarget(exports[subpath]);
  return subpath === '.' ? conditionalTarget(exports) : undefined;
}

function conditionalTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = conditionalTarget(item);
      if (target !== undefined) return target;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [condition, target] of Object.entries(value)) {
    if (!CONDITIONS.has(condition)) continue;
    const resolved = conditionalTarget(target);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}
