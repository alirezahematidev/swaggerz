import type { HttpMethod } from '../ir/types.ts';

/**
 * Fully defaulted configuration used internally by the compiler. Paths are absolute.
 * Plugins receive this object read-only.
 */
export interface ResolvedConfig {
  /** Directory the config file lives in (or the working directory without a config file). */
  readonly root: string;
  /** Absolute path of the loaded config file, if any. */
  readonly configFile?: string;
  readonly spec: {
    readonly version: '2.0' | '3.0' | '3.1' | 'auto';
    /** Absolute path or URL. */
    readonly input: string;
    readonly refs: {
      readonly external: 'none' | 'local' | 'remote';
      readonly allowedDirectories: readonly string[];
      readonly allowedHosts: readonly string[];
    };
    readonly fetch: {
      readonly headers: Readonly<Record<string, string>>;
      readonly timeout: number;
      readonly maxBytes: number;
    };
  };
  readonly output: {
    /** Absolute path. */
    readonly directory: string;
    readonly language: 'typescript' | 'javascript';
    readonly moduleFormat: 'esm';
    readonly clean: boolean;
    readonly declarations: boolean;
    readonly importExtension: '.js' | '.ts' | 'none';
    readonly barrel: boolean;
    readonly groupBy: 'tag' | 'none';
    readonly models: 'all' | 'used';
    readonly webhooks: boolean;
    readonly banner?: string;
  };
  readonly client: {
    readonly adapter: 'fetch' | 'axios';
    readonly baseUrl?: string;
    readonly operationServers: boolean;
    readonly includeCredentials: boolean;
    readonly headers: Readonly<Record<string, string>>;
    readonly timeout?: number;
    readonly responseStyle: 'data' | 'full';
  };
  readonly features: {
    readonly jsdoc: boolean;
    readonly reactQuery:
      | false
      | {
          readonly queryMethods: readonly HttpMethod[];
          readonly infinite: Readonly<Record<string, { readonly pageParam: string }>>;
          readonly invalidates: Readonly<Record<string, readonly string[]>>;
        };
    readonly validation:
      | false
      | { readonly library: 'zod'; readonly response: boolean; readonly request: boolean };
  };
  readonly naming: {
    readonly operations: 'camelCase' | 'PascalCase' | 'snake_case' | 'preserve';
    readonly models: 'PascalCase' | 'camelCase' | 'snake_case' | 'preserve';
    readonly files: 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case';
    readonly parameters: 'preserve' | 'camelCase';
    readonly inputSuffix: string;
  };
  readonly types: {
    readonly enums: 'union' | 'const';
    readonly readonlyProperties: boolean;
    readonly readWrite: 'split' | 'merged';
    readonly dates: 'string' | 'Date';
  };
  readonly dashboard: {
    readonly host: string;
    readonly port: number;
    readonly allowNetworkAccess: boolean;
    readonly usage: { readonly include: readonly string[]; readonly exclude: readonly string[] };
  };
}
