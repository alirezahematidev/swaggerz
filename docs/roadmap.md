# Roadmap

## Status of the initial implementation

The first version was built in nine phases. Each phase ends with tests that compile and, where relevant, execute the generated code.

| Phase | Scope                                                                                                                                                                                                                                                                                                                                                      | Status |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | Project setup, configuration (`defineConfig`, loading, validation, environment overrides), diagnostics, CLI skeleton                                                                                                                                                                                                                                       | Done   |
| 2     | Loader (JSON/YAML, remote documents, limits), reference resolution with a security policy, version detection, Swagger 2.0 / OpenAPI 3.0 / 3.1 adapters, the IR                                                                                                                                                                                             | Done   |
| 3     | Analysis (dependency graph, naming, module layout) and code generation: models, operations, client, runtime with fetch and axios transports, TypeScript and JavaScript                                                                                                                                                                                     | Done   |
| 4     | Output: manifest, ownership rules, atomic writes, cleanup, diffs; `generate --watch`, `validate`, `inspect`, `clean`, `doctor`                                                                                                                                                                                                                             | Done   |
| 5     | TanStack Query v5 hooks, query options, keys, infinite queries, mutations with invalidation; Zod schemas and validation                                                                                                                                                                                                                                    | Done   |
| 6     | Plugins and hooks                                                                                                                                                                                                                                                                                                                                          | Done   |
| 7     | Dashboard: overview, operations, models, dependencies, usage scanning, generation preview                                                                                                                                                                                                                                                                  | Done   |
| 8     | Tree-shaking and compatibility verification, benchmarks, documentation, examples, CI and release automation                                                                                                                                                                                                                                                | Done   |
| 9     | Former limitations: read/write model split, `Date` conversion, multiple request media types, declared 3xx responses, per-operation servers, webhooks and callbacks, `not`/conditional/dependent assertions in Zod, relative `$id` scopes; JSON and YAML configs, plugin references; oxc-based usage scanning; dashboard redesign; oxlint/oxfmt; release-it | Done   |

What "done" is backed by: the unit and integration suites, `pnpm compat` (TypeScript 5.0/6/7 and the oldest supported release of every optional dependency, with the latest versions in the integration tests), `pnpm test:smoke` on Node.js 18–24, `pnpm test:pack` and `scripts/verify-examples.ts`. See [compatibility](compatibility.md) for exactly what is and is not verified.

## Before the first release

- Create the `alirezahematidev/swaggerz` repository, register the `swaggerz` name on npm and configure trusted publishing and the `npm` environment ([CONTRIBUTING.md](../CONTRIBUTING.md#releases)). The unscoped name was available on 2026-10-19; nothing has been published.
- Run the CI workflow on all platforms. Windows and Linux are covered by the CI matrix but have not yet been exercised; development happened on macOS.

## After the initial implementation

Implemented after the first version, with tests and documentation:

| Item                                          | Where it is documented                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate --check` for CI                     | [generated code](generated-code.md#checking-committed-output-in-ci)                                                                                                                       |
| Errors typed by status                        | [generated code](generated-code.md#errors), [decision 15](decisions.md#15-errors-are-typed-by-status-with-one-guard-per-operation)                                                        |
| `retry()` and `refreshAuth()` middleware      | [generated code](generated-code.md#middleware)                                                                                                                                            |
| Live reload for remote specifications         | [configuration](configuration.md#spec) (`spec.fetch.poll`), [dashboard](dashboard.md#live-reload)                                                                                         |
| OpenAPI 3.2                                   | [compatibility](compatibility.md#specification-support), [generated code](generated-code.md#openapi-32), [decision 16](decisions.md#16-openapi-32-maps-onto-the-existing-ir-where-it-can) |
| MCP server for coding agents                  | [MCP server](mcp.md), [decision 20](decisions.md#20-the-mcp-server-implements-the-protocol-itself-and-serves-both-protocol-eras)                                                          |
| TanStack Query for Vue, Svelte and Solid; SWR | [data fetching](data-fetching.md), [decision 18](decisions.md#18-data-fetching-hooks-share-key-functions-option-factories-are-plain-objects-outside-react)                                |
| OpenAPI Overlays                              | [overlays](overlays.md), [decision 19](decisions.md#19-overlays-patch-the-root-document-before-anything-reads-it-with-the-11-rules)                                                       |
| Valibot and ArkType validation                | [generated code](generated-code.md#validation), [decision 17](decisions.md#17-each-validation-library-gets-its-own-printer-behind-one-interface)                                          |
| `swaggerz lint`                               | [linting](lint.md), [decision 21](decisions.md#21-the-linter-reports-what-changes-the-generated-client-nothing-else)                                                                      |
| Mock Service Worker handlers and fixtures     | [mocks](mocks.md), [decision 22](decisions.md#22-mocks-are-msw-handlers-over-seeded-fixtures-with-a-dependency-free-fake-data-module)                                                     |
| Docs website                                  | [website/](../website)                                                                                                                                                                    |
| `sz` alias of the CLI                         | [README](../README.md#cli)                                                                                                                                                                |

## Candidates for later versions

Ordered roughly by expected value. None of them is committed.

- Typed streaming responses (server-sent events, JSON Lines) for OpenAPI 3.2 `itemSchema` and `x-` annotations in 3.0/3.1 (today such content is read as text).
- Opt-in `int64` → `bigint` (needs a JSON parser that keeps large integers exact, since `JSON.parse` already loses precision before any conversion).
- XML request and response serialization (today XML bodies are passed and returned as strings).
- `$dynamicRef` / `$recursiveRef`.
- Incremental compilation in watch mode (today the whole specification is recompiled; only changed files are written).
- A stable, documented IR (currently experimental, see [plugins](plugins.md#stability)).

Known limitations of the current version are listed in the [README](../README.md#known-limitations).
