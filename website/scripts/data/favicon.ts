/** Copies the mark (`brand/mark.svg`) as the favicon, so `brand/` stays the only source. */
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, WEBSITE } from './output.ts';

export async function favicon(): Promise<void> {
  await copyFile(path.join(ROOT, 'brand', 'mark.svg'), path.join(WEBSITE, 'public', 'favicon.svg'));
}
