import { createHash } from 'node:crypto';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { inlineHashes } from './integrations/inline-hashes.ts';
import { CHAPTERS } from './src/navigation.ts';
import { REPOSITORY } from './src/site.ts';

const base = process.env.SITE_BASE ?? '/';

/**
 * The one style element a component injects at runtime (Radix ScrollArea hides native scrollbars
 * with it, in the playground). Allowed by its hash, like Astro's own inline scripts and styles.
 */
const RADIX_SCROLL_AREA_STYLE =
  '[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}';
const sha256 = (text: string): `sha256-${string}` =>
  `sha256-${createHash('sha256').update(text).digest('base64')}`;

export default defineConfig({
  ...(process.env.SITE_URL === undefined ? {} : { site: process.env.SITE_URL }),
  base,
  trailingSlash: 'always',
  // Code blocks are highlighted by Expressive Code (through Starlight), not Astro's Shiki.
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: {
        resources: [
          "'self'",
          // Expressive Code colors tokens with style attributes; style elements stay hashed.
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
        hashes: [sha256(RADIX_SCROLL_AREA_STYLE)],
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // The playground imports the dashboard's components, which live outside the website package.
    resolve: { dedupe: ['react', 'react-dom'] },
  },
  integrations: [
    starlight({
      title: 'swaggerz',
      description: 'Typed, tree-shakeable API clients compiled from Swagger and OpenAPI documents.',
      editLink: { baseUrl: `${REPOSITORY.url}/edit/${REPOSITORY.branch}/website/` },
      social: [{ icon: 'github', label: 'GitHub', href: REPOSITORY.url }],
      markdown: { processedDirs: ['../docs', '../examples', '../brand'] },
      routeMiddleware: './src/route-data.ts',
      // src/pages/404.astro instead.
      disable404Route: true,
      customCss: [
        './src/styles/theme.css',
        './src/styles/layout.css',
        './src/styles/twin.css',
        './src/styles/reference.css',
      ],
      components: {
        Head: './src/overrides/Head.astro',
        SiteTitle: './src/overrides/SiteTitle.astro',
        Search: './src/components/Search.astro',
        ThemeSelect: './src/overrides/ThemeSelect.astro',
        Sidebar: './src/overrides/Sidebar.astro',
        TwoColumnContent: './src/overrides/TwoColumnContent.astro',
        PageSidebar: './src/overrides/PageSidebar.astro',
        PageTitle: './src/overrides/PageTitle.astro',
        MarkdownContent: './src/overrides/MarkdownContent.astro',
        Footer: './src/overrides/Footer.astro',
      },
      sidebar: CHAPTERS.map((chapter) => ({
        label: chapter.label,
        items: chapter.pages.map((page) =>
          page.external === true
            ? { label: page.label ?? page.id, link: `/${page.id}/` }
            : page.label === undefined
              ? page.id
              : { label: page.label, slug: page.id },
        ),
      })),
    }),
    react(),
    inlineHashes(),
  ],
});
