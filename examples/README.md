# Examples

| Example                            | Shows                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [react-query](react-query)         | OpenAPI 3.1, React with TanStack Query hooks (queries, infinite queries, mutations with invalidation), Zod response validation, a typed mock API for Vite  |
| [node-javascript](node-javascript) | OpenAPI 3.0, a plain JavaScript Node.js project using the generated JavaScript client with JSDoc and `.d.ts` types, API-key auth, middleware, typed errors |
| [custom-plugin](custom-plugin)     | Swagger 2.0, two plugins: naming operations from a vendor extension, and emitting a typed operation catalog with documentation links                       |

Each example uses the local checkout of swaggerz (`"swaggerz": "file:../.."`). Build it once, then run an example:

```sh
yarn install && yarn build     # in the repository root
cd examples/react-query
npm install
npm run generate               # writes src/generated/api
npm run check                  # type-checks (and builds) the example
```

In your own project, install `swaggerz` from the registry instead and keep the rest of the setup. `node scripts/verify-examples.ts` (run in CI) does the same with the packed package.
