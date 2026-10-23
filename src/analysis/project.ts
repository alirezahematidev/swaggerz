import type { ResolvedConfig, ResolvedDataFetching } from '../config/resolved.ts';
import type { DiagnosticBag } from '../diagnostics/bag.ts';
import {
  wireMethod,
  type ApiDocument,
  type OperationIR,
  type ParameterLocation,
  type SchemaDefinition,
  type SchemaIR,
  type WebhookIR,
} from '../ir/types.ts';
import { getOwn } from '../utils/object.ts';
import { compareStrings } from '../utils/strings.ts';
import { groupKey, linkDataFetching, type MemberKey } from './data-fetching.ts';
import { definitionsWithDates } from './dates.ts';
import { DependencyGraph } from './graph.ts';
import {
  applyCase,
  NameRegistry,
  nameFromPath,
  toFileName,
  toIdentifier,
  toPropertyName,
} from './naming.ts';
import type {
  ModelSymbol,
  OperationSymbol,
  ProjectModel,
  QueryGroup,
  QueryLibrary,
  WebhookSymbol,
} from './types.ts';

/**
 * Names exported by the generated `client` module, which every barrel re-exports. Other runtime
 * exports never take precedence over model or operation names: the barrel skips a runtime export
 * whose name is already used (it stays importable from the `runtime/` modules).
 */
export const RESERVED_EXPORTS: readonly string[] = ['client', 'RequestOptions'];

/** Top-level output entries that operation group directories must not collide with. */
const RESERVED_MODULE_ROOTS = [
  'index',
  'client',
  'runtime',
  'models',
  'react-query',
  'vue-query',
  'svelte-query',
  'solid-query',
  'swr',
  'zod',
  'valibot',
  'arktype',
  'webhooks',
  'callbacks',
  'dates',
];

/** The enabled data-fetching integration and its options, if any. */
export function dataFetching(
  config: ResolvedConfig,
): { readonly library: QueryLibrary; readonly options: ResolvedDataFetching } | undefined {
  const { query, swr } = config.features;
  if (query !== false) return { library: `${query.framework}-query`, options: query };
  if (swr !== false) return { library: 'swr', options: swr };
  return undefined;
}

export interface NamingHooks {
  operationName?: (operation: OperationIR, suggested: string) => string | undefined;
  modelName?: (definition: SchemaDefinition, suggested: string) => string | undefined;
  /** Customizes the static React Query key prefix of an operation. */
  queryKey?: (operation: OperationIR, prefix: readonly string[]) => readonly string[] | undefined;
}

export interface BuildProjectOptions {
  readonly ir: ApiDocument;
  readonly config: ResolvedConfig;
  readonly diagnostics: DiagnosticBag;
  readonly hooks?: NamingHooks;
}

