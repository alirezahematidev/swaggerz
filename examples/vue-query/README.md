# Vue Query example

The task list of the [React Query example](../react-query), built with Vue 3 single-file components, [TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview) and Valibot validation, from the same OpenAPI 3.1 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:vue-query   # from the repository root: build swaggerz, generate, start Vite
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate     # src/generated/api
pnpm dev          # http://localhost:5173, served by an in-memory mock API (mock-api.ts)
pnpm check        # type-checks the app (vue-tsc) and builds it
```

What to look at:

- [swaggerz.config.ts](swaggerz.config.ts) enables Vue Query composables (`features.query.framework: 'vue'`), an infinite list for `listTasks` paginated by its `cursor` parameter, invalidation of every `Tasks` query after mutations, and Valibot validation of responses.
- [src/App.vue](src/App.vue) passes a getter as the parameters of `useListTasksInfinite`, so changing the filter refetches; [src/TaskDetails.vue](src/TaskDetails.vue) does the same with a prop and uses `select`. Errors are typed: `ApiError` with the operation's error body (`Problem`) or `RequestError`.
- [mock-api.ts](mock-api.ts) implements the API with the generated model types, so it stops compiling when the specification changes.
