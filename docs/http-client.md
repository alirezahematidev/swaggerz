# Fetch and axios

Every generated client talks to the API through a **transport**: `fetch` (the default, with no dependency) or `axios` (`client.adapter: 'axios'`). Both sit behind one contract, so operations, errors, middleware and data-fetching hooks behave the same with either. Only the selected transport is generated.

## Configuring the client

`client.ts` exports `client`, the instance every operation uses. Configure it once at startup:

```ts check
import { client } from './generated/api';

client.setConfig({
  baseUrl: 'https://petstore3.swagger.io/api/v3',
  headers: { 'x-app-version': '1.4.0' },
  // Keys are security scheme names from the specification; functions run for every request.
  auth: {
    api_key: () => sessionStorage.getItem('apiKey') ?? undefined,
    petstore_auth: () => localStorage.getItem('accessToken') ?? undefined,
  },
  timeout: 10_000,
});
```

`setConfig` merges into the current configuration and `getConfig()` returns a copy of it. `headers` may also be a function (sync or async) that computes headers per request.

**Authentication.** `auth` values are strings or functions per security scheme. API keys are sent where the scheme says (header, query or cookie); HTTP bearer, OAuth 2 and OpenID Connect values are sent as `Authorization: Bearer <token>`; HTTP basic values are `username:password` and are base64-encoded. When an operation lists several security requirements, the first one whose credentials are all configured is used. A function returning `undefined` means "no credentials", so the next requirement is tried.

**Base URL.** It defaults to the specification's first server (`client.baseUrl` in the config changes the compiled default). Operations that declare their own `servers` are sent there; see [servers](servers.md).

## Calling an operation

Every operation takes one `params` object (path, query, header and cookie parameters, and `body`) and per-call options:

```ts check
import { findPetsByStatus, getPetById } from './generated/api';

const controller = new AbortController();
const pet = await getPetById({ petId: 10 }, { timeout: 5_000, signal: controller.signal });
const available = await findPetsByStatus(
  { status: 'available' },
  { headers: { 'x-request-id': crypto.randomUUID() } },
);
console.log(pet.name, available.length);
```

| Option             | Effect                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `signal`           | Cancels the request. The call rejects with the signal's own abort error.                   |
| `timeout`          | Milliseconds for this call (overrides the client default); covers retries and their waits. |
| `headers`          | Extra headers; an `undefined` value removes a header.                                      |
| `baseUrl`          | Sends this call elsewhere; wins over operation servers.                                    |
| `parseAs`          | Reads a successful body as `'json'`, `'text'`, `'blob'`, `'arrayBuffer'` or `'stream'`.    |
| `transportOptions` | Passed to the transport: `RequestInit` fields for fetch, an axios request config.          |
| `client`           | Uses another client instance (see below).                                                  |

## Errors

Operations resolve with the response body and reject with one of two errors:

- **`ApiError`** for statuses that are neither 2xx nor a declared 3xx. Each operation types it per documented status (`<Name>ApiError`) and exports a guard, so checking `status` narrows `body`.
- **`RequestError`** when no usable response arrived. Its `kind` is `'network'`, `'timeout'`, `'parse'`, `'serialization'` or `'validation'`.

```ts check
import { getPetById, isGetPetByIdApiError, isRequestError } from './generated/api';

try {
  await getPetById({ petId: 10 });
} catch (error) {
  if (isGetPetByIdApiError(error)) {
    if (error.status === 404) console.error('Not found:', error.body.message);
    else console.error('HTTP', error.status, error.body);
  } else if (isRequestError(error) && error.kind === 'timeout') {
    console.error('The API did not answer in time.');
  } else {
    throw error; // an abort, or a bug
  }
}
```

> [!NOTE]
> Checking `status` narrows `body` because every member of `<Name>ApiError` has its own status type; undocumented statuses get a member whose body is `unknown`.

