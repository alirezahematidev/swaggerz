import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  output: { directory: './src/generated/api' },
  // Mock Service Worker handlers and fixtures: src/api.ts answers the client's requests with them.
  features: { mocks: 'msw' },
});
