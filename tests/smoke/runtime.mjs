/**
 * Runs a generated JavaScript client against a local server on the current Node.js version, with
 * the same checks `scripts/runtimes.ts` runs in Deno, Bun, browsers and workerd. Plain JavaScript
 * without dependencies so it runs on Node.js versions older than the generator supports (CI runs
 * it on Node.js 18 and 20).
 *
 * Usage: node dist/cli/bin.js generate --config tests/smoke/swaggerz.config.mjs
 *        node tests/smoke/runtime.mjs
 */
import * as api from '../.output/smoke/api/index.js';
import { startServer } from '../runtimes/server.mjs';
import { runSuite } from '../runtimes/suite.js';

const server = await startServer();
let failed = [];
try {
  const results = await runSuite(api, server.url, `node-${process.versions.node}`);
  failed = results.filter((check) => !check.ok);
  for (const check of results)
    console.log(`${check.ok ? '✔' : '✖'} ${check.name}${check.ok ? '' : `: ${check.error}`}`);
} finally {
  await server.close();
}
if (failed.length > 0) {
  console.error(`${failed.length} checks failed on Node.js ${process.versions.node}.`);
  process.exitCode = 1;
} else {
  console.log(`Generated client works on Node.js ${process.versions.node}.`);
}
