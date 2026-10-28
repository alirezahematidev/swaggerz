# React Query example

A task list built with React, TanStack Query and a client generated from an OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:react-query   # from the repository root: build swaggerz, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm dev          # http://localhost:5173: generates src/generated/api, serves the API from the generated mocks (src/mocks.ts)
pnpm check        # builds the app (generating the client first), then type-checks it
pnpm dashboard    # explore the API and the generated code
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables React Query hooks, an infinite query for `listTasks` paginated by its `cursor` parameter, invalidation of every `Tasks` query after mutations, Zod validation of responses, and Mock Service Worker mocks.
- [vite.config.ts](vite.config.ts) adds `swaggerz()` from `swaggerz/vite`: the client is generated when Vite starts, again whenever [openapi.yaml](openapi.yaml) or [swaggerz.config.ts](swaggerz.config.ts) changes (edit the specification while `pnpm dev` runs and the page updates, or shows the error over it), and before `vite build`. There is no separate generate step. See [framework integrations](../../docs/integrations.md).
- [src/App.tsx](src/App.tsx) uses `useListTasksInfinite`, `useGetTask` with `select`, and `useCreateTask`/`useUpdateTask`/`useDeleteTask`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError` (network, timeout, or a response that failed validation).
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated mock handlers (`mockListTasks`, `mockCreateTask`, …): fixtures (`makeTask`) seed an in-memory list that the handlers' response functions read and change, and invalid input gets the documented `422` problem. [src/main.tsx](src/main.tsx) passes those handlers to the generated `startMocks()` during development only (one line: `if (import.meta.env.DEV) await startMocks({ handlers })`), and [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. Everything is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
