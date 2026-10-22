import type { EmitContext } from '../context.ts';
import type { OperationPlan } from '../operation-plan.ts';
import { literal, propertyKey } from '../printer.ts';
import {
  call,
  hookDoc,
  infiniteKeyParts,
  infiniteParamsParam,
  infiniteShape,
  keyLiteral,
  keyType,
  mutationVariables,
  queryKeyParts,
  queryParamsParam,
  renderFunction,
  type QuerySymbols,
  type Scope,
} from './common.ts';

/**
 * SWR 2 hooks (`swr` 2.2 or later): `useSWR` for queries, `useSWRMutation` for mutations and
 * `useSWRInfinite` for configured infinite queries. Keys are the same arrays the TanStack Query
 * hooks use, so they are serialized stably and can be matched by prefix to revalidate a group.
 * SWR fetchers receive no `AbortSignal`; pass `request.signal` to cancel a request yourself.
 */
const MUTATION = 'swr/mutation';
const INFINITE = 'swr/infinite';

function useSWR(scope: Scope, pkg: string, local: string): string {
  return scope.lang === 'dts'
    ? ''
    : scope.imports.add(pkg, 'default', { typeOnly: false, external: true, local });
}

export function generateSwrQuery(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const data = scope.response;
  const parts = queryKeyParts(plan, q, scope);
  const keyArgs = plan.hasParams ? 'params' : '';
  parts.push(
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `SWR hook for {@link ${op}}.`,
        'Requests are deduplicated and revalidated by the query key. Set `enabled: false` to skip fetching (the key becomes `null`).',
      ),
      {
        name: q.hook,
        params: [
          ...queryParamsParam(plan, scope),
          {
            name: 'options',
            type: `${scope.type('SWRConfiguration', 'swr')}<${data}, ${scope.error}> & { request?: ${scope.options} | undefined; enabled?: boolean | undefined }`,
            defaultValue: '{}',
            description: 'SWR options, `enabled`, and `request` options for the HTTP call.',
          },
        ],
        returns: `${scope.type('SWRResponse', 'swr')}<${data}, ${scope.error}>`,
        body:
          `  const { request, enabled = true, ...swrOptions } = options;\n` +
          `  return ${useSWR(scope, 'swr', 'useSWR')}(\n` +
          `    enabled ? ${q.queryKey ?? ''}(${keyArgs}) : null,\n` +
          `    () => ${call(scope, plan, 'params', 'request')},\n    swrOptions,\n  );\n`,
      },
    ),
  );
  if (q.infiniteHook !== undefined) parts.push(...generateSwrInfinite(plan, q, scope, ctx));
  return parts;
}

function generateSwrInfinite(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
): string[] {
  const op = plan.symbol.name;
  const shape = infiniteShape(plan, q, scope);
  const data = scope.response;
  // The infinite key followed by the page parameter: `[...prefix, 'infinite', params, page]`.
  const pageKey = keyType(q.keyPrefix, ["'infinite'", shape.paramsType, shape.pageType]);
  const paramsIndex = q.keyPrefix.length + 1;
  const pageFn = `(lastPage: ${data}, pageIndex: number) => ${shape.pageType} | undefined | null`;
  return [
    ...infiniteKeyParts(plan, q, scope, shape),
    renderFunction(
      scope,
      hookDoc(
        ctx,
        plan,
        `SWR infinite hook for {@link ${op}}, paginating with the \`${q.pageParam ?? ''}\` query parameter.`,
        'Provide `initialPageParam` and `getNextPageParam`; returning `undefined` or `null` from `getNextPageParam` ends the list.',
      ),
      {
        name: q.infiniteHook ?? '',
        params: [
          infiniteParamsParam(q, shape),
          {
            name: 'options',
            type: `${scope.type('SWRInfiniteConfiguration', INFINITE)}<${data}, ${scope.error}> & { initialPageParam: ${shape.pageType}; getNextPageParam: ${pageFn}; request?: ${scope.options} | undefined; enabled?: boolean | undefined }`,
            description: 'SWR options with pagination, `enabled`, and `request` options.',
          },
        ],
        returns: `${scope.type('SWRInfiniteResponse', INFINITE)}<${data}, ${scope.error}>`,
        body:
          `  const { request, enabled = true, initialPageParam, getNextPageParam, ...swrOptions } = options;\n` +
          `  return ${useSWR(scope, INFINITE, 'useSWRInfinite')}(\n` +
          `    (pageIndex${scope.lang === 'ts' ? ': number' : ''}, previousPage${scope.lang === 'ts' ? `: ${data} | null` : ''})${scope.lang === 'ts' ? `: ${pageKey} | null` : ''} => {\n` +
          `      if (!enabled) return null;\n` +
          `      // The first page is always requested (its page parameter may be undefined); later\n` +
          `      // pages end the list when getNextPageParam returns undefined or null.\n` +
          `      if (previousPage === null) return ${scope.assert(pageKey, `[...${shape.keyFn}(params), initialPageParam]`)};\n` +
          `      const page = getNextPageParam(previousPage, pageIndex - 1);\n` +
          `      return page === undefined || page === null ? null : ${scope.assert(pageKey, `[...${shape.keyFn}(params), page]`)};\n` +
          `    },\n` +
          `    (key${scope.lang === 'ts' ? `: ${pageKey}` : ''}) => ${scope.op}({ ...key[${paramsIndex}], ${propertyKey(shape.property)}: key[${paramsIndex + 1}] }, request),\n` +
          `    swrOptions,\n  );\n`,
      },
    ),
  ];
}

