# Node.js JavaScript example

A plain JavaScript Node.js script using a client generated as JavaScript with JSDoc and `.d.ts` declarations from an OpenAPI 3.0 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:node-javascript   # from the repository root: build swaggerz, generate, run
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate   # src/generated/api (.js + .d.ts)
pnpm start      # calls the API, answered in process by the generated mocks (src/mocks.js)
pnpm check      # type-checks the JavaScript with `checkJs`
```

[src/index.js](src/index.js) configures the `apiKey` security scheme and a logging middleware, then creates and lists tasks (with an exploded array query parameter) and handles a `404` with the operation's error guard, which types the body by status. Editors show the generated types and documentation for every call.

Expected output:

```text
  createTask: POST http://localhost:3000/tasks → 201
Created task 2: Try swaggerz (todo)
  listTasks: GET http://localhost:3000/tasks?tag=demo&tag=docs → 200
Tasks tagged demo and docs: Try swaggerz
  getTask: GET http://localhost:3000/tasks/404 → 404
Expected failure: HTTP 404 — No task at /tasks/404
```

[src/mocks.js](src/mocks.js) implements the API with the generated Mock Service Worker handlers, generated as JavaScript too: fixtures (`makeTask`) seed an in-memory list, response functions read the query, the path parameters and the typed request body, check the API key and return the documented `404`. `setupServer()` from `msw/node` answers the client's requests inside the process. See [mocks](../../docs/mocks.md).
