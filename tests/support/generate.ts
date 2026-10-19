import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { formatDiagnostic } from '../../src/diagnostics/format.ts';
import type { UserConfig } from '../../src/config/types.ts';
import { runGeneration, type GenerationResult } from '../../src/pipeline/generate.ts';
import type { SwaggerzPlugin } from '../../src/plugins/types.ts';
import { makeConfig, REPO_ROOT } from '../helpers.ts';

/** Generated test output lives inside the repository so `axios` and React Query resolve. */
export const OUTPUT_ROOT = path.join(REPO_ROOT, 'tests', '.output');

export interface GeneratedCase {
  readonly directory: string;
  readonly result: GenerationResult;
}

/** Generates into `tests/.output/<name>` (cleared first) and fails loudly on errors. */
export async function generateCase(
  name: string,
  config: Partial<UserConfig> & { spec: UserConfig['spec'] },
  plugins: readonly SwaggerzPlugin[] = [],
): Promise<GeneratedCase> {
  const directory = path.join(OUTPUT_ROOT, name);
  await rm(directory, { recursive: true, force: true });
  const resolved = makeConfig({ ...config, output: { ...config.output, directory } });
  const result = await runGeneration({ config: resolved, plugins });
  if (!result.ok) {
    const messages = result.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => formatDiagnostic(d));
    throw new Error(`Generation of ${name} failed:\n${messages.join('\n')}`);
  }
  return { directory, result };
}

export async function listFiles(directory: string, extension?: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && (extension === undefined || entry.name.endsWith(extension)),
    )
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}
