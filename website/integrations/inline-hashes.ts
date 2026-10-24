/**
 * Completes each page's Content Security Policy after the build. Astro hashes the scripts and
 * styles it processes, but not `is:inline` scripts of components from packages (Starlight's theme
 * bootstrapping, search shortcut and sidebar restore). This adds the hash of every inline script
 * and style element to the page's own policy, so the policy needs no 'unsafe-inline'.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const hash = (text: string): string =>
  `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

export function completePolicy(html: string): string {
  const meta = /(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i.exec(html);
  if (meta === null) return html;
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1] ?? '',
  );
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? '');
  let policy = (meta[2] ?? '').replace(/&#39;/g, "'");
  const add = (directive: string, hashes: string[]): void => {
    const pattern = new RegExp(`(^|;)\\s*${directive}\\s([^;]*)`);
    const found = pattern.exec(policy);
    if (found === null) return;
    const sources = new Set((found[2] ?? '').split(/\s+/).filter(Boolean));
    const missing = hashes.filter((value) => !sources.has(value));
    if (missing.length === 0) return;
    policy = policy.replace(
      pattern,
      (_all, start: string, list: string) =>
        `${start} ${directive} ${list} ${[...new Set(missing)].join(' ')}`,
    );
  };
  add('script-src', scripts.filter((text) => text.trim() !== '').map(hash));
  add('style-src', styles.filter((text) => text.trim() !== '').map(hash));
  return `${html.slice(0, meta.index)}${meta[1]}${policy.replace(/'/g, '&#39;')}${meta[3]}${html.slice(meta.index + meta[0].length)}`;
}

export function inlineHashes(): AstroIntegration {
  return {
    name: 'swaggerz-inline-hashes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await readdir(root, { recursive: true, withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
          .map((entry) => path.join(entry.parentPath, entry.name));
        let changed = 0;
        for (const file of files) {
          const html = await readFile(file, 'utf8');
          const completed = completePolicy(html);
          if (completed !== html) {
            await writeFile(file, completed);
            changed++;
          }
        }
        logger.info(
          `Added inline script hashes to the policy of ${changed} of ${files.length} pages.`,
        );
      },
    },
  };
}
