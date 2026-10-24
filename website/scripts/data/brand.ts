/**
 * Copies the brand files (`brand/`) into `public/brand/` for the brand page's downloads, and the
 * mark as the favicon. They are copies made at build time, so `brand/` stays the only source.
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, WEBSITE, writeGenerated } from './output.ts';

const PUBLISHED = /\.(svg|png)$/;

export async function brand(): Promise<void> {
  const source = path.join(ROOT, 'brand');
  const target = path.join(WEBSITE, 'public', 'brand');
  await mkdir(target, { recursive: true });
  const files = (await readdir(source)).filter((name) => PUBLISHED.test(name)).sort();
  const listed = [];
  for (const name of files) {
    await copyFile(path.join(source, name), path.join(target, name));
    listed.push({ name, bytes: (await stat(path.join(source, name))).size });
  }
  await copyFile(path.join(source, 'mark.svg'), path.join(WEBSITE, 'public', 'favicon.svg'));
  await writeGenerated('brand.json', { files: listed });
}
