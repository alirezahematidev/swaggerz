import { buildDashboard, buildRuntimeTemplates } from '../../scripts/build-assets.ts';

/** Builds the runtime templates and dashboard bundle once before the test run. */
export default async function setup(): Promise<void> {
  await buildRuntimeTemplates();
  await buildDashboard();
}
