# Configuration reference

The config file is `swaggerz.config.ts` (also `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`) in the working directory, or the file passed with `--config`. Relative paths are resolved from the config file's directory.

```ts
import { defineConfig } from 'swaggerz';

export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
});
```

A config can also export a function receiving `{ command }` (`'generate'`, `'validate'`, `'dashboard'`, …), synchronously or asynchronously:

```ts
export default defineConfig(async ({ command }) => ({
  spec: {
    version: '3.1',
    input: command === 'dashboard' ? './openapi.yaml' : 'https://api.example.com/openapi.json',
  },
}));
```

**Loading.** Config files are imported with Node's module loader; TypeScript configs use Node's built-in type stripping (Node.js ≥ 22.18). They are trusted code executed with the CLI's permissions. Only erasable TypeScript syntax is allowed (no `enum`, `namespace`, parameter properties) and relative imports need file extensions.

**Precedence.** Defaults < config file < environment variables < CLI flags (`--no-clean`).

## `spec`

| Option           | Type                                | Default    |                                                                                                       |
| ---------------- | ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `version`        | `'2.0' \| '3.0' \| '3.1' \| 'auto'` | required   | The family the document must declare. A mismatch is an error; `'auto'` accepts any supported version. |
| `input`          | `string`                            | required   | Local path or `http(s)` URL of a JSON or YAML document.                                               |
| `refs`           | object                              |            | See below.                                                                                            |
| `fetch.headers`  | `Record<string, string>`            | `{}`       | Sent only to the origin of `input` (e.g. `Authorization` for a private spec).                         |
| `fetch.timeout`  | `number` (ms)                       | `30000`    | Per request.                                                                                          |
| `fetch.maxBytes` | `number`                            | `52428800` | Maximum document size.                                                                                |

### `spec.refs`

External `$ref`s are resolved according to a policy:

| `external`          | Local files                 | Remote URLs                                        |
| ------------------- | --------------------------- | -------------------------------------------------- |
| `'none'`            | refused                     | refused                                            |
| `'local'` (default) | inside `allowedDirectories` | only same-origin as a remote `input`               |
| `'remote'`          | inside `allowedDirectories` | hosts in `allowedHosts` (exact or `*.example.com`) |

`allowedDirectories` defaults to the project root and the directory of the input file. Symbolic links are resolved before checking. Remote documents can never reference local files. Redirects are checked against the same policy. Each blocked reference is reported with a hint showing which option to change.

## `output`

| Option            | Type                           | Default                 |                                                                                                                                                                    |
| ----------------- | ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `directory`       | `string`                       | `'./src/generated/api'` | Must not contain the project root, the config file or the spec.                                                                                                    |
| `language`        | `'typescript' \| 'javascript'` | `'typescript'`          |                                                                                                                                                                    |
| `declarations`    | `boolean`                      | `true`                  | JavaScript only: `.d.ts` next to each module. Runtime modules always have declarations.                                                                            |
| `importExtension` | `'.js' \| '.ts' \| 'none'`     | `'.js'`                 | `.js` works with Node ESM, TypeScript `nodenext`/`bundler` and all major bundlers. `.ts` requires `allowImportingTsExtensions`. `none` suits older webpack setups. |
| `clean`           | `boolean`                      | `true`                  | Delete generated files that are no longer produced (never hand-edited ones).                                                                                       |
| `barrel`          | `boolean`                      | `true`                  | `index`, `react-query/index`, `zod/index`.                                                                                                                         |
| `groupBy`         | `'tag' \| 'none'`              | `'tag'`                 | Operation directories by first tag (`default` when untagged) or a single `operations/` directory.                                                                  |
| `models`          | `'all' \| 'used'`              | `'all'`                 | `'used'` omits schemas no operation references.                                                                                                                    |
| `banner`          | `string`                       |                         | Additional `//` header lines.                                                                                                                                      |
| `moduleFormat`    | `'esm'`                        | `'esm'`                 | Reserved.                                                                                                                                                          |

## `client`

| Option               | Type                     | Default                                                |                                                                                                             |
| -------------------- | ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `adapter`            | `'fetch' \| 'axios'`     | `'fetch'`                                              |                                                                                                             |
| `baseUrl`            | `string`                 | first `servers` entry (variables replaced by defaults) | Compiled into `client.ts`. For environment-specific URLs prefer `client.setConfig({ baseUrl })` at runtime. |
| `headers`            | `Record<string, string>` | `{}`                                                   | Default headers.                                                                                            |
| `timeout`            | `number` (ms)            | none                                                   | Default timeout.                                                                                            |
| `includeCredentials` | `boolean`                | `false`                                                | `credentials: 'include'` (fetch) / `withCredentials` (axios).                                               |
| `responseStyle`      | `'data' \| 'full'`       | `'data'`                                               | `'full'` resolves with `ApiResponse<Data, Status>` unions.                                                  |

## `features`

| Option       | Default |                                                                                                                                                                                                                                                                            |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsdoc`      | `true`  | Documentation comments (deprecations are always kept).                                                                                                                                                                                                                     |
| `reactQuery` | `false` | `true`, or `{ queryMethods?: HttpMethod[]; infinite?: Record<name, { pageParam }>; invalidates?: Record<name, string[]> }`. Keys are generated operation names or `operationId`s; invalidation targets are operation names/ids or tags. See [React Query](react-query.md). |
| `validation` | `false` | `'zod'` or `{ library: 'zod'; response?: boolean (true); request?: boolean (false) }`.                                                                                                                                                                                     |

## `naming`

| Option       | Values                                                   | Default      |
| ------------ | -------------------------------------------------------- | ------------ |
| `operations` | `camelCase`, `PascalCase`, `snake_case`, `preserve`      | `camelCase`  |
| `models`     | `PascalCase`, `camelCase`, `snake_case`, `preserve`      | `PascalCase` |
| `files`      | `kebab-case`, `camelCase`, `PascalCase`, `snake_case`    | `kebab-case` |
| `parameters` | `preserve` (wire names, quoted when needed), `camelCase` | `preserve`   |

Operation names come from `operationId`, or from the method and path (`GET /pets/{id}` → `getPetsById`). Collisions get numeric suffixes and a `naming/collision` warning. Use the `operationName`/`modelName` plugin hooks for custom rules.

## `types`

| Option               | Default   |                                                                                                                                                         |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enums`              | `'union'` | `'const'` additionally emits `export const Status = { Active: 'active', … } as const` (member names from `x-enum-varnames`/`x-enumNames` when present). |
| `readonlyProperties` | `true`    | `readonly` modifier for `readOnly` properties in response types.                                                                                        |

## `dashboard`

| Option               | Default       |                                                                                                         |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `host`               | `'127.0.0.1'` | Non-loopback hosts require `allowNetworkAccess: true`.                                                  |
| `port`               | `4400`        | The next free port is used when taken (unless `--port` is given). `0` picks any free port.              |
| `allowNetworkAccess` | `false`       |                                                                                                         |
| `usage.include`      | `['src']`     | Directories or files scanned for usage.                                                                 |
| `usage.exclude`      | `[]`          | Path fragments to skip (`node_modules`, build directories and the output directory are always skipped). |

## `plugins` and `hooks`

`plugins` is an array of [plugins](plugins.md); `hooks` accepts the same hooks inline (it behaves like a plugin named `config.hooks` that runs after the default plugin group).

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
