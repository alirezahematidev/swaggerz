# Validation

TypeScript types disappear at runtime: a server that sends `"id": "42"` where the specification says `integer` still type-checks. With `features.validation`, swaggerz also generates a schema for every model and checks responses (and, if you want, request bodies) against them as they cross the wire.

```ts
features: { validation: 'zod' }, // or 'valibot', 'arktype'
// or, with options:
features: { validation: { library: 'zod', response: true, request: true } },
```

| Library | Versions (checked by `pnpm compat`) | Directory  | Failure `cause`            |
| ------- | ----------------------------------- | ---------- | -------------------------- |
| Zod     | 4.0.15 – 4.x                        | `zod/`     | `ZodError`                 |
| Valibot | 1.0.0 – 1.x                         | `valibot/` | `ValiError`                |
| ArkType | 2.0.0 – 2.x (TypeScript 5.4+)       | `arktype/` | ArkType's `TraversalError` |

## What is validated

- **Responses** (`response`, default `true`): the body of every successful response is parsed with its schema before the operation resolves.
- **Request bodies** (`request`, default `false`): the body is checked before it is serialized; an invalid body is never sent.

A failure rejects with a `RequestError` of kind `'validation'` whose `cause` is the library's error, with the path to the offending value:

```ts check
import { getPetById, isRequestError } from './generated/api';

try {
  await getPetById({ petId: 10 });
} catch (error) {
  if (isRequestError(error) && error.kind === 'validation') {
    console.error(`${error.operationId} returned an unexpected body`, error.cause);
  }
}
```

## Using the schemas yourself

The schemas are exported from their own barrel, next to the client. Use them for data that does not come through the client: form input, messages from a queue, a cached copy in storage.

```ts check
import { PetSchema } from './generated/api/zod';

export function cachedPetName(json: string): string {
  const pet = PetSchema.parse(JSON.parse(json)); // throws a ZodError for anything else
  return pet.name;
}
```

The library is imported only by its directory and, when validation is on, by the operations. With validation off, nothing in the client depends on it.

## What the schemas enforce

All three libraries enforce the same rules, following JSON Schema and the generated types:

- required and optional properties, nullability, enums and `const`, unions and discriminators (including OpenAPI 3.2 default mappings), tuples, `minLength`/`maxLength`, numeric bounds and `multipleOf`;
- `additionalProperties: false` (unknown properties are kept otherwise) and typed additional properties;
- the assertions TypeScript cannot express: `not`, `if`/`then`/`else`, `dependentSchemas` and `dependentRequired`;
- recursive and mutually recursive schemas.

Where the libraries' defaults differ from JSON Schema, the schemas follow JSON Schema: string lengths count characters rather than UTF-16 code units, a decimal `multipleOf` such as `0.01` tolerates floating-point rounding, and integers may exceed 2^53. The details are in [generated code](generated-code.md#validation).

## Choosing a library

- **Zod** is the most common choice and the one the examples use. Schemas are plain objects and methods.
- **Valibot** is modular: an application bundles only the validators it uses, which keeps a few validated operations small.
- **ArkType** definitions read like TypeScript types. It needs TypeScript 5.4 or later; `swaggerz doctor` checks it.

Switching libraries is a config change: the operations call the schemas through the same code path, so the rest of your code does not change.

## Limitations

- `format` and `pattern` are documentation only (except `date` and `date-time` with `types.dates: 'Date'`, which are checked before they are converted).
- Validation runs on what the client receives and sends; it does not check headers or parameters.
- In Valibot and ArkType, a closed model that contains itself through `allOf` reads like the intersection only at its first level of nesting.
