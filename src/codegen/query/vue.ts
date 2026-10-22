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
  queryKeyParts,
  queryParamsParam,
  renderFunction,
  type QuerySymbols,
  type Scope,
} from './common.ts';
import {
  invalidatingOnSuccess,
  plainInfiniteQueryOptions,
  plainMutationOptions,
  plainQueryOptions,
} from './factories.ts';
import { invalidationDescription } from './react.ts';

/**
 * TanStack Query v5 for Vue (`@tanstack/vue-query`). Parameters and options accept refs, computed
 * refs and getters (`MaybeRefOrGetter`); the hooks pass a computed options object to the adapter,
 * so changing a parameter refetches. Query options use the plain object form of the adapter's
 * `UseQueryOptions` (it also accepts refs), mutations the query core's `MutationObserverOptions`
 * and infinite queries the parameter type of `useInfiniteQuery`: those are stable across v5,
 * unlike some of the adapter's other option types.
 */
const VUE = 'vue';

function reactive(scope: Scope, type: string): string {
  return `${scope.type('MaybeRefOrGetter', VUE)}<${type}>`;
}

export function generateVueQuery(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const keyName = q.queryKeyType ?? '';
  const generics = [scope.queryData, scope.error, 'TData', keyName];
  // The plain object form of the adapter's options (it also accepts a ref of them).
  const optionsType = `Exclude<${scope.type('UseQueryOptions')}<${scope.queryData}, ${scope.error}, TData, ${scope.queryData}, ${keyName}>, ${scope.type('Ref', VUE)}<unknown>>`;
  const toValue = scope.value('toValue', VUE);
  const parts = [...queryKeyParts(plan, q, scope), plainQueryOptions(plan, q, scope)];
  const object =
    `{\n        ...vueQueryOptions,\n        queryKey: ${q.queryKey ?? ''}(${plan.hasParams ? 'values' : ''}),\n` +
    `        queryFn: ({ signal }) => ${scope.queryCall(call(scope, plan, 'values', scope.signal('request')))},\n      }`;
  parts.push(
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `Vue Query composable for {@link ${op}}.`,
        'Parameters and options may be refs or getters: the query refetches when they change. Cancellation is wired to the query signal. `TData` is inferred from `select`.',
      ),
      {
        name: q.hook,
        typeParams: [{ name: 'TData', default: scope.queryData }],
        params: [
          ...queryParamsParam(
            plan,
            scope,
            'Request parameters (part of the query key); a ref or getter keeps them reactive.',
            reactive(scope, plan.paramsRequired ? scope.params : `${scope.params} | undefined`),
          ),
          {
            name: 'options',
            type: reactive(
              scope,
              `Omit<${optionsType}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            ),
            defaultValue: '{}',
            description: 'Vue Query options plus `request` options for the HTTP call.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one provided by `VueQueryPlugin`.',
          },
        ],
        returns: `${scope.type('UseQueryReturnType')}<TData, ${scope.error}>`,
        body:
          `  return ${scope.value('useQuery')}${scope.typeArgs(generics)}(\n` +
          `    ${scope.value('computed', VUE)}(() => {\n` +
          `      const { request, ...vueQueryOptions } = ${toValue}(options);\n` +
          (plan.hasParams ? `      const values = ${toValue}(params);\n` : '') +
          `      return ${scope.cast(optionsType, object)};\n    }),\n    queryClient,\n  );\n`,
      },
    ),
  );
  if (q.infiniteHook !== undefined) parts.push(...generateVueInfinite(plan, q, scope, ctx));
  return parts;
}

function generateVueInfinite(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const shape = infiniteShape(plan, q, scope);
  const pages = `${scope.type('InfiniteData')}<${scope.queryData}, ${shape.pageType}>`;
  const generics = [scope.queryData, scope.error, 'TData', shape.keyName, shape.pageType];
  // The plain object form of the adapter's options: neither a ref nor a getter.
  const optionsType = `Exclude<Parameters<typeof ${scope.typeofValue('useInfiniteQuery')}<${generics.join(', ')}>>[0], ${scope.type('Ref', VUE)}<unknown> | ((...args: never[]) => unknown)>`;
  const toValue = scope.value('toValue', VUE);
  // Vue Query 5.0 takes a plain options object for infinite queries (later releases also accept
  // refs), so the parameters stay reactive through a computed key and are read when fetching.
  const object =
    `{\n      ...vueQueryOptions,\n      queryKey: ${scope.value('computed', VUE)}(() => ${shape.keyFn}(${toValue}(params))),\n` +
    `      queryFn: ({ pageParam, signal }) => ${scope.queryCall(`${scope.op}({ ...${toValue}(params), ${propertyKey(shape.property)}: pageParam }, ${scope.signal('request')})`)},\n    }`;
  return [
    ...infiniteKeyParts(plan, q, scope, shape),
    plainInfiniteQueryOptions(plan, q, scope, shape),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `Vue Query infinite query composable for {@link ${op}}, paginating with the \`${q.pageParam ?? ''}\` query parameter.`,
        'Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested. Parameters may be refs or getters; options are read once, so pass refs for options that change (such as `enabled`).',
      ),
      {
        name: q.infiniteHook ?? '',
        typeParams: [{ name: 'TData', default: pages }],
        params: [
          infiniteParamsParam(q, shape, reactive(scope, shape.paramsType)),
          {
            name: 'options',
            type: `Omit<${optionsType}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            description: 'Vue Query options, including pagination, plus `request` options.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one provided by `VueQueryPlugin`.',
          },
        ],
        returns: `${scope.type('UseInfiniteQueryReturnType')}<TData, ${scope.error}>`,
        body:
          `  const { request, ...vueQueryOptions } = options;\n` +
          `  return ${scope.value('useInfiniteQuery')}${scope.typeArgs(generics)}(\n` +
          `    ${scope.cast(optionsType, object)},\n    queryClient,\n  );\n`,
      },
    ),
  ];
}

export function generateVueMutation(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
  invalidations: readonly (readonly string[])[],
): string[] {
  const op = plan.symbol.name;
  const variables = mutationVariables(plan, scope);
  const generics = [scope.response, scope.error, variables, 'TContext'];
  const optionsType = `${scope.type('MutationObserverOptions')}<${generics.join(', ')}>`;
  const setup =
    invalidations.length === 0
      ? ''
      : `  const client = queryClient ?? ${scope.value('useQueryClient')}();\n`;
  const object =
    `{\n        ...vueQueryOptions,\n        mutationKey: ${keyLiteral(q.keyPrefix, [])},\n` +
    `        mutationFn: ${mutationFn(plan, scope, 'request')},\n` +
    `${invalidatingOnSuccess(invalidations, 'client', 'vueQueryOptions', '        ')}      }`;
  return [
    plainMutationOptions(plan, q, scope),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `Vue Query mutation composable for {@link ${op}}.`,
        invalidationDescription(invalidations),
      ),
      {
        name: q.hook,
        typeParams: [{ name: 'TContext', default: 'unknown' }],
        params: [
          {
            name: 'options',
            type: reactive(
              scope,
              `Omit<${optionsType}, 'mutationKey' | 'mutationFn'> & { request?: ${scope.options} | undefined }`,
            ),
            defaultValue: '{}',
            description: 'Vue Query options plus `request` options for the HTTP call.',
          },
          {
            name: 'queryClient',
            type: scope.type('QueryClient'),
            optional: true,
            description: 'Use this QueryClient instead of the one provided by `VueQueryPlugin`.',
          },
        ],
        returns: `${scope.type('UseMutationReturnType')}<${generics.join(', ')}>`,
        body:
          setup +
          `  return ${scope.value('useMutation')}${scope.typeArgs(generics)}(\n` +
          `    ${scope.value('computed', VUE)}(() => {\n` +
          `      const { request, ...vueQueryOptions } = ${scope.value('toValue', VUE)}(options);\n` +
          `      return ${scope.cast(optionsType, object)};\n    }),\n    queryClient,\n  );\n`,
      },
    ),
  ];
}
