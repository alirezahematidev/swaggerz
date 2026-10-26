# Design decisions

Each entry records the context, the decision and its consequences. New decisions that change the public API or generated output are added here.

## 1. A single package with internal modules

**Context.** The feature set (parsers, generators, transports, React Query, dashboard, CLI) could be split into many packages.
**Decision.** Ship one package with clear internal module boundaries. Optional features are separated at the module level (the dashboard is loaded lazily; React Query and Zod are only generated when enabled).
**Consequences.** One version to install and release; no inter-package version skew. The public API is the small surface of `src/index.ts`; everything else is internal and may change.

## 2. Generated clients are self-contained

**Context.** Generated code could import a runtime from this package, or carry its own.
**Decision.** Emit the runtime (`runtime/*`) into every client. The generator is a development dependency only.
**Consequences.** No runtime coupling between the application and the generator version; the runtime is readable and patchable by the user; the runtime is duplicated if a project generates several clients (~16 KB minified each).

## 3. Configuration files are loaded with Node.js's own module loader

**Context.** TypeScript configs need transpilation. Common approaches bundle the config with esbuild or evaluate transpiled code with `vm`/`new Function`.
**Decision.** Import config files with `import()`. TypeScript configs rely on Node's built-in type stripping (unflagged since Node 22.18), which sets the minimum Node.js version.
**Consequences.** No `eval`, no bundler dependency, and configs behave exactly like any other module. Configs may only use erasable TypeScript syntax and need explicit extensions on relative imports; errors explain both.

## 4. Version-specific adapters and schema dialects, one IR

**Context.** Swagger 2.0, OpenAPI 3.0, 3.1 and 3.2 differ in document structure and in schema semantics.
**Decision.** Each version has an adapter that produces the shared IR. Document structure is shared between 3.0, 3.1 and 3.2 (3.2 additions are switched on by version); schema semantics differ through small `SchemaDialect` objects (type keyword, nullability, exclusive bounds, examples, binary detection, discriminator shape, `$ref` sibling rules) used by one schema converter. The configured version is enforced.
**Consequences.** Supporting a new version means adding an adapter and maybe a dialect; generators are unaffected. Non-standard keywords that are common in practice (e.g. `oneOf` in Swagger 2.0) are honored with a warning rather than silently.

## 5. One module per operation and per model

**Context.** Tree-shaking must work with every mainstream bundler, including when the barrel is used.
**Decision.** Every operation and model is its own module with only static imports and no top-level side effects except the client instance (marked `/* @__PURE__ */`). There is no registry of operations and no client class.
**Consequences.** Verified with esbuild, Rollup and Vite on a 1,000-operation client. The output has many files; that is the cost of precise bundling.

## 6. A single `params` object per operation

**Context.** Positional arguments break when parameters are added; separate objects per location are verbose.
**Decision.** Path, query, header and cookie parameters and the body (as `body`) form one object; wire names are preserved by default.
**Consequences.** Calls read naturally and React Query mutation variables are simply the params type. Name clashes across locations are resolved deterministically with a location prefix.

## 7. Errors are thrown, not returned

**Decision.** Operations resolve with data (or `{ data, status, headers }` with `responseStyle: 'full'`) and reject with `ApiError` (HTTP status) or `RequestError` (network, timeout, parse, serialization, validation). Cancellation rethrows the original abort error.
**Consequences.** Works naturally with `async/await` and React Query's error handling; error bodies are typed from the documented error responses.

## 8. React Query typing uses only APIs that are stable across v5

**Context.** Several TanStack Query types changed shape during v5 (`UseInfiniteQueryOptions` lost a type parameter, `DataTag` gained one, helper overload order changed).
**Decision.** Hooks pass explicit generics to `useQuery`/`useMutation`/`useInfiniteQuery`; infinite option types are derived from `useInfiniteQuery`'s own parameters; option factories use the `queryOptions`/`infiniteQueryOptions` helpers and let TypeScript infer the tagged key; declaration files spell out a stable equivalent.
**Consequences.** The same generated code type-checks with TanStack Query 5.0.0 and the latest 5.x (verified by `pnpm compat`).

## 9. Ownership is explicit

**Decision.** A manifest records every generated file and its hash; every file starts with an `@generated` marker. Only owned files are overwritten or deleted; unsafe output directories are refused.
**Consequences.** Regeneration is safe in any directory, `clean` is precise, and hand edits to generated files are detected.

