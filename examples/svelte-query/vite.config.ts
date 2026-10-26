import { svelte } from '@sveltejs/vite-plugin-svelte';
import { msw } from 'msw/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Serves Mock Service Worker's script during `vite`; src/mocks.ts serves the Tasks API with it,
  // so the example runs without a backend. `apply: 'serve'` keeps the script out of `vite build`,
  // where the plugin would otherwise copy it.
  plugins: [svelte(), { ...msw({ mode: 'worker-only' }), apply: 'serve' }],
});
