import path from 'node:path';
import type { SwaggerzPlugin } from '../plugins/types.ts';
import type { ResolvedConfig, ResolvedDataFetching } from './resolved.ts';
import type { DataFetchingConfig, UserConfig } from './types.ts';

export const DEFAULT_OUTPUT_DIRECTORY = './src/generated/api';
export const DEFAULT_DASHBOARD_PORT = 4400;

export function isRemoteUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

export const DEFAULT_POLL_INTERVAL = 2000;
/** A bound on runaway descriptions, not on large ones (DigitalOcean's has about 1,900 files). */
export const DEFAULT_MAX_DOCUMENTS = 5000;

function resolvePoll(poll: boolean | number | undefined): ResolvedConfig['spec']['fetch']['poll'] {
  if (poll === undefined) return { hosts: 'loopback', interval: DEFAULT_POLL_INTERVAL };
  if (typeof poll === 'number') return { hosts: 'all', interval: poll };
  return { hosts: poll ? 'all' : 'none', interval: DEFAULT_POLL_INTERVAL };
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

  // `reactQuery` is an alias of `query` with the React adapter; validation rejects both at once.
  const reactQuery = config.features?.reactQuery ?? false;
  const query =
    config.features?.query ??
    (reactQuery === false
      ? false
      : reactQuery === true
        ? true
        : { ...reactQuery, framework: 'react' });
  const swr = config.features?.swr ?? false;
  const validation = config.features?.validation ?? false;
  const mocks = config.features?.mocks ?? false;
  const dataFetching = (settings: DataFetchingConfig | true): ResolvedDataFetching => ({
    queryMethods: (settings === true ? undefined : settings.queryMethods) ?? ['get', 'query'],
    infinite: (settings === true ? undefined : settings.infinite) ?? {},
    invalidates: (settings === true ? undefined : settings.invalidates) ?? {},
  });

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
        maxDocuments: config.spec.refs?.maxDocuments ?? DEFAULT_MAX_DOCUMENTS,
      },
      fetch: {
        headers: config.spec.fetch?.headers ?? {},
        timeout: config.spec.fetch?.timeout ?? 30_000,
        maxBytes: config.spec.fetch?.maxBytes ?? 50 * 1024 * 1024,
        poll: resolvePoll(config.spec.fetch?.poll),
      },
      overlays: (config.spec.overlays ?? []).map((overlay) =>
        isRemoteUrl(overlay) ? overlay : path.resolve(root, overlay),
      ),
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
      query:
        query === false
          ? false
          : {
              framework: (query === true ? undefined : query.framework) ?? 'react',
              ...dataFetching(query),
            },
      swr: swr === false ? false : dataFetching(swr),
      validation:
        validation === false
          ? false
          : typeof validation === 'string'
            ? { library: validation, response: true, request: false }
            : {
                library: validation.library,
                response: validation.response ?? true,
                request: validation.request ?? false,
              },
      mocks: mocks === false ? false : { library: mocks },
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
    lint: { rules: config.lint?.rules ?? {} },
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
