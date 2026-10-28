# Solid Query example

The task list of the [React Query example](../react-query), built with Solid and [TanStack Solid Query](https://tanstack.com/query/latest/docs/framework/solid/overview), from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:solid-query   # from the repository root: build swaggerz, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm dev          # http://localhost:5173: generates src/generated/api, serves the API from the generated mocks (src/mocks.ts)
pnpm check        # builds the app (generating the client first), then type-checks it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Solid Query primitives (`features.query.framework: 'solid'`), an infinite list for `listTasks` paginated by its `cursor` parameter and invalidation of every `Tasks` query after mutations.
- [vite.config.ts](vite.config.ts) adds `swaggerz()` from `swaggerz/vite`: the client is generated when Vite starts, again whenever [openapi.yaml](openapi.yaml) or [swaggerz.config.ts](swaggerz.config.ts) changes (edit the specification while `pnpm dev` runs and the page updates, or shows the error over it), and before `vite build`. There is no separate generate step. See [framework integrations](../../docs/integrations.md).
- [src/App.tsx](src/App.tsx) passes accessors to `createListTasksInfiniteQuery` and `createGetTaskQuery`: reading signals and props inside them makes the queries follow them. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated Mock Service Worker handlers: fixtures (`makeTask`) seed an in-memory list that the handlers read and change. [src/index.tsx](src/index.tsx) passes those handlers to the generated `startMocks()` during development only (one line: `if (import.meta.env.DEV) await startMocks({ handlers })`); [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. It is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
