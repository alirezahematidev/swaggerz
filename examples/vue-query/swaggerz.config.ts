import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  output: { directory: './src/generated/api' },
  client: { baseUrl: '/api' },
  features: {
    query: {
      framework: 'vue',
      // Load more tasks with `useListTasksInfinite`, driven by the `cursor` query parameter.
      infinite: { listTasks: { pageParam: 'cursor' } },
      // Refresh every task query after a change.
      invalidates: { createTask: ['Tasks'], updateTask: ['Tasks'], deleteTask: ['Tasks'] },
    },
    // Check responses at runtime against the specification with Valibot.
    validation: 'valibot',
    // Mock Service Worker handlers and fixtures: src/mocks.ts serves the API from them.
    mocks: 'msw',
  },
});
