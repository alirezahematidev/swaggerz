// A JavaScript project: the generated client is JavaScript with JSDoc and `.d.ts` declarations.
import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.0', input: './openapi.yaml' },
  output: { directory: './src/generated/api', language: 'javascript' },
  // Mock Service Worker handlers and fixtures, as JavaScript too: src/mocks.js serves the API.
  features: { mocks: 'msw' },
});
