import type { EmitContext } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { propertyKey } from '../printer.ts';
import {
  call,
  hookDoc,
  infiniteKeyParts,
  infiniteParamsParam,
  infiniteShape,
  keyLiteral,
  mutationFn,
  mutationVariables,
  paginationType,
  queryKeyParts,
  queryParamsParam,
  renderFunction,
  type QuerySymbols,
  type Scope,
} from './common.ts';

/**
 * TanStack Query v5 for React. Generated code only relies on APIs whose types are stable across
 * all v5 releases: the hook generics, `UseQueryOptions`, `UseMutationOptions`, the result types,
 * `InfiniteData`, `DataTag` (two-parameter form) and the `queryOptions`/`infiniteQueryOptions`
 * helpers. Infinite query option types are derived from `useInfiniteQuery`'s own generics because
 * `UseInfiniteQueryOptions` changed its type parameters during v5.
 */
export function generateReactQuery(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const keyName = q.queryKeyType ?? '';
  const keyFn = q.queryKey ?? '';
  const paramsParam = queryParamsParam(plan, scope);
  const keyArgs = plan.hasParams ? 'params' : '';
  const generics = [scope.queryData, scope.error, scope.queryData, keyName];
  const queryOptionsType = `${scope.type('UseQueryOptions')}<${generics.join(', ')}>`;
  const parts: string[] = queryKeyParts(plan, q, scope);

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
        name: q.queryOptions ?? '',
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
        name: q.hook,
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

  if (q.infiniteHook !== undefined) parts.push(...generateInfinite(plan, q, scope, ctx));
  return parts;
}

function generateInfinite(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const shape = infiniteShape(plan, q, scope);
  const { pageType, keyName, keyFn, property } = shape;
  const paramsParam = infiniteParamsParam(q, shape);
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
  const queryFn = (request: string): string =>
    `({ pageParam, signal }) => ${scope.queryCall(`${scope.op}({ ...params, ${propertyKey(property)}: pageParam }, ${scope.signal(request)})`)}`;

  return [
    ...infiniteKeyParts(plan, q, scope, shape),
    renderFunction(
      scope,
      {
        summary: `Infinite query options of {@link ${op}} for \`useInfiniteQuery\` and \`queryClient.fetchInfiniteQuery\`.`,
        tags: [],
      },
      {
        name: q.infiniteQueryOptions ?? '',
        params: [
          paramsParam,
          {
            name: 'pagination',
            type: paginationType(scope, pageType),
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
        `Infinite query hook for {@link ${op}}, paginating with the \`${q.pageParam ?? ''}\` query parameter.`,
        'Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested.',
      ),
      {
        name: q.infiniteHook ?? '',
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

export function generateReactMutation(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
  invalidations: readonly (readonly string[])[],
): string[] {
  const op = plan.symbol.name;
  const variables = mutationVariables(plan, scope);
  const key = keyLiteral(q.keyPrefix, []);
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
  const generics = [scope.response, scope.error, variables, 'TContext'];

  return [
    renderFunction(
      scope,
      { summary: `Mutation options of {@link ${op}} for \`useMutation\`.`, tags: [] },
      {
        name: q.mutationOptions ?? '',
        params: [
          {
            name: 'options',
            type: scope.options,
            optional: true,
            description: 'Per-request options.',
          },
        ],
        returns: optionsType(),
        body: `  return {\n    mutationKey: ${key},\n    mutationFn: ${mutationFn(plan, scope, 'options')},\n  };\n`,
      },
    ),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `React Query mutation hook for {@link ${op}}.`,
        invalidationDescription(invalidations),
      ),
      {
        name: q.hook,
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
          `    ${scope.cast(optionsType('TContext'), `{\n      ...reactQueryOptions,\n      mutationKey: ${key},\n      mutationFn: ${mutationFn(plan, scope, 'request')},\n${invalidate}    }`)},\n` +
          `    queryClient,\n  );\n`,
      },
    ),
  ];
}

/** The JSDoc sentence describing what a mutation hook invalidates. */
export function invalidationDescription(invalidations: readonly (readonly string[])[]): string {
  return invalidations.length === 0
    ? 'Pass `onSuccess` to react to results, for example to invalidate queries.'
    : `On success it invalidates ${invalidations.map((t) => `\`${JSON.stringify(t)}\``).join(', ')} before calling your \`onSuccess\`.`;
}
