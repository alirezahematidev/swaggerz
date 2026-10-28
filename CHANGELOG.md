# Changelog

## [0.2.2](https://github.com/alirezahematidev/swaggerz/compare/v0.2.1...v0.2.2) (2026-10-28)

### Features

* Vite plugin, Astro and Next.js integrations (swaggerz/vite, swaggerz/astro, swaggerz/next) ([07c0bf5](https://github.com/alirezahematidev/swaggerz/commit/07c0bf5e21ebb00c448d67f28071640c02b2e7ee))
* **website:** versioned docs, with a snapshot of each minor release at /vX.Y/ ([cd8a4fa](https://github.com/alirezahematidev/swaggerz/commit/cd8a4fad536facb334861ec1c860a062f29c1d69))

### Bug fixes

* vite knip ([89fcde2](https://github.com/alirezahematidev/swaggerz/commit/89fcde217c9ce011955e3ecd5396bc8a233d206e))

## [0.2.1](https://github.com/alirezahematidev/swaggerz/compare/v0.2.0...v0.2.1) (2026-10-27)

* **deps-dev:** bump the development group across 1 directory with 7 updates ([46183a6](https://github.com/alirezahematidev/swaggerz/commit/46183a6ee1d8b83eaab061bd13f03b6af7ddff0d))
* **deps:** bump @tanstack/react-query from 5.104.3 to 5.104.5 ([961bd4c](https://github.com/alirezahematidev/swaggerz/commit/961bd4c97dc3ba81ad5eacf1d59b2e059e746546))
* **deps:** bump oxc-parser from 0.154.0 to 0.155.0 ([755ae02](https://github.com/alirezahematidev/swaggerz/commit/755ae02d187e5b129fc397581dcb960a452f6685))
* link the Product Hunt launch from the website and the README ([264a1bc](https://github.com/alirezahematidev/swaggerz/commit/264a1bc7b0a3b644a7ecf477ba20fa93a1168bdd))

### Bug fixes

* realistic mock lists, error bodies, text and people ([58da685](https://github.com/alirezahematidev/swaggerz/commit/58da685a80175575765d45f403aacaa58666c669))

## [0.2.0](https://github.com/alirezahematidev/swaggerz/compare/v0.1.2...v0.2.0) (2026-10-26)

* check out corpus documents with git instead of fetch ([349d22a](https://github.com/alirezahematidev/swaggerz/commit/349d22ac85f7c3fdd1a5146e8f79ab5ce0780802))
* swaggers website ([3629ec5](https://github.com/alirezahematidev/swaggerz/commit/3629ec5a5d0615738f55c84166efa2c6d42e1f87))

### Features

* Mock Service Worker handlers with realistic, seeded fixtures (features.mocks) ([6be5977](https://github.com/alirezahematidev/swaggerz/commit/6be5977289be6e5fe1f2106b7f5ab1faba774cbc))

### Bug fixes

* scorecard release files provided ([df15dae](https://github.com/alirezahematidev/swaggerz/commit/df15dae058dc2435c1648cf0a56738c9dc4a37ce))
* treat HEAD responses as bodiless ([543a2c8](https://github.com/alirezahematidev/swaggerz/commit/543a2c8dffdb4672a7ecdbdb656e75cf86072e27))
* validate text and binary responses as their types say ([57b7d43](https://github.com/alirezahematidev/swaggerz/commit/57b7d4344e1a540719b0c38387fa33c639477ce3))

## [0.1.2](https://github.com/alirezahematidev/swaggerz/compare/v0.1.1...v0.1.2) (2026-10-24)

### Features

* website ([c573de0](https://github.com/alirezahematidev/swaggerz/commit/c573de01d77a49cb25c23b3e0e721d74c75537df))

### Bug fixes

* plan.txt ignored ([6345f47](https://github.com/alirezahematidev/swaggerz/commit/6345f47dc07078a7853975835704b55f94901ef2))
* resolve code scanning alerts and two crashes found by fuzzing ([661309b](https://github.com/alirezahematidev/swaggerz/commit/661309bbb537d6b29d650a908faa093d9e66f901))
* security issues ([b380811](https://github.com/alirezahematidev/swaggerz/commit/b3808114b506e45be09776f022b0c1313c9d368e))

## [0.1.1](https://github.com/alirezahematidev/swaggerz/compare/v0.1.0...v0.1.1) (2026-10-23)

### Features

* **core:** configured husky and knip ([3e858f9](https://github.com/alirezahematidev/swaggerz/commit/3e858f931d49a72286c2f4b4dd22573ec5c60072))

## 0.1.0

Initial release.

- Compiles Swagger 2.0, OpenAPI 3.0, 3.1 and 3.2 documents (JSON or YAML, local or remote, multi-file) through a version-independent intermediate representation, with diagnostics that include file, JSON pointer, line and column.
- Generates one module per operation and per model, a client module and barrels; TypeScript or JavaScript with declarations and JSDoc.
- Generated runtime with fetch and axios transports, middleware, timeouts, cancellation, typed `ApiError`/`RequestError`, and parameter serialization for every OpenAPI style.
- Optional data-fetching hooks: TanStack Query v5 for React, Vue, Svelte 5 and Solid, or SWR 2, with typed query keys, option factories, infinite queries and mutation invalidation.
- Optional Zod 4, Valibot 1 or ArkType 2 schemas with response and request validation, including `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired`.
- OpenAPI Overlays 1.0, 1.1 and 1.2 (`spec.overlays`) with an RFC 9535 JSONPath implementation, for every specification version.
- Separate request (`…Input`) and response models for `readOnly`/`writeOnly` properties (`types.readWrite`).
- Opt-in `Date` types for `date`/`date-time` with conversion in both directions (`types.dates: 'Date'`).
- Every request media type of an operation, selected with a typed `contentType` parameter; declared `3XX` responses resolve; operation and path `servers` are honored (`client.operationServers`).
- Payload and handler types for webhooks and callbacks (`output.webhooks`).
- `$id`-scoped references, including nested relative ids (JSON Schema 2020-12).
- Plugins with parse, naming, documentation, import, generation and write hooks; plugins can be referenced by module (`'./plugin.mjs'`, `['package', options]`).
- Config files in TypeScript, JavaScript, JSON or YAML, with a published JSON Schema (`swaggerz/config.schema.json`) for editor completion.
- CLI (`swaggerz`, or `sz`): `init`, `generate` (with `--watch`), `validate`, `lint`, `inspect`, `dashboard`, `mcp`, `clean`, `doctor`; JSON output for tooling.
- `swaggerz lint`: findings about what in a specification makes the generated client worse, with configurable severities.
- `swaggerz mcp`: a Model Context Protocol server that gives coding agents the generated functions, their types, example calls and diagnostics, and follows changes.
- Local dashboard for exploring operations, models, dependencies and usage (scanned with oxc), and previewing generation diffs; live reload with New/Updated badges for changes since it started; light and dark themes, command palette, custom scrollbars, mobile layout.
- Deterministic, incremental and atomic output with a manifest that protects files the generator does not own.
