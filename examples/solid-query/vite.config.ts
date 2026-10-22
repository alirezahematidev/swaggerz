import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { mockApi } from './mock-api.ts';

export default defineConfig({
  // Serves the Tasks API from memory during `vite` so the example runs without a backend.
  plugins: [solid(), mockApi()],
});
