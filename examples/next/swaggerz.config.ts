import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  // Next.js (Turbopack and webpack) does not resolve `./client.js` to `client.ts`: generate
  // imports without an extension.
  output: { directory: './src/generated/api', importExtension: 'none' },
  // Mock Service Worker handlers and fixtures: src/api.ts answers the client's requests with them.
  features: { mocks: 'msw' },
});
