// @ts-check
/**
 * Runs `suite.js` in a server-side runtime (Node.js, Deno, Bun) and prints the results as JSON.
 *
 * Usage: <runtime> tests/runtimes/entry.js <client module URL> <server URL> <run id>
 */
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
console.log(JSON.stringify(results));
