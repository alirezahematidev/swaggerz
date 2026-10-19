# swaggerz

## 0.1.0

Initial version (not yet published).

- Compiles Swagger 2.0, OpenAPI 3.0 and OpenAPI 3.1 documents (JSON or YAML, local or remote, multi-file) through a version-independent intermediate representation, with diagnostics that include file, JSON pointer, line and column.
- Generates one module per operation and per model, a client module and barrels; TypeScript or JavaScript with declarations and JSDoc.
- Generated runtime with fetch and axios transports, middleware, timeouts, cancellation, typed `ApiError`/`RequestError`, and parameter serialization for every OpenAPI style.
- Optional TanStack Query v5 hooks and query option factories with typed query keys, infinite queries and mutation invalidation.
- Optional Zod 4 schemas with response and request validation.
- Plugins with parse, naming, documentation, import, generation and write hooks.
- CLI: `init`, `generate` (with `--watch`), `validate`, `inspect`, `dashboard`, `clean`, `doctor`; JSON output for tooling.
- Local dashboard for exploring operations, models, dependencies and usage, and previewing generation diffs.
- Deterministic, incremental and atomic output with a manifest that protects files the generator does not own.
