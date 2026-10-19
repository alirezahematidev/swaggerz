# swaggerz

Generate fully typed, documented, tree-shakeable API clients from **Swagger 2.0**, **OpenAPI 3.0** and **OpenAPI 3.1** specifications.

- **One module per operation.** Applications bundle only the endpoints they import. Measured with esbuild, Rollup and Vite: one operation of a 1,000-operation client costs ~11 KB (shared runtime) + ~0.2 KB per extra operation.
- **TypeScript or JavaScript.** Strict TypeScript, or plain ES modules with JSDoc and optional `.d.ts` files — same runtime behavior.
- **Fetch or axios.** Interchangeable transports behind one contract; bring your own axios instance and interceptors.
- **Optional TanStack Query v5 hooks**, query/mutation option factories, key factories, infinite queries and invalidation — never imported unless enabled.
- **Optional Zod v4 schemas** and runtime validation of requests and responses.
- **Self-contained output.** The generated client has no runtime dependency on this package.
- **Safe, deterministic regeneration.** Identical input produces identical output; unchanged files are not rewritten; files you own are never overwritten.
- **Local dashboard** to explore operations, models, dependency graphs, static usage in your code and generation diffs.
- **Plugin API** with typed lifecycle hooks.

> **Package name.** The package is configured as `swaggerz` in `package.json`. The unscoped `swaggerz` name is already taken on the npm registry, so it must be published under a scope (for example `@your-scope/swaggerz`) — the name is read from `package.json` everywhere, so only that file changes. The CLI command stays `swaggerz`.

## Contents

