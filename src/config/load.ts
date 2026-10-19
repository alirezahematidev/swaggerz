import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SwaggerzError } from '../diagnostics/bag.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import { DocumentParseError, parseDocumentText } from '../loader/parse.ts';
import { CONFIG_BASENAME, TOOL_NAME } from '../meta.ts';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import { deepMerge, isRecord } from '../utils/object.ts';
import { readEnvOverrides } from './env.ts';
import { loadPluginEntries } from './plugins.ts';
import { orderPlugins, resolveConfig } from './resolve.ts';
import type { ResolvedConfig } from './resolved.ts';
import type { ConfigEnv, UserConfig } from './types.ts';
import { validateUserConfig } from './validate.ts';

/** Searched in this order. JSON and YAML configs cannot contain functions; see `PluginEntry`. */
export const CONFIG_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
] as const;

const DATA_EXTENSIONS: Readonly<Record<string, 'json' | 'yaml'>> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

export interface LoadConfigOptions {
  /** Working directory used to search for a config file. */
  readonly cwd: string;
  /** Explicit config file path (absolute or relative to `cwd`). */
  readonly configFile?: string;
  /** Use this config object instead of loading a file. */
  readonly inlineConfig?: UserConfig;
  /** CLI command name, passed to config functions. */
  readonly command?: string;
  /** Deep overrides applied after environment variables (e.g. from CLI flags). */
  readonly overrides?: Record<string, unknown>;
  readonly env?: NodeJS.ProcessEnv;
}

export interface LoadedConfig {
  readonly config: ResolvedConfig;
  readonly plugins: readonly SwaggerzPlugin[];
  /** Absolute path of the config file, when one was loaded. */
  readonly file?: string;
  /** Environment variables that changed the configuration. */
  readonly envApplied: readonly string[];
}

/** Searches `cwd` for `<tool>.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}`. */
export async function findConfigFile(cwd: string): Promise<string | undefined> {
  for (const extension of CONFIG_EXTENSIONS) {
    const candidate = path.join(cwd, `${CONFIG_BASENAME}${extension}`);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next extension.
    }
  }
  return undefined;
}

let importGeneration = 0;

/**
 * Imports a config module with Node's own module loader. TypeScript files rely on Node's built-in
 * type stripping (Node >= 22.18), so no code is evaluated through `eval` or `new Function`.
 * Config files are trusted project code: they run with the permissions of the CLI process.
 */
export async function importConfigModule(file: string): Promise<unknown> {
  const url = pathToFileURL(file);
  // A unique query string bypasses the ESM cache so watch mode picks up edits.
  url.searchParams.set('v', `${Date.now()}-${++importGeneration}`);
  let module: unknown;
  try {
    module = await import(url.href);
  } catch (error) {
    throw new SwaggerzError(`Failed to load config file ${file}`, [
      configLoadDiagnostic(file, error),
    ]);
  }
  return isRecord(module) && 'default' in module ? module.default : module;
}

/** Reads a JSON or YAML config file (parsed as data; nothing is executed). */
async function readDataConfig(file: string, format: 'json' | 'yaml'): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new SwaggerzError(`Failed to read config file ${file}`, [
      configLoadDiagnostic(file, error),
    ]);
  }
  try {
    return parseDocumentText(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, format);
  } catch (error) {
    const position =
      error instanceof DocumentParseError && error.line !== undefined
        ? { line: error.line, ...(error.column === undefined ? {} : { column: error.column }) }
        : {};
    throw new SwaggerzError(`Failed to parse config file ${file}`, [
      {
        code: 'config/load-failed',
        severity: 'error',
        message: `Could not parse config file: ${error instanceof Error ? error.message : String(error)}`,
        location: { file, ...position },
      },
    ]);
  }
}

/** Loads a config file of any supported format and returns its exported value. */
export async function readConfigFile(file: string): Promise<unknown> {
  const format = DATA_EXTENSIONS[path.extname(file).toLowerCase()];
  return format === undefined ? importConfigModule(file) : readDataConfig(file, format);
}