`ApiError` carries `status`, `statusText`, `body`, `headers`, `response` (the raw response), `operationId`, `method` and `url`. Aborting rethrows the original abort error rather than wrapping it, so `signal.aborted` checks and `AbortError` handling work as with plain `fetch`. The types are described in [generated code](generated-code.md#errors).

## Middleware

Middleware runs around every request, in registration order. `client.use()` returns a function that removes it.

```ts check
import { client } from './generated/api';

const remove = client.use({
  onRequest({ request }) {
    request.headers.set('x-request-id', crypto.randomUUID());
  },
  onResponse({ response, operation }) {
    if (response.status === 401) console.warn(`${operation.operationId} needs authentication`);
  },
  onError({ error, operation }) {
    console.error(`${operation.operationId} failed`, error);
  },
});
remove();
```

`onRequest` may return a replacement request; `onResponse` and `onError` may return a response (to recover) or `retry()` from their context to send the request again. The exact contract is in [generated code](generated-code.md#middleware).

## Retries and token refresh

Two middleware are built in. They are opt-in and bundlers drop them when they are not imported.

```ts check
import { client, refreshAuth, retry } from './generated/api';

// Idempotent methods only, jittered exponential backoff, honors Retry-After and cancellation.
client.use(retry({ attempts: 3, statuses: [429, 502, 503, 504] }));

// On 401: one refresh shared by every failing request, then each request is sent once more.
client.use(
  refreshAuth({
    scheme: 'petstore_auth',
    refresh: async () => (await fetch('/token', { method: 'POST' })).text(),
  }),
);
```

`retry()` retries `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`, `TRACE` and `QUERY` requests (and any request with an `Idempotency-Key` header) on `408`, `429`, `500`, `502`, `503`, `504` and network failures by default. `refreshAuth()` only refreshes for operations that have security requirements, so a login endpoint never triggers it; a request is replayed at most once.

## Several clients

For multi-tenant servers or per-request credentials, create more clients and pass one per call:

```ts check
import { client, createClient, getPetById } from './generated/api';

const tenant = createClient({
  ...client.getConfig(),
  baseUrl: 'https://tenant-a.example.com/api/v3',
});
await getPetById({ petId: 10 }, { client: tenant });
```

Data-fetching hooks accept a client the same way (`{ request: { client } }`).

## fetch

The fetch transport uses the global `fetch`. Supply another implementation, or fetch options per call:

```ts check
import { client, createFetchTransport, findPetsByStatus } from './generated/api';

// Any fetch-compatible function, for example one that adds tracing.
const tracedFetch: typeof fetch = (input, init) => fetch(input, init);
client.setConfig({ transport: createFetchTransport({ fetch: tracedFetch }) });

await findPetsByStatus({ status: 'available' }, { transportOptions: { cache: 'no-store' } });
```

## axios

With `client.adapter: 'axios'`, the client uses the default axios instance. Reuse your own instance and its interceptors:

```ts check=axios
import axios from 'axios';
import { client, createAxiosTransport } from './generated/api';

const http = axios.create({ withCredentials: true });
http.interceptors.request.use((config) => config);
client.setConfig({ transport: createAxiosTransport(http) });
```

HTTP errors still reject with `ApiError`: the `AxiosError` is its `cause` and the `AxiosResponse` its `response`. Bodies are serialized by the generated runtime before they reach axios, and responses are read as bytes and decoded by the runtime exactly as with fetch, so both transports return the same data for the same response.

## Full responses

`client.responseStyle: 'full'` makes operations resolve with `{ data, status, headers }`, typed as one member per documented success status:

```ts check=full
import { getPetById } from './generated/api';

const response = await getPetById({ petId: 10 });
if (response.status === 200) console.log(response.data.name, response.headers.get('etag'));
```

## Limitations

- Retries never resend a request body that is a stream.
- Browsers do not let scripts set the `Cookie` header, so cookie parameters only reach the server from Node.js and other server runtimes; in a browser, use `includeCredentials: true` and let the browser send its cookies.
- `int64` values are `number`s: beyond 2^53 they lose precision when the response JSON is parsed.