- [Supported specifications](#supported-specifications)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [CLI](#cli)
- [Generated code](#generated-code)
- [HTTP client: fetch and axios](#http-client-fetch-and-axios)
- [React Query](#react-query)
- [Runtime validation with Zod](#runtime-validation-with-zod)
- [Tree-shaking](#tree-shaking)
- [JavaScript output and JSDoc](#javascript-output-and-jsdoc)
- [Dashboard](#dashboard)
- [Plugins and customization](#plugins-and-customization)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Security](#security)
- [Contributing](#contributing)

Detailed guides live in [`docs/`](docs): [architecture](docs/architecture.md), [design decisions](docs/decisions.md), [configuration](docs/configuration.md), [generated code](docs/generated-code.md), [React Query](docs/react-query.md), [plugins](docs/plugins.md), [dashboard](docs/dashboard.md), [compatibility](docs/compatibility.md), [diagnostics](docs/diagnostics.md), [benchmarks](docs/benchmarks.md) and the [roadmap](docs/roadmap.md). Runnable [examples](examples) cover React with TanStack Query, a plain JavaScript Node.js project and custom plugins.

## Supported specifications

| Family  | Versions | Notes                                                                                                                                        |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Swagger | 2.0      | `body`/`formData` parameters, `collectionFormat`, `consumes`/`produces`, `securityDefinitions`, `x-nullable`, `discriminator`                |
| OpenAPI | 3.0.x    | `nullable`, `oneOf`/`anyOf`/`allOf`, discriminators, `content` parameters, `style`/`explode`, callbacks reported as skipped                  |
| OpenAPI | 3.1.x    | JSON Schema 2020-12 types (`type: [..., "null"]`), `const`, `prefixItems`, `$ref` siblings, `$defs`, `$anchor`, webhooks reported as skipped |

The configured `spec.version` is enforced: a 3.0 document is rejected when the config says `'3.1'` instead of being reinterpreted. Each version has its own adapter; all of them produce the same normalized intermediate representation. Features that cannot be represented are reported as diagnostics — see [compatibility](docs/compatibility.md) for the full matrix.

Input can be JSON or YAML, local or `http(s)`, split across files with external `$ref`s (subject to a [reference policy](docs/configuration.md#specrefs)).

## Installation

Requires **Node.js 22.18 or later** (TypeScript config files are loaded with Node's built-in type stripping).

```sh
npm install --save-dev swaggerz
# or: yarn add --dev swaggerz · pnpm add --save-dev swaggerz
```

The generated client needs no runtime dependency on `swaggerz`. Depending on the options you enable, your application needs:

| Option                       | Dependency                       | Tested versions |
| ---------------------------- | -------------------------------- | --------------- |
| `client.adapter: 'axios'`    | `axios`                          | 1.0.0 – 1.x     |
| `features.reactQuery`        | `@tanstack/react-query`, `react` | 5.0.0 – 5.x     |
| `features.validation: 'zod'` | `zod`                            | 4.0.15 – 4.x    |
| TypeScript output            | `typescript`                     | 5.0 – 7.x       |

## Quick start

```sh
npx swaggerz init        # creates swaggerz.config.ts (detects your spec file and its version)
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
import { client, getPetById, isApiError } from './generated/api';

client.setConfig({
  baseUrl: 'https://petstore3.swagger.io/api/v3',
  auth: { api_key: () => sessionStorage.getItem('apiKey') ?? undefined },
});

try {
  const pet = await getPetById({ petId: 10 }, { timeout: 5_000 });
  console.log(pet.name);
} catch (error) {
  if (isApiError(error)) console.error(error.status, error.body);
}
```

## Configuration

`defineConfig()` gives full autocomplete and type checking. The config may also export a function `(env) => config` (sync or async), where `env.command` is the CLI command being run. All options are validated strictly — unknown keys are rejected with a "did you mean" hint.

| Option                                                          | Default                                        | Description                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `spec.version`                                                  | — (required)                                   | `'2.0'`, `'3.0'`, `'3.1'` or `'auto'`                                                      |
| `spec.input`                                                    | — (required)                                   | File path (relative to the config file) or `http(s)` URL                                   |
| `spec.refs.external`                                            | `'local'`                                      | `'none'`, `'local'` (files in allowed directories) or `'remote'` (plus allow-listed hosts) |
| `spec.refs.allowedDirectories`                                  | project root + spec directory                  | Directories external `$ref`s may read                                                      |
| `spec.refs.allowedHosts`                                        | `[]`                                           | Hosts remote `$ref`s may fetch (`'*.example.com'` supported)                               |
| `spec.fetch`                                                    | 30 s timeout, 50 MiB                           | `headers`, `timeout`, `maxBytes` for remote documents                                      |
| `output.directory`                                              | `./src/generated/api`                          | Output directory                                                                           |
| `output.language`                                               | `'typescript'`                                 | `'typescript'` or `'javascript'`                                                           |
| `output.declarations`                                           | `true`                                         | Emit `.d.ts` next to JavaScript files                                                      |
| `output.importExtension`                                        | `'.js'`                                        | `'.js'`, `'.ts'` or `'none'` in relative imports                                           |
| `output.clean`                                                  | `true`                                         | Delete generated files that are no longer produced                                         |
| `output.barrel`                                                 | `true`                                         | Emit `index` barrels                                                                       |
| `output.groupBy`                                                | `'tag'`                                        | Operation directories by first tag, or `'none'`                                            |
| `output.models`                                                 | `'all'`                                        | `'all'` or only `'used'` models                                                            |
| `output.banner`                                                 | —                                              | Extra header comment for every file                                                        |
| `client.adapter`                                                | `'fetch'`                                      | `'fetch'` or `'axios'`                                                                     |
| `client.baseUrl`                                                | first server                                   | Compiled default; change at runtime with `client.setConfig()`                              |
| `client.headers`, `client.timeout`, `client.includeCredentials` | —                                              | Client defaults                                                                            |
| `client.responseStyle`                                          | `'data'`                                       | `'data'` resolves with the body; `'full'` with `{ data, status, headers }`                 |
| `features.reactQuery`                                           | `false`                                        | `true` or `{ queryMethods, infinite, invalidates }`                                        |
| `features.validation`                                           | `false`                                        | `'zod'` or `{ library: 'zod', response, request }`                                         |
| `features.jsdoc`                                                | `true`                                         | Generate documentation comments                                                            |
| `naming.operations` / `models` / `files` / `parameters`         | camelCase / PascalCase / kebab-case / preserve | Naming conventions                                                                         |
| `types.enums`                                                   | `'union'`                                      | `'union'` literal types, or `'const'` objects as well                                      |
| `types.readonlyProperties`                                      | `true`                                         | `readonly` for `readOnly` properties                                                       |
| `dashboard`                                                     | `127.0.0.1:4400`                               | `host`, `port`, `allowNetworkAccess`, `usage.include`/`exclude`                            |
| `plugins`, `hooks`                                              | —                                              | See [plugins](#plugins-and-customization)                                                  |

Environment variables override the config file: `SWAGGERZ_SPEC_INPUT`, `SWAGGERZ_SPEC_VERSION`, `SWAGGERZ_OUTPUT_DIRECTORY`, `SWAGGERZ_OUTPUT_LANGUAGE`, `SWAGGERZ_CLIENT_ADAPTER`, `SWAGGERZ_CLIENT_BASE_URL`. The full reference is in [docs/configuration.md](docs/configuration.md).

Config files are **trusted project code** and run with the permissions of the CLI. TypeScript configs are imported with Node's own loader (no `eval`), so they may only use erasable TypeScript syntax (no `enum`, `namespace` or parameter properties); relative imports need explicit extensions.

## CLI

```
swaggerz <command> [options]

  init        Create a swaggerz.config.ts file for this project.
  generate    Generate the API client from the specification.  (alias: gen)
  validate    Validate config and spec and generate in memory, without writing files.
  inspect     Print a summary of the operations and models that would be generated.
  dashboard   Start the local dashboard.
  clean       Remove generated files (only files recorded in the output manifest).
  doctor      Check Node.js, config, spec, output directory and dependency versions.
```

| Option                                                                                        | Commands            | Description                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `-c, --config <path>`                                                                         | all                 | Config file (default: `swaggerz.config.{ts,mts,cts,js,mjs,cjs}` in the working directory) |
| `--cwd <dir>`                                                                                 | all                 | Working directory                                                                         |
| `--json`                                                                                      | all                 | One machine-readable JSON document on stdout                                              |
| `--verbose` / `-q, --quiet`                                                                   | all                 | Show notes and timings / only errors                                                      |
| `--color` / `--no-color`                                                                      | all                 | Force or disable color (`NO_COLOR` is respected)                                          |
| `-w, --watch`                                                                                 | `generate`          | Regenerate when the spec, any referenced file or the config changes                       |
| `--dry-run`                                                                                   | `generate`, `clean` | Show changes without writing                                                              |
| `--force`                                                                                     | `generate`, `clean` | Overwrite files the generator does not own; delete hand-edited generated files            |
| `--no-clean`                                                                                  | `generate`          | Keep generated files that are no longer produced                                          |
| `--operations`, `--models`, `--filter <text>`                                                 | `inspect`           | Narrow the listing                                                                        |
| `--host`, `--port`, `--open`                                                                  | `dashboard`         | Bind address and browser opening                                                          |
| `--spec`, `--spec-version`, `--output`, `--language`, `--adapter`, `--react-query`, `--force` | `init`              | Initial values                                                                            |

Exit codes: `0` success · `1` failed checks, invalid specification or generation errors · `2` invalid usage or configuration · `3` internal error.

Diagnostics point to the source: `error ref/missing-target $ref "#/components/schemas/Categry" … at openapi.yaml:478:9 (#/components/schemas/NewPet/properties/category)`.

## Generated code

```
src/generated/api/
├── index.ts                 # optional barrel: client, runtime exports, every model and operation
├── client.ts                # the default client instance and RequestOptions
├── runtime/                 # transport contract, serialization, errors (emitted, no dependency)
├── models/pet.ts            # one module per model
├── pet/get-pet-by-id.ts     # one module per operation, grouped by tag
├── react-query/             # only when enabled (separate barrel)
├── zod/                     # only when enabled (separate barrel)
└── .swaggerz-manifest.json      # files owned by the generator (with content hashes)
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

/** Error rejected by {@link getPetById}. */
export type GetPetByIdError = OperationError<GetPetByIdErrorBody>;

/**
 * Find pet by ID.
 *
 * Returns a single pet.
 *
 * @remarks `GET /pet/{petId}` (operationId `getPetById`)
 * @param params - Request parameters.
 * @param options - Per-request options: `signal`, `timeout`, `headers`, `client`.
 * @returns `200` successful operation
 * @throws {@link ApiError} `400` Invalid ID supplied; `404` Pet not found
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
```

Highlights (details in [docs/generated-code.md](docs/generated-code.md)):

- **Parameters** of every location (path, query, header, cookie) and the request body are one `params` object. Optional parameters accept `undefined`. Property names keep wire names by default (`params['X-Request-ID']`); `naming.parameters: 'camelCase'` converts them. Name clashes between locations are resolved (`id` and `queryId`).
- **Serialization** follows the spec: `form`/`simple`/`label`/`matrix`/`spaceDelimited`/`pipeDelimited`/`deepObject`, `explode`, `allowReserved`, JSON `content` parameters, JSON/urlencoded/multipart/binary/text bodies.
- **Responses** are typed from the success (2xx) responses; bodiless responses resolve with `undefined`/`void`. Binary responses are `Blob`s.
- **Errors**: non-2xx responses reject with `ApiError<Body>` (`status`, `body`, `headers`, `response`, `operationId`); network failures, timeouts, malformed JSON and validation failures reject with `RequestError` (`kind`). Aborting with an `AbortSignal` rethrows the original abort error.
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

HTTP errors still reject with `ApiError`; the `AxiosError` is preserved as `error.cause` and the `AxiosResponse` as `error.response`. Only the selected adapter is generated, so axios is never bundled with the fetch adapter. Bodies are serialized by the generated runtime before reaching axios.

## React Query

Enable TanStack Query v5 support:

```ts
features: {
  reactQuery: {
    queryMethods: ['get'],                                 // default
    infinite: { listPets: { pageParam: 'cursor' } },       // infinite query hooks
    invalidates: { createPet: ['listPets'], deletePet: ['pet'] }, // operation names or tags
  },
},
```

For each query operation: `use<Name>(params, options?, queryClient?)`, `<name>QueryOptions(params, requestOptions?)`, `<name>QueryKey(params)`; for mutations: `use<Name>(options?, queryClient?)` and `<name>MutationOptions()`; per tag, a key factory such as `petKeys.all`.

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

Query keys contain a static prefix (tag, operation) and **all** request parameters, so different parameters never share cache entries. React Query's `AbortSignal` is passed to the request, so cancelled queries cancel the HTTP request. `TData` is inferred from `select`, and errors are typed as the operation's `ApiError | RequestError`. Hooks live in `react-query/`; operation modules and the main barrel never import React. See [docs/react-query.md](docs/react-query.md).

## Runtime validation with Zod

```ts
features: { validation: { library: 'zod', response: true, request: true } },
```

Generates `zod/<model>.ts` (`PetSchema`, …) and validates successful responses (and request bodies when `request: true`) in every operation. Failures reject with `RequestError` (`kind: 'validation'`, `cause` = `ZodError`); invalid request bodies are never sent. Unknown properties are preserved (`z.looseObject`); `additionalProperties: false` is enforced. Formats and patterns are documentation only and are not enforced. Recursive and mutually recursive schemas use Zod 4 getters. Zod is only imported by `zod/` modules and, when validation is enabled, by operations.

## Tree-shaking

Each operation and model is its own ES module with no top-level side effects, imports are static, and there is no registry of all endpoints. Measured on a generated client with **1,000 operations and 602 models** ([test](tests/integration/treeshake/bundle.test.ts), minified, not gzipped):

| Bundle                                              |     Size |
| --------------------------------------------------- | -------: |
| 1 operation (direct import, esbuild)                |  11.4 KB |
| 3 operations via the barrel (esbuild)               |  11.8 KB |
| 3 operations via the barrel (Vite production build) |  15.5 KB |
| 1 React Query hook, excluding TanStack Query itself |  11.9 KB |
| Entire client                                       | 214.8 KB |

The ~11 KB base is the shared runtime (serialization, errors, client, transport). The tests assert that only the imported operations remain in esbuild, Rollup and Vite bundles.

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
- **Usage** — statically scans `dashboard.usage.include` (default `src`) with the TypeScript compiler API to find which generated operations, hooks and models your code imports. Dynamic imports and escaping namespace objects are reported as _undetermined_, never as unused. Requires `typescript` 5.x or 6.x in your project.
- **Generate** — preview every create/update/delete with diffs, then write after confirmation.

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
| Usage scan says TypeScript is unavailable                   | Install `typescript` 5.x or 6.x (TypeScript 7 has no JavaScript compiler API)                                                                       |
| Cookie parameters are not sent in browsers                  | Browsers forbid the `Cookie` header; the browser sends cookies itself (`includeCredentials: true`)                                                  |
| `swaggerz doctor`                                           | Checks all of the above in one go                                                                                                                   |

## Known limitations

- `readOnly`/`writeOnly` properties are not split into separate request and response types; a required `readOnly` property must also be provided in request bodies.
- `format: date-time` and similar formats are typed as `string`; values are not converted to `Date`. `int64` maps to `number`.
- `not`, `if`/`then`/`else`, `dependentSchemas` and `$dynamicRef` are ignored with a warning (types may be wider than the schema); validation-only keywords (`propertyNames`, `contains`, …) are noted.
- Webhooks and callbacks are not generated. Operation- and path-level `servers` are not used for the base URL.
- When a request body offers several media types, the client uses one (JSON first, then multipart, urlencoded, text, binary). XML bodies are not serialized — pass a string.
- Only 2xx responses resolve; a declared `304` rejects with `ApiError`.
- `$id`-based references are resolved for absolute ids; relative references inside nested `$id` scopes resolve against the document.
- Watch mode recompiles the whole specification on change (only changed files are written).
- Usage scanning is static and requires TypeScript 5.x/6.x.

## Security

- Generation never executes code from specifications. Descriptions, examples and names end up in comments, string literals and identifiers through dedicated escaping and sanitization.
- External `$ref`s are restricted by default to the project and spec directories; remote references need an explicit host allow-list, redirects are re-checked, credentials from `spec.fetch.headers` are only sent to the origin of `spec.input`, and remote documents may never reference local files.
- The writer only overwrites or deletes files it owns (manifest), refuses unsafe output directories (the project root, the config or spec file) and refuses to write through symbolic links that leave the output directory.
- The dashboard binds to loopback, requires a per-session token, rejects foreign `Host` and `Origin` headers, uses a strict Content Security Policy and renders spec content as text.
- Config files and plugins are trusted code.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `yarn install`, `yarn check` (types, lint, format, tests), add a changeset with `yarn changeset` for user-facing changes.

## License

[MIT](LICENSE)
