import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  output: { directory: './src/generated/api' },
  client: { baseUrl: '/api' },
  features: {
    swr: {
      // Load more tasks with `useListTasksInfinite`, driven by the `cursor` query parameter.
      infinite: { listTasks: { pageParam: 'cursor' } },
      // Revalidate every cached task query after a change.
      invalidates: { createTask: ['Tasks'], updateTask: ['Tasks'], deleteTask: ['Tasks'] },
    },
    // Check responses at runtime against the specification with ArkType.
    validation: 'arktype',
  },
});
