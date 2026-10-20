import type { OperationSymbol, ReactQueryGroup } from '../analysis/types.ts';
import { applyJsDocHook, renderAll, type EmitContext, type ModuleOutput } from './context.ts';
import type { ImportManager, Lang } from './imports.ts';
import type { OperationPlan } from './operation-plan.ts';
import { literal, propertyKey, renderJsDoc } from './printer.ts';
import type { GeneratedExport, JsDocBlock, JsDocTag } from './types.ts';

/**
 * TanStack Query v5 integration. Generated code only relies on APIs whose types are stable across
 * all v5 releases: the hook generics, `UseQueryOptions`, `UseMutationOptions`, the result types,
 * `InfiniteData`, `DataTag` (two-parameter form) and the `queryOptions`/`infiniteQueryOptions`
 * helpers. Infinite query option types are derived from `useInfiniteQuery`'s own generics because
 * `UseInfiniteQueryOptions` changed its type parameters during v5.
 */
const RQ = '@tanstack/react-query';

type ReactQuerySymbols = NonNullable<OperationSymbol['reactQuery']>;

interface Param {
  readonly name: string;
  readonly type: string;
  readonly optional?: boolean;
  readonly defaultValue?: string;
  readonly description: string;
}

interface FunctionSpec {
  readonly name: string;
  readonly typeParams?: readonly { readonly name: string; readonly default: string }[];
  readonly params: readonly Param[];
  /** Return type; omitted in TypeScript output when inference gives a more precise type. */
  readonly returns?: string;
  readonly body: string;
}

/** Imports and language helpers for one rendered module. */
class Scope {
  readonly imports: ImportManager;
  readonly lang: Lang;
  readonly op: string;
  readonly params: string;
  readonly #responseName: string;
  readonly #module: string;
  /**
   * Data type of queries. TanStack Query rejects `undefined` query data, so operations that can
   * resolve without a body (204, 304) produce `null` instead.
   */
  readonly queryData: string;
  /** Whether query functions must map `undefined` to `null`. */
  readonly nullable: boolean;
  readonly error: string;
  readonly options: string;

  constructor(imports: ImportManager, lang: Lang, plan: OperationPlan, ctx: EmitContext) {
    this.imports = imports;
    this.lang = lang;
    const symbol = plan.symbol;
    const type = (name: string): string => imports.add(symbol.module, name, { typeOnly: true });
    this.op =
      lang === 'dts' ? symbol.name : imports.add(symbol.module, symbol.name, { typeOnly: false });
    this.params = plan.hasParams ? type(symbol.typeNames.params) : 'never';
    this.#module = symbol.module;
    this.#responseName = symbol.typeNames.response;
    const dataStyle = ctx.config.client.responseStyle === 'data';
    const noBody = plan.success.every((s) => s.media === undefined);
    this.nullable = dataStyle && (noBody || plan.success.some((s) => s.media === undefined));
    this.queryData = !this.nullable
      ? this.response
      : noBody
        ? 'null'
        : `Exclude<${this.response}, undefined> | null`;
    this.error = type(symbol.typeNames.error);
    this.options = imports.add('client', 'RequestOptions', { typeOnly: true });
  }

