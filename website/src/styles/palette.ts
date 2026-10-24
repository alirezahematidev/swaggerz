/**
 * The palette as data, read from the CSS shared with the dashboard
 * (`src/dashboard/client/tokens.css`), so the code theme and the contrast check use exactly the
 * colors the pages use.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Theme = 'light' | 'dark';
export type Palette = Readonly<Record<string, string>>;

export const TOKENS_FILE = fileURLToPath(
  new URL('../../../src/dashboard/client/tokens.css', import.meta.url),
);
export const SITE_TOKENS_FILE = fileURLToPath(new URL('./tokens.css', import.meta.url));

function declarations(block: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) values[name] = value.trim();
  }
  return values;
}

/** The custom properties declared directly in the first rule with `selector`. */
function rule(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No "${selector}" rule in the palette CSS.`);
  const end = css.indexOf('}', start);
  return declarations(css.slice(start, end));
}

function read(theme: Theme): Palette {
  const shared = readFileSync(TOKENS_FILE, 'utf8');
  const site = readFileSync(SITE_TOKENS_FILE, 'utf8');
  return theme === 'light'
    ? { ...rule(shared, ':root'), ...rule(site, ':root') }
    : { ...rule(shared, ":root[data-theme='dark']"), ...rule(site, ":root[data-theme='dark']") };
}

let cache: Record<Theme, Palette> | undefined;

/** Every color token of a theme, by name without the leading `--`. */
export function palette(theme: Theme): Palette {
  cache ??= { light: read('light'), dark: read('dark') };
  return cache[theme];
}
