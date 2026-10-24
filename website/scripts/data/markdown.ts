/** Inline Markdown (code spans, emphasis, links) from repository docs, as safe HTML. */
import { resolveTarget } from '../../src/loaders/repository-docs.ts';

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Renders one line of inline Markdown from `source` (a repository path) to HTML. */
export function inlineMarkdown(text: string, source: string, base = '/'): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part, index) => {
      if (index % 2 === 1) return `<code>${escape(part.slice(1, -1))}</code>`;
      return escape(part)
        .replace(/\\\|/g, '|')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
        .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, target: string) => {
          const href = resolveTarget(target.replace(/&amp;/g, '&'), source, base);
          return `<a href="${escape(href)}">${label}</a>`;
        });
    })
    .join('');
}

/** The rows of every table in a Markdown document, as cells of raw Markdown. */
export function markdownTables(text: string): { heading: string | undefined; rows: string[][] }[] {
  const tables: { heading: string | undefined; rows: string[][] }[] = [];
  let heading: string | undefined;
  let current: string[][] | undefined;
  for (const line of text.split('\n')) {
    if (/^#{1,6} /.test(line)) heading = line.replace(/^#+ /, '').trim();
    if (line.startsWith('|')) {
      const cells = splitRow(line);
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
      if (current === undefined) {
        current = [];
        tables.push({ heading, rows: current });
      }
      current.push(cells);
    } else {
      current = undefined;
    }
  }
  return tables;
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inCode = false;
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '`') inCode = !inCode;
    if (char === '\\' && body[i + 1] === '|') {
      cell += '\\|';
      i++;
      continue;
    }
    if (char === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}
