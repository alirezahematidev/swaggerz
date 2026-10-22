import type { EmitContext } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { propertyKey } from '../printer.ts';
import {
  call,
  hookDoc,
  infiniteKeyParts,
  infiniteShape,
  keyLiteral,
  mutationFn,
  mutationVariables,
  queryKeyParts,
  renderFunction,
  type Param,
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
 * TanStack Query v5 for Svelte (`@tanstack/svelte-query` 6, Svelte 5 runes) and Solid
 * (`@tanstack/solid-query` 5). Both adapters take their options as an accessor function, so the
 * generated functions take parameters and options as accessors too: reading them inside the
 * adapter's accessor makes the query follow `$state` (Svelte) and signals (Solid).
 */
export interface AccessorFramework {
  readonly name: 'Svelte' | 'Solid';
  /** Wraps an adapter option type into the plain object type (Solid's are accessors). */
  readonly plain: (type: string) => string;
}

export const SVELTE: AccessorFramework = { name: 'Svelte', plain: (type) => type };
// Solid's option types are accessors. Its query primitives are overloaded on whether
// `initialData` is set, so the option type leaves `initialData` out to match one overload.
export const SOLID: AccessorFramework = {
  name: 'Solid',
  plain: (type) => `Omit<ReturnType<${type}>, 'initialData'>`,
};

const accessor = (type: string): string => `() => ${type}`;

function clientParam(scope: Scope): Param {
  return {
    name: 'queryClient',
    type: accessor(scope.type('QueryClient')),
    optional: true,
    description: 'Use this QueryClient instead of the one from context.',
  };
}

export function generateAccessorQuery(
  framework: AccessorFramework,
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const keyName = q.queryKeyType ?? '';
  const generics = [scope.queryData, scope.error, 'TData', keyName];
  const optionsType = framework.plain(
    `${scope.type('CreateQueryOptions')}<${generics.join(', ')}>`,
  );
  const object =
    `{\n      ...queryOptions,\n      queryKey: ${q.queryKey ?? ''}(${plan.hasParams ? 'values' : ''}),\n` +
    `      queryFn: ({ signal }) => ${scope.queryCall(call(scope, plan, 'values', scope.signal('request')))},\n    }`;
  const params: Param[] = plan.hasParams
    ? [
        {
          name: 'params',
          type: accessor(plan.paramsRequired ? scope.params : `${scope.params} | undefined`),
          ...(plan.paramsRequired ? {} : { defaultValue: '() => undefined' }),
          description: 'Returns the request parameters (part of the query key); read reactively.',
        },
      ]
    : [];
  return [
    ...queryKeyParts(plan, q, scope),
    plainQueryOptions(plan, q, scope),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `${framework.name} Query for {@link ${op}}.`,
        'Parameters and options are accessors, read reactively: the query refetches when they change. Cancellation is wired to the query signal. `TData` is inferred from `select`.',
      ),
      {
        name: q.hook,
        typeParams: [{ name: 'TData', default: scope.queryData }],
        params: [
          ...params,
          {
            name: 'options',
            type: accessor(
              `Omit<${optionsType}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            ),
            defaultValue: '() => ({})',
            description: `Returns ${framework.name} Query options plus \`request\` options for the HTTP call.`,
          },
          clientParam(scope),
        ],
        returns: `${scope.type('CreateQueryResult')}<TData, ${scope.error}>`,
        body:
          `  return ${scope.value('createQuery')}${scope.typeArgs(generics)}(() => {\n` +
          `    const { request, ...queryOptions } = options();\n` +
          (plan.hasParams ? `    const values = params();\n` : '') +
          `    return ${scope.cast(optionsType, object)};\n  }, queryClient);\n`,
      },
    ),
    ...(q.infiniteHook === undefined ? [] : generateInfinite(framework, plan, q, scope, ctx)),
  ];
}