/** Semantic analysis: dependency graph, symbol names and module layout. */
export function buildProject(options: BuildProjectOptions): ProjectModel {
  const { ir, config, diagnostics, hooks } = options;
  const graph = DependencyGraph.build(ir);
  const exports = new NameRegistry();
  const modules = new NameRegistry({ caseInsensitive: true });
  RESERVED_EXPORTS.forEach((name) => {
    exports.reserve(name);
  });
  RESERVED_MODULE_ROOTS.forEach((name) => {
    modules.reserve(name);
  });
  const fileStyle = config.naming.files;
  const tagParents = new Map(
    ir.tags.flatMap((tag) => (tag.parent === undefined ? [] : [[tag.name, tag.parent] as const])),
  );
  const directories = groupDirectories(ir.operations, config, tagParents);
  const used = graph.usedSchemas();
  const withDates = config.types.dates === 'Date' ? definitionsWithDates(ir) : new Set<string>();

  // Models -----------------------------------------------------------------------------------
  const definitions =
    config.output.models === 'used' ? ir.schemas.filter((d) => used.has(d.id)) : ir.schemas;
  const modelCandidates = definitions
    .map((definition) => {
      const suggested = toIdentifier(definition.name, config.naming.models);
      const custom = hooks?.modelName?.(definition, suggested);
      return {
        definition,
        preferred: custom === undefined ? suggested : toIdentifier(custom, 'preserve'),
      };
    })
    .sort(
      (a, b) =>
        compareStrings(a.preferred, b.preferred) ||
        compareStrings(a.definition.id, b.definition.id),
    );

  const models: ModelSymbol[] = [];
  for (const { definition, preferred } of modelCandidates) {
    const name = exports.claim(preferred);
    if (name !== preferred) {
      diagnostics.warning({
        code: 'naming/collision',
        message: `Model name "${preferred}" (from ${definition.id}) is already taken; it is exported as "${name}".`,
      });
    }
    const module = modules.claim(`models/${toFileName(name, fileStyle)}`, '-');
    const aliases = definition.aliases.map((alias) =>
      exports.claim(toIdentifier(alias, config.naming.models)),
    );
    const validation = config.features.validation;
    const schemaName = validation === false ? undefined : exports.claim(`${name}Schema`);
    const schemaModule =
      validation === false
        ? undefined
        : modules.claim(`${validation.library}/${toFileName(name, fileStyle)}`, '-');
    const dates = withDates.has(definition.id)
      ? {
          datesName: exports.claim(`${name}Dates`),
          datesModule: modules.claim(`dates/${toFileName(name, fileStyle)}`, '-'),
        }
      : {};
    models.push({
      id: definition.id,
      definition,
      name,
      module,
      aliases,
      used: used.has(definition.id),
      ...(schemaName === undefined ? {} : { schemaName }),
      ...(schemaModule === undefined ? {} : { schemaModule }),
      ...dates,
    });
  }
  models.sort((a, b) => compareStrings(a.name, b.name));

  // Operations -------------------------------------------------------------------------------
  const operations: OperationSymbol[] = [];
  const fetching = dataFetching(config);
  // Svelte and Solid name their primitives `createQuery`/`createMutation`; the others `use…`.
  const createStyle = fetching?.library === 'svelte-query' || fetching?.library === 'solid-query';
  const tanstack = fetching !== undefined && fetching.library !== 'swr';
  for (const operation of ir.operations) {
    const base = operation.operationId ?? nameFromPath(operation.method, operation.path);
    const suggested = toIdentifier(base, config.naming.operations);
    const custom = hooks?.operationName?.(operation, suggested);
    const preferred = custom === undefined ? suggested : toIdentifier(custom, 'preserve');
    const name = exports.claim(preferred);
    if (name !== preferred) {
      diagnostics.warning({
        code: 'naming/collision',
        message: `Operation name "${preferred}" (${wireMethod(operation.method)} ${operation.path}) is already taken; it is exported as "${name}".`,
      });
    }
    const group = groupFor(operation, config, tagParents, directories);
    const fileName = toFileName(name, fileStyle);
    const module = modules.claim(`${group}/${fileName}`, '-');
    const pascal = derivedBase(name, 'PascalCase');
    const camel = derivedBase(name, 'camelCase');
    const typeNames = {
      params: exports.claim(`${pascal}Params`),
      body: exports.claim(`${pascal}Body`),
      response: exports.claim(`${pascal}Response`),
      error: exports.claim(`${pascal}Error`),
      apiError: exports.claim(`${pascal}ApiError`),
      errorBody: exports.claim(`${pascal}ErrorBody`),
      // Request bodies by media type, only for operations that accept several.
      ...((operation.requestBody?.contents.length ?? 0) > 1
        ? { bodies: exports.claim(`${pascal}Bodies`) }
        : {}),
    };
    const errorGuard = exports.claim(`is${pascal}ApiError`);
    const { properties, body, contentType } = parameterProperties(
      operation,
      config.naming.parameters,
    );

    let querySymbols: OperationSymbol['query'];
    if (fetching !== undefined) {
      const settings = fetching.options;
      const isQuery = (settings.queryMethods as readonly string[]).includes(operation.method);
      const infiniteConfig =
        getOwn(settings.infinite, name) ??
        (operation.operationId === undefined
          ? undefined
          : getOwn(settings.infinite, operation.operationId));
      const pageParam = isQuery
        ? resolvePageParam(operation, infiniteConfig?.pageParam, diagnostics)
        : undefined;
      const groupPrefix = groupKeyPrefix(operation, config, tagParents);
      const keyPrefix = hooks?.queryKey?.(operation, [...groupPrefix, name]) ?? [
        ...groupPrefix,
        name,
      ];
      const hook = createStyle
        ? `create${pascal}${isQuery ? 'Query' : 'Mutation'}`
        : `use${pascal}`;
      querySymbols = {
        library: fetching.library,
        module: modules.claim(`${fetching.library}/${group}/${fileName}`, '-'),
        hook: exports.claim(hook),
        keyPrefix,
        ...(isQuery
          ? {
              queryKey: exports.claim(`${camel}QueryKey`),
              queryKeyType: exports.claim(`${pascal}QueryKey`),
              // SWR has no option objects: the key and the fetcher are the hook's arguments.
              ...(tanstack ? { queryOptions: exports.claim(`${camel}QueryOptions`) } : {}),
            }
          : tanstack
            ? { mutationOptions: exports.claim(`${camel}MutationOptions`) }
            : {}),
        ...(pageParam !== undefined
          ? {
              pageParam,
              infiniteHook: exports.claim(
                createStyle ? `create${pascal}InfiniteQuery` : `use${pascal}Infinite`,
              ),
              infiniteQueryKey: exports.claim(`${camel}InfiniteQueryKey`),
              infiniteQueryKeyType: exports.claim(`${pascal}InfiniteQueryKey`),
              ...(tanstack
                ? { infiniteQueryOptions: exports.claim(`${camel}InfiniteQueryOptions`) }
                : {}),
              pageParamType: exports.claim(`${pascal}PageParam`),
            }
          : {}),
      };
    }

    operations.push({
      key: operation.key,
      operation,
      name,
      group,
      module,
      typeNames,
      errorGuard,
      parameterProperties: properties,
      bodyProperty: body,
      contentTypeProperty: contentType,
      ...(querySymbols === undefined ? {} : { query: querySymbols }),
    });
  }
  operations.sort((a, b) => compareStrings(a.group, b.group) || compareStrings(a.name, b.name));

  const queryGroups: QueryGroup[] = [];
  if (fetching !== undefined && config.output.groupBy === 'tag') {
    // Every group with operations, and the groups of their parent tags (OpenAPI 3.2), whose
    // `all` key matches the queries of every nested group.
    const prefixes = new Map<string, readonly string[]>();
    const memberKeys = new Map<string, MemberKey[]>();
    for (const symbol of operations) {
      const tags = tagPath(symbol.operation.tags[0] ?? 'default', tagParents);
      const member = { key: symbol.query?.keyPrefix ?? [], base: [...tags, symbol.name] };
      tags.forEach((_, index) => {
        const prefix = tags.slice(0, index + 1);
        const group = directories(prefix);
        if (!prefixes.has(group)) prefixes.set(group, prefix);
        memberKeys.set(group, [...(memberKeys.get(group) ?? []), member]);
      });
    }
    for (const [group, prefix] of [...prefixes].sort(([a], [b]) => compareStrings(a, b))) {
      queryGroups.push({
        group,
        module: modules.claim(`${fetching.library}/${group}/keys`, '-'),
        // A valid identifier even for groups such as `1-click-applications`.
        name: exports.claim(toIdentifier(`${group} keys`, 'camelCase')),
        tags: prefix,
        prefix: groupKey(prefix, memberKeys.get(group) ?? []),
      });
    }
  }
  if (fetching !== undefined) {
    linkDataFetching({
      operations,
      groups: queryGroups,
      tags: ir.tags.map((tag) => tag.name),
      parents: tagParents,
      options: fetching.options,
      option: fetching.library === 'swr' ? 'features.swr' : 'features.query',
      diagnostics,
    });
  }

  // Webhooks and callbacks ------------------------------------------------------------------
  const webhooks: WebhookSymbol[] = [];
  if (config.output.webhooks) {
    const add = (
      kind: 'webhook' | 'callback',
      webhook: WebhookIR,
      base: string,
      module: string,
      owner?: string,
    ): void => {
      for (const operation of webhook.operations) {
        const methodSuffix =
          webhook.operations.length > 1 ? applyCase(operation.method, 'PascalCase') : '';
        const prefix = `${base}${methodSuffix}${kind === 'webhook' ? 'Webhook' : 'Callback'}`;
        webhooks.push({
          kind,
          key: operation.key,
          operation,
          webhook,
          ...(owner === undefined ? {} : { owner }),
          module,
          typeNames: {
            payload: exports.claim(`${prefix}Payload`),
            request: exports.claim(`${prefix}Request`),
            response: exports.claim(`${prefix}Response`),
            handler: exports.claim(`${prefix}Handler`),
          },
        });
      }
    };
    for (const webhook of ir.webhooks) {
      const base = toIdentifier(webhook.name, 'PascalCase');
      add('webhook', webhook, base, modules.claim(`webhooks/${toFileName(base, fileStyle)}`, '-'));
    }
    for (const symbol of operations) {
      for (const callback of symbol.operation.callbacks ?? []) {
        const base = `${derivedBase(symbol.name, 'PascalCase')}${toIdentifier(callback.name, 'PascalCase')}`;
        add(
          'callback',
          callback,
          base,
          modules.claim(`callbacks/${toFileName(base, fileStyle)}`, '-'),
          symbol.key,
        );
      }
    }
  }

  // JavaScript output: a JSDoc typedef cannot refer to itself through an array (TypeScript defers
  // only arrays that are a whole typedef), so the top-level arrays of recursive models become
  // helper typedefs. Their names are claimed last, after every other export.
  if (config.output.language === 'javascript') {
    const recursive = graph.recursiveSchemas();
    models.forEach((model, index) => {
      const count = recursive.has(model.id) ? topLevelArrays(model.definition.schema) : 0;
      if (count === 0) return;
      models[index] = {
        ...model,
        arrayTypedefs: Array.from({ length: count }, () => exports.claim(`${model.name}Array`)),
      };
    });
  }

  return {
    queryGroups,
    webhooks,
    ir,
    graph,
    operations,
    models,
    operationByKey: new Map(operations.map((op) => [op.key, op])),
    modelById: new Map(models.map((model) => [model.id, model])),
  };
}

