<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="swaggerz" width="300">
  </picture>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/swaggerz"><img src="https://img.shields.io/npm/v/swaggerz" alt="npm version"></a>
  <a href="https://github.com/alirezahematidev/swaggerz/actions/workflows/ci.yml"><img src="https://github.com/alirezahematidev/swaggerz/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/alirezahematidev/swaggerz"><img src="https://api.scorecard.dev/projects/github.com/alirezahematidev/swaggerz/badge" alt="OpenSSF Scorecard"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/swaggerz" alt="MIT license"></a>
</p>

Generate fully typed, documented, tree-shakeable API clients from **Swagger 2.0**, **OpenAPI 3.0**, **3.1** and **3.2** specifications.

- **One module per operation.** Applications bundle only the endpoints they import. Measured with esbuild, Rollup, Vite and webpack: one operation of a 1,000-operation client costs ~13 KB (shared runtime) + ~0.2 KB per extra operation.
- **TypeScript or JavaScript.** Strict TypeScript, or plain ES modules with JSDoc and optional `.d.ts` files — same runtime behavior.
- **Fetch or axios.** Interchangeable transports behind one contract; bring your own axios instance and interceptors.
- **Optional data-fetching hooks**: TanStack Query v5 for **React, Vue, Svelte and Solid**, or **SWR** — option and key factories, infinite queries and invalidation, never imported unless enabled.
- **Optional schemas and runtime validation** of requests and responses with **Zod 4, Valibot 1 or ArkType 2**.
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
- [Configuration](#configuration)
- [CLI](#cli)
- [Generated code](#generated-code)
- [HTTP client: fetch and axios](#http-client-fetch-and-axios)
- [Data fetching: TanStack Query and SWR](#data-fetching-tanstack-query-and-swr)
- [Runtime validation: Zod, Valibot, ArkType](#runtime-validation-zod-valibot-arktype)
- [Overlays](#overlays)
- [Linting](#linting)
- [MCP server for coding agents](#mcp-server-for-coding-agents)
- [Tree-shaking](#tree-shaking)
- [JavaScript output and JSDoc](#javascript-output-and-jsdoc)
- [Dashboard](#dashboard)
- [Plugins and customization](#plugins-and-customization)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Security](#security)
- [Contributing](#contributing)

Detailed guides live in [`docs/`](docs): [architecture](docs/architecture.md), [design decisions](docs/decisions.md), [configuration](docs/configuration.md), [generated code](docs/generated-code.md), [data fetching](docs/data-fetching.md), [overlays](docs/overlays.md), [linting](docs/lint.md), [MCP server](docs/mcp.md), [plugins](docs/plugins.md), [dashboard](docs/dashboard.md), [compatibility](docs/compatibility.md), [diagnostics](docs/diagnostics.md), [benchmarks](docs/benchmarks.md) and the [roadmap](docs/roadmap.md). Runnable [examples](examples) cover TanStack Query for React, Vue, Svelte and Solid, SWR, Zod, Valibot and ArkType validation, a plain JavaScript Node.js project and custom plugins. The plan for a [docs website](website.md) is in the repository root.

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
| TypeScript output                         | `typescript`                        | 5.0 – 7.x                     |

The CLI is installed as `swaggerz` and as the shorter alias `sz` (`npx sz generate`).

## Quick start

```sh
npx swaggerz init        # creates swaggerz.config.ts (detects your spec file and its version; --format js|json|yaml)
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

## Configuration

The config file can be TypeScript, JavaScript, JSON or YAML (`swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}`). JSON and YAML configs get completion and validation in editors from the bundled JSON Schema:

```yaml
# yaml-language-server: $schema=./node_modules/swaggerz/config.schema.json
spec:
  version: '3.1'
  input: ./openapi.yaml
features:
  reactQuery: true
plugins:
  - ./plugins/drop-internal.mjs
```

In TypeScript and JavaScript, `defineConfig()` gives full autocomplete and type checking. The config may also export a function `(env) => config` (sync or async), where `env.command` is the CLI command being run. All options are validated strictly — unknown keys are rejected with a "did you mean" hint.

| Option                                                          | Default                                        | Description                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `spec.version`                                                  | — (required)                                   | `'2.0'`, `'3.0'`, `'3.1'`, `'3.2'` or `'auto'`                                             |
| `spec.input`                                                    | — (required)                                   | File path (relative to the config file) or `http(s)` URL                                   |
| `spec.refs.external`                                            | `'local'`                                      | `'none'`, `'local'` (files in allowed directories) or `'remote'` (plus allow-listed hosts) |
| `spec.refs.allowedDirectories`                                  | project root + spec directory                  | Directories external `$ref`s may read                                                      |
| `spec.refs.allowedHosts`                                        | `[]`                                           | Hosts remote `$ref`s may fetch (`'*.example.com'` supported)                               |
| `spec.fetch`                                                    | 30 s timeout, 50 MiB                           | `headers`, `timeout`, `maxBytes` for remote documents; `poll` for watching them            |
| `spec.overlays`                                                 | `[]`                                           | [Overlay](#overlays) files or URLs applied in order before parsing                         |
| `output.directory`                                              | `./src/generated/api`                          | Output directory                                                                           |
| `output.language`                                               | `'typescript'`                                 | `'typescript'` or `'javascript'`                                                           |
| `output.declarations`                                           | `true`                                         | Emit `.d.ts` next to JavaScript files                                                      |
| `output.importExtension`                                        | `'.js'`                                        | `'.js'`, `'.ts'` or `'none'` in relative imports                                           |
| `output.clean`                                                  | `true`                                         | Delete generated files that are no longer produced                                         |
| `output.barrel`                                                 | `true`                                         | Emit `index` barrels                                                                       |
| `output.groupBy`                                                | `'tag'`                                        | Operation directories by first tag, or `'none'`                                            |
| `output.models`                                                 | `'all'`                                        | `'all'` or only `'used'` models                                                            |
| `output.webhooks`                                               | `true`                                         | Payload and handler types for webhooks and callbacks                                       |
| `output.banner`                                                 | —                                              | Extra header comment for every file                                                        |
| `client.adapter`                                                | `'fetch'`                                      | `'fetch'` or `'axios'`                                                                     |
| `client.baseUrl`                                                | first server                                   | Compiled default; change at runtime with `client.setConfig()`                              |
| `client.operationServers`                                       | `true`                                         | Send operations with their own `servers` to that server                                    |
| `client.headers`, `client.timeout`, `client.includeCredentials` | —                                              | Client defaults                                                                            |
| `client.responseStyle`                                          | `'data'`                                       | `'data'` resolves with the body; `'full'` with `{ data, status, headers }`                 |
| `features.query`                                                | `false`                                        | `true` (React) or `{ framework, queryMethods, infinite, invalidates }`                     |
| `features.reactQuery`                                           | `false`                                        | Alias of `features.query` with `framework: 'react'`                                        |
| `features.swr`                                                  | `false`                                        | `true` or `{ queryMethods, infinite, invalidates }` (not together with `query`)            |
| `features.validation`                                           | `false`                                        | `'zod'`, `'valibot'`, `'arktype'` or `{ library, response, request }`                      |
| `features.jsdoc`                                                | `true`                                         | Generate documentation comments                                                            |
| `naming.operations` / `models` / `files` / `parameters`         | camelCase / PascalCase / kebab-case / preserve | Naming conventions                                                                         |
| `naming.inputSuffix`                                            | `'Input'`                                      | Suffix of request-side model variants (`PetInput`)                                         |
| `types.enums`                                                   | `'union'`                                      | `'union'` literal types, or `'const'` objects as well                                      |
| `types.readonlyProperties`                                      | `true`                                         | `readonly` for `readOnly` properties                                                       |
| `types.readWrite`                                               | `'split'`                                      | Separate request (`…Input`) and response models, or `'merged'`                             |
| `types.dates`                                                   | `'string'`                                     | `'Date'` types `date`/`date-time` as `Date` and converts at runtime                        |
| `dashboard`                                                     | `127.0.0.1:4400`                               | `host`, `port`, `allowNetworkAccess`, `usage.include`/`exclude`                            |
| `lint.rules`                                                    | —                                              | Severity per [lint rule](#linting): `'off'`, `'info'`, `'warning'` or `'error'`            |
| `plugins`, `hooks`                                              | —                                              | Plugin objects or module references; see [plugins](#plugins-and-customization)             |

Environment variables override the config file: `SWAGGERZ_SPEC_INPUT`, `SWAGGERZ_SPEC_VERSION`, `SWAGGERZ_OUTPUT_DIRECTORY`, `SWAGGERZ_OUTPUT_LANGUAGE`, `SWAGGERZ_CLIENT_ADAPTER`, `SWAGGERZ_CLIENT_BASE_URL`. The full reference is in [docs/configuration.md](docs/configuration.md).

Config files (and the plugins they reference) are **trusted project code** and run with the permissions of the CLI. TypeScript configs are imported with Node's own loader (no `eval`), so they may only use erasable TypeScript syntax (no `enum`, `namespace` or parameter properties); relative imports need explicit extensions.

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

| Option                                                                                                    | Commands            | Description                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `-c, --config <path>`                                                                                     | all                 | Config file (default: `swaggerz.config.{ts,mts,cts,js,mjs,cjs,json,yaml,yml}` in the working directory)           |
| `--cwd <dir>`                                                                                             | all                 | Working directory                                                                                                 |
| `--json`                                                                                                  | all                 | One machine-readable JSON document on stdout                                                                      |
| `--verbose` / `-q, --quiet`                                                                               | all                 | Show notes and timings / only errors                                                                              |
| `--color` / `--no-color`                                                                                  | all                 | Force or disable color (`NO_COLOR` is respected)                                                                  |
| `-w, --watch`                                                                                             | `generate`          | Regenerate when the spec, any referenced file, the config or a local plugin changes (remote documents are polled) |
| `--dry-run`                                                                                               | `generate`, `clean` | Show changes without writing                                                                                      |
| `--check`                                                                                                 | `generate`          | Write nothing; exit `1` and list the differences when the output is not up to date (for CI)                       |
| `--force`                                                                                                 | `generate`, `clean` | Overwrite files the generator does not own; delete hand-edited generated files                                    |
| `--no-clean`                                                                                              | `generate`          | Keep generated files that are no longer produced                                                                  |
| `--operations`, `--models`, `--filter <text>`                                                             | `inspect`           | Narrow the listing                                                                                                |
| `--host`, `--port`, `--open`, `--no-watch`                                                                | `dashboard`         | Bind address, browser opening, live reload off                                                                    |
| `--max-warnings <n>`, `--rules`                                                                           | `lint`              | Fail above n warnings; list the rules and their severities                                                        |
| `--allow-write`, `--no-watch`                                                                             | `mcp`               | Offer the `generate` tool; do not reload on changes                                                               |
| `--spec`, `--spec-version`, `--output`, `--language`, `--adapter`, `--react-query`, `--format`, `--force` | `init`              | Initial values; `--format ts\|js\|json\|yaml` picks the config format                                             |

Exit codes: `0` success · `1` failed checks, invalid specification or generation errors · `2` invalid usage or configuration (including an unsafe output directory) · `3` internal error. Ctrl+C stops `generate --watch`, `dashboard` and `mcp` gracefully and ends other commands at once.

Diagnostics point to the source: `error ref/missing-target $ref "#/components/schemas/Categry" … at openapi.yaml:478:9 (#/components/schemas/NewPet/properties/category)`.

## Generated code

```
src/generated/api/
├── index.ts                 # optional barrel: client, runtime exports, every model and operation
├── client.ts                # the default client instance and RequestOptions
├── runtime/                 # transport contract, serialization, errors (emitted, no dependency)
├── models/pet.ts            # one module per model (plus pet-input.ts for readOnly/writeOnly)
├── pet/get-pet-by-id.ts     # one module per operation, grouped by tag
├── webhooks/, callbacks/     # payload and handler types
├── react-query/             # hooks when enabled: or vue-query/, svelte-query/, solid-query/, swr/
├── zod/                     # schemas when enabled: or valibot/, arktype/ (separate barrel)
└── .swaggerz-manifest.json  # files owned by the generator (with content hashes)
```

An operation module (abridged):

```ts
/** Parameters of {@link getPetById}. */
export type GetPetByIdParams = {
  /**
   * ID of pet to return
   *
   * @format int64
   * @minimum 1
   * @example 10
   */
  petId: number;
};

/** Response data of {@link getPetById}. */
export type GetPetByIdResponse = Pet;

/** The `ApiError`s {@link getPetById} rejects with: one per documented status, … */
export type GetPetByIdApiError =
  | ApiError<undefined, 400>
  | ApiError<ErrorModel, 404>
  | ApiError<unknown, Exclude<HttpStatus<1 | 3 | 4 | 5>, 400 | 404>>;

/** Everything {@link getPetById} rejects with: … */
export type GetPetByIdError = GetPetByIdApiError | RequestError;

/**
 * Find pet by ID.
 *
 * Returns a single pet.
 *
 * @remarks `GET /pet/{petId}` (operationId `getPetById`)
 * @param params - Request parameters.
 * @param options - Per-request options: `signal`, `timeout`, `headers`, `client`.
 * @returns `200` successful operation
 * @throws {@link ApiError} `400` Invalid ID supplied; `404` Pet not found; narrow it with {@link isGetPetByIdApiError}.
 * @throws {@link RequestError} When no usable response is received (network failure, timeout or invalid body).
 */
export function getPetById(
  params: GetPetByIdParams,
  options?: RequestOptions,
): Promise<GetPetByIdResponse> {
  return (options?.client ?? client).request<GetPetByIdResponse>(
    {
      operationId: 'getPetById',
      method: 'GET',
      path: '/pet/{petId}',
      pathParams: { petId: params.petId },
      accept: 'application/json',
      security: [['api_key'], ['petstore_auth']],
    },
    options,
  );
}

/** Whether `error` is an `ApiError` rejected by {@link getPetById}. It narrows to … */
export function isGetPetByIdApiError(error: unknown): error is GetPetByIdApiError {
  return isApiError(error) && error.operationId === 'getPetById' && error.method === 'GET';
}
```

Highlights (details in [docs/generated-code.md](docs/generated-code.md)):

- **Parameters** of every location (path, query, header, cookie) and the request body are one `params` object. Optional parameters accept `undefined`. Property names keep wire names by default (`params['X-Request-ID']`); `naming.parameters: 'camelCase'` converts them. Name clashes between locations are resolved (`id` and `queryId`).
- **Serialization** follows the spec: `form`/`simple`/`label`/`matrix`/`spaceDelimited`/`pipeDelimited`/`deepObject`, `explode`, `allowReserved`, JSON `content` parameters, JSON/urlencoded/multipart/binary/text bodies.
- **Request bodies** with several media types take a `contentType` discriminator (`{ contentType: 'application/x-www-form-urlencoded', body }`), each with its own body type; XML and other raw media types take an already serialized body.
- **Read and write models**: request bodies use `…Input` variants without `readOnly` properties, responses leave out `writeOnly` properties (`types.readWrite`).
- **Responses** are typed from the success (2xx) and declared 3xx responses; bodiless responses (`204`, `304`) resolve with `undefined`/`void`. Binary responses are `Blob`s.
- **Dates**: with `types.dates: 'Date'`, `date` and `date-time` values are `Date` objects in both directions.
- **Servers**: operations and paths with their own `servers` are sent there (`client.operationServers`).
- **Webhooks and callbacks**: payload, request, response and handler types to annotate your own route handlers.
- **Errors**: other responses reject with `ApiError` (`status`, `body`, `headers`, `response`, `operationId`), typed per operation as one `ApiError<Body, Status>` per documented status, so `isGetPetByIdApiError(error) && error.status === 404` narrows `error.body`; network failures, timeouts, malformed JSON and validation failures reject with `RequestError` (`kind`). Aborting with an `AbortSignal` rethrows the original abort error.
- **Models** are type aliases with documentation from the spec, `readonly` for `readOnly`, discriminated unions (`oneOf` + `discriminator`), narrowed subtypes (allOf inheritance), nullable types, index signatures, tuples and recursion.
- **Authentication**: `apiKey` (header/query/cookie), HTTP bearer/basic/other, OAuth 2 and OpenID Connect tokens. Requirements are alternatives — the first one whose credentials are all configured is applied.

## HTTP client: fetch and axios

The default `client` is created in `client.ts`. Configure it at startup:

```ts
import { client } from './generated/api';

client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL,
  headers: { 'x-app-version': '1.4.0' },
  // Keys are security scheme names from the spec; values may be functions evaluated per request.
  auth: { petstore_auth: () => localStorage.getItem('accessToken') ?? undefined },
  timeout: 10_000,
});

// Middleware runs in registration order and can replace requests, responses or recover from errors.
const remove = client.use({
  onRequest({ request }) {
    request.headers.set('x-request-id', crypto.randomUUID());
  },
  onResponse({ response, operation }) {
    if (response.status === 401) console.warn(`${operation.operationId} needs authentication`);
  },
});
```

Retries and token refresh are built in, opt in, and dropped by bundlers when unused:

```ts
import { client, refreshAuth, retry } from './generated/api';

// Idempotent methods only, jittered exponential backoff, honours Retry-After and cancellation.
client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));
// On 401: one refresh shared by every failing request, then each request is sent again.
client.use(
  refreshAuth({
    scheme: 'petstore_auth',
    refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
  }),
);
```

Per call: `getPetById(params, { signal, timeout, headers, baseUrl, parseAs, transportOptions, client })`. For multi-tenant servers, create clients with `createClient({ ...client.getConfig(), baseUrl })` and pass `{ client }`.

**fetch** (default) uses the global `fetch`. Supply another implementation or fetch options:

```ts
import { client, createFetchTransport, findPetsByStatus } from './generated/api';

// Any fetch-compatible function, e.g. one that adds tracing.
const tracedFetch: typeof fetch = (input, init) => fetch(input, init);
client.setConfig({ transport: createFetchTransport({ fetch: tracedFetch }) });
await findPetsByStatus({ status: 'available' }, { transportOptions: { cache: 'no-store' } });
```

**axios** (`client.adapter: 'axios'`) uses the default axios instance; reuse your own instance and interceptors:

```ts
import axios from 'axios';
import { client, createAxiosTransport } from './generated/api';

const http = axios.create({ withCredentials: true });
http.interceptors.request.use((config) => config);
client.setConfig({ transport: createAxiosTransport(http) });
```

HTTP errors still reject with `ApiError`; the `AxiosError` is preserved as `error.cause` and the `AxiosResponse` as `error.response`. Only the selected adapter is generated, so axios is never bundled with the fetch adapter. Bodies are serialized by the generated runtime before reaching axios, and responses are read as bytes and decoded by the runtime exactly as with fetch (JSON, text or `Blob`, by status and `Content-Type`).

## Data fetching: TanStack Query and SWR

Enable TanStack Query v5 hooks for React (the default), Vue, Svelte or Solid, or SWR hooks:

```ts
features: {
  query: {
    framework: 'react',                                    // 'react' | 'vue' | 'svelte' | 'solid'
    queryMethods: ['get', 'query'],                        // default
    infinite: { listPets: { pageParam: 'cursor' } },       // infinite query hooks
    invalidates: { createPet: ['listPets'], deletePet: ['pet'] }, // operation names or tags
  },
  // or: swr: { infinite: …, invalidates: … }
},
```

`features.reactQuery` still works as an alias of `query` with the React adapter. For each query operation the generator emits a key function (`getPetByIdQueryKey`), an option factory for `queryClient.fetchQuery` and prefetching (`getPetByIdQueryOptions`) and a hook; for mutations a hook and `addPetMutationOptions`; per tag, a key factory such as `petKeys.all`.

| Library      | Directory       | Query                                                 | Mutation                               | Parameters and options         |
| ------------ | --------------- | ----------------------------------------------------- | -------------------------------------- | ------------------------------ |
| React Query  | `react-query/`  | `useGetPetById(params, options?, client?)`            | `useAddPet(options?, client?)`         | Values                         |
| Vue Query    | `vue-query/`    | `useGetPetById(params, options?, client?)`            | `useAddPet(options?, client?)`         | Values, refs or getters        |
| Svelte Query | `svelte-query/` | `createGetPetByIdQuery(() => params, () => options?)` | `createAddPetMutation(() => options?)` | Accessors (runes)              |
| Solid Query  | `solid-query/`  | `createGetPetByIdQuery(() => params, () => options?)` | `createAddPetMutation(() => options?)` | Accessors (signals)            |
| SWR          | `swr/`          | `useGetPetById(params, options?)`                     | `useAddPet(options?)` (`trigger`)      | Values; `enabled: false` skips |

```tsx
import {
  useGetPetById,
  useAddPet,
  getPetByIdQueryOptions,
  petKeys,
} from './generated/api/react-query';

function PetName({ id }: { id: number }) {
  const { data } = useGetPetById({ petId: id }, { select: (pet) => pet.name, staleTime: 30_000 });
  return <span>{data}</span>;
}

const addPet = useAddPet({
  onSuccess: () => queryClient.invalidateQueries({ queryKey: petKeys.all }),
});
await queryClient.prefetchQuery(getPetByIdQueryOptions({ petId: 1 }));
```

```ts
// Vue: parameters follow refs and getters
const id = ref(1);
const { data } = useGetPetById(() => ({ petId: id.value }));
// Svelte 5 and Solid: accessors are read reactively
const pet = createGetPetByIdQuery(() => ({ petId }));
// SWR
const { data, error } = useGetPetById({ petId: 1 });
const { trigger } = useAddPet();
```

Query keys contain a static prefix (tag, operation) and **all** request parameters, so different parameters never share cache entries. TanStack Query's `AbortSignal` is passed to the request, so cancelled queries cancel the HTTP request. `TData` is inferred from `select`, and errors are typed as the operation's `ApiError` union (narrowed by `status`) or `RequestError`. Hooks live in their own directory; operation modules and the main barrel never import a UI framework. See [docs/data-fetching.md](docs/data-fetching.md).

## Runtime validation: Zod, Valibot, ArkType

```ts
features: { validation: { library: 'zod', response: true, request: true } },
// library: 'zod' (4) | 'valibot' (1) | 'arktype' (2); or simply validation: 'valibot'
```

Generates `<library>/<model>.ts` (`PetSchema`, …) and validates successful responses (and request bodies when `request: true`) in every operation. Failures reject with `RequestError` (`kind: 'validation'`, `cause` = the library's error: `ZodError`, `ValiError` or ArkType's `TraversalError`); invalid request bodies are never sent. Unknown properties are preserved; `additionalProperties: false` is enforced, and so are `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired` (which TypeScript types cannot express). Formats and patterns are documentation only, except `date`/`date-time` with `types.dates: 'Date'`, which are checked before conversion. Recursive and mutually recursive schemas are supported by all three libraries. Each schema is typed with the model it validates (`ZodType<Pet>`, `GenericSchema<Pet>`, `Type<Pet>`). The library is only imported by its directory and, when validation is enabled, by operations.

## Overlays

[OpenAPI Overlays](https://spec.openapis.org/overlay/latest) patch a specification you do not own — a missing `operationId`, a wrong type, an internal endpoint to hide — in a separate file that keeps working when the upstream document changes:

```ts
spec: { version: '3.1', input: 'https://api.example.com/openapi.json', overlays: ['./fixes.overlay.yaml'] },
```

```yaml
overlay: 1.1.0
info: { title: Fixes, version: 1.0.0 }
actions:
  - target: $.paths['/internal/metrics']
    remove: true
  - target: $.paths['/pets'].get
    update: { operationId: listPets }
  - target: $..[?@.format == 'int64']
    update: { format: int32 }
```

Overlay Specification 1.0, 1.1 (`copy`, primitive targets) and 1.2 (reusable actions) are supported for Swagger 2.0 and every OpenAPI version, with RFC 9535 JSONPath (filters and functions included). Overlays apply to the root document before anything else reads it; local overlay files are watched like the specification. Targets that match nothing are reported with the line in the overlay. See [docs/overlays.md](docs/overlays.md).

## Linting

```sh
npx swaggerz lint                    # findings as warnings and notes
npx swaggerz lint --max-warnings 0   # fail CI on warnings
```

`swaggerz lint` reports the compiler's diagnostics plus what in the specification makes the generated client worse: operations without an `operationId` (their names change when the path does), success responses without a schema (`unknown`), inline request and response objects, untyped or duplicate schemas, unused models, undeclared tags and missing servers. It is not a style linter — Spectral and Redocly cover that. Severities are configurable with `lint.rules`; see [docs/lint.md](docs/lint.md).

## MCP server for coding agents

`swaggerz mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server for Claude Code, Cursor, Copilot and other agents. It answers from the same compiled project as the generated code, so agents call the client correctly instead of guessing from the spec:

```json
{ "mcpServers": { "swaggerz": { "command": "npx", "args": ["swaggerz", "mcp"] } } }
```

Tools: `api_overview`, `find_operations`, `get_operation` (the exact declaration, import line and an example call), `get_model`, `check`, `preview_generation`, `find_usages`, and `generate` with `--allow-write` (after the user confirms, when the client can ask). Operations and models are also resources (`swaggerz://operations/getPetById`), updated live when the specification changes. Protocol versions 2026-07-28 (stateless) and 2025-11-25 back to 2024-11-05 are supported, with no extra dependency. See [docs/mcp.md](docs/mcp.md).

## Tree-shaking

Each operation and model is its own ES module with no top-level side effects, imports are static, and there is no registry of all endpoints. Measured on a generated client with **1,000 operations and 602 models** ([test](tests/integration/treeshake/bundle.test.ts), minified, not gzipped):

| Bundle                                              |     Size |
| --------------------------------------------------- | -------: |
| 1 operation (direct import, esbuild)                |  13.3 KB |
| 3 operations via the barrel (esbuild)               |  13.7 KB |
| 3 operations via the barrel (Vite production build) |  17.9 KB |
| 3 operations via the barrel (webpack production)    |  13.8 KB |
| 1 React Query hook, excluding TanStack Query itself |  13.8 KB |
| Entire client                                       | 326.4 KB |

The ~13 KB base is the shared runtime (serialization, errors, client with retries, transport); the `retry` and `refreshAuth` middleware add to it only when imported. The tests assert that only the imported operations remain in esbuild, Rollup, Vite and webpack bundles.

- Importing from the barrel (`./generated/api`) is as tree-shakeable as importing modules directly in Rollup, Vite and esbuild (all three are covered by the bundle tests). webpack is not part of the automated tests: in production mode its `usedExports` analysis and minifier remove unused exports of these side-effect-free modules, and marking the generated directory side-effect free in your package.json (`"sideEffects"`) lets it skip unused modules entirely.
- Model types cost nothing at runtime. Zod schemas and React Query hooks are separate modules and only bundled when imported.
- The axios adapter imports `axios`; the fetch adapter has no dependencies.

## JavaScript output and JSDoc

`output.language: 'javascript'` emits ES modules with JSDoc types (and `.d.ts` files unless `declarations: false`):

```js
/**
 * Parameters of {@link getPetById}.
 *
 * @typedef {object} GetPetByIdParams
 * @property {number} petId - ID of pet to return
 */

/**
 * Find pet by ID.
 *
 * @param {GetPetByIdParams} params - Request parameters.
 * @param {import('../client.js').RequestOptions} [options] - Per-request options: `signal`, `timeout`, `headers`, `client`.
 * @returns {Promise<GetPetByIdResponse>} `200` successful operation
 */
export function getPetById(params, options) {
  /* … */
}
```

Editors get full autocomplete from either the declarations or the JSDoc. The test suite type-checks JavaScript output with `checkJs` and strict settings, and verifies that `.js` files contain no TypeScript syntax.

## Dashboard

```sh
npx swaggerz dashboard          # prints http://127.0.0.1:4400/?token=…
npx swaggerz dashboard --open --port 0
```

- **Overview** — versions, counts, HTTP methods, tags, generation status, diagnostics, unresolved references and unsupported constructs.
- **Operations** — search by name, operation id, path, description, tag or model; filter by method, tag and deprecation; parameters, bodies, responses, auth, examples, source location and generated code.
- **Models** — properties, constraints, enums, unions, discriminators, recursion, relations, used-by operations, generated TypeScript/JavaScript/declarations.
- **Dependencies** — an operation's transitive models with "why it is included" chains, unused, recursive and structurally duplicated models.
- **Usage** — statically scans `dashboard.usage.include` (default `src`) with oxc to find which generated operations, hooks and models your code imports (TypeScript, JavaScript, JSX, `require()`, `tsconfig` paths). Dynamic imports and escaping namespace objects are reported as _undetermined_, never as unused. No TypeScript installation needed.
- **Generate** — preview every create/update/delete with diffs, then write after confirmation.

**Live reload**: while it runs, the dashboard watches the config, local plugins, the specification (with every local file it references) and the output. Edit the spec or run `swaggerz generate` and open pages update in place, with **New** and **Updated** badges on the operations and models that changed since the dashboard started (they reset on restart). A change that does not parse keeps the last good version on screen with its diagnostics.

Light and dark themes, a <kbd>⌘K</kbd> command palette and layouts down to phone width.

The dashboard reads the same compiled representation as the CLI. It binds to `127.0.0.1` and requires the session token from the printed link for every API call; see [docs/dashboard.md](docs/dashboard.md) for its security model.

## Plugins and customization

```ts
import { defineConfig, definePlugin } from 'swaggerz';

const internalOnly = definePlugin({
  name: 'drop-internal',
  // Modify the normalized IR (operations, schemas, …).
  afterNormalize: (ir) => ({
    ...ir,
    operations: ir.operations.filter((op) => op.extensions['x-internal'] !== true),
  }),
  // Rename symbols before uniqueness is enforced.
  operationName: (_operation, suggested) => suggested.replace(/^get/, 'fetch'),
  // Add files.
  generate: (ctx) => [
    {
      path: 'meta/operations.json',
      content: JSON.stringify(ctx.project.operations.map((o) => o.name)),
      origin: '',
    },
  ],
});

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  plugins: [internalOnly],
});
```

Hooks: `beforeParse`, `afterNormalize`, `operationName`, `modelName`, `jsdoc`, `queryKey`, `resolveImport`, `beforeGenerate`, `generate`, `transformFile`, `afterGenerate`, `beforeWrite`, `afterWrite`. Plugins run in a deterministic order (`enforce: 'pre'`, default, inline `hooks`, `enforce: 'post'`); a throwing hook aborts the run with a `plugin/hook-failed` diagnostic and nothing is written. The IR and project model are marked experimental until 1.0. See [docs/plugins.md](docs/plugins.md). The programmatic API (`generate()`, `validate()`, `loadConfig()`) is exported from the package as well.

## Troubleshooting

| Symptom                                                     | Fix                                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/load-failed` with "type stripping"                  | Use Node.js ≥ 22.18, avoid `enum`/`namespace` in the config, or rename it to `swaggerz.config.mjs`                                                  |
| `spec/version-mismatch`                                     | Set `spec.version` to the version the document declares (or `'auto'`)                                                                               |
| `ref/external-blocked`                                      | Allow the directory (`spec.refs.allowedDirectories`) or host (`spec.refs.external: 'remote'` + `allowedHosts`)                                      |
| `output/user-file`                                          | A file you created sits where generated code goes; move it, change `output.directory` or pass `--force`                                             |
| Imports like `./client.js` fail with webpack 4/CRA          | Set `output.importExtension: 'none'`                                                                                                                |
| Running generated **TypeScript** directly with `node` fails | Node does not map `.js` imports to `.ts`; compile/bundle it, generate JavaScript, or use `importExtension: '.ts'` with `allowImportingTsExtensions` |
| Usage scan says the scanner is unavailable                  | Optional dependencies were skipped (`--omit=optional`, `--no-optional`) or the platform has no oxc binaries; reinstall with optional dependencies   |
| Cookie parameters are not sent in browsers                  | Browsers forbid the `Cookie` header; the browser sends cookies itself (`includeCredentials: true`)                                                  |
| `swaggerz doctor`                                           | Checks all of the above in one go                                                                                                                   |

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

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `pnpm install`, `pnpm check` (types, oxlint, oxfmt, tests), and [Conventional Commits](https://www.conventionalcommits.org/) messages; releases are cut with release-it and published from CI.

## License

[MIT](LICENSE)
