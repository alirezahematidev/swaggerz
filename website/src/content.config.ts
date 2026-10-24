import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { examplesLoader } from './loaders/examples.ts';
import { repositoryDocsLoader } from './loaders/repository-docs.ts';
import { repositoryFilesLoader } from './loaders/repository-files.ts';

const file = z.object({ path: z.string(), language: z.string(), content: z.string() });

export const collections = {
  // Starlight reads interface strings from here; the site is English only, so it stays empty.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  docs: defineCollection({
    loader: repositoryDocsLoader(docsLoader()),
    schema: docsSchema({
      extend: z.object({
        /** A twin panel (src/twins.ts) shown under "What's generated" at the end of the page. */
        twin: z.string().optional(),
        /** The repository file a page is rendered from. */
        source: z.string().optional(),
      }),
    }),
  }),
  changelog: defineCollection({
    loader: repositoryFilesLoader({ changelog: 'CHANGELOG.md' }),
    schema: z.object({ title: z.string(), source: z.string() }),
  }),
  brand: defineCollection({
    loader: repositoryFilesLoader({ brand: 'brand/README.md' }),
    schema: z.object({ title: z.string(), source: z.string() }),
  }),
  examples: defineCollection({
    loader: examplesLoader(),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      config: file,
      sources: z.array(file),
      generated: z.array(z.string()),
      operations: z.number(),
      models: z.number(),
      dependencies: z.array(z.string()),
    }),
  }),
};
