import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../helpers.ts';
import { OUTPUT_ROOT } from './generate.ts';

/**
 * Creates a throwaway user project under `tests/.output/<name>` with a plain-object config file
 * (no package import, so it works without a build) and the given spec.
 */
export async function createProject(
  name: string,
  options: {
    spec?: string;
    version?: string;
    config?: Record<string, unknown>;
    files?: Record<string, string>;
  } = {},
): Promise<string> {
  const directory = path.join(OUTPUT_ROOT, 'projects', name);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ name, private: true, type: 'module' }),
  );
  const config = {
    spec: {
      version: options.version ?? '3.0',
      input: fixture(options.spec ?? 'petstore-3.0.yaml'),
    },
    output: { directory: './src/generated/api' },
    ...options.config,
  };
  await writeFile(
    path.join(directory, 'swaggerz.config.mjs'),
    `export default ${JSON.stringify(config, null, 2)};\n`,
  );
  for (const [file, content] of Object.entries(options.files ?? {})) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), content);
  }
  return directory;
}
