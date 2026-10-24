/** A POSIX `node:path` for the browser compiler (every path it sees is a virtual POSIX path). */
function normalizeSegments(path: string): string {
  const absolute = path.startsWith('/');
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out.at(-1) !== '..') out.pop();
      else if (!absolute) out.push('..');
    } else out.push(segment);
  }
  const joined = out.join('/');
  return absolute ? `/${joined}` : joined === '' ? '.' : joined;
}

export const sep = '/';
export const delimiter = ':';

export function normalize(path: string): string {
  const trailing = path.endsWith('/') && path.length > 1;
  const result = normalizeSegments(path);
  return trailing && result !== '/' ? `${result}/` : result;
}

export function join(...parts: string[]): string {
  const filtered = parts.filter((part) => part !== '');
  return filtered.length === 0 ? '.' : normalizeSegments(filtered.join('/'));
}

export function resolve(...parts: string[]): string {
  let path = '';
  for (let index = parts.length - 1; index >= 0 && !path.startsWith('/'); index--) {
    const part = parts[index];
    if (part !== undefined && part !== '') path = path === '' ? part : `${part}/${path}`;
  }
  return normalizeSegments(path.startsWith('/') ? path : `/${path}`);
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

export function dirname(path: string): string {
  const normalized = normalizeSegments(path);
  const index = normalized.lastIndexOf('/');
  if (index === -1) return '.';
  return index === 0 ? '/' : normalized.slice(0, index);
}

export function basename(path: string, extension?: string): string {
  const base = path.replace(/\/+$/, '').split('/').at(-1) ?? '';
  return extension !== undefined && base.endsWith(extension)
    ? base.slice(0, -extension.length)
    : base;
}

export function extname(path: string): string {
  const base = basename(path);
  const index = base.lastIndexOf('.');
  return index <= 0 ? '' : base.slice(index);
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean);
  const b = resolve(to).split('/').filter(Boolean);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common++;
  return [...a.slice(common).map(() => '..'), ...b.slice(common)].join('/');
}

export function parse(path: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
} {
  const base = basename(path);
  const ext = extname(path);
  return {
    root: path.startsWith('/') ? '/' : '',
    dir: dirname(path),
    base,
    ext,
    name: base.slice(0, base.length - ext.length),
  };
}

export function toNamespacedPath(path: string): string {
  return path;
}

const posix = {
  sep,
  delimiter,
  normalize,
  join,
  resolve,
  isAbsolute,
  dirname,
  basename,
  extname,
  relative,
  parse,
  toNamespacedPath,
};
const path = { ...posix, posix, win32: posix };
export { posix };
export default path;
