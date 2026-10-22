# Configuration reference

The config file is `swaggerz.config.<ext>` in the working directory, or the file passed with `--config`. TypeScript (`.ts`, `.mts`, `.cts`), JavaScript (`.js`, `.mjs`, `.cjs`), JSON (`.json`) and YAML (`.yaml`, `.yml`) are supported; when several exist, the first in that order is used. `swaggerz init --format ts|js|json|yaml` creates one. Relative paths are resolved from the config file's directory.

```ts
import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
});
```

A config can also export a function receiving `{ command }` (`'generate'`, `'validate'`, `'lint'`, `'dashboard'`, `'mcp'`, …), synchronously or asynchronously:

```ts
export default defineConfig(async ({ command }) => ({
  spec: {
    version: '3.1',
    input: command === 'dashboard' ? './openapi.yaml' : 'https://api.example.com/openapi.json',
  },
}));
```

## Formats

TypeScript and JavaScript configs get type checking from `defineConfig` and can compute values, export a function and pass plugin objects. JSON and YAML configs hold the same options as plain data; editors validate and complete them through the JSON Schema shipped with the package (`swaggerz/config.schema.json`), which `swaggerz init` references:

```json
{
  "$schema": "./node_modules/swaggerz/config.schema.json",
  "spec": { "version": "3.1", "input": "./openapi.yaml" },
  "output": { "directory": "./src/generated/api" },
  "features": { "reactQuery": true },
  "plugins": [["./plugins/drop-internal.mjs", { "extension": "x-internal" }]]
}
```

```yaml
# yaml-language-server: $schema=./node_modules/swaggerz/config.schema.json
spec:
  version: '3.1'
  input: ./openapi.yaml
output:
  directory: ./src/generated/api
plugins:
  - ./plugins/add-metadata.mjs
```

