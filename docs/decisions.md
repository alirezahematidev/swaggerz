# Design decisions

Each entry records the context, the decision and its consequences. New decisions that change the public API or generated output are added here.

## 1. A single package with internal modules

**Context.** The feature set (parsers, generators, transports, React Query, dashboard, CLI) could be split into many packages.
**Decision.** Ship one package with clear internal module boundaries. Optional features are separated at the module level (the dashboard is loaded lazily; React Query and Zod are only generated when enabled).
**Consequences.** One version to install and release; no inter-package version skew. The public API is the small surface of `src/index.ts`; everything else is internal and may change.

## 2. Generated clients are self-contained

**Context.** Generated code could import a runtime from this package, or carry its own.
**Decision.** Emit the runtime (`runtime/*`) into every client. The generator is a development dependency only.
**Consequences.** No runtime coupling between the application and the generator version; the runtime is readable and patchable by the user; the runtime is duplicated if a project generates several clients (~11 KB minified each).

## 3. Configuration files are loaded with Node.js's own module loader

**Context.** TypeScript configs need transpilation. Common approaches bundle the config with esbuild or evaluate transpiled code with `vm`/`new Function`.
**Decision.** Import config files with `import()`. TypeScript configs rely on Node's built-in type stripping (unflagged since Node 22.18), which sets the minimum Node.js version.
**Consequences.** No `eval`, no bundler dependency, and configs behave exactly like any other module. Configs may only use erasable TypeScript syntax and need explicit extensions on relative imports; errors explain both.

## 4. Version-specific adapters and schema dialects, one IR

**Context.** Swagger 2.0, OpenAPI 3.0 and 3.1 differ in document structure and in schema semantics.
**Decision.** Each version has an adapter that produces the shared IR. Document structure is shared between 3.0 and 3.1; schema semantics differ through small `SchemaDialect` objects (type keyword, nullability, exclusive bounds, examples, binary detection, discriminator shape, `$ref` sibling rules) used by one schema converter. The configured version is enforced.
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
**Consequences.** The same generated code type-checks with TanStack Query 5.0.0 and the latest 5.x (verified by `yarn compat`).

## 9. Ownership is explicit

**Decision.** A manifest records every generated file and its hash; every file starts with an `@generated` marker. Only owned files are overwritten or deleted; unsafe output directories are refused.
**Consequences.** Regeneration is safe in any directory, `clean` is precise, and hand edits to generated files are detected.

## 10. The dashboard is a local, token-protected tool

**Decision.** A dependency-free `node:http` server bound to loopback, a random per-session token sent in an `Authorization` header, `Host`/`Origin` checks, a strict CSP and no inline scripts. The web client is pre-bundled (Preact) so users install no frontend dependencies.
**Consequences.** Browsing other sites cannot read or trigger the dashboard; exposing it on a network requires an explicit opt-in.

## 11. Usage scanning is static and honest

**Decision.** Parse application sources with the project's own TypeScript compiler API and module resolution (so path aliases work). Imports that cannot be attributed statically (dynamic imports, escaping namespace objects, `export *`) mark the affected exports as _undetermined_.
**Consequences.** No false "unused" claims; requires TypeScript 5.x/6.x because TypeScript 7 has no JavaScript compiler API.