function generateInfinite(
  framework: AccessorFramework,
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const shape = infiniteShape(plan, q, scope);
  const pages = `${scope.type('InfiniteData')}<${scope.queryData}, ${shape.pageType}>`;
  const generics = [scope.queryData, scope.error, 'TData', shape.keyName, shape.pageType];
  const optionsType = framework.plain(
    `${scope.type('CreateInfiniteQueryOptions')}<${generics.join(', ')}>`,
  );
  const object =
    `{\n      ...queryOptions,\n      queryKey: ${shape.keyFn}(values),\n` +
    `      queryFn: ({ pageParam, signal }) => ${scope.queryCall(`${scope.op}({ ...values, ${propertyKey(shape.property)}: pageParam }, ${scope.signal('request')})`)},\n    }`;
  return [
    ...infiniteKeyParts(plan, q, scope, shape),
    plainInfiniteQueryOptions(plan, q, scope, shape),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `${framework.name} infinite query for {@link ${op}}, paginating with the \`${q.pageParam ?? ''}\` query parameter.`,
        'Provide `initialPageParam` and `getNextPageParam` to describe how pages are requested. Parameters and options are accessors, read reactively.',
      ),
      {
        name: q.infiniteHook ?? '',
        typeParams: [{ name: 'TData', default: pages }],
        params: [
          {
            name: 'params',
            type: accessor(shape.paramsType),
            ...(shape.required ? {} : { defaultValue: '() => ({})' }),
            description: `Returns the request parameters without \`${q.pageParam ?? ''}\` (part of the query key).`,
          },
          {
            name: 'options',
            type: accessor(
              `Omit<${optionsType}, 'queryKey' | 'queryFn'> & { request?: ${scope.options} | undefined }`,
            ),
            description: `Returns ${framework.name} Query options, including pagination, plus \`request\` options.`,
          },
          clientParam(scope),
        ],
        returns: `${scope.type('CreateInfiniteQueryResult')}<TData, ${scope.error}>`,
        body:
          `  return ${scope.value('createInfiniteQuery')}${scope.typeArgs(generics)}(() => {\n` +
          `    const { request, ...queryOptions } = options();\n` +
          `    const values = params();\n` +
          `    return ${scope.cast(optionsType, object)};\n  }, queryClient);\n`,
      },
    ),
  ];
}

export function generateAccessorMutation(
  framework: AccessorFramework,
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
  invalidations: readonly (readonly string[])[],
): string[] {
  const op = plan.symbol.name;
  const variables = mutationVariables(plan, scope);
  const generics = [scope.response, scope.error, variables, 'TContext'];
  const optionsType = framework.plain(
    `${scope.type('CreateMutationOptions')}<${generics.join(', ')}>`,
  );
  // The query client is looked up while the component initializes, like any context.
  const setup =
    invalidations.length === 0
      ? ''
      : `  const client = ${scope.value('useQueryClient')}(queryClient?.());\n`;
  const object =
    `{\n      ...mutationOptions,\n      mutationKey: ${keyLiteral(q.keyPrefix, [])},\n` +
    `      mutationFn: ${mutationFn(plan, scope, 'request')},\n` +
    `${invalidatingOnSuccess(invalidations, 'client', 'mutationOptions', '      ')}    }`;
  return [
    plainMutationOptions(plan, q, scope),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `${framework.name} Query mutation for {@link ${op}}.`,
        invalidationDescription(invalidations),
      ),
      {
        name: q.hook,
        typeParams: [{ name: 'TContext', default: 'unknown' }],
        params: [
          {
            name: 'options',
            type: accessor(
              `Omit<${optionsType}, 'mutationKey' | 'mutationFn'> & { request?: ${scope.options} | undefined }`,
            ),
            defaultValue: '() => ({})',
            description: `Returns ${framework.name} Query options plus \`request\` options for the HTTP call.`,
          },
          clientParam(scope),
        ],
        returns: `${scope.type('CreateMutationResult')}<${generics.join(', ')}>`,
        body:
          setup +
          `  return ${scope.value('createMutation')}${scope.typeArgs(generics)}(() => {\n` +
          `    const { request, ...mutationOptions } = options();\n` +
          `    return ${scope.cast(optionsType, object)};\n  }, queryClient);\n`,
      },
    ),
  ];
}
