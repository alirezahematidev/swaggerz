# swaggerz docs website — plan

Status: plan, nothing built yet. The site is static, so it can be deployed anywhere later (section 9). It follows the brand in [brand/](brand/README.md) and the dashboard's palette, so the CLI, dashboard, editor extension and website look like one product.

## 1. Goals

- Get someone from "what is this" to a generated, type-checked client in five minutes.
- Be the reference: every config option, CLI flag, diagnostic code and generated-code shape, generated from the source so it cannot drift.
- Show, don't claim: code samples are type-checked at build time, and every number on the site (bundle sizes, compatibility ranges, benchmark timings) comes from a measurement made during the build or in CI.
- Look like nothing else in the OpenAPI tooling space: editorial, warm, typographic. No purple gradients, glass cards or a stock docs theme.

## 2. Tool: Astro + Starlight

| Option                | Fit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro + Starlight** | **Chosen.** Static HTML by default with zero JS on content pages; React islands only where needed (playground, spec ↔ code panels), so the dashboard's React components are reusable. Starlight brings search (Pagefind, fully static), accessible navigation, i18n, edit links and prev/next, and every part of its layout can be replaced through component overrides, which is how the custom layout below is built. Content collections give typed frontmatter. Expressive Code with a Twoslash plugin gives type-checked samples with hover types. |
| Fumadocs (Next.js)    | Very flexible and has OpenAPI rendering, but ties the site to Next.js and React Server Components; static export works but is the less traveled path. More framework than this site needs.                                                                                                                                                                                                                                                                                                                                                              |
| VitePress             | Fast and simple, but Vue-based (the dashboard components are React) and its default theme is very recognizable; deep layout changes mean writing a theme from scratch.                                                                                                                                                                                                                                                                                                                                                                                  |
| Docusaurus            | Mature, versioning built in, but heavier client JS, slower builds, and the most recognizable look of all.                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Decision details:

- Pin exact Astro and Starlight versions when scaffolding; renovate them deliberately.
- Plugins to evaluate (each one only if it earns its place): `starlight-links-validator` (broken links fail the build), `starlight-llms-txt` (`/llms.txt` and plain-text pages for AI assistants), `starlight-typedoc` (programmatic API reference from the `.d.ts` files), an Expressive Code Twoslash plugin.

## 3. Information architecture

```text
/                         Landing
/docs/                    Start here
  introduction            what swaggerz is, how it differs, when not to use it
  quick-start             install → init → generate → call, in five steps
  config-files            TypeScript, JavaScript, JSON and YAML configs; $schema; env overrides
/docs/guides/
  fetch-and-axios         transports, middleware, timeouts, cancellation, errors
  react-query             hooks, query keys, infinite queries, invalidation, bodiless (null) responses
  zod                     validation of requests and responses
  dates                   types.dates: 'Date', revival and encoding
  read-write-models       readOnly/writeOnly split and Input models
  bodies-and-uploads      multiple media types, form data, binary, XML as string
  webhooks-and-callbacks  payload and handler types
  servers                 per-operation servers and operationServers
  plugins                 writing a plugin, plugin references, hooks
  dashboard               local dashboard, security model
  ci-and-monorepos        validate in CI, deterministic output, several APIs in one repo
  migrating               from openapi-typescript, orval, openapi-generator (honest, tested comparisons)
/docs/concepts/
  pipeline                loader → IR → analysis → codegen → plugins → writer
  determinism-and-safety  manifest, atomic writes, never touching your files
  tree-shaking            one module per operation, measured bundle sizes
/docs/reference/
  config                  generated from config.schema.json
  cli                     generated from the CLI's argument definitions
  api                     programmatic API, generated from the published .d.ts
  generated-code          shapes of models, operations, client, runtime
  diagnostics             every code, generated from the diagnostics source
  compatibility           matrix, generated from `pnpm compat` results
/playground               in-browser generator (phase 3)
/examples                 the examples/ projects, with their generated output
/changelog                rendered from CHANGELOG.md
/brand                    logo files and usage rules
```

### Single source of truth

