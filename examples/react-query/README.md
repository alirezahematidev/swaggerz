# React Query example

A task list built with React, TanStack Query and a client generated from an OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:react-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, the API served by the generated mocks (src/mocks.ts)
pnpm check        # type-checks the app and builds it
pnpm dashboard    # explore the API and the generated code
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables React Query hooks, an infinite query for `listTasks` paginated by its `cursor` parameter, invalidation of every `Tasks` query after mutations, Zod validation of responses, and Mock Service Worker mocks.
- [src/App.tsx](src/App.tsx) uses `useListTasksInfinite`, `useGetTask` with `select`, and `useCreateTask`/`useUpdateTask`/`useDeleteTask`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError` (network, timeout, or a response that failed validation).
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated mock handlers (`mockListTasks`, `mockCreateTask`, …): fixtures (`makeTask`) seed an in-memory list that the handlers' response functions read and change, and invalid input gets the documented `422` problem. [src/main.tsx](src/main.tsx) starts it during development only, and [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. Everything is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
