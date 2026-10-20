# What to build next

Status: proposals, nothing is committed. Ordered by value for effort within each group. This complements [docs/roadmap.md](docs/roadmap.md) (the short list) and [website.md](website.md) (docs site). Effort: **S** ≈ days, **M** ≈ one to two weeks, **L** ≈ several weeks.

## First: ship 0.1

None of the features below matter until people can install the package.

- Push `main` and get CI green on Linux, macOS and Windows (it has never run; Linux and Windows are untested).
- Create the npm package, configure trusted publishing, tag `v0.1.0` ([CONTRIBUTING.md](CONTRIBUTING.md#releases)).
- Decide the docs domain and deploy a first version of the site (even the docs folder rendered as is), so the README can link to it.

## At a glance

| #   | Feature                                              | Why it matters                                                               | Effort |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| 1   | `generate --check` for CI                            | Fail a pull request when committed output is stale                           | S      |
| 2   | Errors typed by status                               | `if (error.status === 404) error.body` narrows to the 404 body               | S–M    |
| 3   | Retry and token-refresh middleware                   | The two things every production client re-implements                         | M      |
| 4   | "What changed" in the dashboard                      | Badges say _Updated_; this shows how                                         | S–M    |
| 5   | Live reload for remote specs                         | URL inputs are not watched today                                             | S      |
| 6   | MCP server for coding agents                         | Agents call the generated client correctly instead of guessing from the spec | S–M    |
| 7   | OpenAPI 3.2                                          | Current spec version; rejected today                                         | M–L    |
| 8   | Streaming responses (SSE, JSON Lines)                | Typed `for await` over event streams, LLM-style APIs                         | M      |
| 9   | Mocks: MSW handlers and data factories               | Tests, Storybook and offline development from the same spec                  | M      |
| 10  | `swaggerz diff`: breaking-change detection           | Catch API breaks in CI before clients do                                     | M–L    |
| 11  | Try it in the dashboard                              | Send real requests and check responses against the spec                      | L      |
| 12  | TanStack Query for Vue, Svelte and Solid; SWR        | The same hooks for the other big frameworks                                  | M each |
| 13  | OpenAPI Overlays                                     | Patch third-party specs without forking them                                 | M      |
| 14  | Several APIs in one config                           | Monorepos and apps that talk to more than one backend                        | M      |
| 15+ | bigint, XML, server types, incremental compile, more | See [Later](#later)                                                          | M–L    |

## Now

Small changes with an outsized effect on everyday use.

### 1. `generate --check`

**Why.** Teams that commit generated code need CI to fail when someone changes the spec and forgets to regenerate. Today `--dry-run` lists the changes but exits 0.

**What.**

```sh
swaggerz generate --check   # writes nothing; exit 1 and list the files that differ when the output is stale
```

With `--json`, the stale files and their change kinds are in the output. A recipe in the docs shows it in GitHub Actions.

**Builds on.** `planWrite()` in `src/output/writer.ts`, already used by `--dry-run` and the dashboard's generation status.

**Done when.** Exit codes are covered by the CLI tests for up-to-date, stale, missing and hand-edited output.

### 2. Errors typed by status

**Why.** `ApiError<Body>` has `status: number` and a body typed as the union of every error response, so `status === 404` does not narrow the body. This is the most common complaint about generated clients.

**What.**

```ts
try {
  await getPetById({ petId });
} catch (error) {
  if (isApiError(getPetById, error) && error.status === 404) {
    error.body; // NotFound, not NotFound | ValidationProblem | unknown
  }
}
```

Each operation exports `GetPetByIdApiError = ApiError<404, NotFound> | ApiError<422, Problem> | ApiError<number, unknown>` (the last for `default` and undeclared statuses). `ApiError` gains a status type parameter; `isApiError(operation, error)` narrows to that operation's union. `responseStyle: 'full'` gets the same treatment for success statuses.

**Builds on.** `planOperation()` already sorts responses by status; `src/templates/runtime/errors.ts`.

**Risk.** Changes the `ApiError` generic parameters. Fine before 1.0, but it needs a changelog entry and a migration note.

### 3. Retry and token-refresh middleware

**Why.** Retries with backoff and "refresh the token once on 401, then replay" are written by hand in almost every app, and often wrongly (retrying non-idempotent requests, retry storms, refresh races).

**What.** Opt-in helpers in the generated runtime, tree-shaken when unused:

```ts
import { client, retry, refreshAuth } from './generated/api';

client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504], respectRetryAfter: true }));
client.use(
  refreshAuth({
    scheme: 'bearerAuth',
    refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
  }),
);
```

`retry` only retries idempotent methods unless told otherwise, uses jittered exponential backoff, honours `Retry-After` and the caller's `AbortSignal`. `refreshAuth` coalesces concurrent refreshes into one.

**Builds on.** The middleware contract (`onRequest`, `onResponse`, `onError` with recovery). Replaying a request needs one addition to the contract: middleware can ask the client to re-send.

**Done when.** Runtime tests cover backoff timing (fake timers), `Retry-After`, abort during a wait, and a burst of concurrent 401s producing exactly one refresh.

### 4. "What changed" in the dashboard

**Why.** Live reload marks operations and models as _Updated_ but does not say what changed. That is the next question every time.

**What.** On an updated item, a **Changes** tab: the schema tree with added, removed and changed properties marked (type, required, nullable, enum values, constraints), and a unified diff of the generated code between the version the dashboard started with and now.

**Builds on.** `ChangeTracker` (`src/dashboard/changes.ts`) keeps fingerprints; it would also keep the baseline IR and generated files of changed items (memory grows only with what changed). `diffHunks()` and the Generate page's diff view already exist.

**Done when.** The live reload integration tests assert the diff for a renamed property, a new required parameter and a narrowed enum.

### 5. Live reload for remote specs

**Why.** `spec.input: https://…` is common (specs served by the backend in development), and it gets neither `--watch` nor dashboard live reload.

**What.** Poll with conditional requests (`ETag`/`If-None-Match`, `Last-Modified`) every few seconds (configurable), under the same reference policy and size limits as a normal fetch. A changed response triggers the same reload path as a file change.

**Builds on.** `src/loader/fetch.ts`, `FileWatcher` (a sibling `RemoteWatcher` with the same `onChange` contract).

**Open question.** Default interval and whether polling is on by default for loopback URLs only.

## Next

Larger features that open new use cases.

### 6. MCP server for coding agents

**Why.** A growing share of client code is written by coding agents (Claude Code, Cursor, Copilot and others). To call an API correctly they need the exact generated function, its import path and its parameter shape. Today they either read the raw specification (large, and nothing in it ties an endpoint to the generated names) or search the generated output. An MCP server answers from the same compiled IR as the generated code, so the agent writes calls that match the client and stops inventing endpoints.

**What.** `swaggerz mcp`, a stdio MCP server that the agent's client starts in the project:

```json
{ "mcpServers": { "swaggerz": { "command": "npx", "args": ["swaggerz", "mcp"] } } }
```

| Tool                 | Returns                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `api_overview`       | Title, versions, counts, tags, generation status, a diagnostics summary                                                        |
| `find_operations`    | Operations matching words, a tag, a method or a model: name, `METHOD /path`, summary, the import line                          |
| `get_operation`      | The generated signature (parameter and response types as TypeScript), error statuses, auth, React Query hooks, an example call |
| `get_model`          | The generated type and where it is used                                                                                        |
| `check`              | Diagnostics, and whether the generated output is up to date                                                                    |
| `preview_generation` | The files a generation would create, change or delete, with diffs                                                              |
| `generate`           | Writes the output under the manifest rules; only available with `--allow-write`                                                |
| `find_usages`        | Where the application uses an operation or model (the dashboard's usage scan)                                                  |

Generated modules are also exposed as resources (`swaggerz://operations/getPetById`), and the live reload watcher notifies the client when the specification or config changes, so the agent never works from a stale index.

**Builds on.** Nearly everything already exists in `DashboardState` (overview, details, code variants, preview, generate, usage) and the live reload watcher. Moving that into a shared, experimental `swaggerz/service` module (`createProjectService({ configFile, cwd })`) makes the dashboard and the MCP server two thin adapters over one service, and keeps them in step. The MCP SDK is loaded only by this command (an optional dependency), so other users install nothing extra.

**Risk.**

- Prompt injection: descriptions and examples in a specification are untrusted text that ends up in the agent's context. Tools return them as clearly delimited data fields, and the tool descriptions say they are data, not instructions.
- Writes: `generate` exists only when the server starts with `--allow-write`, is marked as destructive in its tool annotations, and keeps the manifest guarantees (files swaggerz does not own are never touched). Where the client supports it, the server asks the user to confirm first.
- No calls to the API itself (no "try it") until item 11's safeguards exist.
- MCP changes quickly: pin the supported protocol versions and test against the clients people use.

**Effort.** S–M for the read-only tools once the service exists; M with writes and change notifications.

**Done when.** An integration test drives the server over stdio (initialize, list tools, call each tool against the fixture specs), and the docs show a recorded agent session where `find_operations` and `get_operation` lead to a correct import and call.

### 7. OpenAPI 3.2

**Why.** 3.2 is the current OpenAPI version; documents that declare it are rejected today (`spec/unsupported-version`).

**What.** Accept `spec.version: '3.2'` and map the additions. To be confirmed against the published 3.2.0 text before implementation:

| 3.2 addition                                              | In swaggerz                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `QUERY` method and `additionalOperations` (other methods) | Operations with any method; the runtime's method type widens                       |
| `in: querystring` parameter                               | One typed object for the whole query string, serialized by its media type          |
| Sequential media types with `itemSchema`                  | Streaming responses (item 8)                                                       |
| Tag `parent` and `kind`                                   | Nested tag groups in `output.groupBy`, the dashboard and React Query key factories |
| `$self`                                                   | Base URI for reference resolution (the loader already resolves `$id` bases)        |
| OAuth 2 device authorization flow, metadata URL           | Security scheme types and the auth helper                                          |

**Builds on.** The adapter structure: a 3.2 adapter shares almost everything with 3.1 (`src/spec/openapi3`).

**Done when.** A `features-3.2.yaml` fixture covers every row and joins the compile, runtime and dashboard test matrices.

### 8. Streaming responses

**Why.** Server-sent events and JSON Lines are how LLM, notification and log APIs respond. Today such a response is a string or a `Blob`.

**What.**

```ts
for await (const event of streamOrderEvents({ orderId }, { signal })) {
  // `event` is typed from the item schema (3.2) or from `x-stream-item` / config for 3.0 and 3.1
}
```

Parsers for `text/event-stream` (event, data, id, retry, reconnection with `Last-Event-ID`), `application/jsonl` and `application/json-seq`, with per-item Zod validation when enabled. React Query gets a streamed query helper on top of TanStack's streaming support.

**Builds on.** Transports already support `parseAs: 'stream'`.

**Risk.** axios streaming in browsers is limited; the fetch transport comes first, and the docs say so.

### 9. Mocks: MSW handlers and data factories

**Why.** Frontend tests, Storybook and offline development all need fake responses that match the API. Hand-written mocks drift from the spec.

**What.** `features.mocks: 'msw'` emits:

```ts
import { handlers } from './generated/api/mocks/msw';
import { createPet } from './generated/api/mocks/factories';

server.use(...handlers({ getPetById: ({ params }) => createPet({ id: params.petId }) }));
```

Factories prefer the spec's examples, otherwise generate data that satisfies the schema (formats, enums, constraints, discriminators, recursion with a depth limit), deterministic per seed. No Faker dependency by default.

**Builds on.** The IR and the read/write split (factories produce response shapes; handlers validate request bodies with the generated Zod schemas when enabled).

**Done when.** Generated handlers serve every operation of the fixture specs, and the responses pass the generated Zod response validation.

### 10. `swaggerz diff`: breaking-change detection

**Why.** The most expensive API mistakes are unnoticed breaking changes. Generic spec-diff tools report document changes; swaggerz can report what breaks for the generated clients.

**What.**

```sh
swaggerz diff origin/main:openapi.yaml openapi.yaml --fail-on breaking --format markdown
```

It classifies changes as breaking, risky or safe for the client: a removed operation or model, a new required request parameter or property, a removed or retyped response property, a narrowed enum, a changed media type, and renamed exports in the generated code. It suggests a semver bump and outputs Markdown (for a pull-request comment) or JSON.

**Builds on.** The IR, `ChangeTracker`'s per-item fingerprints, and the request/response split (request and response sides break in opposite directions).

**Done when.** A table of fixture pairs (one per rule) is covered, and a GitHub Action example posts the report.

### 11. Try it in the dashboard

**Why.** Exploring an API is half reading and half calling it. The dashboard already shows every operation's parameters, bodies and responses; sending the request is the missing half.

**What.** A request panel on each operation: parameters and body prefilled from examples, server and auth pickers, send, and a response view with a **Spec check** (status documented, media type documented, body valid against the response schema).

**Builds on.** The runtime's serialization (so the request is byte-for-byte what the generated client sends), and a new IR-based value validator in core that `swaggerz test` and the MCP server can share.

**Risk.** Security. Requests go through the dashboard server (no CORS); it must only reach the spec's servers or explicitly allowed hosts, keep credentials in memory, never log them, and confirm before sending credentials over plain HTTP to a non-loopback host.

### 12. TanStack Query for Vue, Svelte and Solid; SWR

**Why.** React is covered; the other TanStack adapters share the same query core and the same option-factory pattern, so most of the generator carries over.

**What.** `features.reactQuery` becomes `features.query: { framework: 'react' | 'vue' | 'svelte' | 'solid' }` (keeping `reactQuery` as an alias). The framework-neutral key and option factories are shared; hooks are emitted per framework. SWR is a separate, smaller generator.

**Done when.** `pnpm compat` type-checks each adapter's oldest and newest supported versions, and each has an example project.

### 13. OpenAPI Overlays

**Why.** Third-party specs often need small fixes (a missing `operationId`, a wrong nullable, an internal endpoint to hide). Overlays describe those patches in a file instead of a fork, and keep working when the upstream spec updates.

**What.** `spec.overlays: ['./overlays/fixes.yaml']`, applying Overlay Specification 1.0 actions (JSONPath target, update, remove) before parsing, with diagnostics that point into the overlay file when a target matches nothing.

**Builds on.** The `beforeParse` stage; needs a JSONPath (RFC 9535) implementation, either a small dependency or our own bounded one.

### 14. Several APIs in one config

**Why.** Monorepos and apps with more than one backend currently need one config file and one command per API.

**What.** `defineConfig([{ name: 'billing', … }, { name: 'users', … }])`. `generate` runs them all (or `--project billing`), and the dashboard gets a project switcher. Each project keeps its own output directory and runtime, unless `output.sharedRuntime` points them at one.

**Risk.** Name collisions in a shared runtime, and plugin hooks that assume one project. Both need explicit rules.

## Later

Valuable but larger, or waiting on something else.

- **int64 as `bigint`** (opt-in): needs lossless JSON parsing. `JSON.parse` source-text access where the runtime supports it, a small fallback parser otherwise, and conversion in both directions like dates.
- **XML bodies**: serialize and parse using the schema's `xml` metadata (names, attributes, wrapped arrays, namespaces) instead of passing strings.
- **Server-side types and validators**: request and response types for route handlers (Hono, Fastify, Express), with optional Zod request validation, so the server is checked against the same contract as the client. The webhook handler types are the first step.
- **Incremental compilation**: recompile only the documents and schemas that changed, for large specs in watch mode and the dashboard.
- **Static dashboard export**: `swaggerz dashboard --export site/` writes the explorer as static files with pre-rendered data, for publishing internal API references.
- **Smaller runtime**: emit only the serialization styles, body formats and helpers the spec uses (the shared runtime is about 12 KB today).
- **Migration from other generators**: read an orval, openapi-typescript or openapi-generator setup and write the equivalent `swaggerz.config.ts`, plus a guide for the code changes.
- **More validators**: Valibot and ArkType next to Zod, behind the same `features.validation` option.
- **`swaggerz test`**: run saved requests with declarative assertions in CI, reusing the request runner and the validator from item 11.
- **Arazzo workflows**: typed functions for multi-step flows described with the Arazzo specification. Interesting, but adoption is still early.

## Verification gaps worth closing

Not features, but each one would turn a "should work" into a tested claim ([docs/compatibility.md](docs/compatibility.md)).

- Generated clients in real browsers (Playwright) and in Deno, Bun and an edge runtime; today they run in Node.js and happy-dom only.
- webpack in the tree-shaking tests (esbuild, Rollup and Vite are covered).
- File watching on Linux and Windows (the live reload and `--watch` tests have only run on macOS).
- A large real-world spec corpus (public APIs) compiled in CI, to catch crashes and diagnostics regressions.

## Not planned

- **A spec linter.** Spectral and Redocly do this well; swaggerz reports what affects code generation and stops there.
- **A runtime dependency on swaggerz.** Generated clients stay self-contained.
- **JavaScript test scripts in request files.** Assertions stay declarative (reviewable, safe in CI, no `eval`).
- **GraphQL or gRPC.** Different problems with good dedicated tools.
- **A VS Code extension, for now.** The dashboard and the MCP server cover exploring and agent use; an editor extension can be reconsidered once those exist. The 16 px file icons in [brand/](brand/README.md) stay ready for icon-theme pull requests.

## Suggested order

1. Ship 0.1 (the first section).
2. Items 1, 2, 4 and 5: small, and each one improves daily use right away.
3. Item 6 (MCP server): small, because it is mostly a new adapter over what the dashboard already computes.
4. Item 7 (OpenAPI 3.2) together with item 8 (streaming), since 3.2's `itemSchema` defines the streaming types.
5. Items 9 (mocks) and 10 (`swaggerz diff`): the strongest reasons to choose swaggerz over other generators.
6. Item 11 (try it), then `swaggerz test`, reusing the request runner and the validator.
7. The rest as demand shows up in issues.
