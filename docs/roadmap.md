# Roadmap

## Status of the initial implementation

The first version was built in eight phases. Each phase ends with tests that compile and, where relevant, execute the generated code.

| Phase | Scope                                                                                                                                                                  | Status |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | Project setup, configuration (`defineConfig`, loading, validation, environment overrides), diagnostics, CLI skeleton                                                   | Done   |
| 2     | Loader (JSON/YAML, remote documents, limits), reference resolution with a security policy, version detection, Swagger 2.0 / OpenAPI 3.0 / 3.1 adapters, the IR         | Done   |
| 3     | Analysis (dependency graph, naming, module layout) and code generation: models, operations, client, runtime with fetch and axios transports, TypeScript and JavaScript | Done   |
| 4     | Output: manifest, ownership rules, atomic writes, cleanup, diffs; `generate --watch`, `validate`, `inspect`, `clean`, `doctor`                                         | Done   |
| 5     | TanStack Query v5 hooks, query options, keys, infinite queries, mutations with invalidation; Zod schemas and validation                                                | Done   |
| 6     | Plugins and hooks                                                                                                                                                      | Done   |
| 7     | Dashboard: overview, operations, models, dependencies, usage scanning, generation preview                                                                              | Done   |
| 8     | Tree-shaking and compatibility verification, benchmarks, documentation, examples, CI and release automation                                                            | Done   |

What "done" is backed by: the unit and integration suites, `yarn compat` (TypeScript 5.0/6/7, React Query 5.0.0, axios 1.0.0, Zod 4.0.15 and the latest versions), `yarn test:smoke` on Node.js 18–24, `yarn test:pack` and `scripts/verify-examples.ts`. See [compatibility](compatibility.md) for exactly what is and is not verified.

## Before the first release

- Choose an available npm package name (`swaggerz` is taken) and replace the `your-org/swaggerz` placeholders.
- Configure npm trusted publishing and the `npm` environment ([CONTRIBUTING.md](../CONTRIBUTING.md#releases)).
- Run the CI workflow on all platforms. Windows and Linux are covered by the CI matrix but have not yet been exercised; development happened on macOS.

## Candidates for later versions

Ordered roughly by expected value. None of them is committed.

- OpenAPI 3.2 support (currently rejected as an unsupported version).
- Separate request and response types for `readOnly`/`writeOnly` properties.
- Opt-in conversion of `date`/`date-time` strings to `Date` and `int64` to `bigint`.
- Operation- and path-level `servers` as per-operation base URLs.
- More integrations as optional generators: Vue Query, Svelte Query, SWR, Valibot.
- Incremental compilation in watch mode (today the whole specification is recompiled; only changed files are written).
- A stable, documented IR (currently experimental, see [plugins](plugins.md#stability)).

Known limitations of the current version are listed in the [README](../README.md#known-limitations).
