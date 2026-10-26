# swaggerz

A compiler from Swagger 2.0 / OpenAPI 3.0 / 3.1 / 3.2 documents (optionally patched by OpenAPI Overlays) to typed, tree-shakeable API clients (fetch or axios, optional TanStack Query v5 hooks for React, Vue, Svelte or Solid, or SWR hooks, Zod 4, Valibot 1 or ArkType 2 schemas, and Mock Service Worker handlers with fixtures). Ships as a CLI (`swaggerz`, alias `sz`), a programmatic API, a local dashboard, an MCP server for coding agents and a codegen-focused linter. Read [docs/architecture.md](docs/architecture.md) before changing the pipeline and [docs/decisions.md](docs/decisions.md) before revisiting a design choice.

## Commands

Use pnpm; the exact version is pinned in `packageManager` and any recent pnpm switches to it. Dependencies may run install scripts only when listed under `allowBuilds` in `pnpm-workspace.yaml`. Node 22.18+; scripts and tests run `.ts` files directly through Node's type stripping, with no build step.

```sh
pnpm check            # typecheck (4 projects) + oxlint + oxfmt --check + knip + all tests; must pass before you finish
pnpm knip             # unused files, exports and dependencies (knip.jsonc)
pnpm test:unit        # fast; tests/unit
pnpm test:integration # compiles generated clients with tsc, runs them against mock servers
pnpm vitest run tests/unit/config/formats.test.ts   # one file
pnpm format           # oxfmt --write; run it instead of hand-formatting
pnpm build            # dist/, runtime templates, dashboard bundle, config.schema.json
pnpm test:pack        # packs, installs the tarball in a temp project and uses it like a user would (network)
pnpm test:smoke       # needs `pnpm build`; generates and runs a client
pnpm test:runtimes    # the client in Node.js, Deno, Bun, Chromium, Firefox, WebKit, workerd (network)
pnpm corpus           # 24 public API descriptions vs fixtures/corpus/baseline.json; --update records changes (network)
pnpm compat           # oldest/newest supported zod, axios, TanStack Query, TypeScript (network)
pnpm example:react-query                              # build, generate and run an example (also node-javascript, custom-plugin)
pnpm examples:check                                   # build, then generate and type-check every example
pnpm examples:browsers                                # the browser examples on their MSW mocks in Chromium, Firefox, WebKit (after examples:check)
node scripts/verify-examples.ts                       # packs, installs and checks examples/* like a user (network)
node dist/cli/bin.js dashboard --config <file>        # run the dashboard against a config
node src/cli/bin.ts mcp --config <file>               # the MCP server on stdio (logs on stderr)
pnpm website:dev      # docs website on http://localhost:4321 (regenerates its data first; needs `pnpm build`)
pnpm website:build    # build swaggerz, generate the site's data, type-check samples, build the site, check links
pnpm website:check    # contrast check of the palette + astro check + oxlint of the website (after a website build; `pnpm lint` skips website/, whose types need the generated data)
pnpm website:test     # Playwright on the built site: axe in both themes, CSP, budgets, search, menus, playground, screenshots
```

The vitest global setup builds the runtime templates and the dashboard bundle once per run, so the first test run is slower.

`pnpm install` installs the husky git hooks (`.husky/`): pre-commit runs `format:check`, `lint` and `knip`, pre-push `typecheck` and `test:unit`, commit-msg checks the Conventional Commits format.

## Layout

