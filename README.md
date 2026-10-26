<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/alirezahematidev/swaggerz/main/brand/logotype-lockup-dark.png">
    <img src="https://raw.githubusercontent.com/alirezahematidev/swaggerz/main/brand/logotype-lockup.png" alt="swaggerz" width="360">
  </picture>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/swaggerz"><img src="https://img.shields.io/npm/v/swaggerz" alt="npm version"></a>
  <a href="https://github.com/alirezahematidev/swaggerz/actions/workflows/ci.yml"><img src="https://github.com/alirezahematidev/swaggerz/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/alirezahematidev/swaggerz"><img src="https://api.scorecard.dev/projects/github.com/alirezahematidev/swaggerz/badge" alt="OpenSSF Scorecard"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/swaggerz" alt="MIT license"></a>
</p>

Generate fully typed, documented, tree-shakeable API clients from **Swagger 2.0**, **OpenAPI 3.0**, **3.1** and **3.2** specifications.

- **One module per operation.** Applications bundle only the endpoints they import. Measured with esbuild, Rollup, Vite and webpack: one operation of a 1,000-operation client costs ~16 KB (shared runtime) + ~0.2 KB per extra operation.
- **TypeScript or JavaScript.** Strict TypeScript, or plain ES modules with JSDoc and optional `.d.ts` files — same runtime behavior.
- **Fetch or axios.** Interchangeable transports behind one contract; bring your own axios instance and interceptors.
- **Optional data-fetching hooks**: TanStack Query v5 for **React, Vue, Svelte and Solid**, or **SWR** — option and key factories, infinite queries and invalidation, never imported unless enabled.
- **Optional schemas and runtime validation** of requests and responses with **Zod 4, Valibot 1 or ArkType 2**.
- **Optional mocks**: a **Mock Service Worker** handler per operation, typed by status, and a deterministic fixture factory per model (`makePet({ name: 'Rex' })`), for UIs and tests that run without the backend.
- **OpenAPI Overlays** (1.0–1.2) fix third-party specifications without forking them.
- **Self-contained output.** The generated client has no runtime dependency on this package.
- **Safe, deterministic regeneration.** Identical input produces identical output; unchanged files are not rewritten; files you own are never overwritten.
- **Local dashboard** to explore operations, models, dependency graphs, static usage in your code and generation diffs.
- **MCP server for coding agents**: Claude Code, Cursor and others look up the exact generated function, its types and an example call instead of guessing from the spec.
- **A linter for what matters to the client**: missing operationIds, untyped responses, inline schemas and other things that make the generated code worse.
- **Accurate types for what specs actually say**: separate request and response models for `readOnly`/`writeOnly`, every request media type, declared `304`s, per-operation servers, webhook and callback handler types, optional `Date` conversion.
- **Plugin API** with typed lifecycle hooks; plugins can be referenced by module from any config format.

## Contents

