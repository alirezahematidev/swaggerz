/**
 * The site's information architecture: chapters, their pages, and where each page comes from.
 * The sidebar, the repository docs loader and the chapter numbers all read this one list.
 */

export interface PageEntry {
  /** Route id below the site root, e.g. `docs/guides/overlays` (served at `/docs/guides/overlays/`). */
  readonly id: string;
  /** Sidebar label when it differs from the page title. */
  readonly label?: string;
  /**
   * A Markdown file of the repository (relative to its root) the page is rendered from. Pages
   * without a source are MDX in `website/src/content/docs` or generated at build time.
   */
  readonly source?: string;
  /** Title for a `source` page when its first heading does not suit the site. */
  readonly title?: string;
  /** One-line description for search results and social previews. */
  readonly description?: string;
  /** A twin panel (`src/twins.ts`) shown under "What's generated" at the end of the page. */
  readonly twin?: string;
  /**
   * The page is MDX that reads `source` itself (to add measurements, examples or checks), so the
   * repository loader does not render the file. Links to `source` still lead to the page.
   */
  readonly generated?: boolean;
  /** Pages outside the docs collection (custom Astro pages) are linked, not loaded. */
  readonly external?: boolean;
}

export interface Chapter {
  readonly label: string;
  readonly pages: readonly PageEntry[];
}