- `src/config` — user config types, `defineConfig`, loading (`ts/mts/cts/js/mjs/cjs/json/yaml/yml`), plugin references, validation. `validate.ts` is the single source of truth for options: it drives runtime validation **and** the generated `config.schema.json`. Adding an option means updating `types.ts`, `validate.ts`, `resolved.ts`/`resolve.ts` and docs/configuration.md.
- `src/loader` (including `jsonpath.ts` and `overlay.ts`, applied to the root document before parsing) → `src/spec` (version adapters, schema converter) → `src/ir` (version-independent `ApiDocument`, `IR_VERSION`) → `src/analysis` (graph, naming, read/write split, `ProjectModel`) → `src/codegen` → `src/plugins` → `src/output` (manifest, atomic writes). `src/pipeline/compile.ts` wires them.
- `src/templates/runtime` — the runtime copied into every generated client. It must stay dependency-free and type-check against the browser-only `src/templates/tsconfig.json`.
- `src/codegen/query` — hooks per data-fetching library (`react.ts`, `vue.ts`, `accessor.ts` for Svelte and Solid, `swr.ts`) over shared keys in `common.ts`; `src/codegen/validation` — one schema printer per library (`zod.ts`, `valibot.ts`, `arktype.ts`) behind the `Validator` interface; `src/codegen/mocks` — MSW handlers and fixture factories (`sampler.ts` computes fixture values; patterns are parsed by `pattern.ts`, never executed), with the support module the handlers share in `src/templates/mocks` (the only template allowed to import a package, `msw`).
- `src/service` — `ProjectService` (compiled project, change tracking, usage scanner with oxc-parser/oxc-resolver as optional dependencies), `ProjectWatcher`, and the API types shared with the dashboard client.
- `src/dashboard` — HTTP server (`server.ts`) over `ProjectService`, and the React client in `client/` (Vite + Tailwind v4 + Radix primitives, shadcn-style components in `components/ui`).
- `src/mcp` — the dependency-free MCP server (`server.ts`: protocol 2026-07-28 and 2025-11-25…2024-11-05) and its tools/resources (`tools.ts`). `src/lint` — the lint rules (`rules.ts` catalog, `lint.ts` checks).
- `tests/unit`, `tests/integration` (generated code is compiled with `tsc` and executed; the MCP tests drive `swaggerz mcp` with the official SDK clients), `fixtures/specs` (shared specs; `advanced-3.1.yaml` covers webhooks, callbacks, dates, read/write split, multiple media types and assertions; `features-3.2.yaml` every OpenAPI 3.2 addition; `mocks-3.1.yaml` mock handlers).
- `examples/` — pnpm workspace packages (`swaggerz: workspace:*`), run from the root with `pnpm example:<name>`.
- `brand/` — logo sources; `scripts/` — build, pack verification, compat, release notes.
- `website/` — the docs website (Astro + Starlight; see [website/README.md](website/README.md)). It renders `docs/*.md`, the examples' READMEs and `CHANGELOG.md` in place; `website/scripts/data.ts` generates the references, twin panels, measurements and the playground's browser compiler from this checkout into `website/src/generated/`. The palette lives in `src/dashboard/client/tokens.css`, shared with the dashboard.

## Rules that are not negotiable

- Never use `eval`, `new Function` or `vm`. Config files are trusted code loaded with native `import()`; specifications are untrusted input.
- Specification text that reaches generated code is escaped for its context (comments, strings, identifiers). The dashboard renders it as text, never as HTML, and keeps its strict CSP (no inline scripts; styles only through the per-response nonce).
- Never overwrite or delete files the generator does not own: the output manifest decides. Keep writes atomic.
- Output is deterministic: sort everything that comes from object iteration or the file system, no timestamps or absolute paths in generated files. Snapshot and determinism tests catch regressions.
- No `any` in public APIs or generated code. New user-facing problems are diagnostics with a stable code, documented in docs/diagnostics.md.
- Do not claim compatibility that the conformance tests and `pnpm compat` do not cover.
- Never publish, tag, or push from a local command unless explicitly asked. Releases go through `pnpm release` (release-it: bump, changelog, tag) and the tag-triggered `.github/workflows/release.yml` (npm trusted publishing). Do not commit secrets.

## Conventions

- TypeScript is strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`: spread optional properties conditionally (`...(x === undefined ? {} : { x })`) instead of assigning `undefined`.
- Imports use explicit `.ts` extensions. ESM only.
- oxlint runs type-aware rules (`.oxlintrc.json`); fix the cause instead of disabling a rule, and if a disable is unavoidable, use `// oxlint-disable-next-line <rule>` with a reason.
- Changes to generated code: update the generator, then the consumer tests in `tests/integration` that compile the output, then docs/generated-code.md. Changes to the IR shape bump `IR_VERSION`.
- Dashboard UI: compose `components/ui` primitives (no native `select`, checkbox or dialog); use the palette tokens in `client/styles.css` rather than raw colors; check light and dark themes and a 390px-wide viewport.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:` reach the changelog).
- Keep docs in `docs/` and `README.md` in step with behavior; `CHANGELOG.md` is written by release-it from commits.
- A new `docs/*.md` file needs a page in `website/src/navigation.ts` (the website build fails otherwise). Mark complete TypeScript code blocks in docs as ` ```ts check ` so the website build type-checks them; GitHub alerts (`> [!NOTE]`) become margin notes on the site.
