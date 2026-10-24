# Data fetching: TanStack Query and SWR

```ts
features: {
  query: {
    framework: 'react', // 'react' (default) | 'vue' | 'svelte' | 'solid'
    queryMethods: ['get', 'query'], // the default; QUERY is OpenAPI 3.2's safe method with a body
    infinite: { listShapes: { pageParam: 'cursor' } },
    invalidates: { createShape: ['listShapes'], deleteShape: ['Shapes'] },
  },
},
```

`features.query: true` generates React hooks; `features.reactQuery` is an alias of `query` with `framework: 'react'` (use one or the other). `features.swr` takes the same `queryMethods`, `infinite` and `invalidates` options and generates SWR hooks instead; it cannot be combined with `query`, because both would export hooks named `use<Operation>`.

| Library      | Option                                  | Directory       | Versions (oldest and newest type-checked by `pnpm compat`) | Example                                  |
| ------------ | --------------------------------------- | --------------- | ---------------------------------------------------------- | ---------------------------------------- |
| React Query  | `query: true`, `{ framework: 'react' }` | `react-query/`  | `@tanstack/react-query` 5.0.0 – 5.x                        | [react-query](../examples/react-query)   |
| Vue Query    | `{ framework: 'vue' }`                  | `vue-query/`    | `@tanstack/vue-query` 5.0.0 – 5.x, Vue 3.3+                | [vue-query](../examples/vue-query)       |
| Svelte Query | `{ framework: 'svelte' }`               | `svelte-query/` | `@tanstack/svelte-query` 6.0.0 – 6.x (Svelte 5 runes)      | [svelte-query](../examples/svelte-query) |
| Solid Query  | `{ framework: 'solid' }`                | `solid-query/`  | `@tanstack/solid-query` 5.0.0 – 5.x                        | [solid-query](../examples/solid-query)   |
| SWR          | `swr: true`                             | `swr/`          | `swr` 2.2.0 – 2.x                                          | [swr](../examples/swr)                   |

