# Architecture

swaggerz is a compiler: specifications go through a fixed pipeline of stages with explicit data structures between them. Every consumer — the CLI, the programmatic API, the dashboard and plugins — uses the same pipeline.

```text
Configuration            src/config        defineConfig, loading (native import), env overrides, strict validation, defaults
    ↓
Input loader             src/loader        file/URL reading, JSON/YAML parsing, size and redirect limits
    ↓
Overlays                 src/loader/overlay  OpenAPI Overlay actions on the root document (RFC 9535 JSONPath)
    ↓
Version detection        src/spec/detect   `swagger`/`openapi` field → 2.0 | 3.0 | 3.1 | 3.2; mismatch with config is an error
    ↓
Reference resolution     src/loader/store  external documents crawled under a security policy; pointers, anchors, $id, $self
    ↓
Version-specific parser  src/spec/{swagger2,openapi3}  + schema dialects (swagger2, oas30, oas31, oas32)
    ↓
Normalized IR            src/ir            ApiDocument: operations, webhooks, schemas, security, provenance
    ↓
Read/write split         src/analysis/read-write  request-side model variants for readOnly/writeOnly (types.readWrite)
    ↓
Semantic analysis        src/analysis      dependency graph, naming, symbol table, module layout (ProjectModel)
    ↓
Code generation          src/codegen       models, operations, client, runtime, hooks (query/), schemas (validation/), mocks (mocks/), barrels
    ↓
Plugins                  src/plugins       generate / transformFile / afterGenerate hooks
    ↓
Validation & writing     src/pipeline, src/output  path checks, manifest diff, atomic writes, cleanup
```

`compile()` (`src/pipeline/compile.ts`) runs everything up to the in-memory file list without touching the disk. `runGeneration()` adds planning and writing. Each stage reports problems as diagnostics into one `DiagnosticBag`; an error anywhere prevents writing.

## Modules

| Directory           | Responsibility                                                                                          | Depends on                        |
| ------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `config`            | User config types, `defineConfig`, loading, validation, defaults                                        | `plugins/types` (types only)      |
| `diagnostics`       | `Diagnostic`, `DiagnosticBag`, `SwaggerzError`, terminal formatting                                     | —                                 |
| `loader`            | Reading, parsing, JSON pointers, `$ref` crawling and resolution, line/column lookup, JSONPath, overlays | `diagnostics`                     |
| `spec`              | Version detection, adapters, schema dialects and converter                                              | `loader`, `ir`                    |
| `ir`                | IR types and helpers (walkers, reference collection)                                                    | —                                 |
| `analysis`          | Dependency graph, naming, project model                                                                 | `ir`, `config`                    |
| `codegen`           | Printers, imports, type printer, generators                                                             | `analysis`, `ir`, `config`        |
| `templates/runtime` | Runtime emitted into clients (checked separately against a browser-only lib)                            | —                                 |
| `plugins`           | Plugin types and the runner                                                                             | `codegen/types`, `analysis/types` |
| `pipeline`          | `compile()` and `runGeneration()`                                                                       | everything above                  |
| `output`            | Manifest, write planning, atomic writing, diffs                                                         | `codegen/types`                   |
| `lint`              | Lint rules over a compiled project (`swaggerz lint`, the MCP `check` tool)                              | `analysis`, `ir`                  |
| `service`           | `ProjectService` (a compiled project kept in step with its sources), change tracking, usage scanner     | `pipeline`, `analysis`, `codegen` |
| `cli`               | Commands, argument parsing, reporter, watch mode                                                        | `pipeline`, `config`              |
| `dashboard`         | HTTP server and web client over `ProjectService`                                                        | `service`                         |
| `mcp`               | MCP server over stdio: protocol, tools and resources over `ProjectService`                              | `service`, `codegen`, `lint`      |

There are no runtime import cycles between these modules. The dashboard and its assets are only loaded by the `dashboard` command, the MCP server only by `mcp`.

## The intermediate representation

`src/ir/types.ts` defines `ApiDocument`, versioned by `IR_VERSION` (bumped whenever its shape changes). It is the boundary between "understanding a specification" and "producing code": generators never read raw documents.

