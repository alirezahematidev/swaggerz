import { defineConfig } from 'astro/config';
import swaggerz from 'swaggerz/astro';

export default defineConfig({
  // Generates src/generated/api from openapi.yaml: when `astro dev` starts and again whenever the
  // specification or swaggerz.config.ts changes (errors show over the page), and before
  // `astro build` and `astro check`.
  integrations: [swaggerz()],
});