/**
 * An identifier in a case style that names can be derived from by appending (`PetParams`) or
 * prepending (`usePet`): never empty, and `_`-prefixed when it would start with a digit
 * (`_123startParams`, not `123startParams`).
 */
function derivedBase(name: string, style: 'PascalCase' | 'camelCase'): string {
  const cased = applyCase(name, style);
  if (cased === '') return style === 'PascalCase' ? 'Unnamed' : 'unnamed';
  return /^\d/.test(cased) ? `_${cased}` : cased;
}

/**
 * Array and tuple types of a schema that are not nested in an object or another array: the ones
 * the type printer hoists into helper typedefs (`TypeContext.hoistArray`).
 */
function topLevelArrays(schema: SchemaIR): number {
  switch (schema.kind) {
    case 'array':
      return 1;
    case 'union':
      // The printer prints a union with an `unknown` member as `unknown`.
      return schema.variants.some((variant) => variant.kind === 'unknown')
        ? 0
        : schema.variants.reduce((sum, variant) => sum + topLevelArrays(variant), 0);
    case 'intersection':
      return schema.members.reduce((sum, member) => sum + topLevelArrays(member), 0);
    default:
      return 0;
  }
}

/** The first tag preceded by its ancestors (OpenAPI 3.2 `parent`), root first. */
function tagPath(tag: string, parents: ReadonlyMap<string, string>): string[] {
  const path = [tag];
  for (
    let parent = parents.get(tag);
    parent !== undefined && !path.includes(parent);
    parent = parents.get(parent)
  )
    path.unshift(parent);
  return path;
}