- `docs/*.md` in the repository stays the source for prose that also reads well on GitHub. The site loads it through a content-collection loader with `base: '../docs'` and turns each file's first heading into the page title, so nothing is copied. Site-only pages (landing, guides with interactive components) are MDX in `website/src/content/`.
- Generated at build time: the config reference (walks `config.schema.json`: option, type, default, description, example), the CLI reference, the diagnostics dictionary, the compatibility matrix and bundle-size numbers (from the treeshake tests' output), and the examples' generated code (by running the repository's own `swaggerz` build against `fixtures/specs` and `examples/`).
- A reference page that cannot be generated fails the build instead of rendering stale content.

## 4. Design

### Direction: "technical manual, printed on good paper"

An editorial layout borrowed from well-made printed manuals: a serif voice for headings, generous margins, notes in the margin rather than colored boxes, numbered chapters, a colophon. Warm paper and ink instead of white and grey, with marigold used sparingly, like a highlighter. It matches the dashboard and the logo.

### Palette

Same tokens as the dashboard (`src/dashboard/client/styles.css`), so components move between them unchanged.

| Token        | Light                                                           | Dark (night)     | Use                                                       |
| ------------ | --------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| background   | `#F6F2EA`                                                       | `#141311`        | page                                                      |
| surface      | `#FDFBF7`                                                       | `#1B1A17`        | code panels, popovers                                     |
| sunken       | `#EFE9DE`                                                       | `#11100E`        | sidebar, code blocks                                      |
| foreground   | `#1B1915`                                                       | `#EDE7DC`        | text                                                      |
| muted        | `#6B655B`                                                       | `#A39B8D`        | secondary text                                            |
| border       | `#E0D8C8`                                                       | `#2C2924`        | rules, hairlines                                          |
| marigold     | `#F2B33D`                                                       | `#F2B33D`        | highlighter strokes, active marker, focus ring, selection |
| marigold ink | `#8A5A00`                                                       | `#F2B33D`        | links and accents that need text contrast                 |
| GET … DELETE | earth tones from the dashboard (moss, ochre, rust, plum, brick) | lighter variants | method stamps                                             |

Dark mode is warm black, never blue-grey. Every text/background pair is checked for WCAG AA in both themes at build time (a small script over the token table).

### Type

- **Source Serif 4** (variable, optical sizes) for headings, the landing headline and the chapter navigation. Display sizes use the large optical size; small headings the text size.
- **Geist** for body text at 16.5 px / 1.7, measure capped at 68 characters.
- **Geist Mono** for code and the CLI, with ligatures off.
- All self-hosted (OFL), Latin subsets preloaded, fallback fonts metric-adjusted (`size-adjust`, `ascent-override`) so swapping causes no layout shift.

### Layout (what makes it not look like a stock docs site)

```text
≥ 1280 px
┌──────────────┬──────────────────────────────────────────┬──────────────────┐
│ 01 Start     │  Guides / React Query               ⌘K   │                  │
│ 02 Guides    │                                          │                  │
│   ▸ React Q. │  React Query                              │                  │
│   ...        │  ───────────                              │  Note            │
│ 03 Concepts  │  Body text at a 68ch measure. Margin      │  Bodiless        │
│ 04 Reference │  notes sit beside the paragraph they      │  responses map   │
│              │  annotate, like sidenotes in a book.¹     │  to null.¹       │
│              │                                          │                  │
│              │  ┌ spec ─────────────┬ generated ───────┐ │                  │
│              │  │ /pets/{id}: get   │ export function  │ │                  │
│              │  │  operationId: …   │  getPetById(…)   │ │                  │
│              │  └───────────────────┴──────────────────┘ │                  │
│ colophon     │  ← Zod                    Dates →        │  On this page ▾  │
└──────────────┴──────────────────────────────────────────┴──────────────────┘
```

1. **Chapter navigation**: sections are numbered chapters (`01 Start`, `02 Guides` …) set in the serif, with the current page marked by a short marigold bar rather than a filled pill.
2. **Margin notes instead of callout boxes**: `<Note>`/`<Caution>` render in the right margin, aligned with the paragraph that references them; below 1280 px they fall back into the text flow as indented notes with a marigold rule. The page table of contents becomes a compact "On this page" menu at the bottom of the margin column.
3. **Spec ↔ code twins**: a `<SpecToCode>` component shows a specification fragment beside the code swaggerz generates for it, produced at build time from a real run. Hovering a field highlights its counterpart on the other side. Generated files already record the operations and schemas they come from (`GeneratedFile.sources`); field-level pairs need a small addition to the generator that records the JSON pointer of each emitted property (phase 2). On narrow screens the panes become tabs.
4. **Method stamps**: HTTP methods are small-caps stamps in the earth-tone method colors, the same as in the dashboard.
5. **Highlighter**: search hits, `<mark>` and the landing page's emphasis use a slightly irregular marigold stroke behind the text (an SVG background), not a flat rectangle.
6. **Diagnostics as a dictionary**: each code is a headword (`schema/unsupported-keyword`) with severity, meaning, an example that triggers it and the fix.
7. **Colophon footer**: fonts, the swaggerz version and commit the site was built from, and the date of the measurements shown on the site.

Motion is limited to 120–180 ms opacity and transform transitions; `prefers-reduced-motion` removes them.

### Landing page

1. **Headline** in the display serif, plain and specific: "Your OpenAPI spec, compiled into the client you would have written by hand." A copyable `npx swaggerz init` line.
2. **The twin panel**, large: a petstore YAML on the left, the generated `getPetById.ts` on the right, linked highlighting, with tabs for React Query and Zod output. Real output, generated during the build.
3. **Spec sheet** instead of feature cards: a two-column definition list (Input · Output · Runtime · Guarantees · Tooling), each line linking to its doc. For example: _Runtime_: dependency-free, fetch or axios, ~N kB for one operation (measured).
4. **Measured**: the tree-shaking result (bytes for one operation vs. the whole client) and benchmark timings, with the date and commit they were measured on.
5. **Tools**: the dashboard (real screenshot) and, once it exists, the VS Code extension. Nothing is shown before it ships.
6. Footer colophon.

### Components

- Built as Astro components (static) wherever possible; React islands only for the twin panel's hover linking, the playground, theme toggle and copy buttons.
- Reuse the dashboard's `components/ui` primitives (Radix-based) for interactive pieces so focus handling and keyboard behavior are already tested.
- Code blocks: Expressive Code with a custom theme from the palette tokens (no stock syntax theme), file name tabs, line markers, Twoslash hovers.

## 5. Playground (phase 3)

Paste or upload a spec, pick options, see the generated files, diagnostics and the client in a read-only editor, entirely in the browser.

- Needs a **browser build of the compiler**: the loader gets an injectable file reader (a map of virtual files) instead of `node:fs`, and remote `$ref`s are disabled. The compile runs in a Web Worker so the page stays responsive on large specs.
- Specs never leave the browser. State is shareable through a compressed URL fragment (never sent to a server).
- Output view: file tree, code with the site's code theme, diagnostics with positions, "download as zip".
- Size budget: the playground route may load up to 600 KB gzipped of JavaScript, lazily, and other pages stay at near-zero JavaScript.

## 6. Content work

- Rewrite the README's long sections into guides, keep the README short (pitch, install, quick start, links).
- Each guide ends with "What's generated" (a twin panel) and "Limitations", stating plainly what is not supported.
- `migrating` pages are written only from side-by-side runs on the same fixture specs, with the commands used.
- Every code sample is a file under `website/samples/` that the build type-checks against the current build (Twoslash); a sample that stops compiling fails the build.

## 7. Quality gates (CI)

- `astro check`, oxlint and oxfmt like the rest of the repository.
- Broken internal links and anchors fail the build.
- Accessibility: axe on every page template in both themes; Lighthouse CI budgets of 100 accessibility, ≥ 95 performance, CLS 0 on the landing page and a docs page.
- Visual regression with Playwright screenshots of key pages at 390, 768 and 1440 px in both themes.
- Contrast check over the token table (section 4).

## 8. Repository layout

```text
website/
  astro.config.mjs        Starlight config, component overrides, Expressive Code theme
  src/
    content/              site-only MDX pages
    loaders/              docs/ loader, generated reference loaders
    components/           Note, SpecToCode, MethodStamp, SpecSheet, Colophon …
    overrides/            Starlight overrides: PageFrame, Sidebar, Header, TableOfContents, Footer
    styles/               tokens.css (shared with the dashboard), typography.css
    pages/                landing, playground, examples
  samples/                type-checked code samples
  public/                 fonts, brand files, _headers
```

It is a pnpm workspace package next to the root package (and `extension/`, see extension.md). The site builds the core first and uses the local build for every generated page, so docs always describe the code in the same commit.

## 9. Deployment (when ready)

- Output is plain static files (`astro build` → `website/dist`), deployable to Cloudflare Pages, Netlify, Vercel or GitHub Pages. Cloudflare Pages or Netlify is the recommendation: free tier, preview deployments per pull request, `_headers` support.
- `public/_headers` sets a strict CSP (no third-party origins at all: fonts and scripts are self-hosted), `X-Content-Type-Options`, `Referrer-Policy`, and long cache lifetimes for hashed assets.
- For GitHub Pages under a project path, set Astro's `base` to `/swaggerz`.
- Domain: to be chosen (for example `swaggerz.dev`; availability not checked). Canonical URLs, sitemap and Open Graph images (generated at build in the brand style with the page title in the serif) are configured once the domain is known.
- No analytics by default; if wanted, a cookie-less option (Cloudflare Web Analytics or Plausible) added later.

## 10. Phases

| Phase                 | Scope                                                                                                                                                                                                    | Done when                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **1. Docs**           | Workspace scaffold, tokens and fonts, layout overrides (chapters, margin notes, colophon), docs/ loader, generated config/CLI/diagnostics references, search, code theme, CI gates, preview deployments. | Every page of docs/ renders in the new layout; generated references match the source; gates pass. |
| **2. Landing**        | Landing page with real twin panel, spec sheet, measured numbers; examples gallery; Twoslash samples; OG images; changelog and brand pages.                                                               | A production build deploys with zero third-party requests; Lighthouse budgets met.                |
| **3. Playground**     | Browser compiler build, worker, editor, share links.                                                                                                                                                     | The fixture specs produce the same files in the playground as the CLI.                            |
| **4. Versions, i18n** | Versioned docs after 1.0 (latest and next), translations if contributors appear.                                                                                                                         | —                                                                                                 |

## 11. Open questions

- Domain name and hosting provider (yours to choose; nothing in the plan depends on which).
- Whether the VS Code extension's docs live on this site (recommended) or in the extension's README only.
- Whether `docs/` moves into `website/` entirely after phase 1 (simpler tooling) or stays readable on GitHub (current plan).
