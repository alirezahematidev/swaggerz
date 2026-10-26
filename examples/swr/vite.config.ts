import { msw } from 'msw/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Serves Mock Service Worker's script during `vite`; src/mocks.ts serves the Tasks API with it,
  // so the example runs without a backend. `apply: 'serve'` keeps the script out of `vite build`,
  // where the plugin would otherwise copy it.
  plugins: [{ ...msw({ mode: 'worker-only' }), apply: 'serve' }],
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