/**
 * Root of the React Query keys of an operation's group: its first tag (after the tags it is
 * nested under), or nothing when ungrouped.
 */
function groupKeyPrefix(
  operation: OperationIR,
  config: ResolvedConfig,
  parents: ReadonlyMap<string, string>,
): string[] {
  return config.output.groupBy === 'tag' ? tagPath(operation.tags[0] ?? 'default', parents) : [];
}

/** Directory of a tag path, e.g. `pets/cats`; a first segment that is reserved gets `-api`. */
function groupPath(tags: readonly string[], config: ResolvedConfig): string {
  const segments = tags.map((tag) => toFileName(tag, config.naming.files));
  const first = segments[0] ?? 'default';
  if (RESERVED_MODULE_ROOTS.includes(first.toLowerCase())) segments[0] = `${first}-api`;
  return segments.join('/');
}

/**
 * Group directories of tag paths ({@link groupPath}). Directories whose spellings differ only in
 * case (tags `userData` and `userdata`) are one directory on macOS and Windows, so they share the
 * spelling that sorts first, segment by segment; the result does not depend on operation order.
 */
function groupDirectories(
  operations: readonly OperationIR[],
  config: ResolvedConfig,
  parents: ReadonlyMap<string, string>,
): (tags: readonly string[]) => string {
  const spellings = new Map<string, string>();
  const canonical = (directory: string): string => {
    let result = '';
    for (const segment of directory.split('/')) {
      const candidate = result === '' ? segment : `${result}/${segment}`;
      const key = candidate.toLowerCase();
      const existing = spellings.get(key);
      if (existing === undefined) spellings.set(key, candidate);
      result = existing ?? candidate;
    }
    return result;
  };
  const directories = operations.flatMap((operation) => {
    const tags = tagPath(operation.tags[0] ?? 'default', parents);
    return tags.map((_, index) => groupPath(tags.slice(0, index + 1), config));
  });
  for (const directory of [...new Set(directories)].sort(compareStrings)) canonical(directory);
  return (tags) => canonical(groupPath(tags, config));
}

