/**
 * `node:fs/promises` for the browser compiler: reads come from the in-memory files, and anything
 * that would write or list the disk fails (the compiler never writes; the writer is not used).
 */
import { hasFile, readVirtual } from './virtual-files.ts';

const toPath = (file: string | URL): string =>
  file instanceof URL ? decodeURIComponent(file.pathname) : file;

export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };

export async function readFile(file: string | URL): Promise<string> {
  return readVirtual(toPath(file));
}

export async function realpath(file: string): Promise<string> {
  return file;
}

export async function access(file: string | URL): Promise<void> {
  readVirtual(toPath(file));
}

export async function stat(
  file: string | URL,
): Promise<{ isFile(): boolean; isDirectory(): boolean }> {
  const name = toPath(file);
  const isFile = hasFile(name);
  if (!isFile && !name.endsWith('/') && name.includes('.')) readVirtual(name);
  return { isFile: () => isFile, isDirectory: () => !isFile };
}

const unavailable = (name: string) => async (): Promise<never> => {
  throw new Error(`${name}() is not available in the browser.`);
};

export const lstat = unavailable('lstat');
export const mkdir = unavailable('mkdir');
export const open = unavailable('open');
export const readdir = unavailable('readdir');
export const rename = unavailable('rename');
export const rm = unavailable('rm');
export const rmdir = unavailable('rmdir');
export const writeFile = unavailable('writeFile');
