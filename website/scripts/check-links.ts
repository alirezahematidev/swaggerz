/**
 * Checks every internal link and anchor of the built site (dist/): each `href` and `src` that
 * stays on the site must reach a page or file, and a `#fragment` an element with that id. Run
 * after `astro build`; external links are not fetched.
 *
 * Versions (scripts/versions.ts): the root of the site (`SITE_ROOT`, or `SITE_BASE`) holds the
 * latest docs and `v<major>.<minor>/` below it the snapshot of each release. Links into a version
 * that is not in the checked directory (a build checked on its own) are skipped, and so are links
 * from a snapshot to another version: a snapshot is never rebuilt, so its link to the same page of
 * the latest docs is best effort, and that page may be gone. `SITE_DIST` checks another directory,
 * such as the assembled site with every version.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST =
  process.env.SITE_DIST === undefined
    ? fileURLToPath(new URL('../dist/', import.meta.url))
    : path.resolve(process.env.SITE_DIST);
const BASE = (process.env.SITE_BASE ?? '/').replace(/\/?$/, '/');
const ROOT = (process.env.SITE_ROOT ?? BASE).replace(/\/?$/, '/');

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VERSION_TREE = new RegExp(`^${escapeRegExp(ROOT)}v\\d+\\.\\d+/`);

/** The version a URL path belongs to: the root of the site or a release's snapshot. */
const treeOf = (pathname: string): string => VERSION_TREE.exec(pathname)?.[0] ?? ROOT;

async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

// `&amp;` last: decoding it first would turn `&amp;quot;` into `"` instead of `&quot;`.
const decode = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** The URL path a built file is served at. */
function urlOf(file: string): string {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  return `${BASE}${relative.replace(/(^|\/)index\.html$/, '$1')}`;
}

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false,
  );
}

export async function checkLinks(): Promise<string[]> {
  const files = await htmlFiles(DIST);
  const ids = new Map<string, Set<string>>();
  const pages = new Map<string, string>();
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    pages.set(urlOf(file), html);
    ids.set(
      urlOf(file),
      new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decode(m[1] ?? ''))),
    );
  }
  const trees = new Set([...pages.keys()].map(treeOf));
  const problems: string[] = [];
  for (const [page, html] of pages) {
    // Skip what is shown as code: links inside code samples are text.
    const markup = html.replace(/<pre[\s\S]*?<\/pre>/g, '');
    for (const match of markup.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const raw = decode(match[2] ?? '');
      if (
        raw === '' ||
        /^(https?:|mailto:|data:|blob:|javascript:)/i.test(raw) ||
        raw.startsWith('//')
      )
        continue;
      const url = new URL(raw, `https://site.invalid${page}`);
      if (url.origin !== 'https://site.invalid') continue;
      const pathname = decodeURIComponent(url.pathname);
      const tree = treeOf(pathname);
      if (tree !== treeOf(page) && (!trees.has(tree) || treeOf(page) !== ROOT)) continue;
      const target = pathname;
      const targetIds =
        ids.get(target) ?? (pathname.endsWith('/') ? undefined : ids.get(`${pathname}/`));
      if (targetIds === undefined) {
        const file = path.join(DIST, pathname.slice(BASE.length));
        if (!(await exists(file))) problems.push(`${page}: ${raw} leads nowhere`);
        continue;
      }
      if (url.hash !== '' && url.hash !== '#' && url.hash !== '#_top') {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!targetIds.has(id)) problems.push(`${page}: ${raw} has no #${id} on ${target}`);
      }
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = await checkLinks();
  if (problems.length > 0) {
    console.error(
      `Broken links (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    process.exitCode = 1;
  } else {
    console.log('Links: every internal link and anchor resolves.');
  }
}