## 10. The dashboard is a local, token-protected tool

**Decision.** A dependency-free `node:http` server bound to loopback, a random per-session token sent in an `Authorization` header, `Host`/`Origin` checks, a strict CSP and no inline scripts. The web client (React with Radix primitives, Tailwind CSS and self-hosted fonts) is pre-bundled, so users install no frontend dependencies and the page makes no third-party requests. Component libraries that inject positioning styles get a per-response CSP nonce instead of `unsafe-inline`.
**Consequences.** Browsing other sites cannot read or trigger the dashboard; exposing it on a network requires an explicit opt-in.

## 11. Usage scanning is static and honest

**Decision.** Parse application sources with oxc (`oxc-parser`) and resolve imports with `oxc-resolver`, honoring `tsconfig.json` paths. Both are optional native dependencies of swaggerz, so the scan does not depend on the project's TypeScript version. (The first implementation used the project's TypeScript compiler API; TypeScript 7 has no JavaScript compiler API, so it was replaced.) Imports that cannot be attributed statically (dynamic imports, escaping namespace objects, `export *`) mark the affected exports as _undetermined_.
**Consequences.** No false "unused" claims; scanning works in JavaScript-only projects and with any TypeScript version. On platforms without oxc binaries, the usage view reports that the scanner is unavailable.

## 12. Request and response models are split where the spec says they differ

**Decision.** A pass between the IR and analysis (`src/analysis/read-write.ts`) creates a request-side variant (`PetInput`) of every model that has `readOnly` or `writeOnly` properties directly or through the models it contains, and only when the model is reachable from a request. Response types drop `writeOnly` properties. Webhook and callback payloads use the inverted directions. `types.readWrite: 'merged'` turns it off.
**Consequences.** Request types no longer demand server-assigned fields such as `id`; models that do not need a variant are not duplicated, so most specs see no extra types.

## 13. Dates stay strings unless asked for

**Decision.** `types.dates` defaults to `'string'`. With `'Date'`, generated shape descriptors (`dates/<model>.ts`) tell a small runtime helper where dates sit; operations encode request bodies and parameters before validation and revive responses after it. Zod schemas validate the wire format (`z.iso.*`) rather than transforming, because transforms cannot be combined with Zod intersections.
**Consequences.** The default output matches JSON exactly and costs nothing at runtime. Opting in adds one module per model that contains dates and a runtime helper of 1.2 KB minified, and validation errors point at the received strings.

## 14. Assertions are enforced at runtime, not encoded in types

**Decision.** `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired` are kept in the IR as assertions. Generated Zod schemas enforce them with refinements; TypeScript types ignore them, and an info diagnostic (`schema/assertion-keyword`) says so.
**Consequences.** Types may be wider than the schema (TypeScript cannot express negation or conditionals over arbitrary schemas), but validation is complete when Zod is enabled.

## 15. Errors are typed by status, with one guard per operation

**Context.** `ApiError<Body>` had `status: number` and a body typed as the union of every documented error response, so `error.status === 404` could not narrow the body. It also claimed the body was always one of the documented ones, which is false for statuses the specification does not mention.
**Decision.** `ApiError` takes the status as a second type parameter (`ApiError<Body, Status>`, the same order as `ApiResponse<Data, Status>`, so `ApiError<Body>` keeps working). Each operation exports `<Name>ApiError`, a union with one member per documented status. Ranges (`4XX`) and `default` get the exact remaining codes through the runtime's `HttpStatus<Class>` literal unions, and statuses nothing documents get a final member with an `unknown` body, so every member has a disjoint status type and checking the status narrows the body. The narrowing guard is a generated function per operation (`isGetPetByIdApiError`) that checks `instanceof ApiError`, the `operationId` and the method. A shared `isApiError(getPetById, error)` was considered: it needs a value that ties the function to its errors at runtime, either a property on the function (a top-level side effect that defeats tree-shaking) or the function itself stored in every request descriptor and error, plus a phantom type on the return value. A per-operation guard needs neither and is dropped by bundlers when unused.
**Consequences.** Code that read `error.body` without checking the status now sees `unknown` (the undocumented-status member) and either checks the status or casts to `<Name>ErrorBody`, which is unchanged. One more export per operation.

## 16. OpenAPI 3.2 maps onto the existing IR where it can