export const CHAPTERS: readonly Chapter[] = [
  {
    label: 'Start',
    pages: [
      {
        id: 'docs/introduction',
        description:
          'What swaggerz is, what it generates, and when another tool is the better fit.',
      },
      {
        id: 'docs/quick-start',
        description: 'Install, create a config, generate a client and call the API in five steps.',
      },
      {
        id: 'docs/config-files',
        label: 'Config files',
        source: 'docs/configuration.md',
        title: 'Configuration',
        description:
          'TypeScript, JavaScript, JSON and YAML configs, every option, environment overrides.',
      },
      {
        id: 'docs/troubleshooting',
        source: 'docs/troubleshooting.md',
        description: 'Common problems and their fixes.',
      },
    ],
  },
  {
    label: 'Guides',
    pages: [
      {
        id: 'docs/guides/fetch-and-axios',
        label: 'Fetch and axios',
        source: 'docs/http-client.md',
        twin: 'operation',
        description:
          'Transports, configuration, middleware, retries, timeouts, cancellation and errors.',
      },
      {
        id: 'docs/guides/data-fetching',
        label: 'Data fetching',
        source: 'docs/data-fetching.md',
        twin: 'react-query',
        description: 'TanStack Query hooks for React, Vue, Svelte and Solid, and SWR hooks.',
      },
      {
        id: 'docs/guides/validation',
        source: 'docs/validation.md',
        twin: 'zod',
        description:
          'Zod, Valibot and ArkType schemas and runtime validation of responses and requests.',
      },
      {
        id: 'docs/guides/mocks',
        source: 'docs/mocks.md',
        description:
          'Mock Service Worker handlers per operation and deterministic fixtures per model.',
      },
      {
        id: 'docs/guides/overlays',
        source: 'docs/overlays.md',
        twin: 'overlay',
        description:
          'Patch third-party specifications with OpenAPI Overlays instead of forking them.',
      },
      {
        id: 'docs/guides/lint',
        label: 'Linting',
        source: 'docs/lint.md',
        description: 'What in a specification makes the generated client worse.',
      },
      {
        id: 'docs/guides/mcp',
        label: 'MCP server',
        source: 'docs/mcp.md',
        description:
          'The MCP server that gives coding agents the exact generated functions and types.',
      },
      {
        id: 'docs/guides/dates',
        source: 'docs/dates.md',
        twin: 'dates',
        description: "types.dates: 'Date' — Date values in models, parameters and bodies.",
      },
      {
        id: 'docs/guides/read-write-models',
        label: 'Read and write models',
        source: 'docs/read-write-models.md',
        twin: 'read-write',
        description: 'readOnly and writeOnly properties: separate request and response models.',
      },
      {
        id: 'docs/guides/bodies-and-uploads',
        label: 'Bodies and uploads',
        source: 'docs/bodies-and-uploads.md',
        twin: 'bodies',
        description: 'Several media types, form data, multipart uploads, binary and XML bodies.',
      },
      {
        id: 'docs/guides/webhooks-and-callbacks',
        label: 'Webhooks and callbacks',
        source: 'docs/webhooks-and-callbacks.md',
        twin: 'webhook',
        description: 'Payload, response and handler types for webhooks and callbacks.',
      },
      {
        id: 'docs/guides/servers',
        source: 'docs/servers.md',
        twin: 'servers',
        description: 'Base URLs, per-operation servers and several clients.',
      },
      {
        id: 'docs/guides/plugins',
        source: 'docs/plugins.md',
        description: 'Writing plugins: lifecycle hooks, plugin references, added files.',
      },
      {
        id: 'docs/guides/dashboard',
        source: 'docs/dashboard.md',
        description: 'The local dashboard: operations, models, dependencies, usage and diffs.',
      },
      {
        id: 'docs/guides/javascript',
        label: 'JavaScript output',
        source: 'docs/javascript-output.md',
        twin: 'javascript',
        description: 'Plain ES modules with JSDoc types and declaration files.',
      },
      {
        id: 'docs/guides/ci-and-monorepos',
        label: 'CI and monorepos',
        source: 'docs/ci-and-monorepos.md',
        description:
          'Checking generated output in CI, deterministic output, several APIs in one repository.',
      },
      {
        id: 'docs/guides/migrating',
        source: 'docs/migrating.md',
        description: 'Moving from openapi-typescript, orval or openapi-generator.',
      },
    ],
  },
  {
    label: 'Concepts',
    pages: [
      {
        id: 'docs/concepts/pipeline',
        source: 'docs/architecture.md',
        description:
          'How a specification becomes a client: loader, IR, analysis, code generation, writer.',
      },
      {
        id: 'docs/concepts/determinism-and-safety',
        label: 'Determinism and safety',
        source: 'docs/determinism-and-safety.md',
        description:
          'The manifest, atomic writes, untrusted specifications and files that are yours.',
      },
      {
        id: 'docs/concepts/tree-shaking',
        description: 'One module per operation, and what that costs in bytes, measured.',
      },
      {
        id: 'docs/concepts/benchmarks',
        source: 'docs/benchmarks.md',
        generated: true,
        description: 'Compiler timings and memory by specification size, measured.',
      },
      {
        id: 'docs/concepts/decisions',
        label: 'Design decisions',
        source: 'docs/decisions.md',
        description: 'The decisions behind the design, with their context and consequences.',
      },
    ],
  },
  {
    label: 'Reference',
    pages: [
      {
        id: 'docs/reference/config',
        label: 'Config options',
        description: 'Every config option with its type, default and description.',
      },
      {
        id: 'docs/reference/cli',
        label: 'CLI',
        description: 'Every command and flag of the swaggerz CLI.',
      },
      {
        id: 'docs/reference/api',
        label: 'Programmatic API',
        description: 'generate(), validate(), loadConfig(), defineConfig() and their types.',
      },
      {
        id: 'docs/reference/generated-code',
        source: 'docs/generated-code.md',
        description: 'The shape of models, operations, the client and the runtime.',
      },
      {
        id: 'docs/reference/diagnostics',
        source: 'docs/diagnostics.md',
        generated: true,
        description: 'Every diagnostic code: what it means, an example and the fix.',
      },
      {
        id: 'docs/reference/compatibility',
        source: 'docs/compatibility.md',
        description: 'Specification features, runtimes and dependency versions that are verified.',
      },
    ],
  },
  {
    label: 'Project',
    pages: [
      { id: 'examples', label: 'Examples', external: true },
      { id: 'playground', label: 'Playground', external: true },
      { id: 'changelog', label: 'Changelog', external: true },
      {
        id: 'docs/project/roadmap',
        source: 'docs/roadmap.md',
        description: 'What is done, what comes next.',
      },
    ],
  },
];

/** Every page with a repository source, keyed by that source. */
export const SOURCE_PAGES: ReadonlyMap<string, PageEntry> = new Map(
  CHAPTERS.flatMap((chapter) => chapter.pages)
    .filter((page): page is PageEntry & { source: string } => page.source !== undefined)
    .map((page) => [page.source, page]),
);

/** Files in `docs/` that intentionally have no page, with the reason. */
export const UNPUBLISHED_DOCS: Readonly<Record<string, string>> = {};

/** `01`, `02` … for the chapter that contains a page id. */
export function chapterOf(id: string): { number: string; label: string } | undefined {
  // Subpages (`examples/react-query`) belong to the chapter of their section page.
  const candidates = new Set([id, id.split('/')[0] ?? id]);
  const index = CHAPTERS.findIndex((chapter) =>
    chapter.pages.some((page) => candidates.has(page.id)),
  );
  const chapter = CHAPTERS[index];
  return chapter === undefined
    ? undefined
    : { number: String(index + 1).padStart(2, '0'), label: chapter.label };
}
