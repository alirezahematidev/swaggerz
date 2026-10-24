# Migrating

This page compares swaggerz with the three generators people most often move from, using the same input: the repository's [`petstore-3.0.yaml`](../fixtures/specs/petstore-3.0.yaml) fixture. Every snippet below was type-checked against the real output of each tool. Versions used: openapi-typescript 7.13.0 with openapi-fetch 0.17.0, orval 8.44.0 and openapi-generator 7.26.0, on 23 October 2026.

```sh
npx openapi-typescript petstore-3.0.yaml -o out-oats/schema.d.ts
npx orval --config orval.config.cjs   # { input: './petstore-3.0.yaml', output: { target: './out-orval/petstore.ts', client: 'fetch', mode: 'tags-split' } }
npx openapi-generator-cli generate -i petstore-3.0.yaml -g typescript-fetch -o out-oag
npx swaggerz generate                 # { spec: { version: '3.0', input: './petstore-3.0.yaml' } }
```

## The steps, whatever you come from

1. `npx swaggerz init` creates a config: it finds the specification, its version, and the data-fetching library your `package.json` depends on.
2. Generate into a new directory next to the old client. The two do not share state, so both can live in the codebase while you move call sites over.
3. Configure `client` once at startup (base URL, auth, middleware), replacing the old client's setup.
4. Move call sites module by module, then delete the old client and its dependency.

## From openapi-typescript and openapi-fetch

openapi-typescript generates types only (one `.d.ts` file with `paths`, `components` and `operations`); openapi-fetch calls the API by path, typed by those types. swaggerz generates a function per operation, so calls are imported by name:

```ts
// openapi-typescript + openapi-fetch
const api = createClient<paths>({ baseUrl: 'https://petstore.example.com/api/v3' });
const { data, error, response } = await api.GET('/pet/{petId}', {
  params: { path: { petId: 10 } },
});
if (error !== undefined && response.status === 404) console.error(error.message);
```

```ts
// swaggerz
client.setConfig({ baseUrl: 'https://petstore.example.com/api/v3' });
try {
  const pet = await getPetById({ petId: 10 });
} catch (error) {
  if (isGetPetByIdApiError(error) && error.status === 404) console.error(error.body.message);
}
```

| openapi-typescript / openapi-fetch              | swaggerz                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `components['schemas']['Pet']`                  | `Pet`, imported from the client                                     |
| `createClient<paths>({ baseUrl })`              | `client.setConfig({ baseUrl })`, or `createClient()` for more       |
| `api.GET('/pet/{petId}', { params: { path } })` | `getPetById({ petId })`: path, query, header and body in one object |
| `{ data, error, response }`                     | Resolves with the data; rejects with `ApiError` or `RequestError`   |
| `api.use({ onRequest, onResponse })`            | `client.use({ onRequest, onResponse, onError })`                    |

What you gain: functions that tree-shake per operation, errors typed per status, request serialization from the specification (styles, forms, multipart), and optional hooks and schemas. What you give up: calling arbitrary paths by string, and openapi-fetch's thin runtime; the size of the swaggerz runtime is measured on the [benchmarks](benchmarks.md#bundle-size) page.

## From orval

orval's fetch client generates a function per operation with positional parameters, and every status, success or error, resolves with `{ data, status, headers }`:

```ts
// orval (client: 'fetch')
const result = await getPetById(10);
if (result.status === 404) console.error(result.data.message);
```

```ts
// swaggerz
const pet = await getPetById({ petId: 10 }); // errors reject; see "Errors" in the fetch and axios guide
```

| orval                                     | swaggerz                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `input`, `output.target`                  | `spec.input`, `output.directory`                                      |
| `client: 'react-query'` (`vue-query`, …)  | `features.query: { framework }`, or `features.swr`                    |
| `client: 'zod'`                           | `features.validation: 'zod'`: schemas, and validation inside calls    |
| `mode: 'tags-split'`                      | `output.groupBy: 'tag'` (the default)                                 |
| `override.mutator` (a custom fetcher)     | Middleware, or a custom transport (`createFetchTransport({ fetch })`) |
| Positional parameters `getPetById(petId)` | One object: `getPetById({ petId })`                                   |
| `{ data, status }` for every status       | `client.responseStyle: 'full'` for successes; errors still reject     |

Hook names stay the same (`useGetPetById`), but the parameters become one object, so call sites need a small change.

## From openapi-generator (typescript-fetch)

openapi-generator emits a class per tag, model converters (`PetFromJSON`) and a runtime, and needs Java. Its parameters are already one object, so calls look alike:

```ts
// openapi-generator, typescript-fetch
const api = new PetApi(new Configuration({ basePath: 'https://petstore.example.com/api/v3' }));
try {
  const pet = await api.getPetById({ petId: 10 });
} catch (error) {
  if (error instanceof ResponseError && error.response.status === 404)
    console.error(await error.response.text());
}
```

```ts
// swaggerz
const pet = await getPetById({ petId: 10 });
```

| openapi-generator (typescript-fetch)          | swaggerz                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| `new PetApi(new Configuration({ basePath }))` | Import `getPetById`; configure `client` once                 |
| `ResponseError` with the raw `Response`       | `ApiError` with the parsed body, typed by status             |
| `pre` / `post` middleware in `Configuration`  | `client.use({ onRequest, onResponse })`                      |
| `date-time` properties are `Date`s            | Strings by default; `types.dates: 'Date'` for `Date`s        |
| `Pet` and `NewPet` as written in the spec     | `Pet` and, where `readOnly` differs, `PetInput` for requests |

Because typescript-fetch converts dates by default, set `types.dates: 'Date'` to keep `Date` objects in your code. Operations are separate modules rather than methods of a class per tag, so an application bundles only the operations it imports.

## Limitations of this comparison

- It covers one fixture and one configuration of each tool; other options of these tools generate other code.
- The versions are the ones above; newer releases may differ.
