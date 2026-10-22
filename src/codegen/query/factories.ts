import type { OperationPlan } from '../operation-plan.ts';
import { propertyKey } from '../printer.ts';
import {
  call,
  infiniteParamsParam,
  keyLiteral,
  mutationFn,
  mutationVariables,
  paginationType,
  queryParamsParam,
  renderFunction,
  type InfiniteShape,
  type QuerySymbols,
  type Scope,
} from './common.ts';

/**
 * Option factories for the Vue, Svelte and Solid adapters. They return plain objects typed with
 * `DataTag` instead of calling the adapters' `queryOptions` helpers, which not every v5 release of
 * those adapters exports. The objects work with `queryClient.fetchQuery`, `prefetchQuery`,
 * `getQueryData` and the adapters' own hooks.
 */

export function plainQueryOptions(plan: OperationPlan, q: QuerySymbols, scope: Scope): string {
  const op = plan.symbol.name;
  const keyName = q.queryKeyType ?? '';
  const keyType = `${scope.type('DataTag')}<${keyName}, ${scope.queryData}>`;
  const keyArgs = plan.hasParams ? 'params' : '';
  return renderFunction(
    scope,
    {
      summary: `Query options of {@link ${op}} for \`queryClient.fetchQuery\`, prefetching and the query hooks.`,
      tags: [],
    },
    {
      name: q.queryOptions ?? '',
      params: [
        ...queryParamsParam(plan, scope),
        {
          name: 'options',
          type: scope.options,
          optional: true,
          description: 'Per-request options.',
        },
      ],
      returns: `{ queryKey: ${keyType}; queryFn: (context: { signal: AbortSignal }) => Promise<${scope.queryData}> }`,
      body:
        `  return {\n    queryKey: ${scope.assert(keyType, `${q.queryKey ?? ''}(${keyArgs})`)},\n` +
        `    queryFn: ({ signal }) => ${scope.queryCall(call(scope, plan, 'params', scope.signal('options')))},\n  };\n`,
    },
  );
}

export function plainInfiniteQueryOptions(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  shape: InfiniteShape,
): string {
  const op = plan.symbol.name;
  const pages = `${scope.type('InfiniteData')}<${scope.queryData}, ${shape.pageType}>`;
  const keyType = `${scope.type('DataTag')}<${shape.keyName}, ${pages}>`;
  const pagination = paginationType(scope, shape.pageType);
  return renderFunction(
    scope,
    {
      summary: `Infinite query options of {@link ${op}} for \`queryClient.fetchInfiniteQuery\` and the infinite query hooks.`,
      tags: [],
    },
    {
      name: q.infiniteQueryOptions ?? '',
      params: [
        infiniteParamsParam(q, shape),
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
      returns: `${pagination} & { queryKey: ${keyType}; queryFn: (context: { pageParam: ${shape.pageType}; signal: AbortSignal }) => Promise<${scope.queryData}> }`,
      body:
        `  return {\n    ...pagination,\n    queryKey: ${scope.assert(keyType, `${shape.keyFn}(params)`)},\n` +
        `    queryFn: ({ pageParam, signal }) => ${scope.queryCall(`${scope.op}({ ...params, ${propertyKey(shape.property)}: pageParam }, ${scope.signal('options')})`)},\n  };\n`,
    },
  );
}

export function plainMutationOptions(plan: OperationPlan, q: QuerySymbols, scope: Scope): string {
  const op = plan.symbol.name;
  const variables = mutationVariables(plan, scope);
  return renderFunction(
    scope,
    { summary: `Mutation options of {@link ${op}} for the mutation hooks.`, tags: [] },
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
      returns: `{ mutationKey: readonly ${keyLiteral(q.keyPrefix, [])}; mutationFn: (variables: ${variables}) => Promise<${scope.response}> }`,
      body: `  return {\n    mutationKey: ${keyLiteral(q.keyPrefix, [])},\n    mutationFn: ${mutationFn(plan, scope, 'options')},\n  };\n`,
    },
  );
}

/** The `onSuccess` option that invalidates queries before calling the caller's `onSuccess`. */
export function invalidatingOnSuccess(
  invalidations: readonly (readonly string[])[],
  client: string,
  callerOptions: string,
  indent: string,
): string {
  if (invalidations.length === 0) return '';
  return (
    `${indent}onSuccess: async (...args) => {\n` +
    `${indent}  await Promise.all([\n${invalidations.map((target) => `${indent}    ${client}.invalidateQueries({ queryKey: ${keyLiteral(target, [])} }),`).join('\n')}\n${indent}  ]);\n` +
    `${indent}  return ${callerOptions}.onSuccess?.(...args);\n${indent}},\n`
  );
}
