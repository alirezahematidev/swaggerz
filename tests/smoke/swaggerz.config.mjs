// Generates the JavaScript client exercised by `runtime.mjs` (see the `runtime` job in CI).
/** @type {import('../../src/index.ts').UserConfig} */
export default {
  spec: { version: '3.0', input: '../../fixtures/specs/petstore-3.0.yaml' },
  output: { directory: '../.output/smoke/api', language: 'javascript' },
};
