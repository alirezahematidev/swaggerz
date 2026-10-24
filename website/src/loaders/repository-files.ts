/** Single Markdown files of the repository rendered as pages of their own (changelog, brand). */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Loader } from 'astro/loaders';
import { repositoryRoot, transformDocument } from './repository-docs.ts';

export function repositoryFilesLoader(files: Readonly<Record<string, string>>): Loader {
  return {
    name: 'swaggerz-repository-files',
    async load(context) {
      const root = repositoryRoot(context.config);
      const base = context.config.base.endsWith('/')
        ? context.config.base
        : `${context.config.base}/`;
      context.store.clear();
      for (const [id, source] of Object.entries(files)) {
        const file = path.join(root, source);
        const text = await readFile(file, 'utf8');
        const { title, body } = transformDocument(text, source, { base });
        context.store.set({
          id,
          data: await context.parseData({ id, data: { title, source }, filePath: file }),
          body,
          filePath: path
            .relative(fileURLToPath(context.config.root), file)
            .split(path.sep)
            .join('/'),
          digest: context.generateDigest(text),
          rendered: await context.renderMarkdown(body, { fileURL: pathToFileURL(file) }),
        });
        context.watcher?.add(file);
      }
    },
  };
}
