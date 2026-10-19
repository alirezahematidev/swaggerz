import { defineConfig } from 'vite';
import { mockApi } from './mock-api.ts';

export default defineConfig({
  // Serves the Tasks API from memory during `vite` so the example runs without a backend.
  plugins: [mockApi()],
  oxc: { jsx: { runtime: 'automatic' } },
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // TanStack Query marks its modules "use client" for React Server Components.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