function configLoadDiagnostic(file: string, error: unknown): Diagnostic {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const isTypeScript = /\.[mc]?ts$/.test(file);
  let hint: string | undefined;
  if (
    isTypeScript &&
    (code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
      code === 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING')
  ) {
    hint = `TypeScript config files need Node.js >= 22.18 (native type stripping). Upgrade Node.js or rename the file to ${CONFIG_BASENAME}.mjs.`;
  } else if (
    code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' ||
    code === 'ERR_INVALID_TYPESCRIPT_SYNTAX'
  ) {
    hint =
      'Config files are loaded with Node.js type stripping, which supports only erasable TypeScript syntax. Avoid enums, namespaces and parameter properties in the config file.';
  } else if (code === 'ERR_MODULE_NOT_FOUND') {
    hint = `Install the package that the config imports (usually \`${TOOL_NAME}\`) and use explicit file extensions for relative imports.`;
  }
  return {
    code: 'config/load-failed',
    severity: 'error',
    message: `Could not load config file: ${message}`,
    location: { file },
    ...(hint === undefined ? {} : { hint }),
  };
}

/** Loads, merges, validates and resolves configuration. Throws {@link SwaggerzError} on failure. */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadedConfig> {
  const cwd = path.resolve(options.cwd);
  let file: string | undefined;
  let raw: unknown;

  if (options.inlineConfig !== undefined) {
    raw = options.inlineConfig;
    file = options.configFile === undefined ? undefined : path.resolve(cwd, options.configFile);
  } else {
    file =
      options.configFile === undefined
        ? await findConfigFile(cwd)
        : path.resolve(cwd, options.configFile);
    if (file === undefined) {
      throw new SwaggerzError('No config file found', [
        {
          code: 'config/not-found',
          severity: 'error',
          message: `No ${CONFIG_BASENAME}.{ts,mts,cts,js,mjs,cjs,json,yaml,yml} found in ${cwd}.`,
          hint: `Run \`${TOOL_NAME} init\` to create one, or pass --config <path>.`,
        },
      ]);
    }
    raw = await readConfigFile(file);
  }

  if (typeof raw === 'function') {
    const env: ConfigEnv = { command: options.command ?? 'generate' };
    try {
      raw = await (raw as (env: ConfigEnv) => unknown)(env);
    } catch (error) {
      throw new SwaggerzError('Config function threw', [
        {
          code: 'config/load-failed',
          severity: 'error',
          message: `The exported config function threw: ${error instanceof Error ? error.message : String(error)}`,
          ...(file === undefined ? {} : { location: { file } }),
        },
      ]);
    }
  }

  const { overrides: envOverrides, applied } = readEnvOverrides(options.env ?? process.env);
  let merged: unknown = deepMerge(raw, envOverrides);
  if (options.overrides !== undefined) merged = deepMerge(merged, options.overrides);

  const issues = validateUserConfig(merged);
  if (issues.length > 0) {
    throw new SwaggerzError(
      'Invalid configuration',
      issues.map((issue) => ({
        code: 'config/invalid',
        severity: 'error' as const,
        message: `${issue.path === '' ? 'config' : issue.path}: ${issue.message}`,
        ...(issue.hint === undefined ? {} : { hint: issue.hint }),
        ...(file === undefined ? {} : { location: { file } }),
      })),
    );
  }

  const userConfig = merged as UserConfig;
  const root = file === undefined ? cwd : path.dirname(file);
  const plugins = await loadPluginEntries(userConfig.plugins ?? [], root, file);
  return {
    config: resolveConfig(userConfig, {
      root,
      ...(file === undefined ? {} : { configFile: file }),
    }),
    plugins: orderPlugins(userConfig, plugins),
    ...(file === undefined ? {} : { file }),
    envApplied: applied,
  };
}
