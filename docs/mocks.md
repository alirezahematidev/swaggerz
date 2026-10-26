# Mocks

Build the UI and write the tests before the backend exists, or without it. With `features.mocks`, swaggerz generates a [Mock Service Worker](https://mswjs.io) handler for every operation and a fixture factory for every model, typed like the client and kept in step with the specification.

```ts
features: { mocks: 'msw' },
```

| Library | Versions (checked by `pnpm compat`) | Directory |
| ------- | ----------------------------------- | --------- |
| MSW     | 2.11 – 2.x and 3.x                  | `mocks/`  |

Add `msw` as a development dependency. Only `mocks/` imports it, and the client's own barrel does not export the mocks: production code never loads them.

## What is generated

| Path                         | Content                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `mocks/models/<model>.ts`    | `makePet(overrides?)`: a new `Pet` made of the specification's examples or of generated values               |
| `mocks/<tag>/<operation>.ts` | `mockGetPetById(options?)`, its `GetPetByIdMockOptions` and what response functions receive (`…MockRequest`) |
| `mocks/handlers.ts`          | `mockHandlers(options?)`: a handler for every operation, the most specific paths first                       |
| `mocks/support.ts`           | `mockFetch()`, request matching and response building, copied into the client like the runtime               |
| `mocks/index.ts`             | The barrel                                                                                                   |

## Three ways to use them

**In Node.js tests**, MSW's `setupServer()` answers every request the process sends, from the client or from anything else:

```ts check=mocks
import { setupServer } from 'msw/node';
import { getPetById, isGetPetByIdApiError } from './generated/api';
import { makePet, mockGetPetById, mockHandlers } from './generated/api/mocks';

const server = setupServer(...mockHandlers());
server.listen({ onUnhandledFrame: 'error' }); // MSW 2: onUnhandledRequest

// Every handler responds with its first success status and an example body.
const pet = await getPetById({ petId: 1 }); // equal to makePet()

// Handlers added later take precedence, until `server.resetHandlers()`.
server.use(mockGetPetById({ status: 404 }));
try {
  await getPetById({ petId: 1 });
} catch (error) {
  if (isGetPetByIdApiError(error) && error.status === 404) console.log(error.body);
}

server.use(mockGetPetById({ body: makePet({ name: 'Rex' }) }));
server.resetHandlers();
server.close();
export { pet };
```

**Without intercepting anything**, `mockFetch(handlers)` is a `fetch` the handlers answer. Give it to the client's fetch transport: it works wherever `Request` and `Response` exist (Node.js, browsers, Deno, Bun, edge runtimes such as Cloudflare Workers), leaves the global `fetch` alone, and lets tests that run at the same time use handlers of their own:

```ts check=mocks
import { client, createClient, createFetchTransport, getPetById } from './generated/api';
import { makePet, mockFetch, mockGetPetById, mockHandlers } from './generated/api/mocks';

client.setConfig({ transport: createFetchTransport({ fetch: mockFetch(mockHandlers()) }) });
const pet = await getPetById({ petId: 1 }); // equal to makePet()

// A client of its own, for one test.
const sold = createClient({
  ...client.getConfig(),
  transport: createFetchTransport({
    fetch: mockFetch([mockGetPetById({ body: makePet({ status: 'sold' }) })]),
  }),
});
const soldPet = await getPetById({ petId: 1 }, { client: sold });
export { pet, soldPet };
```

A relative base URL (`/api`) resolves against `http://localhost` outside browsers. A request no handler answers rejects like a network error, or goes to `mockFetch(handlers, { fallback: fetch })`.

**In the browser**, start the worker before the app renders, in development only, so neither MSW nor the mocks reach the production bundle:

```ts
// src/main.tsx (Vite)
async function startMocks(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { setupWorker } = await import('msw/browser');
  const { mockHandlers } = await import('./generated/api/mocks');
  await setupWorker(...mockHandlers({ delay: 300 })).start({ onUnhandledFrame: 'bypass' });
}

startMocks().then(() => createRoot(root).render(<App />));
```

The worker script must be served from the site's root: with MSW 3 and Vite, add `{ ...msw({ mode: 'worker-only' }), apply: 'serve' }` (`msw` from `msw/vite`) to the Vite plugins, which serves it during `vite` and keeps it out of `vite build`; otherwise run `npx msw init public`. Every browser example runs entirely on the generated mocks: [React Query](../examples/react-query/README.md), [Vue Query](../examples/vue-query/README.md), [Svelte Query](../examples/svelte-query/README.md), [Solid Query](../examples/solid-query/README.md) and [SWR](../examples/swr/README.md), and [Node.js](../examples/node-javascript/README.md) with the JavaScript output.

## Statuses and bodies

The options of a handler select a documented response and its body; `status` and `body` are typed together, as `ApiError` is typed by status:

| Option         | Default                      |                                                                                                      |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `status`       | the first success status     | A documented status, a status a range (`4XX`) or `default` covers, or any other one (`unknown` body) |
| `body`         | the response's example body  | A value, or a function of the request returning one (possibly a promise)                             |
| `headers`      | the documented required ones | Headers added to the response                                                                        |
| `delay`        | none                         | Milliseconds, `'real'` (a realistic server time in browsers) or `'infinite'` (to see loading states) |
| `networkError` | `false`                      | Fail like a network error instead of responding (the client rejects with a `RequestError`)           |
| `once`         | `false`                      | Respond to the first matching request only                                                           |
| `baseUrl`      | the client's (see below)     | The base URL requests must start with                                                                |
| `client`       | the generated `client`       | Match the base URL of another client (`createClient()`) instead                                      |

`mockHandlers(options)` passes its options (`baseUrl`, `client`, `delay`, `headers`, `networkError`, `once`) to every handler.

A response function receives the request, its decoded path parameters, its query string and its cookies, and `body()` reads the request body by its media type: parsed JSON typed as the operation's body (with dates revived when `types.dates` is `'Date'`), `FormData`, `URLSearchParams`, text or a `Blob`, and `undefined` without a body. That is enough to keep state between requests:

```ts check=mocks
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Pet } from './generated/api';
import { makePet, mockAddPet, mockFindPetsByStatus, mockGetPetById } from './generated/api/mocks';

const pets: Pet[] = [makePet({ id: 1 }), makePet({ id: 2, status: 'sold' })];
export const server = setupServer(
  mockFindPetsByStatus({
    body: ({ query }) => pets.filter((pet) => pet.status === (query.get('status') ?? 'available')),
  }),
  mockAddPet({
    body: async ({ body }) => {
      const pet = { ...(await body()), id: pets.length + 1 };
      pets.push(pet);
      return pet;
    },
  }),
  mockGetPetById({
    body: ({ params }) =>
      pets.find((pet) => pet.id === Number(params.petId)) ??
      HttpResponse.json({ code: 404, message: 'Not found' }, { status: 404 }),
  }),
);
```

As the last handler shows, a response function may also return a `Response`, which is sent as it is: a status that depends on the request, or `Response.error()` for a network failure. Bodiless responses (`204`) take a function too, for its side effects. The examples' `src/mocks.ts` serve a whole in-memory API this way.

## Fixtures

`makePet()` returns a new object on every call, always the same one: values come from the specification where it has them, otherwise from a generator seeded by the schema's location, so they do not change between runs or machines and there is no faker dependency.

- **Examples first**: a schema's `example`/`examples` (and, for response bodies, the media type's examples), then `default` for scalars. Examples that do not match their schema are replaced by generated values (`mock/invalid-example`); properties the type does not declare are left out.
- **Generated values satisfy the schema**: type, the first enum value or `const`, `minLength`/`maxLength`, `pattern`, `format` (`date-time`, `date`, `time`, `email`, `uuid`, `uri`, `hostname`, `ipv4`, `ipv6`, `byte` and others), numeric bounds and `multipleOf`, `minItems`/`maxItems` (one item by default), optional properties (included), `minProperties`/`maxProperties`, discriminator values, `if`/`then`/`else`, `dependentSchemas`, `dependentRequired` and `not`. Strings are placeholder words (`'dolor magna'`), or shaped by the property's name (`email`, `url`, `…Id`).
- **References call the referenced fixture** (`owner: makePerson()`), so changing one example changes every fixture that contains it. The members of an `allOf` of objects are merged into one object instead, as their types are.
- **Recursion ends**: a fixture never calls itself, directly or through the models that lead back to it. Optional properties are left out, nullable ones are `null` and arrays empty; a model that requires itself has no finite value (`mock/unsatisfiable`).
- **Overrides**: models whose type is one object type take `Partial<Model>` overrides (`makePet({ name: 'Rex' })`); unions, records and other types take none.
- **Dates**: with `types.dates: 'Date'`, date fields are `Date` objects, and handlers send them in their wire format.
- **Impossible values** (a discriminated variant whose own discriminator property excludes its mapped value, contradictory constraints) are reported as `mock/unsatisfiable`. Optional properties are left out; a fixture that still cannot match its schema is cast to its type, so the generated code compiles.

