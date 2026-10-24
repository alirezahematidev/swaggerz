/** The files `swaggerz generate` writes for the petstore fixture with the default options. */
import path from 'node:path';
import { loadConfig } from '../../../src/config/load.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { DriftError, ROOT, writeGenerated } from './output.ts';

export async function quickStart(): Promise<void> {
  const loaded = await loadConfig({
    cwd: ROOT,
    inlineConfig: {
      spec: { version: '3.0', input: path.join('fixtures', 'specs', 'petstore-3.0.yaml') },
    },
    env: {},
  });
  const result = await compile({ config: loaded.config, plugins: loaded.plugins });
  if (!result.ok)
    throw new DriftError(
      'The petstore fixture no longer compiles:',
      result.diagnostics.map((d) => d.code),
    );
  const files = result.files.map((file) => file.path);
  const directories = new Map<string, string[]>();
  for (const file of files) {
    const [first, ...rest] = file.split('/');
    const key = rest.length === 0 ? '' : (first ?? '');
    directories.set(key, [
      ...(directories.get(key) ?? []),
      rest.length === 0 ? file : rest.join('/'),
    ]);
  }
  await writeGenerated('quick-start.json', {
    total: files.length,
    operations: result.project?.operations.length ?? 0,
    models: result.project?.models.length ?? 0,
    tree: [...directories.entries()].map(([directory, entries]) => ({ directory, files: entries })),
  });
}
