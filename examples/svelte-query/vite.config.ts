import { svelte } from '@sveltejs/vite-plugin-svelte';
import { msw } from 'msw/vite';
import { swaggerz } from 'swaggerz/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Generates src/generated/api from openapi.yaml when Vite starts, again whenever the
    // specification or swaggerz.config.ts changes, and before `vite build`. Errors show in the
    // browser over the page.
    swaggerz(),
    svelte(),
    // Serves Mock Service Worker's script during `vite`; src/mocks.ts serves the Tasks API with
    // it, so the example runs without a backend. `apply: 'serve'` keeps the script out of
    // `vite build`, where the plugin would otherwise copy it.
    { ...msw({ mode: 'worker-only' }), apply: 'serve' },
  ],
});