  /**
   * The operation's response type, imported on first use: queries of operations without a
   * response body never mention it, and an unused import fails `noUnusedLocals`.
   */
  get response(): string {
    return this.imports.add(this.#module, this.#responseName, { typeOnly: true });
  }

  /** A value import from TanStack Query (empty in declaration files, which have no bodies). */
  value(name: string): string {
    return this.lang === 'dts'
      ? ''
      : this.imports.add(RQ, name, { typeOnly: false, external: true });
  }

  /** A type import from TanStack Query (an inline `import()` type in JavaScript). */
  type(name: string): string {
    return this.imports.add(RQ, name, { typeOnly: true, external: true });
  }

  /** `typeof useInfiniteQuery` usable in a type position. */
  typeofValue(name: string): string {
    return this.lang === 'ts'
      ? this.imports.add(RQ, name, { typeOnly: false, external: true })
      : this.type(name);
  }

  typeArgs(args: readonly string[]): string {
    return this.lang === 'js' ? '' : `<${args.join(', ')}>`;
  }

  /** In JavaScript, a JSDoc cast that pins the generic arguments TypeScript infers. */
  cast(type: string, expression: string): string {
    return this.lang === 'js' ? `/** @type {${type}} */ (${expression})` : expression;
  }

  /** Wraps an operation call so a missing body becomes `null` for TanStack Query. */
  queryCall(expression: string): string {
    return this.nullable ? `${expression}.then((data) => data ?? null)` : expression;
  }

  signal(source: string): string {
    const anySignal = this.imports.add('runtime/signal', 'anySignal', { typeOnly: false });
    return `{ ...${source}, signal: ${anySignal}(${source}?.signal, signal) }`;
  }
}

function keyLiteral(prefix: readonly string[], extra: readonly string[]): string {
  return `[${[...prefix.map((p) => literal(p)), ...extra].join(', ')}]`;
}

function keyType(prefix: readonly string[], extra: readonly string[]): string {
  return `readonly [${[...prefix.map((p) => literal(p)), ...extra].join(', ')}]`;
}

/** Renders a function as TypeScript, JavaScript with JSDoc types, or a `.d.ts` declaration. */
function renderFunction(scope: Scope, doc: JsDocBlock, spec: FunctionSpec): string {
  const typeParams = spec.typeParams ?? [];
  if (scope.lang === 'js') {
    const tags: JsDocTag[] = [
      ...typeParams.map((t) => ({ tag: 'template', text: `[${t.name}=${t.default}]` })),
      ...spec.params.map((p) => ({
        tag: 'param',
        text: `{${p.type}} ${p.optional === true || p.defaultValue !== undefined ? `[${p.name}]` : p.name} - ${p.description}`,
      })),
      ...(spec.returns === undefined ? [] : [{ tag: 'returns', text: `{${spec.returns}}` }]),
    ];
    const args = spec.params.map((p) =>
      p.defaultValue === undefined ? p.name : `${p.name} = ${p.defaultValue}`,
    );
    return `${renderJsDoc({ ...doc, tags: [...doc.tags, ...tags] })}export function ${spec.name}(${args.join(', ')}) {\n${spec.body}}\n`;
  }
  const generics =
    typeParams.length === 0
      ? ''
      : `<${typeParams.map((t) => `${t.name} = ${t.default}`).join(', ')}>`;
  const params = spec.params.map((p) => {
    const optional =
      p.optional === true || (scope.lang === 'dts' && p.defaultValue !== undefined) ? '?' : '';
    const defaultValue =
      scope.lang === 'ts' && p.defaultValue !== undefined ? ` = ${p.defaultValue}` : '';
    return `${p.name}${optional}: ${p.type}${defaultValue}`;
  });
  const returns = spec.returns === undefined ? '' : `: ${spec.returns}`;
  const keyword = scope.lang === 'dts' ? 'export declare function' : 'export function';
  const oneLine = `${keyword} ${spec.name}${generics}(${params.join(', ')})${returns}`;
  const signature =
    oneLine.length <= 100
      ? oneLine
      : `${keyword} ${spec.name}${generics}(\n${params.map((p) => `  ${p},`).join('\n')}\n)${returns}`;
  const tags: JsDocTag[] = spec.params.map((p) => ({
    tag: 'param',
    text: `${p.name} - ${p.description}`,
  }));
  const jsDoc = renderJsDoc({ ...doc, tags: [...doc.tags, ...tags] });
  return scope.lang === 'dts'
    ? `${jsDoc}${signature};\n`
    : `${jsDoc}${signature} {\n${spec.body}}\n`;
}

function renderTypeAlias(scope: Scope, name: string, type: string, doc: JsDocBlock): string {
  if (scope.lang === 'js')
    return renderJsDoc({
      ...doc,
      tags: [...doc.tags, { tag: 'typedef', text: `{${type}} ${name}` }],
    });
  return `${renderJsDoc(doc)}export type ${name} = ${type};\n`;
}

function call(scope: Scope, plan: OperationPlan, params: string, request: string): string {
  return `${scope.op}(${(plan.hasParams ? [params, request] : [request]).join(', ')})`;
}

function hookDoc(
  ctx: EmitContext,
  plan: OperationPlan,
  summary: string,
  description: string,
): JsDocBlock {
  return applyJsDocHook(
    ctx,
    { summary, description, tags: plan.symbol.operation.deprecated ? [{ tag: 'deprecated' }] : [] },
    { kind: 'hook', operation: plan.symbol.operation },
  );
}

function generateQuery(
  plan: OperationPlan,
  rq: ReactQuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const keyName = rq.queryKeyType ?? '';
  const keyFn = rq.queryKey ?? '';
  const optionalParams = plan.hasParams && !plan.paramsRequired;
  const paramsParam: Param[] = plan.hasParams
    ? [
        {
          name: 'params',
          type: scope.params,
          optional: optionalParams,
          description: 'Request parameters (part of the query key).',
        },
      ]
    : [];
  const keyArgs = plan.hasParams ? 'params' : '';
  const generics = [scope.queryData, scope.error, scope.queryData, keyName];
  const queryOptionsType = `${scope.type('UseQueryOptions')}<${generics.join(', ')}>`;
  const parts: string[] = [];

  parts.push(
    renderTypeAlias(scope, keyName, keyType(rq.keyPrefix, plan.hasParams ? [scope.params] : []), {
      summary: `Query key of {@link ${op}}: a static prefix followed by every request parameter.`,
      tags: [],
    }),
    renderFunction(
      scope,
      { summary: `Builds the query key of {@link ${op}}.`, tags: [] },
      {
        name: keyFn,
        params: paramsParam,
        returns: keyName,
        body: `  return ${keyLiteral(rq.keyPrefix, plan.hasParams ? [optionalParams ? 'params ?? {}' : 'params'] : [])};\n`,
      },
    ),
  );

  const optionsObject =
    `{\n    queryKey: ${keyFn}(${keyArgs}),\n` +
    `    queryFn: ({ signal }) => ${scope.queryCall(call(scope, plan, 'params', scope.signal('options')))},\n  }`;
  parts.push(
    renderFunction(
      scope,
      {
        summary: `Query options of {@link ${op}} for \`useQuery\`, \`queryClient.fetchQuery\`, prefetching and server rendering.`,
        tags: [],
      },
      {
        name: rq.queryOptions ?? '',
        params: [
          ...paramsParam,
          {
            name: 'options',
            type: scope.options,
            optional: true,
            description: 'Per-request options.',
          },
        ],
        // Implementations infer the helper's tagged key type; declarations spell out a stable equivalent.
        ...(scope.lang === 'dts'
          ? {
              returns: `${queryOptionsType} & { queryKey: ${scope.type('DataTag')}<${keyName}, ${scope.queryData}> }`,
            }
          : {}),
        body: `  return ${scope.value('queryOptions')}${scope.typeArgs(generics)}(${scope.cast(queryOptionsType, optionsObject)});\n`,
      },
    ),
  );

  const hookGenerics = [scope.queryData, scope.error, 'TData', keyName];
  const hookOptionsType = `${scope.type('UseQueryOptions')}<${hookGenerics.join(', ')}>`;
  const hookArgs =
    `{\n      ...reactQueryOptions,\n      queryKey: ${keyFn}(${keyArgs}),\n` +
    `      queryFn: ({ signal }) => ${scope.queryCall(call(scope, plan, 'params', scope.signal('request')))},\n    }`;
  parts.push(
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `React Query hook for {@link ${op}}.`,
        'Cancellation is wired to the query signal. `TData` is inferred from `select`.',
      ),
      {
        name: rq.hook,
        typeParams: [{ name: 'TData', default: scope.queryData }],
        params: [
          ...paramsParam,
          {
            name: 'options',
            type: `Omit<${hookOptionsType}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            defaultValue: '{}',
            description: 'React Query options plus `request` options for the HTTP call.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one from context.',
          },
        ],
        returns: `${scope.type('UseQueryResult')}<TData, ${scope.error}>`,
        body:
          `  const { request, ...reactQueryOptions } = options;\n` +
          `  return ${scope.value('useQuery')}${scope.typeArgs(hookGenerics)}(\n    ${scope.cast(hookOptionsType, hookArgs)},\n    queryClient,\n  );\n`,
      },
    ),
  );

  if (rq.infiniteHook !== undefined) parts.push(...generateInfinite(plan, rq, scope, ctx));
  return parts;
}

function generateInfinite(
  plan: OperationPlan,
  rq: ReactQuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const pageParam = rq.pageParam ?? '';
  const property =
    plan.parameters.find((p) => p.parameter.in === 'query' && p.parameter.name === pageParam)
      ?.property ?? pageParam;
  const pageType = rq.pageParamType ?? '';
  const keyName = rq.infiniteQueryKeyType ?? '';
  const keyFn = rq.infiniteQueryKey ?? '';
  const paramsType = `Omit<${scope.params}, ${literal(property)}>`;
  const required =
    plan.parameters.some((p) => p.parameter.required && p.property !== property) ||
    plan.body?.required === true;
  const paramsParam: Param = {
    name: 'params',
    type: paramsType,
    ...(required ? {} : { defaultValue: '{}' }),
    description: `Request parameters without \`${pageParam}\` (part of the query key).`,
  };
  const pages = `${scope.type('InfiniteData')}<${scope.queryData}, ${pageType}>`;
  const generics = (data: string): string[] => [
    scope.queryData,
    scope.error,
    data,
    keyName,
    pageType,
  ];
  const optionsType = (data: string): string =>
    `Parameters<typeof ${scope.typeofValue('useInfiniteQuery')}<${generics(data).join(', ')}>>[0]`;
  const pageFn = `(lastPage: ${scope.queryData}, allPages: ${scope.queryData}[], lastPageParam: ${pageType}, allPageParams: ${pageType}[]) => ${pageType} | undefined | null`;
  const pagination = `{ initialPageParam: ${pageType}; getNextPageParam: ${pageFn}; getPreviousPageParam?: ${pageFn} }`;
  const queryFn = (request: string): string =>
    `({ pageParam, signal }) => ${scope.queryCall(`${scope.op}({ ...params, ${propertyKey(property)}: pageParam }, ${scope.signal(request)})`)}`;

  return [
    renderTypeAlias(scope, pageType, `${scope.params}[${literal(property)}]`, {
      summary: `Page parameter of {@link ${rq.infiniteHook ?? op}}: the \`${pageParam}\` query parameter.`,
      tags: [],
    }),
    renderTypeAlias(scope, keyName, keyType(rq.keyPrefix, ["'infinite'", paramsType]), {
      summary: `Query key of the infinite query of {@link ${op}}.`,
      tags: [],
    }),
    renderFunction(
      scope,
      { summary: `Builds the infinite query key of {@link ${op}}.`, tags: [] },
      {
        name: keyFn,
        params: [paramsParam],
        returns: keyName,
        body: `  return ${keyLiteral(rq.keyPrefix, ["'infinite'", 'params'])};\n`,
      },
    ),
    renderFunction(
      scope,
      {
        summary: `Infinite query options of {@link ${op}} for \`useInfiniteQuery\` and \`queryClient.fetchInfiniteQuery\`.`,
        tags: [],
      },
      {
        name: rq.infiniteQueryOptions ?? '',
        params: [
          paramsParam,
          {
            name: 'pagination',
            type: pagination,
            description: 'How pages are requested: `initialPageParam` and `getNextPageParam`.',
          },
          {
            name: 'options',
            type: scope.options,
            optional: true,
            description: 'Per-request options.',
          },
        ],
        ...(scope.lang === 'dts'
          ? {
              returns: `${optionsType(pages)} & { queryKey: ${scope.type('DataTag')}<${keyName}, ${pages}> }`,
            }
          : {}),
        body:
          `  return ${scope.value('infiniteQueryOptions')}${scope.typeArgs(generics(pages))}(\n` +
          `    ${scope.cast(optionsType(pages), `{\n      ...pagination,\n      queryKey: ${keyFn}(params),\n      queryFn: ${queryFn('options')},\n    }`)},\n  );\n`,
      },
    ),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `Infinite query hook for {@link ${op}}, paginating with the \`${pageParam}\` query parameter.`,
        'Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested.',
      ),
      {
        name: rq.infiniteHook ?? '',
        typeParams: [{ name: 'TData', default: pages }],
        params: [
          paramsParam,
          {
            name: 'options',
            type: `Omit<${optionsType('TData')}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            description: 'React Query options, including pagination, plus `request` options.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one from context.',
          },
        ],
        returns: `${scope.type('UseInfiniteQueryResult')}<TData, ${scope.error}>`,
        body:
          `  const { request, ...reactQueryOptions } = options;\n` +
          `  return ${scope.value('useInfiniteQuery')}${scope.typeArgs(generics('TData'))}(\n` +
          `    ${scope.cast(optionsType('TData'), `{\n      ...reactQueryOptions,\n      queryKey: ${keyFn}(params),\n      queryFn: ${queryFn('request')},\n    }`)},\n` +
          `    queryClient,\n  );\n`,
      },
    ),
  ];
}

function generateMutation(
  plan: OperationPlan,
  rq: ReactQuerySymbols,
  scope: Scope,
  ctx: EmitContext,
  invalidations: readonly (readonly string[])[],
): string[] {
  const op = plan.symbol.name;
  const variables = !plan.hasParams
    ? 'void'
    : plan.paramsRequired
      ? scope.params
      : `${scope.params} | void`;
  const mutationFn = (request: string): string =>
    !plan.hasParams
      ? `() => ${scope.op}(${request})`
      : plan.paramsRequired
        ? `(variables) => ${scope.op}(variables, ${request})`
        : `(variables) => ${scope.op}(variables || undefined, ${request})`;
  const key = keyLiteral(rq.keyPrefix, []);
  const optionsType = (context?: string): string =>
    `${scope.type('UseMutationOptions')}<${[scope.response, scope.error, variables, ...(context === undefined ? [] : [context])].join(', ')}>`;

  const invalidate =
    invalidations.length === 0
      ? ''
      : `      onSuccess: async (...args) => {\n` +
        `        await Promise.all([\n${invalidations.map((target) => `          client.invalidateQueries({ queryKey: ${keyLiteral(target, [])} }),`).join('\n')}\n        ]);\n` +
        `        return reactQueryOptions.onSuccess?.(...args);\n      },\n`;
  const setup =
    invalidations.length === 0
      ? ''
      : `  const client = ${scope.value('useQueryClient')}(queryClient);\n`;
  const description =
    invalidations.length === 0
      ? 'Pass `onSuccess` to react to results, for example to invalidate queries.'
      : `On success it invalidates ${invalidations.map((t) => `\`${JSON.stringify(t)}\``).join(', ')} before calling your \`onSuccess\`.`;
  const generics = [scope.response, scope.error, variables, 'TContext'];

  return [
    renderFunction(
      scope,
      { summary: `Mutation options of {@link ${op}} for \`useMutation\`.`, tags: [] },
      {
        name: rq.mutationOptions ?? '',
        params: [
          {
            name: 'options',
            type: scope.options,
            optional: true,
            description: 'Per-request options.',
          },
        ],
        returns: optionsType(),
        body: `  return {\n    mutationKey: ${key},\n    mutationFn: ${mutationFn('options')},\n  };\n`,
      },
    ),
    renderFunction(
      scope,
      hookDoc(ctx, plan, `React Query mutation hook for {@link ${op}}.`, description),
      {
        name: rq.hook,
        typeParams: [{ name: 'TContext', default: 'unknown' }],
        params: [
          {
            name: 'options',
            type: `Omit<${optionsType('TContext')}, 'mutationKey' | 'mutationFn'> & { request?: ${scope.options} | undefined }`,
            defaultValue: '{}',
            description: 'React Query options plus `request` options for the HTTP call.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one from context.',
          },
        ],
        returns: `${scope.type('UseMutationResult')}<${generics.join(', ')}>`,
        body:
          `  const { request, ...reactQueryOptions } = options;\n${setup}` +
          `  return ${scope.value('useMutation')}${scope.typeArgs(generics)}(\n` +
          `    ${scope.cast(optionsType('TContext'), `{\n      ...reactQueryOptions,\n      mutationKey: ${key},\n      mutationFn: ${mutationFn('request')},\n${invalidate}    }`)},\n` +
          `    queryClient,\n  );\n`,
      },
    ),
  ];
}

/** Resolves configured invalidation targets (operation names/ids or tags) to query key prefixes. */
export function resolveInvalidations(plan: OperationPlan, ctx: EmitContext): string[][] {
  const reactQuery = ctx.config.features.reactQuery;
  if (reactQuery === false) return [];
  const symbol = plan.symbol;
  const targets =
    reactQuery.invalidates[symbol.name] ??
    (symbol.operation.operationId === undefined
      ? undefined
      : reactQuery.invalidates[symbol.operation.operationId]) ??
    [];
  const keys: string[][] = [];
  for (const target of targets) {
    const operation = ctx.project.operations.find(
      (o) => o.name === target || o.operation.operationId === target,
    );
    if (operation?.reactQuery !== undefined) {
      keys.push([...operation.reactQuery.keyPrefix]);
      continue;
    }
    // A tag (nested tags match their own name) or a group directory.
    const group = ctx.project.reactQueryGroups.find(
      (g) => g.prefix.at(-1) === target || g.group === target,
    );
    if (group !== undefined) keys.push([...group.prefix]);
  }
  return keys;
}

export function generateReactQueryModule(
  plan: OperationPlan,
  ctx: EmitContext,
): ModuleOutput | undefined {
  const rq = plan.symbol.reactQuery;
  if (rq === undefined) return undefined;
  const isQuery = rq.queryKey !== undefined;
  const invalidations = isQuery ? [] : resolveInvalidations(plan, ctx);
  const named = (
    name: string | undefined,
    kind: GeneratedExport['kind'],
    typeOnly = false,
  ): GeneratedExport[] => (name === undefined ? [] : [{ name, kind, typeOnly }]);
  const exports: GeneratedExport[] = isQuery
    ? [
        ...named(rq.queryKeyType, 'type', true),
        ...named(rq.queryKey, 'query-key'),
        ...named(rq.queryOptions, 'query-options'),
        ...named(rq.hook, 'hook'),
        ...named(rq.pageParamType, 'type', true),
        ...named(rq.infiniteQueryKeyType, 'type', true),
        ...named(rq.infiniteQueryKey, 'query-key'),
        ...named(rq.infiniteQueryOptions, 'query-options'),
        ...named(rq.infiniteHook, 'hook'),
      ]
    : [...named(rq.mutationOptions, 'mutation-options'), ...named(rq.hook, 'hook')];
  const outputs = renderAll(rq.module, ctx, (imports, lang) => {
    for (const entry of exports) imports.declare(entry.name);
    const scope = new Scope(imports, lang, plan, ctx);
    return (
      isQuery
        ? generateQuery(plan, rq, scope, ctx)
        : generateMutation(plan, rq, scope, ctx, invalidations)
    ).join('\n');
  });
  return {
    module: rq.module,
    origin: 'core:react-query',
    ...outputs,
    exports,
    sources: { operations: [plan.symbol.key] },
  };
}

/** Per-group key factory: `<group>Keys.all` matches every query of the group. */
export function generateGroupKeys(
  group: ReactQueryGroup,
  plans: readonly OperationPlan[],
  ctx: EmitContext,
): ModuleOutput {
  const members = plans.filter(
    (p) => p.symbol.group === group.group && p.symbol.reactQuery?.queryKey !== undefined,
  );
  const outputs = renderAll(group.module, ctx, (imports, lang) => {
    imports.declare(group.name);
    const doc: JsDocBlock = {
      summary: `React Query keys of the \`${group.prefix.join('/')}\` operations.`,
      description:
        '`all` matches every query of the group, e.g. `queryClient.invalidateQueries({ queryKey: keys.all })`.',
      tags: [],
    };
    const entries = members.map((plan) => ({
      name: plan.symbol.name,
      keyFn: imports.add(
        plan.symbol.reactQuery?.module ?? '',
        plan.symbol.reactQuery?.queryKey ?? '',
        { typeOnly: lang === 'dts' },
      ),
    }));
    const all = keyLiteral(group.prefix, []);
    if (lang === 'dts') {
      const lines = [
        `  readonly all: readonly ${all};`,
        ...entries.map((e) => `  readonly ${propertyKey(e.name)}: typeof ${e.keyFn};`),
      ];
      return `${renderJsDoc(doc)}export declare const ${group.name}: {\n${lines.join('\n')}\n};\n`;
    }
    const allValue = lang === 'ts' ? `${all} as const` : `/** @type {const} */ (${all})`;
    const lines = [
      `  all: ${allValue},`,
      ...entries.map((e) => `  ${propertyKey(e.name)}: ${e.keyFn},`),
    ];
    return `${renderJsDoc(doc)}export const ${group.name} = {\n${lines.join('\n')}\n};\n`;
  });
  return {
    module: group.module,
    origin: 'core:react-query',
    ...outputs,
    exports: [{ name: group.name, kind: 'query-key', typeOnly: false }],
  };
}

/** The `react-query/index` barrel. Kept separate so the main barrel never imports React. */
export function generateReactQueryBarrel(
  ctx: EmitContext,
  modules: readonly ModuleOutput[],
): ModuleOutput {
  const outputs = renderAll(
    'react-query/index',
    ctx,
    (imports) =>
      `${modules.map((m) => `export * from '${imports.specifier(m.module)}';`).join('\n')}\n`,
  );
  return {
    module: 'react-query/index',
    origin: 'core:react-query-barrel',
    ...outputs,
    exports: modules.flatMap((m) => m.exports),
  };
}