The integration tests check every fixture of the test specifications against the generated Zod, Valibot and ArkType schemas, call every operation of them through its default handler with response validation on, and `pnpm corpus` type-checks the mocks of 24 public API descriptions.

## Matching requests

- **Base URL**: a handler matches requests below the base URL the client sends them to, read when the request arrives: the client's current `baseUrl`, or the operation's own server (`client.operationServers`). Changing it with `client.setConfig()` before or after creating the handlers works. For another client, pass `client` (or `baseUrl`). A relative base URL (`/api`) matches the page's origin in a browser and any origin elsewhere.
- **Paths** are compared segment by segment after percent-decoding, so paths that MSW's path syntax cannot express work too (`/files/{name}:download`, parameter names with dashes); `label` and `matrix` path parameters are unwrapped. Methods are compared as MSW compares them (`Patch` is `PATCH`), including OpenAPI 3.2 methods such as `QUERY`.
- **Order**: `mockHandlers()` lists literal segments before parameters (`/pets/mine` before `/pets/{petId}`), as MSW uses the first handler that matches.
- **CORS**: handlers answer CORS preflights for their route and add `Access-Control-Allow-Origin` to responses for requests from a page, so cross-origin requests also work in DOM test environments that check CORS (happy-dom). A path with an `OPTIONS` operation of its own answers plain `OPTIONS` requests with that operation.
- `HEAD` responses never have a body. Query strings and headers are not matched; read them in a response function.

