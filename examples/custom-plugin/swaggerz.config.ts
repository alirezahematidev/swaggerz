import { defineConfig } from 'swaggerz';
import { operationCatalog } from './plugins/operation-catalog.ts';
import { sdkNames } from './plugins/sdk-names.ts';

export default defineConfig({
  spec: { version: '2.0', input: './swagger.json' },
  output: { directory: './src/generated/api' },
  plugins: [sdkNames(), operationCatalog({ docsBaseUrl: 'https://docs.example.com/directory' })],
});
