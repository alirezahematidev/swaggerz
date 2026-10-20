# swaggerz

A compiler from Swagger 2.0 / OpenAPI 3.0 / 3.1 / 3.2 documents to typed, tree-shakeable API clients (fetch or axios, optional TanStack Query v5 hooks and Zod 4 schemas). Ships as a CLI, a programmatic API and a local dashboard. Read [docs/architecture.md](docs/architecture.md) before changing the pipeline and [docs/decisions.md](docs/decisions.md) before revisiting a design choice.

## Commands

Use pnpm; the exact version is pinned in `packageManager` and any recent pnpm switches to it. Dependencies may run install scripts only when listed under `allowBuilds` in `pnpm-workspace.yaml`. Node 22.18+; scripts and tests run `.ts` files directly through Node's type stripping, with no build step.

```sh
pnpm check            # typecheck (4 projects) + oxlint + oxfmt --check + all tests; must pass before you finish
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
node scripts/verify-examples.ts                       # packs, installs and checks examples/* like a user (network)
node dist/cli/bin.js dashboard --config <file>        # run the dashboard against a config
```

The vitest global setup builds the runtime templates and the dashboard bundle once per run, so the first test run is slower.

## Layout

- `src/config` — user config types, `defineConfig`, loading (`ts/mts/cts/js/mjs/cjs/json/yaml/yml`), plugin references, validation. `validate.ts` is the single source of truth for options: it drives runtime validation **and** the generated `config.schema.json`. Adding an option means updating `types.ts`, `validate.ts`, `resolved.ts`/`resolve.ts` and docs/configuration.md.
- `src/loader` → `src/spec` (version adapters, schema converter) → `src/ir` (version-independent `ApiDocument`, `IR_VERSION`) → `src/analysis` (graph, naming, read/write split, `ProjectModel`) → `src/codegen` → `src/plugins` → `src/output` (manifest, atomic writes). `src/pipeline/compile.ts` wires them.
- `src/templates/runtime` — the runtime copied into every generated client. It must stay dependency-free and type-check against the browser-only `src/templates/tsconfig.json`.
- `src/dashboard` — HTTP server (`server.ts`), state derived from `compile()`, usage scanner (oxc-parser/oxc-resolver, optional dependencies), and the React client in `client/` (Vite + Tailwind v4 + Radix primitives, shadcn-style components in `components/ui`).
- `tests/unit`, `tests/integration` (generated code is compiled with `tsc` and executed), `fixtures/specs` (shared specs; `advanced-3.1.yaml` covers webhooks, callbacks, dates, read/write split, multiple media types and assertions; `features-3.2.yaml` every OpenAPI 3.2 addition).
- `examples/` — pnpm workspace packages (`swaggerz: workspace:*`), run from the root with `pnpm example:<name>`.
- `brand/` — logo sources; `scripts/` — build, pack verification, compat, release notes.

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
