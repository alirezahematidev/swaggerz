/**
 * Production build: compiles `src/` to `dist/` with tsc, builds the runtime templates and the
 * dashboard bundle into `assets/`, and marks the CLI entry point as executable.
 */
import { execFileSync } from 'node:child_process';
import { chmod, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfigSchema, buildDashboard, buildRuntimeTemplates } from './build-assets.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

await rm(path.join(ROOT, 'dist'), { recursive: true, force: true });
execFileSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.build.json'],
  {
    cwd: ROOT,
    stdio: 'inherit',
  },
);
const templates = await buildRuntimeTemplates();
await buildDashboard();
await buildConfigSchema();
await chmod(path.join(ROOT, 'dist', 'cli', 'bin.js'), 0o755);
console.log(
  `Built dist/, ${templates.length} runtime templates, the dashboard bundle and config.schema.json.`,
);
