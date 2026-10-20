# React Query (TanStack Query v5)

```ts
features: {
  reactQuery: {
    queryMethods: ['get', 'query'], // the default; QUERY is OpenAPI 3.2's safe method with a body
    infinite: { listShapes: { pageParam: 'cursor' } },
    invalidates: { createShape: ['listShapes'], deleteShape: ['Shapes'] },
  },
},
```

Supported versions: `@tanstack/react-query` **5.0.0 and later 5.x** (both ends are type-checked by `pnpm compat`; the hook tests run against the latest 5.x). When the feature is disabled nothing React-related is generated or imported.

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

- **Keys** are the operation's group (first tag), its name and the full params object, so every parameter participates in caching. Operations without parameters have no params element. Plugins can change the static prefix with the `queryKey` hook.
- **Cancellation**: the `signal` React Query passes to the query function is combined with `options.request.signal` and forwarded to the HTTP request.
- **Typing**: `TData` is inferred from `select`; `error` is `GetShapeError`: the operation's `ApiError`s, one per documented status (so `error instanceof ApiError && error.status === 404` narrows `error.body`), or a `RequestError`.
- **Bodiless responses**: TanStack Query v5 does not allow `undefined` as query data, so query hooks and option factories resolve bodiless responses (`204`, `304`, …) with `null`: an operation returning `Account | undefined` has query data `Account | null`. Calling the operation directly still returns `undefined`. Mutations are unaffected.
- **Imperative use**: `queryClient.fetchQuery(getShapeQueryOptions(params))`, `prefetchQuery`, `ensureQueryData`. The options carry a tagged query key, so `queryClient.getQueryData(getShapeQueryOptions(params).queryKey)` is typed.
- **Key factories**: one module per tag, e.g. `shapesKeys = { all: ['Shapes'], getShape: getShapeQueryKey, … }`, for invalidation (`queryClient.invalidateQueries({ queryKey: shapesKeys.all })`). Nested OpenAPI 3.2 tags extend their parent's key (`petsCatsKeys.all` is `['pets', 'cats']`), so a parent's `all` key also matches the queries of its nested tags; parents get a key factory even when they tag no operation directly, and invalidation targets may name either tag.

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

Mutation variables are the operation's params (`void` when it has none; optional when all members are optional). With `invalidates`, the hook awaits `invalidateQueries` for the configured targets (operation names, `operationId`s or tags) before calling your `onSuccess`.

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

Hooks are separate modules under `react-query/` with their own barrel. Importing one hook bundles only that operation, its key and the shared runtime (measured: ~12 KB beyond TanStack Query itself for a 1,000-operation client). Operation modules and the main barrel never import React or TanStack Query.