**Context.** OpenAPI 3.2 adds methods (`query`, `additionalOperations`), a parameter location for the whole query string, sequential media types with `itemSchema`, nested tags, `$self` and smaller fields.
**Decision.** The 3.2 adapter is the 3.0/3.1 adapter with the 3.2 fields enabled and a JSON Schema 2020-12 dialect that also reads `discriminator.defaultMapping`. Methods are open in the IR (`HttpMethod` is the standard methods or any other string) and additional ones are sent exactly as their key is spelled. `in: querystring` is a parameter location serialized by its media type. Nested tags become nested operation directories and nested React Query key prefixes, so the existing key-factory invalidation covers child tags. `$self` is a document's base URI and an alias that identifies it; a reference next to `$self` is read next to the referencing file, which keeps multi-file descriptions working offline. Content described only by `itemSchema` is typed and read as text until streaming responses (typed async iteration) are designed; the item models are still generated.
**Consequences.** `IR_VERSION` 3: plugins that switch over `operation.method` must handle other strings, and `ParameterLocation` gains `querystring`. The default `queryMethods` became `['get', 'query']`; for 3.0 and 3.1 documents, which have no `query` operations, the output does not change.

## 17. Each validation library gets its own printer behind one interface

**Context.** Zod, Valibot and ArkType express the same schemas very differently: Zod methods (`z.string().min(1)`), Valibot pipelines (`v.pipe(v.string(), v.minLength(1))`), ArkType types built from definitions. They also differ where it matters most for generated code: Zod 4 defers references through getters, Valibot through `v.lazy`, and ArkType resolves every definition eagerly and rejects contradictory intersections when a module loads.
**Decision.** One printer per library (`src/codegen/validation/{zod,valibot,arktype}.ts`) behind a small `Validator` interface (inline expressions, unions, `parse`, model modules). Which schema validates what (the success responses, the selected request media type) is shared. Schemas are typed with the model they validate (`ZodType<Pet>`, `GenericSchema<Pet>`, `Type<Pet>`); in Valibot and ArkType every reference inside a schema module goes through a getter with an explicit return type, so TypeScript never infers a schema's type from its own initializer. ArkType gets a generated support module: `lazy()` resolves a reference when data is validated (and answers "no" if ArkType asks while reducing a definition before the target exists, which only keeps union branches apart), `allOf()` falls back to member-by-member checks when ArkType cannot combine an intersection.
**Consequences.** Adding a library means writing a printer, not threading conditions through one. `ModelSymbol.zodName`/`zodModule` became `schemaName`/`schemaModule`. ArkType's own types need TypeScript 5.4, which `doctor` checks.

## 18. Data-fetching hooks share key functions; option factories are plain objects outside React

