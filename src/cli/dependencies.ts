import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../utils/object.ts';

/** Finds the installed version of a package by walking up `node_modules` directories. */
export async function installedVersion(
  packageName: string,
  from: string,
): Promise<string | undefined> {
  let directory = path.resolve(from);
  for (;;) {
    try {
      const raw: unknown = JSON.parse(
        await readFile(path.join(directory, 'node_modules', packageName, 'package.json'), 'utf8'),
      );
      if (isRecord(raw) && typeof raw.version === 'string') return raw.version;
    } catch {
      // Not installed here; keep walking up.
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Compares `major.minor.patch` versions (pre-release tags are ignored). */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string): number[] =>
    version
      .split('-')[0]
      ?.split('.')
      .map((part) => Number(part) || 0) ?? [];
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** True when `version` is in `[minimum, nextMajor)` of `minimum`'s major version. */
export function satisfiesCaret(version: string, minimum: string): boolean {
  const major = (v: string): number => Number(v.split('.')[0]);
  return major(version) === major(minimum) && compareVersions(version, minimum) >= 0;
}
