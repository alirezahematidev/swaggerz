# Compatibility

## Runtime environments of generated code

Generated clients target ES2020 and use `fetch`, `Headers`, `AbortController`, `FormData`, `Blob`, `URLSearchParams`, `TextEncoder` and `btoa` (or axios), so they should run wherever these standard APIs exist: modern browsers, Node.js 18+, and runtimes such as Deno, Bun and edge workers. The automated tests execute clients in Node.js and in a browser-like environment (happy-dom); `tests/smoke/runtime.mjs` runs a generated JavaScript client (JSON, query parameters, multipart upload, binary download, errors, timeout, abort) on Node.js 18, 20, 22 and 24 in CI. Deno, Bun, edge runtimes and real browsers are not exercised automatically. Generated modules are ES modules: in Node.js the consuming package needs `"type": "module"` (or a bundler). The runtime is type-checked against both a browser environment (`lib: ES2020 + DOM`, no Node types) and a Node.js environment (`@types/node`, no DOM, `NodeNext` resolution).

## Tested versions

`yarn compat` installs the oldest and newest supported versions side by side and type-checks generated clients (TypeScript output, JavaScript declarations, React Query hooks) with the strictest settings (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noUnused*`, `verbatimModuleSyntax`, `isolatedModules`):

| Dependency              | Oldest verified | Newest verified                 |
| ----------------------- | --------------- | ------------------------------- |
| TypeScript              | 5.0.4           | 6.0.3 and 7.0 (native compiler) |
| `@tanstack/react-query` | 5.0.0           | 5.104                           |
| axios                   | 1.0.0           | 1.20                            |
| Zod                     | 4.0.15          | 4.6                             |
| Node.js (generator)     | 22.18.0         | 24                              |

The generator's own test suite and the packed-tarball check (`yarn test:pack`) pass on Node.js 22.18.0 and 24. `erasableSyntaxOnly`, available from TypeScript 5.8, is enabled for the newer compilers to prove the output contains no enums or namespaces.

Zod 4.0.0 – 4.0.14 cannot infer recursive schemas defined with getters (the pattern Zod 4 recommends and swaggerz generates) under TypeScript 6 and 7: the compiler reports `TS2615` ("circularly references itself in mapped type"). Zod 4.0.15 fixed this, so it is the minimum version; `swaggerz doctor` checks it when validation is enabled.

## Specification support

| Feature                                                      |               2.0               |           3.0           |              3.1               | Notes                                                                                                                |
| ------------------------------------------------------------ | :-----------------------------: | :---------------------: | :----------------------------: | -------------------------------------------------------------------------------------------------------------------- |
| JSON and YAML, local and remote                              |                ✓                |            ✓            |               ✓                | YAML 1.2 core schema, duplicate keys rejected, alias expansion bounded                                               |
| Internal, external and recursive `$ref`                      |                ✓                |            ✓            |               ✓                | Reference policy; cycles of pure references are errors                                                               |
| `$ref` siblings                                              |        ignored (warning)        |    ignored (warning)    |               ✓                |                                                                                                                      |
| `$anchor`, `$id`                                             |                –                |            –            |        ✓ (absolute ids)        |                                                                                                                      |
| Path, query, header, cookie parameters                       |                ✓                |            ✓            |               ✓                | `Accept`, `Content-Type`, `Authorization` header parameters ignored in 3.x, as the spec requires                     |
| `style` / `explode` / `allowReserved` / `content` parameters |       `collectionFormat`        |            ✓            |               ✓                | `tsv` maps to tab-delimited                                                                                          |
| Request bodies, multiple media types                         |       `body`, `formData`        |            ✓            |               ✓                | One preferred media type is used by the client                                                                       |
| Multipart and file uploads                                   |                ✓                |            ✓            |               ✓                | `encoding` for property content types and array serialization                                                        |
| Binary responses                                             |                ✓                |            ✓            |               ✓                | `Blob`                                                                                                               |
| Multiple responses and ranges (`2XX`, `default`)             |                ✓                |            ✓            |               ✓                |                                                                                                                      |
| `allOf` / `oneOf` / `anyOf`                                  | `allOf` (+ others with warning) |            ✓            |               ✓                |                                                                                                                      |
| Discriminators                                               |        ✓ (property name)        |       ✓ (mapping)       |               ✓                | Implicit and explicit mappings, allOf inheritance                                                                    |
| Nullability                                                  |          `x-nullable`           |       `nullable`        | type arrays, `oneOf` with null | `nullable` in 3.1 is ignored with a warning                                                                          |
| `const`, `prefixItems`, boolean schemas                      |                –                |    `const` (warning)    |               ✓                |                                                                                                                      |
| `not`, `if/then/else`, `$dynamicRef`, `dependentSchemas`     |                –                | `not` ignored (warning) |       ignored (warning)        | Types may be wider than the schema                                                                                   |
| Security schemes                                             |      basic, apiKey, oauth2      |            ✓            |    ✓ (+ mutualTLS ignored)     |                                                                                                                      |
| Webhooks, callbacks                                          |                –                |     skipped (note)      |         skipped (note)         |                                                                                                                      |
| Vendor extensions                                            |            preserved            |        preserved        |           preserved            | Available to plugins; `x-enum-varnames`/`x-enumNames`, `x-discriminator-value`, `x-deprecated`, `x-example` are used |

swaggerz validates what code generation depends on (required fields, parameter shape, references, types) and reports problems with locations; it is not a complete specification linter. Use a dedicated linter such as Spectral or Redocly for style and full conformance checks.

## Fixtures

The test fixtures cover each family: `petstore-2.0.json`, `petstore-3.0.yaml`, `features-3.1.yaml` (composition, discriminators, recursion, tuples, styles), a multi-file specification with recursive cross-file references, edge cases for naming and escaping, and invalid documents (broken and circular references, blocked references, malformed YAML, non-OpenAPI input).
