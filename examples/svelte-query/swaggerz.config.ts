import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  output: { directory: './src/generated/api' },
  client: { baseUrl: '/api' },
  features: {
    query: {
      framework: 'svelte',
      // Load more tasks with `createListTasksInfiniteQuery`, driven by the `cursor` parameter.
      infinite: { listTasks: { pageParam: 'cursor' } },
      // Refresh every task query after a change.
      invalidates: { createTask: ['Tasks'], updateTask: ['Tasks'], deleteTask: ['Tasks'] },
    },
  },
});
