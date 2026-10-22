# Svelte Query example

The task list of the [React Query example](../react-query), built with Svelte 5 (runes) and [TanStack Svelte Query](https://tanstack.com/query/latest/docs/framework/svelte/overview) 6, from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:svelte-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, served by an in-memory mock API (mock-api.ts)
pnpm check        # type-checks the app (svelte-check) and builds it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Svelte Query functions (`features.query.framework: 'svelte'`), an infinite list for `listTasks` paginated by its `cursor` parameter and invalidation of every `Tasks` query after mutations.
- [src/Tasks.svelte](src/Tasks.svelte) passes accessors to `createListTasksInfiniteQuery`: reading the `$state` filter inside them makes the query follow it. [src/TaskDetails.svelte](src/TaskDetails.svelte) does the same with a prop and uses `select`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [mock-api.ts](mock-api.ts) implements the API with the generated model types, so it stops compiling when the specification changes.
