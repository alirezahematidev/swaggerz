#!/usr/bin/env node
import { main } from './main.ts';

// Config files written in TypeScript are loaded with Node's built-in type stripping, which emits
// an ExperimentalWarning on some Node.js versions. Hide only that warning.
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /type stripping|typescript/i.test(warning.message))
    return;
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});

// Long-running commands (watch mode, dashboard, MCP server) stop gracefully on the first Ctrl+C;
// a second one ends the process. Other commands keep Node's default: Ctrl+C ends them at once.
const controller = new AbortController();
const stopGracefully = (): void => {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      controller.abort();
    });
  }
};

process.exitCode = await main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  cwd: process.cwd(),
  signal: controller.signal,
  onLongRunning: stopGracefully,
});
