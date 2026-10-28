# Mocks

Build the UI and write the tests before the backend exists, or without it. With `features.mocks`, swaggerz generates a [Mock Service Worker](https://mswjs.io) handler for every operation, a fixture factory for every model and request mocks for every webhook, typed like the client and kept in step with the specification. Their data is realistic (names, emails, task titles, prices, pictures, PDFs…), covers every state the schemas allow, and is the same on every run, without a dependency.

```ts
features: { mocks: 'msw' },
```

| Library | Versions (checked by `pnpm compat`) | Directory |
| ------- | ----------------------------------- | --------- |
| MSW     | 2.11 – 2.x and 3.x                  | `mocks/`  |

Add `msw` as a development dependency. Only `mocks/` imports it, and the client's own barrel does not export the mocks: production code never loads them.

## What is generated

| Path                              | Content                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `mocks/models/<model>.ts`         | `makePet(overrides?, options?)`: a new `Pet`, the specification's examples or another realistic pet for a seed |
| `mocks/<tag>/<operation>.ts`      | `mockGetPetById(options?)`, its `GetPetByIdMockOptions` and what response functions receive (`…MockRequest`)   |
| `mocks/webhooks/…`, `callbacks/…` | `makeAccountClosedWebhookRequest()` and `sendAccountClosedWebhook(url)`, for testing what receives them        |
| `mocks/handlers.ts`               | `mockHandlers(options?)`: a handler for every operation, the most specific paths first                         |
| `mocks/start.ts`                  | `startMocks(options?)`: starts the mocks in the browser; imports nothing until it is called                    |
| `mocks/fake.ts`                   | The seeded fake data fixtures are made of: vocabularies, patterns, dates, files, XML and streams               |
| `mocks/support.ts`                | `mockFetch()`, request matching and response building, copied into the client like the runtime                 |
| `mocks/index.ts`                  | The barrel                                                                                                     |

## Three ways to use them

**In Node.js tests**, MSW's `setupServer()` answers every request the process sends, from the client or from anything else:

```ts check=mocks
import { setupServer } from 'msw/node';
import { getPetById, isGetPetByIdApiError } from './generated/api';
import { makePet, mockGetPetById, mockHandlers } from './generated/api/mocks';

const server = setupServer(...mockHandlers());
server.listen({ onUnhandledFrame: 'error' }); // MSW 2: onUnhandledRequest

// Every handler responds with its first success status and a realistic body: a pet whose `id`
// is 1, the same pet for every request for it.
const pet = await getPetById({ petId: 1 });

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
const pet = await getPetById({ petId: 1 });

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

**In the browser**, `startMocks()` starts Mock Service Worker with the generated handlers, and resolves when it is ready. Call it before the app renders, behind your bundler's development check:

```ts
// src/main.tsx (Vite)
import { startMocks } from './generated/api/mocks/start';

if (import.meta.env.DEV) await startMocks({ delay: 'real' });
createRoot(root).render(<App />);
```

`mocks/start` imports nothing until `startMocks()` is called: it then loads MSW and the handlers. Behind the development check (`import.meta.env.DEV` with Vite, `process.env.NODE_ENV !== 'production'` with webpack or Next.js), the bundler drops the call, so production builds contain neither MSW nor the mocks, not even as a separate chunk. Its options:

| Option             | Default                 |                                                                                        |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------- |
| `handlers`         | none                    | Handlers of your own, which take precedence: a list, or a function that loads one      |
| `onUnhandled`      | `'bypass'`              | Requests no handler answers: sent to the network, `'warn'`ed about, or `'error'`       |
| `log`              | `false`                 | Log every mocked request in the console                                                |
| `serviceWorkerUrl` | `/mockServiceWorker.js` | Where the worker script is served                                                      |
| settings           |                         | `delay`, `seed`, `empty`, `error`, … are passed to every generated handler (see below) |

It resolves with MSW's worker, for `worker.use(…)` later. Your own handlers stay out of production builds too when you pass a function that imports them: `startMocks({ handlers: () => import('./mocks').then((mocks) => mocks.handlers) })`, as the examples do.

The worker script must be served from the site's root: with MSW 3 and Vite, add `{ ...msw({ mode: 'worker-only' }), apply: 'serve' }` (`msw` from `msw/vite`) to the Vite plugins, which serves it during `vite` and keeps it out of `vite build`; otherwise run `npx msw init public`. Every browser example runs entirely on the generated mocks: [React Query](../examples/react-query/README.md), [Vue Query](../examples/vue-query/README.md), [Svelte Query](../examples/svelte-query/README.md), [Solid Query](../examples/solid-query/README.md) and [SWR](../examples/swr/README.md), and [Node.js](../examples/node-javascript/README.md) with the JavaScript output.

## Fixtures

`makePet()` returns a new object on every call, always the same one: the specification's examples where it has them, realistic generated values elsewhere. A seed makes another pet, the same one every time; seed `0` is the examples:

```ts check=mocks
import { makePet } from './generated/api/mocks';

const rex = makePet({ name: 'Rex' }); // the examples, with a name of your own
const another = makePet({}, { seed: 7 }); // another realistic pet, the same on every run
// Twenty different pets: statuses, tags and optional properties vary from one to the next.
const pets = Array.from({ length: 20 }, (_, index) => makePet({}, { seed: index + 1 }));
// Arrays as short as their schema allows, to see empty states.
const bare = makePet({}, { empty: true });
export { another, bare, pets, rex };
```

Values are chosen by what a property is, from its format, its name and the model it belongs to, then fitted to its schema:

| What               | Values                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| People             | `name` of a `User`, `Member`, `Author`… is a full name; `firstName`, `username`, `jobTitle`, `phone`. The `name`, `email` and `username` of one object belong to the same person (`Chen Brown`, `chen.brown@acme.dev`) |
| Things             | `name` of a `Project`, `Product`, `Company`, `Label`, `File`…; a `Task`'s `title` (`Fix the login redirect`)                                                                                                           |
| Text               | `description`, `body`, `bio`: paragraphs; `comment`, `message`, `note`, `summary`: sentences. An example's wording comes back with its numbers and codes changed, never word for word                                  |
| Errors             | In error models, `status` is the response's status, `title` its reason phrase, `detail` or `message` what went wrong (see below)                                                                                       |
| Contact and places | `email` (keeping an example's domain), `url` (keeping its origin), `street`, `city`, `country`, `postalCode`                                                                                                           |
| Identifiers        | `uuid`, an example's shape kept (`usr_3k9f2a7d1b` → `usr_8q2m5x0c7e`, `WEB-12` → `QAP-48`), tokens, page cursors, hashes                                                                                               |
| Media              | `avatarUrl`, `imageUrl`: colorful SVG pictures as `data:` URLs, which render offline; `color`, `mimeType`, `fileName`                                                                                                  |
| Numbers            | `price` and `amount` as money, `age`, `rating`, counts (`commentCount`: 0–50), percentages, coordinates                                                                                                                |
| Booleans           | `archived`, `deleted`, `disabled` rarely `true`; `active`, `enabled`, `verified` usually                                                                                                                               |
| Dates              | `createdAt`, `updatedAt` before the example (or 2026-01-01), `dueDate` around it, `expiresAt` after it, `birthDate` decades before                                                                                     |
| Formats            | `email`, `uuid`, `uri`, `hostname`, `ipv4`, `ipv6`, `byte`, `date-time`, `duration`, `iban`, `isbn`, `semver`…                                                                                                         |
| Files              | Binary values and bodies are real files of their media type: PNG, JPEG, GIF, WebP, SVG, PDF, WAV, CSV, ZIP                                                                                                             |

- **Every state, in turn**: across seeds, values take every enum value, every member of a union, `null` where it is allowed and every optional property's absence; arrays vary in length (a list's items more, and at least one; nested arrays fewer, and sometimes none; none at all in empty states, so a list is only empty when `empty` asks for it). The examples' value keeps every optional property, and the first item of its arrays is made of examples too.
- **Errors describe their status**: in an error model (a model named like `Problem`, `Error`, `ErrorResponse`, `…Exception`, or with the `title`, `status` and `detail` of RFC 9457 Problem Details), `status` is the status the body is sent with, `title` (or `error`) its reason phrase, `detail` or `message` what went wrong, `code` the status as a code written like the example (`NOT_FOUND`, `not-found`), `type` a problem URI and `instance` a `urn:uuid:`. The errors of single fields (`{ field, message }`, `{ pointer, detail }`) name a field and what is wrong with it. Handlers pass the status they respond with; a fixture takes it too (`makeProblem({}, { status: 503 })` is a `Service Unavailable` problem), and without one each seed describes an error status of its own, with fields that agree. An error model's examples describe one status (its status property's example, `404` without one): they are kept for that status, and a body sent with another status describes that one instead.
- **Constraints hold for every seed**: `minLength`/`maxLength`, `pattern`, numeric bounds and `multipleOf`, `minItems`/`maxItems`, `uniqueItems`, `minProperties`/`maxProperties`, discriminator values, and for the examples `if`/`then`/`else`, `dependentSchemas`, `dependentRequired` and `not`. Every fixture is tried with several seeds against its schema when it is generated; one whose variants do not all match, and every value with such assertions, keeps its examples for every seed.
- **Patterns** use the whole ECMAScript syntax, lookarounds, backreferences and Unicode property escapes included. They are parsed, never executed (specifications are untrusted input): generated strings are checked by a matcher of the parsed pattern with a step budget.
- **Examples first**: a schema's `example`/`examples` (and, for response bodies, the media type's examples), then `default` for scalars. Examples that do not match their schema are replaced by generated values (`mock/invalid-example`); properties the type does not declare are left out.
- **References call the referenced fixture** with a seed of their own (`owner: makePerson(undefined, f.at('owner'))`), so changing one example changes every fixture that contains it. The members of an `allOf` of objects are merged into one object instead, as their types are.
- **Recursion ends**: a fixture never calls itself, directly or through the models that lead back to it. Optional properties are left out, nullable ones are `null` and arrays empty; a model that requires itself has no finite value (`mock/unsatisfiable`).
- **Overrides**: models whose type is one object type take `Partial<Model>` overrides (`makePet({ name: 'Rex' })`); unions, records and other types take the options only (`makeStatus({ seed: 2 })`).
- **Dates**: with `types.dates: 'Date'`, date fields are `Date` objects, and handlers send them in their wire format.
- **Impossible values** (a discriminated variant whose own discriminator property excludes its mapped value, contradictory constraints) are reported as `mock/unsatisfiable`. Optional properties are left out; a fixture that still cannot match its schema is cast to its type, so the generated code compiles.

The integration tests validate every fixture of the test specifications, for the examples, 25 other seeds and empty states, with the generated Zod, Valibot and ArkType schemas, and call every operation through its default handler with response validation on; `pnpm corpus` type-checks the mocks of 24 public API descriptions.

## Responses

The options of a handler select a documented response and its body; `status` and `body` are typed together, as `ApiError` is typed by status:

| Option         | Default                      |                                                                                                      |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `status`       | the first success status     | A documented status, a status a range (`4XX`) or `default` covers, or any other one (`unknown` body) |
| `body`         | generated for the request    | A value, or a function of the request returning one (possibly a promise)                             |
| `seed`         | `'request'`                  | A number makes every default body with that seed (`0`: the examples, as `makePet()`)                 |
| `empty`        | `false`                      | Default bodies' arrays as short as their schema allows                                               |
| `error`        | `false`                      | Respond with the operation's first documented error status (`500` without one)                       |
| `headers`      | the documented required ones | Headers added to the response                                                                        |
| `delay`        | none                         | Milliseconds, `'real'` (a realistic server time in browsers) or `'infinite'` (to see loading states) |
| `networkError` | `false`                      | Fail like a network error instead of responding (the client rejects with a `RequestError`)           |
| `once`         | `false`                      | Respond to the first matching request only                                                           |
| `baseUrl`      | the client's (see below)     | The base URL requests must start with                                                                |
| `client`       | the generated `client`       | Match the base URL of another client (`createClient()`) instead                                      |

`mockHandlers(options)` passes the settings (all but `status` and `body`) to every handler, so one line shows a whole screen in another state:

| State       | Handlers                               |
| ----------- | -------------------------------------- |
| Loading     | `mockHandlers({ delay: 'infinite' })`  |
| Empty lists | `mockHandlers({ empty: true })`        |
| Errors      | `mockHandlers({ error: true })`        |
| Offline     | `mockHandlers({ networkError: true })` |
| Slow        | `mockHandlers({ delay: 'real' })`      |
| Examples    | `mockHandlers({ seed: 0 })`            |

**Default bodies are generated for each request**, so screens look like a real API's:

- A request without parameters gets the examples (the first page of a list starts with `makePet()`); other requests get values seeded by their path parameters and query string. The same request always gets the same body, and different pages different items, so infinite lists end where a cursor is `null`.
- Error responses (`status: 404`, `error: true`) describe their status: `{ title: 'Not Found', status: 404, detail: 'No resource matches this ID.' }`, whatever seed made them.
- Path parameters reappear where the body repeats them: `GET /projects/{projectId}/tasks` lists tasks whose `projectId` is the parameter, and `GET /tasks/{taskId}` returns a task whose `id` is `taskId`.
- An `id` a fixture made is remembered: requesting it (`GET /tasks/{taskId}` after a list showed that task) returns the same entity, so lists and detail views agree.

A response function receives the request, its decoded path parameters, its query string and its cookies, and `body()` reads the request body by its media type: parsed JSON typed as the operation's body (with dates revived when `types.dates` is `'Date'`), `FormData`, `URLSearchParams`, text or a `Blob`, and `undefined` without a body. `generated()` returns the body the handler would respond with otherwise (generated for this request, typed as the default status's body), for a function that only changes or completes it:

```ts check=mocks
import { mockFindPetsByStatus, mockGetPetById } from './generated/api/mocks';

export const renamed = mockGetPetById({
  body: ({ generated }) => ({ ...generated(), name: 'Rex' }),
});
export const fewer = mockFindPetsByStatus({ body: ({ generated }) => generated().slice(0, 2) });
```

That is enough to keep state between requests:

```ts check=mocks
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Pet } from './generated/api';
import { makePet, mockAddPet, mockFindPetsByStatus, mockGetPetById } from './generated/api/mocks';

