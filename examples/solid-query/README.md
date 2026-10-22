# Solid Query example

The task list of the [React Query example](../react-query), built with Solid and [TanStack Solid Query](https://tanstack.com/query/latest/docs/framework/solid/overview), from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:solid-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, served by an in-memory mock API (mock-api.ts)
pnpm check        # type-checks the app and builds it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Solid Query primitives (`features.query.framework: 'solid'`), an infinite list for `listTasks` paginated by its `cursor` parameter and invalidation of every `Tasks` query after mutations.
- [src/App.tsx](src/App.tsx) passes accessors to `createListTasksInfiniteQuery` and `createGetTaskQuery`: reading signals and props inside them makes the queries follow them. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [mock-api.ts](mock-api.ts) implements the API with the generated model types, so it stops compiling when the specification changes.
