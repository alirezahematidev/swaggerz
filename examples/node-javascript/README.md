# Node.js JavaScript example

A plain JavaScript Node.js script using a client generated as JavaScript with JSDoc and `.d.ts` declarations from an OpenAPI 3.0 document ([openapi.yaml](openapi.yaml)).

```sh
pnpm example:node-javascript   # from the repository root: build swaggerz, generate, run
```

Or, inside this directory once swaggerz is built:

```sh
pnpm generate   # src/generated/api (.js + .d.ts)
pnpm start      # starts a local in-memory API (src/server.js) and calls it
pnpm check      # type-checks the JavaScript with `checkJs`
```

[src/index.js](src/index.js) configures the base URL, the `apiKey` security scheme and a logging middleware, then creates and lists tasks (with an exploded array query parameter) and handles a `404` with the operation's error guard, which types the body by status. Editors show the generated types and documentation for every call.

Expected output (ports vary):

```text
  createTask: POST http://127.0.0.1:53816/tasks → 201
Created task 2: Try swaggerz (todo)
  listTasks: GET http://127.0.0.1:53816/tasks?tag=demo&tag=docs → 200
Tasks tagged demo and docs: Try swaggerz
  getTask: GET http://127.0.0.1:53816/tasks/404 → 404
Expected failure: HTTP 404 — No task at /tasks/404
```
