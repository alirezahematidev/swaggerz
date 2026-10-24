import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: {
    version: '3.0',
    input: './openapi.yaml',
  },
  output: {
    directory: './src/generated/api',
  },
});
