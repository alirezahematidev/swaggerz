# SWR example

The task list of the [React Query example](../react-query), built with [SWR](https://swr.vercel.app) hooks and ArkType validation, from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:swr   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, the API served by the generated mocks (src/mocks.ts)
pnpm check        # type-checks the app and builds it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables SWR hooks (`features.swr`), an infinite list for `listTasks` paginated by its `cursor` parameter, revalidation of every `Tasks` query after mutations, and ArkType validation of responses.
- [src/App.tsx](src/App.tsx) uses `useListTasksInfinite` (pages and `setSize`), `useGetTask`, and `useCreateTask`/`useUpdateTask`/`useDeleteTask` with `trigger`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError` (network, timeout, or a response that failed validation).
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated Mock Service Worker handlers: fixtures (`makeTask`) seed an in-memory list that the handlers read and change. [src/main.tsx](src/main.tsx) starts it during development only; [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. It is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
