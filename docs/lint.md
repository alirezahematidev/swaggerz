# Linting

```sh
swaggerz lint                    # report findings; exit 1 only on errors
swaggerz lint --max-warnings 0   # also fail on warnings, for CI
swaggerz lint --rules            # list the rules and their configured severities
swaggerz lint --json             # one JSON document with every diagnostic
```

`swaggerz lint` compiles the specification like `validate` and reports its diagnostics, plus findings about what in the specification makes the **generated client** worse. It is not a style linter: naming conventions, descriptions of every property and other house rules are what [Spectral](https://github.com/stoplightio/spectral) and [Redocly](https://redocly.com/docs/cli/) do well. Every rule here has a concrete effect on the output, and the message says which.

| Rule                 | Default | Reports                                                                       | Effect on the client                                                                                  |
| -------------------- | ------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `operation-id`       | warning | Operations without an `operationId`                                           | The function is named after the method and path (`postPets`) and renames itself when the path changes |
| `operation-id-style` | info    | `operationId`s that are not JavaScript identifiers (`list-pets`, `pets.list`) | The function has another name than the `operationId`                                                  |
| `operation-tags`     | info    | Operations without tags                                                       | They are generated into the `default` group directory and key factory                                 |
| `undeclared-tag`     | info    | Tags used by operations but missing from the top-level `tags`                 | No description for the group                                                                          |
| `operation-summary`  | info    | Operations with neither a summary nor a description                           | The JSDoc only names the endpoint                                                                     |
| `success-response`   | warning | Operations without a 2xx or `default` response                                | The function resolves with `void` whatever the server returns                                         |
| `response-schema`    | warning | JSON success responses without a schema                                       | The function resolves with `unknown`                                                                  |
| `inline-schema`      | info    | JSON request or response bodies that are inline objects                       | Types named after the operation (`AddPetBody`) that other operations cannot reuse                     |
| `untyped-schema`     | info    | Named schemas without a type, properties or composition                       | The model is `unknown`                                                                                |
| `duplicate-schema`   | info    | Named schemas that are structurally identical                                 | Duplicate types                                                                                       |
| `unused-model`       | info    | Named schemas no operation uses (only with `output.models: 'all'`)            | Generated anyway                                                                                      |
| `missing-servers`    | info    | No `servers` (or `host`) and no `client.baseUrl`                              | The client has no default base URL                                                                    |

Findings are [diagnostics](diagnostics.md#lint-findings) with the code `lint/<rule>`, located in the specification (file, line and JSON pointer) and, for operations, naming the operation. Notes are part of the report (other commands show them only with `--verbose`).

## Configuring rules

```ts
export default defineConfig({
  spec: { version: '3.1', input: './openapi.yaml' },
  lint: {
    rules: {
      'operation-id': 'error', // fail CI when an operation has no operationId
      'unused-model': 'off',
    },
  },
});
```

Each rule takes `'off'`, `'info'`, `'warning'` or `'error'`. Unknown rule names are configuration errors, with a suggestion.

## Fixing a specification you do not own

Most findings can be fixed with an [overlay](overlays.md) instead of a fork — for example adding the missing `operationId`s:

```yaml
overlay: 1.1.0
info: { title: Operation ids, version: 1.0.0 }
actions:
  - target: $.paths['/pets'].post
    update: { operationId: createPet }
```

The [MCP server](mcp.md)'s `check` tool returns the same findings to coding agents.