## Environments and frameworks

The handlers are ordinary MSW handlers: anything that takes MSW handlers (Storybook's `msw-storybook-addon`, Playwright fixtures, Jest setups) takes them. What swaggerz's own tests run:

| Environment                                          | How                                          | Verified by                      |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------- |
| Node.js (Vitest), fetch and axios adapters           | `setupServer()` from `msw/node`              | integration tests                |
| happy-dom, fetch and axios adapters                  | `setupServer()`, relative and cross-origin   | integration tests                |
| Chromium, Firefox, WebKit: React, Vue, Svelte, Solid | `setupWorker()`, TanStack Query and SWR apps | `pnpm examples:browsers`         |
| Node.js, Deno, Bun, browsers, workerd                | `mockFetch()`                                | `pnpm test:runtimes`             |
| MSW 2.11 and 3                                       | types, and handlers at runtime               | `pnpm compat`, integration tests |

- **MSW 3** renamed the `onUnhandledRequest` option of `listen()` and `start()` to `onUnhandledFrame`; the generated code works with both versions.
- **Deno** needs `--allow-env` for MSW, and importing MSW keeps the process running (call `Deno.exit()` at the end of a script).
- **Cloudflare Workers (workerd)** need the `nodejs_compat` compatibility flag: without `process`, MSW takes the runtime for a browser and needs `localStorage`.

### Vitest

```ts
// vitest.setup.ts (setupFiles in vitest.config.ts)
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { mockHandlers } from './src/generated/api/mocks';

export const server = setupServer(...mockHandlers());
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

A test then overrides what it needs with `server.use(mockGetPetById({ status: 404 }))`. Tests that run concurrently, or a runtime MSW cannot intercept, use `mockFetch()` instead.

### Storybook

```ts
// Pet.stories.tsx, with msw-storybook-addon
export const NotFound = {
  parameters: { msw: { handlers: [mockGetPetById({ status: 404 })] } },
};
```

## Diagnostics

- `mock/invalid-example` (warning): an `example` or `default` does not match its schema; the fixture uses a generated value instead.
- `mock/unsatisfiable` (warning): no generated value satisfies a schema; the fixture may not validate (and is cast to its type).
- `mock/unsupported-pattern` (info): no string matching a `pattern` was generated.

## Limitations

- Webhooks and callbacks get no handlers: they are requests the API sends, not ones it receives.
- `pattern` is parsed, never executed (specifications are untrusted input). Lookarounds, backreferences and Unicode property escapes are not supported; such strings get a placeholder (`mock/unsupported-pattern`). The generated validators do not enforce patterns either.
- XML and other structured text responses are sent as placeholder text; sequential media types (`itemSchema`) as text, as the client reads them.
- A fixture is one value per model; vary it with overrides (`Array.from({ length: 3 }, (_, i) => makePet({ id: i + 1 }))`).
