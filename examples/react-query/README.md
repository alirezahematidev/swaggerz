# React Query example

A task list built with React, TanStack Query and a client generated from an OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:react-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, served by an in-memory mock API (mock-api.ts)
pnpm check        # type-checks the app and builds it
pnpm dashboard    # explore the API and the generated code
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables React Query hooks, an infinite query for `listTasks` paginated by its `cursor` parameter, invalidation of every `Tasks` query after mutations, and Zod validation of responses.
- [src/App.tsx](src/App.tsx) uses `useListTasksInfinite`, `useGetTask` with `select`, and `useCreateTask`/`useUpdateTask`/`useDeleteTask`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError` (network, timeout, or a response that failed validation).
- [mock-api.ts](mock-api.ts) implements the API with the generated model types, so it stops compiling when the specification changes.
