/**
 * The examples gallery: every `examples/<name>/` project, with its README rendered in place (like
 * the docs) and the data that scripts/data/examples.ts compiled for it.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Loader } from 'astro/loaders';
import { repositoryRoot, transformDocument } from './repository-docs.ts';

export function examplesLoader(): Loader {
  return {
    name: 'swaggerz-examples',
    async load(context) {
      const root = repositoryRoot(context.config);
      const generated = JSON.parse(
        await readFile(new URL('src/generated/examples.json', context.config.root), 'utf8'),
      ) as Record<string, Record<string, unknown>>;
      const base = context.config.base.endsWith('/')
        ? context.config.base
        : `${context.config.base}/`;
      const names = (await readdir(path.join(root, 'examples'), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      context.store.clear();
      for (const name of names) {
        const file = path.join(root, 'examples', name, 'README.md');
        const readme = await readFile(file, 'utf8');
        const { title, body } = transformDocument(readme, `examples/${name}/README.md`, { base });
        const paragraphs = body.split(/\n\s*\n/);
        const leadIndex = paragraphs.findIndex((p) => p.trim() !== '' && !p.startsWith('```'));
        const lead = paragraphs[leadIndex] ?? '';
        // The first paragraph becomes the page's lede, so the body starts after it.
        const rest = paragraphs.filter((_, index) => index !== leadIndex).join('\n\n');
        const description = lead
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/`/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const data = generated[name];
        if (data === undefined)
          throw new Error(`Run scripts/data.ts: no data for examples/${name}.`);
        context.store.set({
          id: name,
          data: await context.parseData({
            id: name,
            data: { title, description, ...data },
            filePath: file,
          }),
          body: rest,
          filePath: path
            .relative(fileURLToPath(context.config.root), file)
            .split(path.sep)
            .join('/'),
          digest: context.generateDigest(readme),
          rendered: await context.renderMarkdown(rest, { fileURL: pathToFileURL(file) }),
        });
      }
    },
  };
}