const pets: Pet[] = Array.from({ length: 12 }, (_, index) =>
  makePet({ id: index + 1 }, { seed: index + 1 }),
);
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

### XML, streams and files

- **XML** responses (`application/xml`, `text/xml`, `…+xml`) are XML documents written as the schemas' XML Objects describe: element and attribute names, `wrapped` arrays, namespaces and prefixes, and OpenAPI 3.2 `nodeType` (`text`, `cdata`, `none`). The root element is named by its XML Object, then by the referenced component.
- **Sequential media types** (OpenAPI 3.2 `itemSchema`) are a series of generated items: JSON Lines and NDJSON one per line, `application/json-seq` as JSON text sequences, `text/event-stream` as server-sent events (`event`, `id`, `retry` and `data` fields).
- **Binary** responses are real files of their media type (a PNG picture for `image/png`, a PDF, a WAV sound…); wildcards and `application/octet-stream` follow the property's name (`avatar`, `invoice`).

A `body` you pass is sent as it is (a string for XML); default bodies get the path parameters before they are written.

## Webhooks and callbacks

Webhooks and callbacks are requests the API sends. For each, the mocks make a request the API could send, to call your handler with in tests, and send it to a URL, to test your route end to end:

```ts check=webhooks
import type { AccountClosedWebhookHandler } from './generated/api';
import { makeAccountClosedWebhookRequest, sendAccountClosedWebhook } from './generated/api/mocks';

const onAccountClosed: AccountClosedWebhookHandler = async ({ body }) => ({
  received: body.id !== '',
});

// Your handler, called with a request the API could send (another one with `{ seed: 2 }`).
const result = await onAccountClosed(makeAccountClosedWebhookRequest());

// Your route, sent the request the way the API sends it: method, headers, query and the body
// in its media type. Pass another `fetch` (a test agent, `mockFetch()`) and extra headers.
const response = await sendAccountClosedWebhook(
  'http://localhost:3000/hooks/account-closed',
  undefined,
  {
    headers: { 'x-signature': 'test' },
  },
);
export { response, result };
```

