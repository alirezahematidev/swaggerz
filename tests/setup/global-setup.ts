import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDashboard, buildRuntimeTemplates } from '../../scripts/build-assets.ts';
import { OUTPUT_ROOT } from '../support/generate.ts';

/**
 * Builds the runtime templates and dashboard bundle once before the test run, and marks the test
 * output directory as ES modules. That file is written here, once, because tests that resolve
 * imports (usage scanning) read it while others run: rewriting it per test leaves moments where
 * it is empty.
 */
export default async function setup(): Promise<void> {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeFile(path.join(OUTPUT_ROOT, 'package.json'), '{ "type": "module" }\n');
  await buildRuntimeTemplates();
  await buildDashboard();
}
