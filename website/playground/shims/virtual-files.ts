/** The files the browser compiler can read: the specification and overlays the page passes in. */
const files = new Map<string, string>();

export function setFiles(entries: Readonly<Record<string, string>>): void {
  files.clear();
  for (const [name, content] of Object.entries(entries)) files.set(name, content);
}

export function hasFile(name: string): boolean {
  return files.has(name);
}

export function readVirtual(name: string): string {
  const content = files.get(name);
  if (content === undefined) {
    const error = new Error(`ENOENT: no such file, open '${name}'`) as Error & { code: string };
    error.code = 'ENOENT';
    throw error;
  }
  return content;
}
