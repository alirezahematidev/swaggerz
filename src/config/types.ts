import type { SwaggerzPlugin } from '../plugins/types.ts';
import type { HttpMethod } from '../ir/types.ts';
import type { ResolvedConfig } from './resolved.ts';

export type SpecVersionOption = '2.0' | '3.0' | '3.1' | 'auto';
export type CaseStyle = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'preserve';

export interface SpecConfig {
  /**
   * Specification family the input must conform to. A document declaring a different version is
   * rejected instead of being reinterpreted. Use `'auto'` to accept any supported version.
   */
  version: SpecVersionOption;
  /** Local path (relative to the config file) or `http(s)://` URL of a JSON or YAML document. */
  input: string;
  /** External `$ref` resolution policy. */
  refs?: RefsConfig;
  /** Options for fetching remote documents. */
  fetch?: FetchConfig;
}

export interface RefsConfig {
  /**
   * Which external references may be followed.
   * - `'none'`: only references inside the root document.
   * - `'local'` (default): local files inside `allowedDirectories`. Remote documents may still
   *   reference same-origin URLs.
   * - `'remote'`: local files plus `http(s)` URLs whose host is listed in `allowedHosts`.
   */
  external?: 'none' | 'local' | 'remote';
  /**
   * Directories that local references may read from. Defaults to the project root and the
   * directory of the root specification.
   */
  allowedDirectories?: string[];
  /** Hosts remote references may be fetched from, e.g. `['schemas.example.com']`. */
  allowedHosts?: string[];
}

export interface FetchConfig {
  /** Extra headers for remote documents, e.g. an authorization header for a private spec. */
  headers?: Record<string, string>;
  /** Timeout per request in milliseconds. Default `30000`. */
  timeout?: number;
  /** Maximum document size in bytes. Default `52428800` (50 MiB). */
  maxBytes?: number;
}

export interface OutputConfig {
  /** Output directory, relative to the config file. Default `./src/generated/api`. */
  directory?: string;
  /** Default `'typescript'`. */
  language?: 'typescript' | 'javascript';
  /** Only ES modules are generated. Reserved for future formats. */
  moduleFormat?: 'esm';
  /**
   * Remove generated files that are no longer produced. Only files recorded in the output
   * manifest are ever removed. Default `true`.
   */
  clean?: boolean;
  /** JavaScript output only: emit `.d.ts` declarations next to each module. Default `true`. */
  declarations?: boolean;
  /**
   * Extension used in relative import specifiers. `'.js'` (default) works with Node ESM,
   * TypeScript `nodenext`/`bundler` resolution and all major bundlers.
   */
  importExtension?: '.js' | '.ts' | 'none';
  /** Emit an `index` barrel re-exporting operations, models and the client. Default `true`. */
  barrel?: boolean;
  /** Directory grouping for operation modules. Default `'tag'` (first tag). */
  groupBy?: 'tag' | 'none';
  /** Emit every named schema (`'all'`, default) or only schemas reachable from operations. */
  models?: 'all' | 'used';
  /**
   * Generate payload types and handler signatures for webhooks (OpenAPI 3.1) and callbacks
   * (OpenAPI 3.x). Default `true`.
   */
  webhooks?: boolean;
  /** Extra text placed in the header comment of every generated file. */
  banner?: string;
}

export interface ClientConfig {
  /** HTTP transport used by generated operations. Default `'fetch'`. */
  adapter?: 'fetch' | 'axios';
  /**
   * Base URL compiled into the generated client. Defaults to the first server declared by the
   * specification. Can be changed at runtime with `client.setConfig({ baseUrl })`.
   */
  baseUrl?: string;
  /**
   * Send operations that declare their own `servers` (on the operation or its path) to the first
   * of those servers instead of the base URL. Default `true`; can be changed at runtime.
   */
  operationServers?: boolean;
  /** Send cookies on cross-origin requests (`credentials: 'include'` / `withCredentials`). */
  includeCredentials?: boolean;
  /** Static headers compiled into the generated client. */
  headers?: Record<string, string>;
  /** Default request timeout in milliseconds. */
  timeout?: number;
  /**
   * `'data'` (default): operations resolve with the parsed response body.
   * `'full'`: operations resolve with `{ data, status, headers }` discriminated by status.
   */
  responseStyle?: 'data' | 'full';
}

export interface ReactQueryConfig {
  /** HTTP methods that produce query hooks; others produce mutation hooks. Default `['get']`. */
  queryMethods?: HttpMethod[];
  /**
   * Infinite query hooks, keyed by operation name (after naming conventions) or `operationId`.
   * `pageParam` names the query parameter that receives the page parameter.
   */
  infinite?: Record<string, { pageParam: string }>;
  /**
   * Query invalidation after successful mutations, keyed by mutation operation name or
   * `operationId`. Values are operation names/ids of queries or tag names.
   */
  invalidates?: Record<string, string[]>;
}

