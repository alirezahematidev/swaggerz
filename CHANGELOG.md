# Changelog

## 0.1.0

Initial release.

- Compiles Swagger 2.0, OpenAPI 3.0 and OpenAPI 3.1 documents (JSON or YAML, local or remote, multi-file) through a version-independent intermediate representation, with diagnostics that include file, JSON pointer, line and column.
- Generates one module per operation and per model, a client module and barrels; TypeScript or JavaScript with declarations and JSDoc.
- Generated runtime with fetch and axios transports, middleware, timeouts, cancellation, typed `ApiError`/`RequestError`, and parameter serialization for every OpenAPI style.
- Optional TanStack Query v5 hooks and query option factories with typed query keys, infinite queries and mutation invalidation.
- Optional Zod 4 schemas with response and request validation, including `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired`.
- Separate request (`…Input`) and response models for `readOnly`/`writeOnly` properties (`types.readWrite`).
- Opt-in `Date` types for `date`/`date-time` with conversion in both directions (`types.dates: 'Date'`).
- Every request media type of an operation, selected with a typed `contentType` parameter; declared `3XX` responses resolve; operation and path `servers` are honored (`client.operationServers`).
- Payload and handler types for webhooks and callbacks (`output.webhooks`).
- `$id`-scoped references, including nested relative ids (JSON Schema 2020-12).
- Plugins with parse, naming, documentation, import, generation and write hooks; plugins can be referenced by module (`'./plugin.mjs'`, `['package', options]`).
- Config files in TypeScript, JavaScript, JSON or YAML, with a published JSON Schema (`swaggerz/config.schema.json`) for editor completion.
- CLI: `init`, `generate` (with `--watch`), `validate`, `inspect`, `dashboard`, `clean`, `doctor`; JSON output for tooling.
- Local dashboard for exploring operations, models, dependencies and usage (scanned with oxc), and previewing generation diffs; live reload with New/Updated badges for changes since it started; light and dark themes, command palette, custom scrollbars, mobile layout.
- Deterministic, incremental and atomic output with a manifest that protects files the generator does not own.
