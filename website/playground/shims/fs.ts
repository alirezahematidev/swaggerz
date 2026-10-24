/**
 * `node:fs` for the browser compiler: the runtime templates and the package identity the
 * generator reads synchronously are embedded at build time.
 */
import { files } from 'virtual:embedded-files';

export function readFileSync(file: string | URL): string {
  const name = file instanceof URL ? decodeURIComponent(file.pathname) : file;
  for (const [suffix, content] of Object.entries(files)) {
    if (name.endsWith(suffix)) return content;
  }
  throw new Error(`ENOENT: ${name} is not embedded in the browser compiler.`);
}

export function existsSync(): boolean {
  return false;
}

export function realpathSync(file: string): string {
  return file;
}

export function watch(): never {
  throw new Error('watch() is not available in the browser.');
}
