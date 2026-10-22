import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SwaggerzError } from '../diagnostics/bag.ts';
import type { Diagnostic, SourceLocation } from '../diagnostics/types.ts';
import { locatePointer } from '../loader/locate.ts';
import { DocumentParseError, parseDocumentText } from '../loader/parse.ts';
import { appendPointer } from '../loader/pointer.ts';
import { CONFIG_BASENAME, TOOL_NAME } from '../meta.ts';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import { deepMerge, isRecord, stableStringify } from '../utils/object.ts';
import { readEnvOverrides } from './env.ts';
import { forgetCommonJsModule, loadPluginEntries } from './plugins.ts';
import { orderPlugins, resolveConfig } from './resolve.ts';
import type { ResolvedConfig } from './resolved.ts';
import type { ConfigIssue } from './schema.ts';
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
  /**
   * Absolute paths of the local files, besides the config file, that the configuration was loaded
   * from: plugin modules referenced by a relative or absolute path or a `file:` URL (sorted).
   * Watch them to reload when a plugin changes; loading the configuration again picks up their
   * changes. Modules that these files or the config file import themselves are not listed, and
   * Node.js caches them for the life of the process.
   */
  readonly watchFiles: readonly string[];
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

/** The `config/not-found` error for a directory without a config file. */
export function configNotFound(cwd: string): SwaggerzError {
  return new SwaggerzError('No config file found', [
    {
      code: 'config/not-found',
      severity: 'error',
      message: `No ${CONFIG_BASENAME}.{ts,mts,cts,js,mjs,cjs,json,yaml,yml} found in ${cwd}.`,
      hint: `Run \`${TOOL_NAME} init\` to create one, or pass --config <path>.`,
    },
  ]);
}

let importGeneration = 0;

/**
 * Imports a config module with Node's own module loader. TypeScript files rely on Node's built-in
 * type stripping (Node >= 22.18), so no code is evaluated through `eval` or `new Function`.
 * Config files are trusted project code: they run with the permissions of the CLI process.
 */
export async function importConfigModule(file: string): Promise<unknown> {
  const url = pathToFileURL(file);
  // A unique query string bypasses the ESM cache so watch mode picks up edits; CommonJS modules
  // are cached by file name instead.
  url.searchParams.set('v', `${Date.now()}-${++importGeneration}`);
  forgetCommonJsModule(file);
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

/** A config file's exported value, and the text of JSON and YAML configs (for positions). */
interface ConfigSource {
  readonly value: unknown;
  readonly text?: string;
}

/** Reads a JSON or YAML config file (parsed as data; nothing is executed). */
async function readDataConfig(file: string, format: 'json' | 'yaml'): Promise<ConfigSource> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new SwaggerzError(`Failed to read config file ${file}`, [
      configLoadDiagnostic(file, error),
    ]);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return { value: parseDocumentText(text, format), text };
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

async function readConfigSource(file: string): Promise<ConfigSource> {
  const format = DATA_EXTENSIONS[path.extname(file).toLowerCase()];
  return format === undefined
    ? { value: await importConfigModule(file) }
    : readDataConfig(file, format);
}

/** Loads a config file of any supported format and returns its exported value. */
export async function readConfigFile(file: string): Promise<unknown> {
  return (await readConfigSource(file)).value;
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

/**
 * Follows a validation issue path (`spec.version`, `plugins[0]`) through `data` as far as it
 * exists. Keys may contain dots, so each step matches the longest key present in the data.
 */
function followIssuePath(
  data: unknown,
  issuePath: string,
): { pointer: string; value: unknown; complete: boolean } {
  let pointer = '';
  let value = data;
  let rest = issuePath;
  while (rest !== '') {
    let segment: string | undefined;
    let length = 0;
    if (Array.isArray(value)) {
      const match = /^\[(\d+)\]/.exec(rest);
      if (match?.[1] !== undefined && Number(match[1]) < value.length) {
        segment = match[1];
        length = match[0].length;
        value = value[Number(segment)];
      }
    } else if (isRecord(value)) {
      const remaining = rest;
      const key = Object.keys(value)
        .filter(
          (k) => remaining === k || remaining.startsWith(`${k}.`) || remaining.startsWith(`${k}[`),
        )
        .sort((a, b) => b.length - a.length)[0];
      if (key !== undefined) {
        segment = key;
        length = key.length;
        value = Object.getOwnPropertyDescriptor(value, key)?.value;
      }
    }
    if (segment === undefined) return { pointer, value, complete: false };
    pointer = appendPointer(pointer, segment);
    rest = rest.slice(length);
    if (rest.startsWith('.')) rest = rest.slice(1);
  }
  return { pointer, value, complete: true };
}

/**
 * The position of a validation issue in a JSON or YAML config file. Omitted when the problem
 * comes from an environment variable or CLI flag rather than the file.
 */
function issuePosition(
  issue: ConfigIssue,
  file: string,
  text: string,
  data: unknown,
  merged: unknown,
): Pick<SourceLocation, 'line' | 'column'> {
  const inFile = followIssuePath(data, issue.path);
  if (inFile.complete) {
    const effective = followIssuePath(merged, issue.path);
    if (stableStringify(effective.value) !== stableStringify(inFile.value)) return {};
  }
  const position = locatePointer(
    { url: pathToFileURL(file).href, display: file, location: file, format: 'yaml', text, data },
    inFile.pointer,
  );
  return position ?? {};
}

/** Loads, merges, validates and resolves configuration. Throws {@link SwaggerzError} on failure. */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadedConfig> {
  const cwd = path.resolve(options.cwd);
  let file: string | undefined;
  let raw: unknown;
  let text: string | undefined;

  if (options.inlineConfig !== undefined) {
    raw = options.inlineConfig;
    file = options.configFile === undefined ? undefined : path.resolve(cwd, options.configFile);
  } else {
    file =
      options.configFile === undefined
        ? await findConfigFile(cwd)
        : path.resolve(cwd, options.configFile);
    if (file === undefined) throw configNotFound(cwd);
    ({ value: raw, text } = await readConfigSource(file));
  }
  const data = raw;

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
        ...(file === undefined
          ? {}
          : {
              location: {
                file,
                ...(text === undefined ? {} : issuePosition(issue, file, text, data, merged)),
              },
            }),
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
    plugins: orderPlugins(userConfig, plugins.plugins),
    ...(file === undefined ? {} : { file }),
    envApplied: applied,
    watchFiles: plugins.files,
  };
}
