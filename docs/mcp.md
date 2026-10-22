# MCP server for coding agents

A growing share of API client code is written by coding agents. To call an API correctly they need the exact generated function, its import path and its parameter shape; reading the raw specification gives them none of that, and searching the generated output is slow and approximate. `swaggerz mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that answers from the same compiled project as the generated code, so the agent writes calls that match the client and does not invent endpoints.

## Setup

The agent's client starts the server in the project, over stdio:

```json
{ "mcpServers": { "swaggerz": { "command": "npx", "args": ["swaggerz", "mcp"] } } }
```

- **Claude Code**: `claude mcp add swaggerz -- npx swaggerz mcp`, or the JSON above in `.mcp.json`.
- **Cursor**: the JSON above in `.cursor/mcp.json`.
- **VS Code (Copilot)**: `.vscode/mcp.json` with `{ "servers": { "swaggerz": { "type": "stdio", "command": "npx", "args": ["swaggerz", "mcp"] } } }`.

Options: `--config <file>` and `--cwd <dir>` as for every command, `--allow-write` to offer the `generate` tool, `--no-watch` to stop following changes. Logs go to stderr; stdout carries protocol messages only.

## Tools

| Tool                 | Returns                                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api_overview`       | Title, versions, counts, tags, the output directory and the barrels to import from (client, hooks, schemas), whether the generated files are up to date, a diagnostics summary                                                                                                                      |
| `find_operations`    | Operations matching words (function names, paths, `operationId`s, tags, summaries), a tag, a method or a model: function name, `METHOD /path` and import line                                                                                                                                       |
| `get_operation`      | One operation by function name, `operationId` or `"GET /pets/{id}"`: its TypeScript declaration (parameters, response and error types), import line, an example call built from the schemas and their examples, error handling, authentication, and the data-fetching hooks with their declarations |
| `get_model`          | A model's declaration and import line, its validation schema when one is generated, the operations using it and the models it references                                                                                                                                                            |
| `check`              | Compiler diagnostics, [lint](lint.md) findings and whether the generated output is up to date                                                                                                                                                                                                       |
| `preview_generation` | The files a generation would create, update or delete; with `file`, that file's unified diff                                                                                                                                                                                                        |
| `find_usages`        | Where the application uses a generated export (the dashboard's [usage scan](dashboard.md))                                                                                                                                                                                                          |
| `generate`           | Writes the output, only with `--allow-write`                                                                                                                                                                                                                                                        |

Results are JSON, as text and as structured content. Unknown names return an error with a suggestion (`Did you mean "getPetById"?`).

A typical session: `find_operations` with "pet by id" returns `getPetById` and `import { getPetById } from './src/generated/api/index.js';`; `get_operation` returns its declaration and `const result = await getPetById({ petId: 10 });`; the agent writes the call against the declared types and handles `isGetPetByIdApiError(error)`.

## Resources

Every operation and model is also a resource, `swaggerz://operations/<function name>` and `swaggerz://models/<model name>` (JSON, the same content as `get_operation` and `get_model`), plus `swaggerz://overview`. The resource templates `swaggerz://operations/{name}` and `swaggerz://models/{name}` are advertised for clients that construct URIs.

While the server runs it watches the config, the specification with every local file it references, local overlays and the output manifest, and polls remote documents like the dashboard. After a change, clients that listen receive `notifications/resources/list_changed`, and subscribers of a resource receive `notifications/resources/updated` when its content actually changed, so an agent never works from a stale index. A change that does not compile keeps the last version that did; `check` reports the problem.

## Protocol versions

The server implements the protocol itself, without the MCP SDK, so `npx swaggerz mcp` needs nothing beyond swaggerz. It serves both protocol eras on one stdio connection:

| Revision                                       | How clients connect                                                                                          | Notifications          | Confirmation of `generate`                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| 2026-07-28                                     | Every request carries the version and client capabilities in `_meta`; `server/discover` describes the server | `subscriptions/listen` | An input-required result with an elicitation, then a retried call |
| 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05 | `initialize`                                                                                                 | `resources/subscribe`  | An `elicitation/create` request                                   |

Results of the 2026-07-28 revision carry `resultType`, cache hints (`ttlMs: 0` and `cacheScope: 'private'`: rely on the change notifications) and the server's identity. The integration tests drive the server with the official TypeScript SDK clients of both eras (`@modelcontextprotocol/client` 2.x and `@modelcontextprotocol/sdk` 1.x).

## Safety

- **Specification text is data.** Descriptions, summaries and examples come from the API's authors and end up in the agent's context. The server returns them only under `specification` keys, and the tool descriptions and server instructions tell the model to treat them as data, not instructions.
- **Read-only by default.** `generate` exists only when the server starts with `--allow-write`, is annotated as destructive, and keeps the manifest guarantees: only files swaggerz generated are overwritten or deleted, hand-edited files are kept. When the client supports elicitation, the user confirms the number of files that change first; a confirmation is bound (by an HMAC with a per-process key) to the exact set of changes it was asked for, and asked again if the specification changed meanwhile.
- **No requests to the API itself.** The server describes the client; it never calls the API.