export interface ZodConfig {
  /** Validate response bodies in generated operations. Default `true`. */
  response?: boolean;
  /** Validate request bodies before sending. Default `false`. */
  request?: boolean;
}

export interface FeaturesConfig {
  /** Generate TanStack Query v5 hooks and option factories. Default `false`. */
  reactQuery?: boolean | ReactQueryConfig;
  /** Generate JSDoc for every exported symbol. Default `true`. */
  jsdoc?: boolean;
  /** Generate Zod schemas and optional runtime validation. Default `false`. */
  validation?: false | 'zod' | ({ library: 'zod' } & ZodConfig);
}

export interface NamingConfig {
  /** Operation function names. Default `'camelCase'`. */
  operations?: 'camelCase' | 'PascalCase' | 'snake_case' | 'preserve';
  /** Model type names. Default `'PascalCase'`. */
  models?: 'PascalCase' | 'camelCase' | 'snake_case' | 'preserve';
  /** File names. Default `'kebab-case'`. */
  files?: 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';
  /**
   * Property names of generated parameter objects. `'preserve'` (default) keeps wire names
   * (quoted when necessary); `'camelCase'` converts them to identifiers.
   */
  parameters?: 'preserve' | 'camelCase';
  /**
   * Suffix of the request-side variant of models that contain `readOnly` or `writeOnly`
   * properties (see `types.readWrite`). Default `'Input'`, e.g. `PetInput`.
   */
  inputSuffix?: string;
}

export interface TypesConfig {
  /**
   * `'union'` (default): enums become string/number literal unions (no runtime code).
   * `'const'`: additionally emit a frozen `as const` object per named enum.
   */
  enums?: 'union' | 'const';
  /** Mark `readOnly` properties with the `readonly` modifier. Default `true`. */
  readonlyProperties?: boolean;
  /**
   * `'split'` (default): `readOnly` properties are left out of request types and `writeOnly`
   * properties out of response types; models that differ get a request-side variant
   * (`PetInput`). `'merged'`: one type per model, used for both directions.
   */
  readWrite?: 'split' | 'merged';
  /**
   * `'string'` (default): `format: date` and `date-time` values are strings.
   * `'Date'`: they are typed as `Date`; response bodies are converted at runtime and `Date`
   * values in requests are serialized (`date` as `YYYY-MM-DD`, `date-time` as ISO 8601).
   */
  dates?: 'string' | 'Date';
}

export interface UsageScanConfig {
  /** Directories or files scanned for generated API usage. Default `['src']`. */
  include?: string[];
  /** Path segments to skip. `node_modules` and the output directory are always skipped. */
  exclude?: string[];
}

export interface DashboardConfig {
  /** Default `127.0.0.1`. Binding to a non-loopback address requires `allowNetworkAccess`. */
  host?: string;
  /** Default `4400`. `0` selects a free port. */
  port?: number;
  /** Required to bind the dashboard to a non-loopback interface. Default `false`. */
  allowNetworkAccess?: boolean;
  usage?: UsageScanConfig;
}

/**
 * A plugin, or a reference to a module whose default export is a plugin or a function returning
 * one: `'./plugins/catalog.ts'`, `'some-package'` or `['./plugins/catalog.ts', options]`. Paths
 * are relative to the config file. References are the only way to use plugins in JSON and YAML
 * config files.
 */
export type PluginEntry = SwaggerzPlugin | string | readonly [specifier: string, options?: unknown];

/** Hooks registered inline in the config. Equivalent to a plugin named `config`. */
export type InlineHooks = Omit<SwaggerzPlugin, 'name' | 'enforce'>;

/** The shape accepted by `defineConfig()`. */
export interface UserConfig {
  spec: SpecConfig;
  output?: OutputConfig;
  client?: ClientConfig;
  features?: FeaturesConfig;
  naming?: NamingConfig;
  types?: TypesConfig;
  dashboard?: DashboardConfig;
  /** Plugins run in array order within their `enforce` group (`pre`, default, `post`). */
  plugins?: PluginEntry[];
  /** Inline lifecycle hooks, run after all plugins of the default group. */
  hooks?: InlineHooks;
}

export interface ConfigEnv {
  /** CLI command being executed, e.g. `generate` or `dashboard`. */
  readonly command: string;
}

/** A config module may export an object or a (possibly async) function returning one. */
export type ConfigExport = UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>);

export type { ResolvedConfig };
