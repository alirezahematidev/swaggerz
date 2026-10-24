/** `node:url` for the browser compiler: virtual paths are `file:` URLs, as in Node.js. */
export function fileURLToPath(url: string | URL): string {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  return decodeURIComponent(parsed.pathname);
}

export function pathToFileURL(path: string): URL {
  return new URL(`file://${encodeURI(path).replace(/[?#]/g, encodeURIComponent)}`);
}
