# Vue Query example

The task list of the [React Query example](../react-query), built with Vue 3 single-file components, [TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview) and Valibot validation, from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:vue-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, the API served by the generated mocks (src/mocks.ts)
pnpm check        # type-checks the app (vue-tsc) and builds it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Vue Query composables (`features.query.framework: 'vue'`), an infinite list for `listTasks` paginated by its `cursor` parameter, invalidation of every `Tasks` query after mutations, and Valibot validation of responses.
- [src/App.vue](src/App.vue) passes a getter as the parameters of `useListTasksInfinite`, so changing the filter refetches; [src/TaskDetails.vue](src/TaskDetails.vue) does the same with a prop and uses `select`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [src/mocks.ts](src/mocks.ts) serves the API in the browser with the generated Mock Service Worker handlers: fixtures (`makeTask`) seed an in-memory list that the handlers read and change. [src/main.ts](src/main.ts) starts it during development only; [vite.config.ts](vite.config.ts) serves the worker script with MSW's Vite plugin. It is typed with the generated models, so it stops compiling when the specification changes. See [mocks](../../docs/mocks.md).
