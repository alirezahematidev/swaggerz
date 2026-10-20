# Custom plugin example

Two small plugins applied to a Swagger 2.0 document ([swagger.json](swagger.json)):

- [plugins/sdk-names.ts](plugins/sdk-names.ts) names operations after an `x-sdk-name` vendor extension (`Users_List` → `listUsers`) with the `operationName` hook. `Teams_ListMembers` has no extension and keeps the default name, `teamsListMembers`.
- [plugins/operation-catalog.ts](plugins/operation-catalog.ts) adds a `@see` link to each operation's documentation with the `jsdoc` hook and emits `catalog.ts`, a typed constant listing every operation, with the `generate` hook.

```sh
pnpm example:custom-plugin   # from the repository root: build swaggerz, generate, print the catalog
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate   # src/generated/api, including catalog.ts
pnpm start      # prints the catalog (src/catalog-report.ts, run by Node.js directly)
pnpm check      # type-checks src/, the plugins and the config
```

Plugin files are owned by the generator like built-in files: they are recorded in the manifest and removed when a later run no longer produces them. See [docs/plugins.md](../../docs/plugins.md) for every hook.