/** Validates the configured page parameter of an infinite query. */
function resolvePageParam(
  operation: OperationIR,
  pageParam: string | undefined,
  diagnostics: DiagnosticBag,
): string | undefined {
  if (pageParam === undefined) return undefined;
  if (!operation.parameters.some((p) => p.in === 'query' && p.name === pageParam)) {
    diagnostics.error({
      code: 'query/invalid-page-param',
      message: `Infinite query for ${wireMethod(operation.method)} ${operation.path}: "${pageParam}" is not a query parameter of the operation.`,
      hint: `Use one of: ${
        operation.parameters
          .filter((p) => p.in === 'query')
          .map((p) => p.name)
          .join(', ') || '(no query parameters)'
      }.`,
    });
    return undefined;
  }
  return pageParam;
}

function groupFor(
  operation: OperationIR,
  config: ResolvedConfig,
  parents: ReadonlyMap<string, string>,
  directories: (tags: readonly string[]) => string,
): string {
  if (config.output.groupBy === 'none') return 'operations';
  return directories(tagPath(operation.tags[0] ?? 'default', parents));
}

const LOCATION_PRIORITY: Record<ParameterLocation, number> = {
  path: 0,
  query: 1,
  querystring: 2,
  header: 3,
  cookie: 4,
};

/**
 * Chooses property names for an operation's parameters inside the generated params object.
 * When two parameters share a name (for example `id` in path and query), the parameter with the
 * higher-priority location keeps it and the other is prefixed with its location.
 */
export function parameterProperties(
  operation: OperationIR,
  style: 'preserve' | 'camelCase',
): { properties: string[]; body: string; contentType: string } {
  const taken = new NameRegistry();
  const properties: string[] = Array.from({ length: operation.parameters.length }, () => '');
  const order = operation.parameters
    .map((parameter, index) => ({ parameter, index }))
    .sort(
      (a, b) =>
        LOCATION_PRIORITY[a.parameter.in] - LOCATION_PRIORITY[b.parameter.in] || a.index - b.index,
    );
  for (const { parameter, index } of order) {
    const preferred =
      style === 'camelCase' ? toPropertyName(parameter.name, 'camelCase') : parameter.name;
    properties[index] = taken.has(preferred)
      ? taken.claim(`${parameter.in}${applyCase(parameter.name, 'PascalCase')}`)
      : taken.claim(preferred);
  }
  const body =
    operation.requestBody === undefined
      ? 'body'
      : taken.has('body')
        ? taken.claim('requestBody')
        : taken.claim('body');
  const contentType =
    (operation.requestBody?.contents.length ?? 0) > 1
      ? taken.has('contentType')
        ? taken.claim('requestContentType')
        : taken.claim('contentType')
      : 'contentType';
  return { properties, body, contentType };
}
