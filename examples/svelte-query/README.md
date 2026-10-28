# Svelte Query example

The task list of the [React Query example](../react-query), built with Svelte 5 (runes) and [TanStack Svelte Query](https://tanstack.com/query/latest/docs/framework/svelte/overview) 6, from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:svelte-query   # from the repository root: build swaggerz, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm dev          # http://localhost:5173: generates src/generated/api, serves the API from the generated mocks (src/mocks.ts)
pnpm check        # builds the app (generating the client first), then type-checks it (svelte-check)
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Svelte Query functions (`features.query.framework: 'svelte'`), an infinite list for `listTasks` paginated by its `cursor` parameter and invalidation of every `Tasks` query after mutations.
- [vite.config.ts](vite.config.ts) adds `swaggerz()` from `swaggerz/vite`: the client is generated when Vite starts, again whenever [openapi.yaml](openapi.yaml) or [swaggerz.config.ts](swaggerz.config.ts) changes (edit the specification while `pnpm dev` runs and the page updates, or shows the error over it), and before `vite build`. There is no separate generate step. See [framework integrations](../../docs/integrations.md).
- [src/Tasks.svelte](src/Tasks.svelte) passes accessors to `createListTasksInfiniteQuery`: reading the `$state` filter inside them makes the query follow it. [src/TaskDetails.svelte](src/TaskDetails.svelte) does the same with a prop and uses `select`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated Mock Service Worker handlers: fixtures (`makeTask`) seed an in-memory list that the handlers read and change. [src/main.ts](src/main.ts) passes those handlers to the generated `startMocks()` during development only (one line: `if (import.meta.env.DEV) await startMocks({ handlers })`); [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. It is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