- [Supported specifications](#supported-specifications)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Documentation](#documentation)
- [CLI](#cli)
- [Known limitations](#known-limitations)
- [Security](#security)
- [Contributing](#contributing)

## Supported specifications

| Family  | Versions | Notes                                                                                                                                                                                                                                                                  |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swagger | 2.0      | `body`/`formData` parameters, `collectionFormat`, `consumes`/`produces`, `securityDefinitions`, `x-nullable`, `discriminator`                                                                                                                                          |
| OpenAPI | 3.0.x    | `nullable`, `oneOf`/`anyOf`/`allOf`, discriminators, `content` parameters, `style`/`explode`, callbacks, operation `servers`                                                                                                                                           |
| OpenAPI | 3.1.x    | JSON Schema 2020-12 types (`type: [..., "null"]`), `const`, `prefixItems`, `$ref` siblings, `$defs`, `$anchor`, `$id` scopes, webhooks, `if`/`then`/`else` and `dependent*` (enforced by Zod)                                                                          |
| OpenAPI | 3.2.x    | Everything in 3.1, plus `QUERY` and `additionalOperations` methods, `in: querystring`, `style: cookie`, nested tags (`parent`, `kind`), `$self`, media type components, `discriminator.defaultMapping`, the OAuth 2 device flow; `itemSchema` content is typed as text |

The configured `spec.version` is enforced: a 3.0 document is rejected when the config says `'3.1'` instead of being reinterpreted. Each version has its own adapter; all of them produce the same normalized intermediate representation. Features that cannot be represented are reported as diagnostics — see [compatibility](docs/compatibility.md) for the full matrix.

Input can be JSON or YAML, local or `http(s)`, split across files with external `$ref`s (subject to a [reference policy](docs/configuration.md#specrefs)).

## Installation

Requires **Node.js 22.18 or later** (TypeScript config files are loaded with Node's built-in type stripping).

```sh
npm install --save-dev swaggerz
# or: yarn add --dev swaggerz · pnpm add --save-dev swaggerz
```

The generated client needs no runtime dependency on `swaggerz`. Depending on the options you enable, your application needs:

| Option                                    | Dependency                          | Tested versions               |
| ----------------------------------------- | ----------------------------------- | ----------------------------- |
| `client.adapter: 'axios'`                 | `axios`                             | 1.0.0 – 1.x                   |
| `features.query` (React, the default)     | `@tanstack/react-query`, `react`    | 5.0.0 – 5.x                   |
| `features.query: { framework: 'vue' }`    | `@tanstack/vue-query`, `vue`        | 5.0.0 – 5.x, Vue 3.3+         |
| `features.query: { framework: 'svelte' }` | `@tanstack/svelte-query`, `svelte`  | 6.0.0 – 6.x, Svelte 5.25+     |
| `features.query: { framework: 'solid' }`  | `@tanstack/solid-query`, `solid-js` | 5.0.0 – 5.x                   |
| `features.swr`                            | `swr`, `react`                      | 2.2.0 – 2.x                   |
| `features.validation: 'zod'`              | `zod`                               | 4.0.15 – 4.x                  |
| `features.validation: 'valibot'`          | `valibot`                           | 1.0.0 – 1.x                   |
| `features.validation: 'arktype'`          | `arktype`                           | 2.0.0 – 2.x (TypeScript 5.4+) |
| `features.mocks: 'msw'` (development)     | `msw`                               | 2.11.0 – 3.x                  |
| TypeScript output                         | `typescript`                        | 5.0 – 7.x                     |

The CLI is installed as `swaggerz` and as the shorter alias `sz` (`npx sz generate`).

## Quick start

```sh
npx swaggerz init        # creates swaggerz.config.ts (detects your spec, its version, and the data-fetching and mock libraries you depend on; --format js|json|yaml)
npx swaggerz generate    # writes the client to src/generated/api
```

`swaggerz.config.ts`:

```ts
import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: {
    version: '3.0',
    input: './openapi.yaml',
  },
  output: {
    directory: './src/generated/api',
    language: 'typescript',
  },
  client: {
    adapter: 'fetch',
  },
  features: {
    reactQuery: false,
  },
});
```

Use it:

```ts
import { client, getPetById, isGetPetByIdApiError } from './generated/api';

client.setConfig({
  baseUrl: 'https://petstore3.swagger.io/api/v3',
  auth: { api_key: () => sessionStorage.getItem('apiKey') ?? undefined },
});

try {
  const pet = await getPetById({ petId: 10 }, { timeout: 5_000 });
  console.log(pet.name);
} catch (error) {
  // Checking the status narrows the body to that response's type.
  if (isGetPetByIdApiError(error) && error.status === 404) console.error(error.body.message);
}
```

## Documentation

Every guide is a file in [`docs/`](docs), readable here on GitHub. The [docs website](https://swaggerz.dev) renders them with references generated from the source, real generated code next to its specification, measured numbers and an in-browser playground.

- **Start:** [configuration](docs/configuration.md) · [troubleshooting](docs/troubleshooting.md)
- **Guides:** [fetch and axios](docs/http-client.md) · [data fetching](docs/data-fetching.md) (TanStack Query for React, Vue, Svelte and Solid; SWR) · [validation](docs/validation.md) (Zod, Valibot, ArkType) · [mocks](docs/mocks.md) (MSW handlers and fixtures) · [overlays](docs/overlays.md) · [linting](docs/lint.md) · [MCP server](docs/mcp.md) · [dates](docs/dates.md) · [read and write models](docs/read-write-models.md) · [bodies and uploads](docs/bodies-and-uploads.md) · [webhooks and callbacks](docs/webhooks-and-callbacks.md) · [servers](docs/servers.md) · [plugins](docs/plugins.md) · [dashboard](docs/dashboard.md) · [JavaScript output](docs/javascript-output.md) · [CI and monorepos](docs/ci-and-monorepos.md) · [migrating](docs/migrating.md) from openapi-typescript, orval or openapi-generator
- **Concepts:** [architecture](docs/architecture.md) · [determinism and safety](docs/determinism-and-safety.md) · [design decisions](docs/decisions.md) · [benchmarks](docs/benchmarks.md)
- **Reference:** [generated code](docs/generated-code.md) · [diagnostics](docs/diagnostics.md) · [compatibility](docs/compatibility.md) · [roadmap](docs/roadmap.md)

Runnable [examples](examples) cover TanStack Query for React, Vue, Svelte and Solid, SWR, Zod, Valibot and ArkType validation, generated MSW mocks, a plain JavaScript Node.js project and custom plugins. The programmatic API (`generate()`, `validate()`, `loadConfig()`, `defineConfig()`) is exported from the package.

## CLI

```
swaggerz <command> [options]        (alias: sz)

  init        Create a config file for this project (TypeScript, JavaScript, JSON or YAML).
  generate    Generate the API client from the specification.  (alias: gen)
  validate    Validate config and spec and generate in memory, without writing files.
  lint        Report what in the specification makes the generated client worse.
  inspect     Print a summary of the operations and models that would be generated.
  dashboard   Start the local dashboard.
  mcp         Run an MCP server on stdio for coding agents.
  clean       Remove generated files (only files recorded in the output manifest).
  doctor      Check Node.js, config, spec, output directory and dependency versions.
```

| Option                                                                                                                                                                  | Commands            | Description                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-c, --config <path>`                                                                                                                                                   | all                 | Config file (default: `swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}` in the working directory)                                                                             |
| `--cwd <dir>`                                                                                                                                                           | all                 | Working directory                                                                                                                                                                   |
| `--json`                                                                                                                                                                | all                 | One machine-readable JSON document on stdout                                                                                                                                        |
| `--verbose` / `-q, --quiet`                                                                                                                                             | all                 | Show notes and timings / only errors                                                                                                                                                |
| `--color` / `--no-color`                                                                                                                                                | all                 | Force or disable color (`NO_COLOR` is respected)                                                                                                                                    |
| `-w, --watch`                                                                                                                                                           | `generate`          | Regenerate when the spec, any referenced file, the config or a local plugin changes (remote documents are polled)                                                                   |
| `--dry-run`                                                                                                                                                             | `generate`, `clean` | Show changes without writing                                                                                                                                                        |
| `--check`                                                                                                                                                               | `generate`          | Write nothing; exit `1` and list the differences when the output is not up to date (for CI)                                                                                         |
| `--force`                                                                                                                                                               | `generate`, `clean` | Overwrite files the generator does not own; delete hand-edited generated files                                                                                                      |
| `--no-clean`                                                                                                                                                            | `generate`          | Keep generated files that are no longer produced                                                                                                                                    |
| `--operations`, `--models`, `--filter <text>`                                                                                                                           | `inspect`           | Narrow the listing                                                                                                                                                                  |
| `--host`, `--port`, `--open`, `--no-watch`                                                                                                                              | `dashboard`         | Bind address, browser opening, live reload off                                                                                                                                      |
| `--max-warnings <n>`, `--rules`                                                                                                                                         | `lint`              | Fail above n warnings; list the rules and their severities                                                                                                                          |
| `--allow-write`, `--no-watch`                                                                                                                                           | `mcp`               | Offer the `generate` tool; do not reload on changes                                                                                                                                 |
| `--spec`, `--spec-version`, `--output`, `--language`, `--adapter`, `--query`, `--react-query`, `--swr`, `--validation`, `--mocks`, `--no-detect`, `--format`, `--force` | `init`              | Initial values; hooks default to the data-fetching library `package.json` depends on, mocks to `msw` when it is a dependency; `--format ts\|js\|json\|yaml` picks the config format |

Exit codes: `0` success · `1` failed checks, invalid specification or generation errors · `2` invalid usage or configuration (including an unsafe output directory) · `3` internal error. Ctrl+C stops `generate --watch`, `dashboard` and `mcp` gracefully and ends other commands at once.

Diagnostics point to the source: `error ref/missing-target $ref "#/components/schemas/Categry" … at openapi.yaml:478:9 (#/components/schemas/NewPet/properties/category)`.

## Known limitations

- `int64` maps to `number`; values beyond 2^53 lose precision when the response JSON is parsed.
- XML bodies are not serialized or parsed: requests take an already serialized string (or `Blob`/`ArrayBuffer`), responses return text.
- `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired` are enforced by the generated schemas but cannot be expressed in TypeScript types, which may be wider than the schema. `$dynamicRef` and `$recursiveRef` are ignored with a warning.
- Webhooks and callbacks produce types only; no server or routing code is generated.
- Watch mode recompiles the whole specification on change (only changed files are written).
- OpenAPI 3.2 sequential media types (`itemSchema`: JSON Lines, server-sent events) are read and typed as text; typed streaming is not generated yet.
- Usage scanning is static: it reports what your code imports, not what runs.

Earlier versions of this list included `readOnly`/`writeOnly` handling, `Date` conversion, multiple request media types, `304` responses, operation-level `servers`, webhooks and callbacks, and relative `$id` scopes. These are now supported; see [generated code](docs/generated-code.md).

## Security

- Generation never executes code from specifications. Descriptions, examples and names end up in comments, string literals and identifiers through dedicated escaping and sanitization.
- External `$ref`s are restricted by default to the project and spec directories; remote references need an explicit host allow-list, redirects are re-checked, credentials from `spec.fetch.headers` are only sent to the origin of `spec.input`, and remote documents may never reference local files.
- The writer only overwrites or deletes files it owns (manifest), refuses unsafe output directories (the project root, the config or spec file, also when reached through a symbolic link or another letter case) and refuses to write or delete through symbolic links that leave the output directory.
- The CLI prints control characters from specifications and plugins as `\xNN` escapes, so spec text cannot clear the terminal, change its title or write to the clipboard.
- The dashboard binds to loopback, requires a per-session token, rejects foreign `Host` and `Origin` headers, uses a strict Content Security Policy and renders spec content as text.
- The MCP server only reads unless started with `--allow-write`; `generate` keeps the manifest rules and asks the user first when the client supports it. Text from the specification is returned in fields marked as data, never as instructions.
- Config files and plugins are trusted code.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `pnpm install`, `pnpm check` (types, oxlint, oxfmt, knip, tests), and [Conventional Commits](https://www.conventionalcommits.org/) messages; releases are cut with release-it and published from CI.

## License

[MIT](LICENSE)