- **Operations** (`OperationIR`) have a stable `key` (`get /pets/{id}`), merged path and operation parameters, a request body with all media types, responses sorted by status, effective security, servers, tags, deprecation, external docs, vendor extensions and a `source` reference.
- **Schemas** (`SchemaIR`) are a closed union of kinds: `ref`, `string`, `number`, `integer`, `boolean`, `null`, `enum` (also `const`), `array` (with tuple `prefixItems`), `object` (properties, additional properties, allOf-polymorphism discriminator), `union` (`oneOf`/`anyOf`/type arrays, with discriminator mapping), `intersection` (`allOf`), `binary`, `unknown`, `never`. Every node carries metadata (`nullable`, `description`, `deprecated`, `readOnly`, `default`, `examples`, `format`, `extensions`).
- **Webhooks** (`WebhookIR`, OpenAPI 3.1+) and **callbacks** (`OperationIR.callbacks`) reuse the operation shape; they are generated as types only.
- **Assertions** (`SchemaMeta.assertions`): `not`, conditionals and dependent schemas, kept for validators even though types cannot express them.
- **Named schemas** (`SchemaDefinition`) are every `$ref` target and every component. Ids are document-relative (`#/components/schemas/Pet`, `schemas/team.yaml#`), so output never depends on absolute paths. Pure `$ref` components collapse into aliases of their target.
- **Provenance**: operations, parameters, responses and definitions keep `{ file, pointer }`. Diagnostics carry the same, and line/column numbers are computed lazily by re-parsing only documents that have diagnostics (`loader/locate.ts`).

Version differences are absorbed by the adapters: Swagger 2.0 `body`/`formData` become request bodies, `collectionFormat` becomes `style`/`explode`, `x-nullable` and OpenAPI 3.0 `nullable` become the `nullable` flag, 3.1 type arrays become unions or nullable flags, and so on.

## Analysis: names and layout

`buildProject()` (`src/analysis/project.ts`) turns the IR into a `ProjectModel`:

- **Dependency graph** (`graph.ts`): direct and reverse edges between operations and schemas, linear-time reachability, reverse lookups, strongly connected components for recursion, shortest "why included" chains and structural duplicate detection.
- **Names**: one registry for every exported symbol (models, operations and their derived types, hooks, schemas) so the barrels never contain ambiguous exports; plugin `operationName`/`modelName` hooks run before uniqueness is enforced; runtime names never take precedence over user models.
- **Modules**: file paths are allocated case-insensitively, so output is safe on macOS and Windows.

## Code generation

Generators receive an `EmitContext` (project, config, plugin hooks) and render each module three times — TypeScript, JavaScript with JSDoc, and declarations — from the same code paths, which is why both output languages behave identically. A per-module `ImportManager` allocates local names (aliasing models that shadow globals such as `Error` or `Blob`) and, in JavaScript output, expresses type imports as `import('…').Name` JSDoc types.

The runtime (`src/templates/runtime`) is ordinary TypeScript that is type-checked with the strictest consumer settings against an ES2020 + DOM environment. At build time it is published as `.ts`, `.js` and `.d.ts` variants in `assets/runtime`, and copied into each generated client. The mocks support module (`src/templates/mocks`, the only template that imports a package: `msw`) is built the same way into `assets/mocks` and copied with `features.mocks`.

Mock fixtures are computed by the generator, not at runtime (`src/codegen/mocks`): one `MockSampler` per generation turns schemas into language-independent values (examples that match their schema, otherwise deterministic values seeded by the schema's location), which each output language then prints. Problems it finds are reported through `EmitContext.report`.

## Writing

`planWrite()` compares generated files with the output directory and the manifest (`.swaggerz-manifest.json`, path → SHA-256). Files are only overwritten or deleted if the generator owns them; hand-edited stale files are kept; user files block generation unless `--force`. `applyWrite()` checks that every file it writes or deletes stays inside the output directory, writes new content to temporary files next to their targets and only renames them into place after every write succeeded. Unchanged files are never touched; contents are compared ignoring line endings, and paths that change only in letter case are renamed rather than deleted.
