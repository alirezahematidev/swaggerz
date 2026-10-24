# Read and write models

Many APIs describe one schema for both directions and mark the differences: `readOnly` properties are set by the server (an `id`, a `createdAt`), `writeOnly` ones are only sent (a `password`). A single TypeScript type for both is wrong both ways: requests would demand the `id` the server assigns, and responses would promise a `password` they never contain.

With `types.readWrite: 'split'` (the default), swaggerz generates two types where the specification says they differ:

```ts check=read-write
import { createAccount, type Account, type AccountInput } from './generated/api';

const input: AccountInput = { name: 'Ada', password: 'correct horse battery staple' };
const created: Account = await createAccount({ body: input });
console.log(created.id); // set by the server; `password` is not part of the response type
```

- **The response type** (`Account`) keeps `readOnly` properties, as `readonly` (see `types.readonlyProperties`), and leaves out `writeOnly` ones.
- **The request type** (`AccountInput`, named with `naming.inputSuffix`) leaves out `readOnly` properties and keeps `writeOnly` ones.

## When a variant is created

A model gets an `…Input` variant only when it has `readOnly` or `writeOnly` properties, directly or through the models it contains, **and** something sends it in a request. Models without such properties, and models that only travel in one direction, are generated once, so most specifications see no extra types.

Webhook and callback payloads use the inverted directions: the API sends the payload, and your handler's response goes back.

## Turning it off

`types.readWrite: 'merged'` generates one type per schema, as most generators do. Use it when the specification marks properties inconsistently and the split types get in the way.

## Limitations

- The setting applies to the whole client; a single model cannot opt out.
- Validation schemas are split the same way (`AccountInputSchema`), so a request body is validated without its `readOnly` properties.