Data configs cannot contain functions, so inline `hooks` are only available in TypeScript and JavaScript; plugins are referenced by module (see [`plugins`](#plugins-and-hooks)). Syntax and validation errors in JSON and YAML configs report the line and column.

**Loading.** TypeScript and JavaScript config files are imported with Node's module loader; TypeScript configs use Node's built-in type stripping (Node.js ≥ 22.18). They are trusted code executed with the CLI's permissions. Only erasable TypeScript syntax is allowed (no `enum`, `namespace`, parameter properties) and relative imports need file extensions.

**Precedence.** Defaults < config file < environment variables < CLI flags (`--no-clean`).

## `spec`

| Option           | Type                                         | Default    |                                                                                                       |
| ---------------- | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `version`        | `'2.0' \| '3.0' \| '3.1' \| '3.2' \| 'auto'` | required   | The family the document must declare. A mismatch is an error; `'auto'` accepts any supported version. |
| `input`          | `string`                                     | required   | Local path or `http(s)` URL of a JSON or YAML document.                                               |
| `refs`           | object                                       |            | See below.                                                                                            |
| `fetch.headers`  | `Record<string, string>`                     | `{}`       | Sent only to the origin of `input` (e.g. `Authorization` for a private spec).                         |
| `fetch.timeout`  | `number` (ms)                                | `30000`    | Per request.                                                                                          |
| `fetch.maxBytes` | `number`                                     | `52428800` | Maximum document size.                                                                                |
| `fetch.poll`     | `boolean \| number` (ms)                     | loopback   | Poll remote documents for changes while watching; see below.                                          |
| `overlays`       | `string[]`                                   | `[]`       | [Overlay](overlays.md) documents (paths relative to the config file, or URLs) applied in order.       |

`generate --watch` and the dashboard poll remote documents (an `http(s)` input and remote `$ref` targets) for changes: every `fetch.poll` milliseconds after the previous round, with conditional requests (`If-None-Match`, `If-Modified-Since`) under the same rules as loading them (credentials only to the origin of `input`, redirect checks, `timeout`, `maxBytes`). Servers that send no `ETag` or `Last-Modified` are compared by content, so an unchanged document never triggers a regeneration. A changed document regenerates (or reloads the dashboard) like a changed file; a server that is down is reported once and polled until it is back.

| `fetch.poll`      | Polled documents                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| not set (default) | Documents on loopback hosts (`localhost`, `127.0.0.1`, `[::1]`), every 2000 ms: a specification served by a local backend |
| `true`            | Every remote document, every 2000 ms                                                                                      |
| a number (≥ 500)  | Every remote document, at that interval                                                                                   |
| `false`           | None                                                                                                                      |

### `spec.refs`

External `$ref`s are resolved according to a policy:

| `external`          | Local files                 | Remote URLs                                        |
| ------------------- | --------------------------- | -------------------------------------------------- |
| `'none'`            | refused                     | refused                                            |
| `'local'` (default) | inside `allowedDirectories` | only same-origin as a remote `input`               |
| `'remote'`          | inside `allowedDirectories` | hosts in `allowedHosts` (exact or `*.example.com`) |

`allowedDirectories` defaults to the project root and the directory of the input file. Symbolic links are resolved before checking. Remote documents can never reference local files. Redirects are checked against the same policy. Each blocked reference is reported with a hint showing which option to change.

`maxDocuments` (default `5000`) bounds how many documents one description may consist of; documents are loaded breadth-first, up to 32 at a time. Large descriptions split into many files (DigitalOcean's has about 1,900) fit the default; the limit stops runaway reference chains.

## `output`

| Option            | Type                           | Default                 |                                                                                                                                                                    |
| ----------------- | ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `directory`       | `string`                       | `'./src/generated/api'` | Must not contain the project root, the config file or the spec.                                                                                                    |
| `language`        | `'typescript' \| 'javascript'` | `'typescript'`          |                                                                                                                                                                    |
| `declarations`    | `boolean`                      | `true`                  | JavaScript only: `.d.ts` next to each module. Runtime modules always have declarations.                                                                            |
| `importExtension` | `'.js' \| '.ts' \| 'none'`     | `'.js'`                 | `.js` works with Node ESM, TypeScript `nodenext`/`bundler` and all major bundlers. `.ts` requires `allowImportingTsExtensions`. `none` suits older webpack setups. |
| `clean`           | `boolean`                      | `true`                  | Delete generated files that are no longer produced (never hand-edited ones).                                                                                       |
| `barrel`          | `boolean`                      | `true`                  | `index`, plus `<hooks library>/index` and `<schema library>/index` when enabled.                                                                                   |
| `groupBy`         | `'tag' \| 'none'`              | `'tag'`                 | Operation directories by first tag (`default` when untagged; nested OpenAPI 3.2 tags in nested directories, `pets/cats`) or a single `operations/` directory.      |
| `models`          | `'all' \| 'used'`              | `'all'`                 | `'used'` omits schemas no operation references.                                                                                                                    |
| `webhooks`        | `boolean`                      | `true`                  | Payload, response and handler types for webhooks (`webhooks/`) and callbacks (`callbacks/`). See [generated code](generated-code.md#webhooks-and-callbacks).       |
| `banner`          | `string`                       |                         | Additional `//` header lines.                                                                                                                                      |
| `moduleFormat`    | `'esm'`                        | `'esm'`                 | Reserved.                                                                                                                                                          |

## `client`

| Option               | Type                     | Default                                                |                                                                                                                                                        |
| -------------------- | ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter`            | `'fetch' \| 'axios'`     | `'fetch'`                                              |                                                                                                                                                        |
| `baseUrl`            | `string`                 | first `servers` entry (variables replaced by defaults) | Compiled into `client.ts`. For environment-specific URLs prefer `client.setConfig({ baseUrl })` at runtime.                                            |
| `operationServers`   | `boolean`                | `true`                                                 | Operations (or paths) that declare their own `servers` are sent to their first server instead of `baseUrl`. A `baseUrl` passed per request still wins. |
| `headers`            | `Record<string, string>` | `{}`                                                   | Default headers.                                                                                                                                       |
| `timeout`            | `number` (ms)            | none                                                   | Default timeout.                                                                                                                                       |
| `includeCredentials` | `boolean`                | `false`                                                | `credentials: 'include'` (fetch) / `withCredentials` (axios).                                                                                          |
| `responseStyle`      | `'data' \| 'full'`       | `'data'`                                               | `'full'` resolves with `ApiResponse<Data, Status>` unions.                                                                                             |

## `features`

| Option       | Default |                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jsdoc`      | `true`  | Documentation comments (deprecations are always kept).                                                                                                                                                                                                                                                                                                                                           |
| `query`      | `false` | `true` (React), or `{ framework?: 'react' \| 'vue' \| 'svelte' \| 'solid' /* default 'react' */; queryMethods?: HttpMethod[] /* default ['get', 'query'] */; infinite?: Record<name, { pageParam }>; invalidates?: Record<name, string[]> }`. Keys are generated operation names or `operationId`s; invalidation targets are operation names/ids or tags. See [data fetching](data-fetching.md). |
| `reactQuery` | `false` | Alias of `query` with `framework: 'react'` (same options except `framework`). Set either `query` or `reactQuery`.                                                                                                                                                                                                                                                                                |
| `swr`        | `false` | `true`, or `{ queryMethods?, infinite?, invalidates? }` as for `query`: SWR hooks. Cannot be combined with `query`/`reactQuery`.                                                                                                                                                                                                                                                                 |
| `validation` | `false` | `'zod'`, `'valibot'`, `'arktype'`, or `{ library: 'zod' \| 'valibot' \| 'arktype'; response?: boolean (true); request?: boolean (false) }`.                                                                                                                                                                                                                                                      |

## `naming`

| Option        | Values                                                   | Default      |
| ------------- | -------------------------------------------------------- | ------------ |
| `operations`  | `camelCase`, `PascalCase`, `snake_case`, `preserve`      | `camelCase`  |
| `models`      | `PascalCase`, `camelCase`, `snake_case`, `preserve`      | `PascalCase` |
| `files`       | `kebab-case`, `camelCase`, `PascalCase`, `snake_case`    | `kebab-case` |
| `parameters`  | `preserve` (wire names, quoted when needed), `camelCase` | `preserve`   |
| `inputSuffix` | any non-empty string                                     | `Input`      |

`inputSuffix` names the request-side variants created by `types.readWrite: 'split'` (`Pet` → `PetInput`).

Operation names come from `operationId`, or from the method and path (`GET /pets/{id}` → `getPetsById`). Collisions get numeric suffixes and a `naming/collision` warning. Use the `operationName`/`modelName` plugin hooks for custom rules.

## `types`

| Option               | Default    |                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enums`              | `'union'`  | `'const'` additionally emits `export const Status = { Active: 'active', … } as const` (member names from `x-enum-varnames`/`x-enumNames` when present).                                                                                                                                      |
| `readonlyProperties` | `true`     | `readonly` modifier for `readOnly` properties in response types.                                                                                                                                                                                                                             |
| `readWrite`          | `'split'`  | `'split'`: models that have `readOnly` or `writeOnly` properties (directly or through the models they contain) get a request variant without `readOnly` properties (`PetInput`), and response types leave out `writeOnly` properties. `'merged'`: one type for both, as in earlier versions. |
| `dates`              | `'string'` | `'Date'` types `format: date` and `date-time` as `Date`: responses are converted after parsing, request bodies are converted back (`date` → `YYYY-MM-DD` in UTC) before sending. Date parameters (path, query, header, cookie) take `Date` values and are encoded the same way.              |

## `dashboard`

| Option               | Default       |                                                                                                         |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `host`               | `'127.0.0.1'` | Non-loopback hosts require `allowNetworkAccess: true`.                                                  |
| `port`               | `4400`        | The next free port is used when taken (unless `--port` is given). `0` picks any free port.              |
| `allowNetworkAccess` | `false`       |                                                                                                         |
| `usage.include`      | `['src']`     | Directories or files scanned for usage.                                                                 |
| `usage.exclude`      | `[]`          | Path fragments to skip (`node_modules`, build directories and the output directory are always skipped). |

## `lint`

| Option  | Default | Description                                                                                                                                                                                            |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rules` | `{}`    | Severity per rule of `swaggerz lint`: `'off'`, `'info'`, `'warning'` or `'error'`, e.g. `{ 'operation-id': 'error', 'unused-model': 'off' }`. Unknown rule names are rejected. See [linting](lint.md). |

## `plugins` and `hooks`

`plugins` is an array of [plugins](plugins.md). Each entry is a plugin object, a module reference (`'./plugins/my-plugin.mjs'` or a package name), or a tuple `[reference, options]`. A referenced module's default export is either a plugin object or a factory function called with the options. References are resolved from the config file's directory (relative paths, `file:` URLs and packages, including their `exports`); failures are reported as `config/plugin-load-failed`. `hooks` accepts the same hooks inline (it behaves like a plugin named `config.hooks` that runs after the default plugin group).

## `$schema`

Ignored by swaggerz; lets editors find the JSON Schema in JSON and YAML configs.

## Environment variables

| Variable                    | Overrides          |
| --------------------------- | ------------------ |
| `SWAGGERZ_SPEC_INPUT`       | `spec.input`       |
| `SWAGGERZ_SPEC_VERSION`     | `spec.version`     |
| `SWAGGERZ_OUTPUT_DIRECTORY` | `output.directory` |
| `SWAGGERZ_OUTPUT_LANGUAGE`  | `output.language`  |
| `SWAGGERZ_CLIENT_ADAPTER`   | `client.adapter`   |
| `SWAGGERZ_CLIENT_BASE_URL`  | `client.baseUrl`   |

The prefix is derived from the CLI name. `--verbose` lists which variables were applied.