/** `key[0] === 'a' && key[1] === 'b'`: the array `key` starts with the prefix. */
function startsWith(prefix: readonly string[]): string {
  return prefix.map((part, index) => `key[${index}] === ${literal(part)}`).join(' && ');
}

export function generateSwrMutation(
  plan: OperationPlan,
  q: QuerySymbols,
  scope: Scope,
  ctx: EmitContext,
  invalidations: readonly (readonly string[])[],
): string[] {
  const op = plan.symbol.name;
  const variables = mutationVariables(plan, scope);
  const key = keyLiteral(q.keyPrefix, []);
  const keyTypeName = `readonly ${key}`;
  const generics = [scope.response, scope.error, keyTypeName, variables];
  const fetcher = !plan.hasParams
    ? `() => ${scope.op}(request)`
    : `(_key${scope.lang === 'ts' ? `: ${keyTypeName}` : ''}, { arg }${scope.lang === 'ts' ? `: { arg: ${variables} }` : ''}) => ${scope.op}(${plan.paramsRequired ? 'arg' : 'arg || undefined'}, request)`;
  const matches = (prefix: readonly string[]): string =>
    `(key) => Array.isArray(key) && ${startsWith(prefix)}`;
  const lists = infiniteLists(invalidations, ctx);
  const setup =
    invalidations.length === 0
      ? ''
      : `  const { mutate } = ${scope.value('useSWRConfig', 'swr')}();\n`;
  const onSuccess =
    invalidations.length === 0
      ? ''
      : `      onSuccess: (...args) => {\n` +
        `        // Revalidates the cached queries whose keys start with each prefix.\n` +
        invalidations.map((prefix) => `        void mutate(${matches(prefix)});\n`).join('') +
        (lists.length === 0 ? '' : revalidateInfinite(scope, lists)) +
        `        swrOptions.onSuccess?.(...args);\n      },\n`;
  const description =
    invalidations.length === 0
      ? 'Call `trigger(params)` to send the request.'
      : `Call \`trigger(params)\` to send the request. On success it revalidates the queries under ${invalidations.map((t) => `\`${JSON.stringify(t)}\``).join(', ')}${lists.length === 0 ? '' : ' (infinite lists with every loaded page)'}, then calls your \`onSuccess\`.`;
  const config = `${scope.type('SWRMutationConfiguration', MUTATION)}<${generics.join(', ')}>`;
  return [
    renderFunction(scope, hookDoc(ctx, plan, `SWR mutation hook for {@link ${op}}.`, description), {
      name: q.hook,
      params: [
        {
          name: 'options',
          type: `${config} & { request?: ${scope.options} | undefined }`,
          defaultValue: '{}',
          description: 'SWR mutation options plus `request` options for the HTTP call.',
        },
      ],
      returns: `${scope.type('SWRMutationResponse', MUTATION)}<${generics.join(', ')}>`,
      body:
        `  const { request, ...swrOptions } = options;\n${setup}` +
        `  return ${useSWR(scope, MUTATION, 'useSWRMutation')}(\n    ${scope.assert(keyTypeName, key)},\n    ${fetcher},\n` +
        (onSuccess === ''
          ? `    swrOptions,\n  );\n`
          : `    ${scope.cast(config, `{\n      ...swrOptions,\n${onSuccess}    }`)},\n  );\n`),
    }),
  ];
}

/**
 * Key prefixes (`[...prefix, 'infinite']`) of the infinite lists whose keys start with one of the
 * invalidated prefixes, in operation order.
 */
function infiniteLists(
  invalidations: readonly (readonly string[])[],
  ctx: EmitContext,
): string[][] {
  const lists: string[][] = [];
  for (const operation of ctx.project.operations) {
    const q = operation.query;
    if (q?.infiniteHook === undefined) continue;
    const list = [...q.keyPrefix, 'infinite'];
    const covered = invalidations.some(
      (prefix) => prefix.length <= list.length && prefix.every((part, i) => list[i] === part),
    );
    if (covered) lists.push(list);
  }
  return lists;
}

/**
 * Revalidates `useSWRInfinite` lists, which `mutate` with a filter skips. The pages of a list are
 * cached under their own keys (`[...list, params, page]`): clearing them without a request makes
 * the list refetch every loaded page when it is revalidated by its first page's key.
 */
function revalidateInfinite(scope: Scope, lists: readonly (readonly string[])[]): string {
  const args = scope.type('Arguments', 'swr');
  const serialize = scope.value('unstable_serialize', INFINITE);
  const isPage = lists
    .map((list) => `key.length === ${list.length + 2} && ${startsWith(list)}`)
    .map((test) => (lists.length === 1 ? test : `(${test})`))
    .join(' || ');
  const pages =
    scope.lang === 'ts'
      ? `const pages: ${args}[] = [];`
      : `const pages = /** @type {${args}[]} */ ([]);`;
  return (
    `        // The filter skips infinite lists: clear their loaded pages without a request, then\n` +
    `        // revalidate each list by its first page's key, which refetches every page.\n` +
    `        ${pages}\n` +
    `        void mutate(\n` +
    `          (key) => {\n` +
    `            if (!Array.isArray(key) || !(${isPage})) return false;\n` +
    `            pages.push(key);\n` +
    `            return true;\n` +
    `          },\n` +
    `          undefined,\n` +
    `          { revalidate: false },\n` +
    `        ).then(() => Promise.all(pages.map((page) => mutate(${serialize}(() => page)))));\n`
  );
}