The React and SWR hooks and the Vue composables also run in tests against a mock server; the Svelte and Solid primitives are type-checked (they need their frameworks' compilers to run). Every example is the same task list app, type-checked and built in CI with its framework's compiler (`vue-tsc`, `svelte-check`, Vite). When the feature is disabled nothing framework-related is generated or imported.

Everything below uses React Query; [other frameworks](#vue-svelte-and-solid) and [SWR](#swr) follow.

## Query operations

For a `GET /shapes/{shapeId}` operation named `getShape`:

```ts
export type GetShapeQueryKey = readonly ['Shapes', 'getShape', GetShapeParams];
export function getShapeQueryKey(params: GetShapeParams): GetShapeQueryKey;
export function getShapeQueryOptions(params: GetShapeParams, options?: RequestOptions); // for queryClient APIs
export function useGetShape<TData = GetShapeResponse>(
  params: GetShapeParams,
  options?: Omit<
    UseQueryOptions<GetShapeResponse, GetShapeError, TData, GetShapeQueryKey>,
    'queryKey' | 'queryFn'
  > & {
    request?: RequestOptions;
  },
  queryClient?: QueryClient,
): UseQueryResult<TData, GetShapeError>;
```

- **Keys** are the operation's group (first tag), its name and the full params object, so every parameter participates in caching. Operations without parameters have no params element. Plugins can change the static prefix with the `queryKey` hook; group keys and invalidation follow (see below).
- **Cancellation**: the `signal` React Query passes to the query function is combined with `options.request.signal` and forwarded to the HTTP request.
- **Typing**: `TData` is inferred from `select`; `error` is `GetShapeError`: the operation's `ApiError`s, one per documented status (so `error instanceof ApiError && error.status === 404` narrows `error.body`), or a `RequestError`.
- **Bodiless responses**: TanStack Query v5 does not allow `undefined` as query data, so query hooks and option factories resolve bodiless responses (`204`, `304`, …) with `null`: an operation returning `Account | undefined` has query data `Account | null`. Calling the operation directly still returns `undefined`. Mutations are unaffected.
- **Imperative use**: `queryClient.fetchQuery(getShapeQueryOptions(params))`, `prefetchQuery`, `ensureQueryData`. The options carry a tagged query key, so `queryClient.getQueryData(getShapeQueryOptions(params).queryKey)` is typed.
- **Key factories**: one module per tag, e.g. `shapesKeys = { all: ['Shapes'], getShape: getShapeQueryKey, … }`, for invalidation (`queryClient.invalidateQueries({ queryKey: shapesKeys.all })`). Nested OpenAPI 3.2 tags extend their parent's key (`petsCatsKeys.all` is `['pets', 'cats']`), so a parent's `all` key also matches the queries of its nested tags; parents get a key factory even when they tag no operation directly, and invalidation targets may name either tag. When a `queryKey` hook puts the same parts before every key (`['api-v1', ...prefix]`), `all` gets them too (`['api-v1', 'Shapes']`); for other hooks it is the longest prefix the group's keys share. With `output.groupBy: 'none'` there are no key factories.

## Mutations

Every non-query method produces:

```ts
export function createShapeMutationOptions(
  options?: RequestOptions,
): UseMutationOptions<CreateShapeResponse, CreateShapeError, CreateShapeParams>;
export function useCreateShape<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<CreateShapeResponse, CreateShapeError, CreateShapeParams, TContext>,
    'mutationKey' | 'mutationFn'
  > & { request?: RequestOptions },
  queryClient?: QueryClient,
): UseMutationResult<CreateShapeResponse, CreateShapeError, CreateShapeParams, TContext>;
```

Mutation variables are the operation's params (`void` when it has none; optional when all members are optional). With `invalidates`, the hook awaits `invalidateQueries` for the configured targets before calling your `onSuccess`:

- An operation name or `operationId` of a query invalidates that query's keys (all parameters, and its infinite query). It takes precedence over a tag of the same name.
- A tag invalidates every query carrying it, as any of its tags or through a nested tag: by the tag's `all` key where that key matches only such queries, and by each other query's own key prefix (queries tagged `[dogs, pets]` are keyed under `dogs`, for example). This works with `output.groupBy: 'none'` and with a `queryKey` hook too. A group directory (`pets/cats`) names its tag.
- Keys of `infinite` and `invalidates` that are not operations of the right kind are reported as `query/unknown-operation` warnings, and targets that match no query as `query/unknown-target` warnings, with a suggestion for likely typos.

## Infinite queries

Pagination semantics cannot be inferred reliably from a specification, so infinite queries are opt-in per operation: `infinite: { <operation>: { pageParam: '<query parameter>' } }`. The hook omits that parameter from `params` and requires the pagination callbacks:

```tsx
const pages = useListShapesInfinite(
  { 'X-Request-ID': requestId, limit: 20 },
  { initialPageParam: undefined, getNextPageParam: (lastPage) => lastPage.nextCursor },
);
pages.data?.pages.flatMap((page) => page.items);
```

`listShapesInfiniteQueryOptions(params, { initialPageParam, getNextPageParam }, requestOptions)` is available for `queryClient.fetchInfiniteQuery`. The page parameter type is the type of the configured query parameter.

## Bundling

Hooks are separate modules under their library's directory (`react-query/`, `vue-query/`, …) with their own barrel. Importing one hook bundles only that operation, its key and the shared runtime (measured: ~17 KB beyond TanStack Query itself for a 1,000-operation client, most of it the shared runtime). Operation modules and the main barrel never import a UI framework, TanStack Query or SWR.

## Vue, Svelte and Solid

The key functions, key factories, invalidation and typing are the same as for React. The option factories (`getShapeQueryOptions`, `listShapesInfiniteQueryOptions`, `createShapeMutationOptions`) return plain objects with a `DataTag`-typed key, because not every v5 release of these adapters exports the `queryOptions` helpers; they work with `queryClient.fetchQuery`, `prefetchQuery` and `getQueryData` alike.

**Vue** (`@tanstack/vue-query`): composables named like React's hooks. Parameters may be plain values, refs or getters (`MaybeRefOrGetter`), and so may query and mutation options: the composable passes a computed options object to Vue Query, so changing a parameter refetches and options such as `enabled` can be reactive.

```ts
const id = ref(1);
const { data } = useGetShape(() => ({ shapeId: id.value }));
const enabled = ref(false);
useListShapes({ 'X-Request-ID': requestId }, () => ({ enabled: enabled.value }));
const create = useCreateShape({ onSuccess: (shape) => console.log(shape.id) });
create.mutate({ body: { kind: 'circle', radius: 1 } });
```

Infinite query composables take reactive parameters, but read their options once (Vue Query 5.0 accepts only a plain object there): pass refs for individual options that change, such as `enabled`. Pages are always fetched with the parameters of their query's key, so a list that is refetched after its composable moved on to other parameters keeps its own.

**Svelte** (`@tanstack/svelte-query` 6, Svelte 5) and **Solid** (`@tanstack/solid-query`): both adapters take their options as an accessor, so the generated functions take accessors too, read inside the adapter's accessor — the query follows `$state` and signals. They are named after the adapters' primitives: `createGetShapeQuery`, `createCreateShapeMutation`, `createListShapesInfiniteQuery`.

```ts
// Svelte 5
let shapeId = $state('a');
const shape = createGetShapeQuery(() => ({ shapeId }));
// Solid
const [shapeId, setShapeId] = createSignal('a');
const shape = createGetShapeQuery(
  () => ({ shapeId: shapeId() }),
  () => ({ staleTime: 30_000 }),
);
const remove = createDeleteShapeMutation();
remove.mutate({ shapeId: 'x' });
```

The query client is an accessor as well (`() => queryClient`). Solid's query options leave out `initialData`, which selects a different overload of Solid's primitives.

## SWR

```ts
features: { swr: { infinite: { listShapes: { pageParam: 'cursor' } }, invalidates: { createShape: ['Shapes'] } } },
```

- **Queries**: `useGetShape(params, options?)` calls `useSWR` with the same array key as the TanStack hooks (`getShapeQueryKey(params)`) and resolves with the operation's data (`undefined` for bodiless responses, which SWR allows). `options` are SWR's configuration plus `request` options and `enabled`: `enabled: false` makes the key `null`, so nothing is fetched. SWR passes no `AbortSignal` to fetchers; cancel with `request.signal` yourself.
- **Mutations**: `useCreateShape(options?)` wraps `useSWRMutation`; send the request with `trigger(params)`. With `invalidates`, a successful mutation revalidates every cached query whose key starts with each configured prefix (operation names, `operationId`s or tags), then calls your `onSuccess`. SWR's `mutate` with a filter skips `useSWRInfinite` lists, so for the infinite lists under those prefixes the hook clears their cached pages and revalidates each list through `unstable_serialize`: like TanStack Query, every loaded page is refetched, while the list keeps showing its current pages.
- **Infinite queries**: `useListShapesInfinite(params, { initialPageParam, getNextPageParam, ...options })` wraps `useSWRInfinite`. `getNextPageParam(lastPage, pageIndex)` returns the next page parameter, or `undefined`/`null` after the last page; the first page is always requested, and a page whose body is `null` ends the list. SWR's `parallel` option is not available: every page parameter comes from the previous page.
- **Key factories** (`shapesKeys.all`) give the prefix of a group's keys for your own filters: `mutate((key) => Array.isArray(key) && shapesKeys.all.every((part, i) => key[i] === part))`.
