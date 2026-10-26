// @ts-check
/**
 * Runs `suite.js` and `mocks-suite.js` in a server-side runtime (Node.js, Deno, Bun) and prints
 * the results as JSON.
 *
 * Usage: <runtime> tests/runtimes/entry.js <client module URL> <server URL> <run id>
 */
import { runMocksSuite } from './mocks-suite.js';
import { runSuite } from './suite.js';

/** @type {any} */
const runtime = globalThis;
const args = /** @type {(string | undefined)[]} */ (
  runtime.Deno?.args ?? runtime.process.argv.slice(2)
);
const [moduleUrl, baseUrl, run] = args;
if (moduleUrl === undefined || baseUrl === undefined || run === undefined) {
  throw new Error('Usage: entry.js <client module URL> <server URL> <run id>');
}
const api = await import(moduleUrl);
const results = await runSuite(api, baseUrl, run);
// The mocks module sits next to the client's barrel (`index.js` → `mocks/index.js`).
try {
  const mocks = await import(new URL(moduleUrl.replace(/index\.(\w+)$/, 'mocks/index.$1')).href);
  results.push(...(await runMocksSuite(api, mocks)));
} catch (error) {
  results.push({ name: 'mocks: load', ok: false, error: String(error) });
}
console.log(JSON.stringify(results));
// Importing MSW keeps Deno running (its WebSocket support opens a BroadcastChannel).
runtime.Deno?.exit(0);
