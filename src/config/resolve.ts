import path from 'node:path';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import type { ResolvedConfig } from './resolved.ts';
import type { UserConfig } from './types.ts';

export const DEFAULT_OUTPUT_DIRECTORY = './src/generated/api';
export const DEFAULT_DASHBOARD_PORT = 4400;

export function isRemoteUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

/** Applies defaults and resolves paths. `config` must already be validated. */
export function resolveConfig(
  config: UserConfig,
  options: { root: string; configFile?: string },
): ResolvedConfig {
  const { root } = options;
  const input = isRemoteUrl(config.spec.input)
    ? config.spec.input
    : path.resolve(root, config.spec.input);
  const specDirectory = isRemoteUrl(input) ? undefined : path.dirname(input);

  const allowedDirectories = (
    config.spec.refs?.allowedDirectories ?? [
      root,
      ...(specDirectory === undefined ? [] : [specDirectory]),
    ]
  ).map((dir) => path.resolve(root, dir));

  const reactQuery = config.features?.reactQuery ?? false;
  const validation = config.features?.validation ?? false;

  return {
    root,
    ...(options.configFile === undefined ? {} : { configFile: options.configFile }),
    spec: {
      version: config.spec.version,
      input,
      refs: {
        external: config.spec.refs?.external ?? 'local',
        allowedDirectories: [...new Set(allowedDirectories)],
        allowedHosts: config.spec.refs?.allowedHosts ?? [],
      },
      fetch: {
        headers: config.spec.fetch?.headers ?? {},
        timeout: config.spec.fetch?.timeout ?? 30_000,
        maxBytes: config.spec.fetch?.maxBytes ?? 50 * 1024 * 1024,
      },
    },
    output: {
      directory: path.resolve(root, config.output?.directory ?? DEFAULT_OUTPUT_DIRECTORY),
      language: config.output?.language ?? 'typescript',
      moduleFormat: 'esm',
      clean: config.output?.clean ?? true,
      declarations: config.output?.declarations ?? true,
      importExtension: config.output?.importExtension ?? '.js',
      barrel: config.output?.barrel ?? true,
      groupBy: config.output?.groupBy ?? 'tag',
      models: config.output?.models ?? 'all',
      webhooks: config.output?.webhooks ?? true,
      ...(config.output?.banner === undefined ? {} : { banner: config.output.banner }),
    },
    client: {
      adapter: config.client?.adapter ?? 'fetch',
      ...(config.client?.baseUrl === undefined ? {} : { baseUrl: config.client.baseUrl }),
      operationServers: config.client?.operationServers ?? true,
      includeCredentials: config.client?.includeCredentials ?? false,
      headers: config.client?.headers ?? {},
      ...(config.client?.timeout === undefined ? {} : { timeout: config.client.timeout }),
      responseStyle: config.client?.responseStyle ?? 'data',
    },
    features: {
      jsdoc: config.features?.jsdoc ?? true,
      reactQuery:
        reactQuery === false
          ? false
          : {
              queryMethods: (reactQuery === true ? undefined : reactQuery.queryMethods) ?? ['get'],
              infinite: (reactQuery === true ? undefined : reactQuery.infinite) ?? {},
              invalidates: (reactQuery === true ? undefined : reactQuery.invalidates) ?? {},
            },
      validation:
        validation === false
          ? false
          : {
              library: 'zod',
              response: (validation === 'zod' ? undefined : validation.response) ?? true,
              request: (validation === 'zod' ? undefined : validation.request) ?? false,
            },
    },
    naming: {
      operations: config.naming?.operations ?? 'camelCase',
      models: config.naming?.models ?? 'PascalCase',
      files: config.naming?.files ?? 'kebab-case',
      parameters: config.naming?.parameters ?? 'preserve',
      inputSuffix: config.naming?.inputSuffix ?? 'Input',
    },
    types: {
      enums: config.types?.enums ?? 'union',
      readonlyProperties: config.types?.readonlyProperties ?? true,
      readWrite: config.types?.readWrite ?? 'split',
      dates: config.types?.dates ?? 'string',
    },
    dashboard: {
      host: config.dashboard?.host ?? '127.0.0.1',
      port: config.dashboard?.port ?? DEFAULT_DASHBOARD_PORT,
      allowNetworkAccess: config.dashboard?.allowNetworkAccess ?? false,
      usage: {
        include: config.dashboard?.usage?.include ?? ['src'],
        exclude: config.dashboard?.usage?.exclude ?? [],
      },
    },
  };
}

/**
 * Orders plugins: `pre`, default, inline hooks, `post` — each group in declaration order.
 * `plugins` are the config's plugin entries after module references were loaded.
 */
export function orderPlugins(
  config: Pick<UserConfig, 'hooks'>,
  plugins: readonly SwaggerzPlugin[],
): SwaggerzPlugin[] {
  const inline: SwaggerzPlugin[] =
    config.hooks === undefined ? [] : [{ name: 'config.hooks', ...config.hooks }];
  return [
    ...plugins.filter((p) => p.enforce === 'pre'),
    ...plugins.filter((p) => p.enforce === undefined),
    ...inline,
    ...plugins.filter((p) => p.enforce === 'post'),
  ];
}
