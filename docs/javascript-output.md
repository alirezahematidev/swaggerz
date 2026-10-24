# JavaScript output

`output.language: 'javascript'` emits the same client as plain ES modules: no TypeScript syntax, types expressed as JSDoc, and `.d.ts` declarations next to every module. Projects without a TypeScript build get the same autocomplete and the same runtime behavior.

```ts
export default defineConfig({
  spec: { version: '3.0', input: './openapi.yaml' },
  output: { language: 'javascript' },
});
```

```js
/**
 * Parameters of {@link getPetById}.
 *
 * @typedef {object} GetPetByIdParams
 * @property {number} petId - ID of pet to return
 */

/**
 * Find pet by ID.
 *
 * @param {GetPetByIdParams} params - Request parameters.
 * @param {import('../client.js').RequestOptions} [options] - Per-request options: `signal`, `timeout`, `headers`, `client`.
 * @returns {Promise<GetPetByIdResponse>} `200` successful operation
 */
export function getPetById(params, options) {
  /* … */
}
```

## How it is generated

Every module is rendered three times from the same code paths: TypeScript, JavaScript with JSDoc, and declarations. That is why both languages behave identically: there is no separate JavaScript generator to fall behind.

- Types become `@typedef`s; parameters and return values are annotated with `@param` and `@returns`.
- Type imports are written as `import('…')` types, so `.js` files contain no TypeScript syntax at all.
- `.d.ts` files are emitted next to every module unless `output.declarations: false`; the runtime always has declarations.
- The test suite type-checks JavaScript output with `checkJs` and strict settings, with and without declarations, and checks that the `.js` files contain no TypeScript syntax.

## Running it in Node.js

The output is ES modules. In Node.js the package that imports it needs `"type": "module"` (or a bundler). The [node-javascript example](../examples/node-javascript) is a plain Node.js project that uses the JavaScript client with API-key auth, middleware and typed errors.

## Limitations

- The output targets ES2020; older runtimes need a bundler that transpiles it.
- Only ES modules are generated (`output.moduleFormat` is reserved for later).