Callbacks get the same functions, named after their operation and callback (`makeCreateAccountAccountEventCallbackRequest`, `sendCreateAccountAccountEventCallback`). Without `output.webhooks`, there are no webhook types, and no webhook mocks.

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
| Astro and Next.js, pages rendered at build time      | `mockFetch()` as the client's `fetch`        | the examples, built in CI        |
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

A test then overrides what it needs with `server.use(mockGetPetById({ status: 404 }))`, or asserts what a fixture says: `server.use(mockGetPetById({ body: makePet() }))` and then `expect(screen.getByText(makePet().name))`. Tests that run concurrently, or a runtime MSW cannot intercept, use `mockFetch()` instead.

### Storybook

```ts
// Pet.stories.tsx, with msw-storybook-addon
export const NotFound = {
  parameters: { msw: { handlers: [mockGetPetById({ status: 404 })] } },
};
export const Empty = {
  parameters: { msw: { handlers: mockHandlers({ empty: true }) } },
};
```

## Diagnostics

- `mock/invalid-example` (warning): an `example` or `default` does not match its schema; the fixture uses a generated value instead.
- `mock/unsatisfiable` (warning): no generated value satisfies a schema; the fixture may not validate (and is cast to its type).
- `mock/unsupported-pattern` (info): no string matching a `pattern` was found (it is not a valid ECMAScript pattern, no string matches it within the length bounds, or the matcher's step budget ran out).

## Limitations

- Handlers keep no state: a request that creates or updates something responds with generated values, and later requests do not see the change. Keep state in response functions, as the examples do.
- Values are generated property by property: they satisfy each schema, but do not follow rules between properties that the schema does not state (a `done` task's `completedAt`, a page's `total` and its items). The exceptions are the person an object names and the status an error describes.
- Vocabularies are English.
- Values of schemas with `not`, `if`/`then`/`else`, `dependentSchemas` or `dependentRequired`, and fixtures whose variants do not all match their schema, are the examples' for every seed.
