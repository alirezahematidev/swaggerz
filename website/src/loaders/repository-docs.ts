/**
 * Loads Markdown files of the repository (`docs/*.md`) into the docs collection without copying
 * them: the files stay the source and keep reading well on GitHub. Each file becomes the page
 * that `src/navigation.ts` assigns to it:
 *
 * - the first `# Heading` becomes the page title;
 * - GitHub alerts (`> [!NOTE]`) become Starlight asides, which the site renders as margin notes;
 * - relative links are rewritten: to other published files, to the examples gallery, or to the
 *   file on GitHub.
 *
 * Every file in `docs/` must have a page or be listed in `UNPUBLISHED_DOCS`, so a new document
 * cannot be forgotten.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { SOURCE_PAGES, UNPUBLISHED_DOCS, type PageEntry } from '../navigation.ts';
import { REPOSITORY } from '../site.ts';

const ALERTS: Readonly<Record<string, string>> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'note',
  WARNING: 'caution',
  CAUTION: 'danger',
};

export interface Transformed {
  readonly title: string;
  readonly body: string;
}

/** The repository root, one directory above the website package. */
export function repositoryRoot(config: { root: URL }): string {
  return path.resolve(fileURLToPath(config.root), '..');
}

/** Turns a repository Markdown file into the title and body of its page. */
export function transformDocument(
  text: string,
  source: string,
  options: { base: string; title?: string | undefined },
): Transformed {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headingIndex = lines.findIndex((line) => /^# \S/.test(line));
  if (headingIndex === -1) throw new Error(`${source} has no "# Title" heading.`);
  const heading = (lines[headingIndex] ?? '').slice(2).trim();
  lines.splice(headingIndex, 1);

  const out: string[] = [];
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1] ?? '';
      if (fence === undefined) fence = marker;
      else if (marker.startsWith(fence)) fence = undefined;
      out.push(line);
      continue;
    }
    if (fence !== undefined) {
      out.push(line);
      continue;
    }
    const alert = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/.exec(line);
    if (alert !== null) {
      const body: string[] = [];
      while (i + 1 < lines.length && (lines[i + 1] ?? '').startsWith('>')) {
        i += 1;
        body.push((lines[i] ?? '').replace(/^>\s?/, ''));
      }
      out.push(
        `:::${ALERTS[alert[1] ?? 'NOTE'] ?? 'note'}`,
        ...body.map((l) => rewriteLinks(l, source, options.base)),
        ':::',
      );
      continue;
    }
    out.push(rewriteLinks(line, source, options.base));
  }
  return { title: options.title ?? stripInlineMarkdown(heading), body: out.join('\n') };
}

function stripInlineMarkdown(text: string): string {
  return text.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1');
}

/** Rewrites the relative link targets of one line of Markdown (outside code spans). */
export function rewriteLinks(line: string, source: string, base: string): string {
  // Split on code spans so links shown as code stay untouched.
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(
            /\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
            (_match, target: string, title: string) => {
              return `](${resolveTarget(target, source, base)}${title})`;
            },
          ),
    )
    .join('');
}

/** Where a link of a repository file points on the site. */
export function resolveTarget(target: string, source: string, base: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) {
    return target;
  }
  const hashIndex = target.indexOf('#');
  const file = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : target.slice(hashIndex);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), file));
  const page = SOURCE_PAGES.get(resolved);
  if (page !== undefined) return `${base}${page.id}/${hash}`;
  const example = /^examples\/([a-z0-9-]+)\/?$/.exec(resolved);
  if (example !== null) return `${base}examples/${example[1] ?? ''}/${hash}`;
  if (resolved === 'CHANGELOG.md') return `${base}changelog/${hash}`;
  if (resolved.startsWith('..'))
    throw new Error(`${source} links outside the repository: ${target}`);
  const kind = /\.[a-z0-9]+$/i.test(resolved) ? 'blob' : 'tree';
  return `${REPOSITORY.url}/${kind}/${REPOSITORY.branch}/${resolved}${hash}`;
}

/** Fails when a file in `docs/` has neither a page nor a reason to be left out. */
async function checkCoverage(root: string): Promise<void> {
  const files = (await readdir(path.join(root, 'docs')))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`)
    .sort();
  const missing = files.filter((file) => !SOURCE_PAGES.has(file) && !(file in UNPUBLISHED_DOCS));
  if (missing.length > 0) {
    throw new Error(
      `These files have no page in website/src/navigation.ts (add one, or list them in UNPUBLISHED_DOCS): ${missing.join(', ')}`,
    );
  }
  for (const source of SOURCE_PAGES.keys()) {
    if (source.startsWith('docs/') && !files.includes(source)) {
      throw new Error(`website/src/navigation.ts publishes ${source}, which does not exist.`);
    }
  }
}

async function syncPage(
  context: LoaderContext,
  root: string,
  page: PageEntry & { source: string },
) {
  const file = path.join(root, page.source);
  const text = await readFile(file, 'utf8');
  const { title, body } = transformDocument(text, page.source, {
    base: context.config.base.endsWith('/') ? context.config.base : `${context.config.base}/`,
    title: page.title,
  });
  const data = await context.parseData({
    id: page.id,
    data: {
      title,
      ...(page.description === undefined ? {} : { description: page.description }),
      editUrl: `${REPOSITORY.url}/edit/${REPOSITORY.branch}/${page.source}`,
      ...(page.twin === undefined ? {} : { twin: page.twin }),
      source: page.source,
    },
    filePath: file,
  });
  const rendered = await context.renderMarkdown(body, { fileURL: pathToFileURL(file) });
  context.store.set({
    id: page.id,
    data,
    body,
    filePath: path.relative(fileURLToPath(context.config.root), file).split(path.sep).join('/'),
    digest: context.generateDigest(text),
    rendered,
  });
}

/** The docs collection: Starlight's own pages (MDX in src/content/docs) plus repository files. */
export function repositoryDocsLoader(starlightLoader: Loader): Loader {
  return {
    name: 'swaggerz-repository-docs',
    async load(context) {
      // Starlight's glob loader removes entries it did not load, so it runs first.
      await starlightLoader.load(context);
      const root = repositoryRoot(context.config);
      await checkCoverage(root);
      const pages = [...SOURCE_PAGES.values()].filter(
        (page): page is PageEntry & { source: string } =>
          page.source !== undefined && page.generated !== true,
      );
      await Promise.all(pages.map((page) => syncPage(context, root, page)));
      const watcher = context.watcher;
      if (watcher === undefined) return;
      for (const page of pages) watcher.add(path.join(root, page.source));
      watcher.on('change', (changed) => {
        const page = pages.find((p) => path.join(root, p.source) === changed);
        if (page === undefined) return;
        syncPage(context, root, page).then(
          () => context.logger.info(`Reloaded ${page.source}`),
          (error: unknown) =>
            context.logger.error(`Failed to reload ${page.source}: ${String(error)}`),
        );
      });
    },
  };
}
