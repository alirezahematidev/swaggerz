/** Where the data scripts write, and how. Everything in `src/generated/` is rebuilt from sources. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEBSITE = fileURLToPath(new URL('../../', import.meta.url));
export const ROOT = path.resolve(WEBSITE, '..');
export const GENERATED = path.join(WEBSITE, 'src', 'generated');

export async function writeGenerated(name: string, content: unknown): Promise<void> {
  const file = path.join(GENERATED, name);
  await mkdir(path.dirname(file), { recursive: true });
  const text = typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`;
  await writeFile(file, text);
}

/** Fails the build with every problem at once, so one run shows everything that drifted. */
export class DriftError extends Error {
  constructor(title: string, problems: readonly string[]) {
    super(`${title}\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'DriftError';
  }
}

/** `text` as a literal inside a regular expression: every pattern character escaped. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
