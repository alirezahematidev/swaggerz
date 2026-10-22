import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { mockApi } from './mock-api.ts';

export default defineConfig({
  // Serves the Tasks API from memory during `vite` so the example runs without a backend.
  plugins: [svelte(), mockApi()],
});
