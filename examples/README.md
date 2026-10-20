# Examples

| Example                            | Shows                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [react-query](react-query)         | OpenAPI 3.1, React with TanStack Query hooks (queries, infinite queries, mutations with invalidation), Zod response validation, a typed mock API for Vite  |
| [node-javascript](node-javascript) | OpenAPI 3.0, a plain JavaScript Node.js project using the generated JavaScript client with JSDoc and `.d.ts` types, API-key auth, middleware, typed errors |
| [custom-plugin](custom-plugin)     | Swagger 2.0, two plugins: naming operations from a vendor extension, and emitting a typed operation catalog with documentation links                       |

## Running an example

The examples are workspace packages of this repository and use its checkout of swaggerz (`"swaggerz": "workspace:*"`). From the repository root:

```sh
pnpm install                    # once; also installs the examples' dependencies
pnpm example:react-query        # build swaggerz, generate the client, start the Vite dev server
pnpm example:node-javascript    # build, generate, run the script against a local in-memory API
pnpm example:custom-plugin      # build, generate, print the catalog the plugin emitted
pnpm example react-query check  # any script of an example: build, generate, then run it
pnpm examples:check             # build, then generate and type-check every example
```

Inside an example directory, its own scripts work too once swaggerz is built (`pnpm build` in the root): `pnpm generate`, `pnpm check`, `pnpm dashboard`, and `pnpm dev` or `pnpm start`.

In your own project, install `swaggerz` from the registry (`npm install --save-dev swaggerz`) instead of `workspace:*` and keep the rest of the setup. `node scripts/verify-examples.ts` (run in CI) checks the examples the way a user would: it packs the package, copies each example out of the repository, installs the tarball with npm and runs `generate`, `check` and `start`.
