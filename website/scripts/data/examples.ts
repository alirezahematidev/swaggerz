/**
 * The examples gallery's data: for every `examples/<name>/` project, its config, its application
 * sources and the files swaggerz generates for it with that config. The README is rendered by the
 * content loader (src/loaders/examples.ts).
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../../src/config/load.ts';
import { compile } from '../../../src/pipeline/compile.ts';
import { DriftError, ROOT, writeGenerated } from './output.ts';

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|mjs|vue|svelte|astro)$/;
const CONFIG_FILES = ['swaggerz.config.ts', 'swaggerz.config.mjs', 'swaggerz.config.js'];
/** The framework's config, where the Vite plugin or the Astro or Next.js integration is added. */
const FRAMEWORK_CONFIGS = ['vite.config.ts', 'astro.config.ts', 'next.config.ts'];

const languageOf = (file: string): string => {
  const extension = path.extname(file).slice(1);
  return extension === 'mjs' ? 'js' : extension;
};

const exists = async (file: string): Promise<boolean> =>
  stat(file).then(
    () => true,
    () => false,
  );

interface SourceFile {
  readonly path: string;
  readonly language: string;
  readonly content: string;
}

async function read(directory: string, relative: string): Promise<SourceFile> {
  return {
    path: relative,
    language: languageOf(relative),
    content: (await readFile(path.join(directory, relative), 'utf8')).trimEnd(),
  };
}

/** The sources under `relative` (pages and components in subdirectories too), not generated code. */
async function sources(directory: string, relative: string): Promise<SourceFile[]> {
  // The listing says which entries are files, so nothing is checked first and read later.
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true }).catch(
    () => [],
  );
  const files: SourceFile[] = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isFile() && SOURCE_EXTENSIONS.test(entry.name))
      files.push(await read(directory, child));
    else if (entry.isDirectory() && entry.name !== 'generated')
      files.push(...(await sources(directory, child)));
  }
  return files;
}

export async function examples(): Promise<void> {
  const root = path.join(ROOT, 'examples');
  const names = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const directory = path.join(root, name);
    let configName: string | undefined;
    for (const file of CONFIG_FILES)
      if ((await exists(path.join(directory, file))) && configName === undefined) configName = file;
    if (configName === undefined)
      throw new DriftError('An example has no config:', [`examples/${name}`]);
    const loaded = await loadConfig({ cwd: directory, configFile: configName, env: {} });
    const result = await compile({ config: loaded.config, plugins: loaded.plugins });
    if (!result.ok) {
      throw new DriftError(
        `examples/${name} does not compile:`,
        result.diagnostics.map((d) => `${d.code} ${d.message}`),
      );
    }
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    out[name] = {
      config: {
        path: configName,
        language: languageOf(configName),
        content: (await readFile(path.join(directory, configName), 'utf8')).trimEnd(),
      },
      sources: [
        ...(await Promise.all(
          FRAMEWORK_CONFIGS.filter((file) => existsSync(path.join(directory, file))).map((file) =>
            read(directory, file),
          ),
        )),
        ...(await sources(directory, 'src')),
        ...(await sources(directory, 'plugins')),
      ],
      generated: result.files.map((file) => file.path),
      operations: result.project?.operations.length ?? 0,
      models: result.project?.models.length ?? 0,
      dependencies: Object.keys(pkg.dependencies ?? {}).sort(),
    };
  }
  await writeGenerated('examples.json', out);
}
