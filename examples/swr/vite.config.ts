import { defineConfig } from 'vite';
import { mockApi } from './mock-api.ts';

export default defineConfig({
  // Serves the Tasks API from memory during `vite` so the example runs without a backend.
  plugins: [mockApi()],
  oxc: { jsx: { runtime: 'automatic' } },
  build: {
    rolldownOptions: {
      // SWR marks its modules `'use client'` for React Server Components; a client-only bundle
      // does not need the directive, so the warning about dropping it is noise.
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
      },
    },
  },
});