**Context.** The TanStack Query adapters share the query core but differ in reactivity (React re-renders, Vue refs and getters, Svelte 5 and Solid accessors), and their own option types changed shape during v5 (Vue Query 5.0 wraps query options in `MaybeRef` but not infinite query options; Solid's primitives are overloaded on `initialData`; not every adapter release exports `queryOptions`). SWR is a different library with its own key and mutation model.
**Decision.** `features.query.framework` selects one adapter (`features.reactQuery` stays as an alias); `features.swr` is a separate, smaller generator that cannot be combined with it. Keys, key factories and invalidation targets are shared by all five. React keeps the `queryOptions` helpers (decision 8); the other adapters get plain, `DataTag`-typed option factories. Hooks use the option types that are stable across each adapter's supported range: Vue's plain `UseQueryOptions` object (without its ref wrapper) passed as a computed ref, the parameter type of `useInfiniteQuery`, the query core's `MutationObserverOptions`; Svelte and Solid take accessors and leave `initialData` out for Solid. SWR keys are the same arrays as the TanStack keys, so invalidation revalidates by prefix; infinite lists, which SWR's filter skips, are revalidated with all their pages.
**Consequences.** `pnpm compat` type-checks every adapter's oldest release; Vue infinite queries read their options once (individual options can still be refs). Svelte Query 5 (Svelte 3/4 stores) is not supported.

## 19. Overlays patch the root document before anything reads it, with the 1.1 rules

**Context.** Overlays (1.0, 1.1 with `copy` and primitive targets, 1.2 with reusable actions) need RFC 9535 JSONPath, which no dependency provided at the quality the project needs.
**Decision.** A JSONPath implementation in `src/loader/jsonpath.ts`, checked against the full JSONPath Compliance Test Suite (values and normalized paths). Overlays apply to the root document right after it is loaded, before plugins' `beforeParse` and version detection, so they work for every specification version. Every overlay version uses the 1.1 merge rules (which clarified 1.0); newer 1.x versions apply with a warning. Diagnostics point into the overlay file.
**Consequences.** Referenced documents are not patched. Line numbers of diagnostics in patched parts of the root document refer to the original text, as with `beforeParse` hooks.

## 20. The MCP server implements the protocol itself and serves both protocol eras

**Context.** The plan was to load the MCP SDK as an optional dependency. The v1 SDK brings Express, Hono and Zod 3; the v2 SDK is lighter but still a dependency of every install (npm installs optional dependencies by default), and `npx swaggerz mcp` must work without extra packages. The protocol changed fundamentally in 2026-07-28 (stateless requests, `server/discover`, `subscriptions/listen`, input-required results) while most clients still speak the `initialize`-based revisions.
**Decision.** A dependency-free stdio server (`src/mcp/server.ts`) that serves 2026-07-28 and 2025-11-25 back to 2024-11-05 on the same connection: requests carrying `_meta` protocol fields are handled statelessly, `initialize` selects the legacy semantics. Tools and resources are thin adapters over `ProjectService` (the dashboard's state, moved to `src/service`), so the dashboard and the server stay in step. The official SDK clients of both eras drive the server in the integration tests.
**Consequences.** Protocol changes are ours to follow; the pinned versions and the SDK-driven tests make that visible. The `generate` tool requires `--allow-write` and asks the user through elicitation when the client supports it.

## 21. The linter reports what changes the generated client, nothing else

**Context.** A spec linter was not planned because Spectral and Redocly cover style rules well. What they do not know is how a specification turns into a client.
**Decision.** `swaggerz lint` reports the compiler's diagnostics plus rules that each have a concrete effect on the output (names derived from paths, `unknown` responses, inline schemas, duplicate or unused models, missing servers), with severities configurable in `lint.rules`. Style rules are out of scope.
**Consequences.** The rule set stays small and every message says what it does to the client. The MCP `check` tool reuses it.

## 22. Mocks are MSW handlers over seeded fixtures with a dependency-free fake data module

**Context.** Teams want to build UIs and tests before the backend exists. Mock generators usually create data with faker at runtime: a large dependency, and values that change on every run. Fixtures that are one constant value per model are stable, but a list of them repeats one item (duplicate keys, identical pages, cursors that never end) and never shows the other states a schema allows. MSW's path syntax cannot express every OpenAPI path (`/files/{name}:download`, parameter names with dashes), and a handler must match the base URL the client really uses, which applications often set at runtime.

**Decision.** `features.mocks: 'msw'` generates a fixture factory per model, a Mock Service Worker handler factory per operation, and a request fixture and sender per webhook. A fixture is a recipe over `mocks/fake.ts`, a template copied into the client: a seeded generator of realistic values (vocabularies by property name and owning model, formats, dates relative to examples, real files, patterns), with no dependency. Seed `0` returns the specification's examples (or values the generator chose), so `makePet()` is stable; other seeds vary every value within its schema, each seeded by its key, and cover enum values, union members, `null` and absent properties in turn. The generator evaluates each recipe with the same module for trial seeds and checks the values against the schema; recipes that fail, and values under assertions, keep their examples. References become calls of the other factories with derived seeds, and a factory never calls into its own cycle. Patterns are parsed and matched by a bounded matcher, never executed. Handlers use MSW's custom predicates (2.11 and later) through a support module (`mocks/support.ts`), which compares paths segment by segment, reads the base URL from the client when a request arrives, and seeds default bodies by the request (the examples without parameters, the remembered seed of an entity's `id`), copying path parameters into them. The options select a documented status and type the body by it, as the operation's `ApiError` union does; a `.status(404)` method on the factory was considered, but it is a top-level side effect (decision 15). Generating values at runtime without the generator's checks, as faker does, was rejected: a variant could break a constraint the generator knows about.

**Consequences.** Fixtures read as the values they make, stay stable in snapshots for seed `0`, need no dependency, and lists and pages look like a real API's. `mocks/fake.ts` adds about 2,000 lines to the generated client's development code. Mocking needs MSW 2.11 or later. The integration tests validate every fixture of the test specifications for many seeds and empty states against the generated Zod, Valibot and ArkType schemas, and drive the generated client through the handlers; `pnpm corpus` type-checks the mocks of 24 public descriptions.
