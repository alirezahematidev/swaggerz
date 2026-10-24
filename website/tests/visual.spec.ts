/**
 * Screenshots of key pages at 390, 768 and 1440 px in both themes. Baselines are per platform
 * (`-darwin`, `-linux`); update them with `pnpm test:visual --update-snapshots`.
 */
import { expect, test } from '@playwright/test';
import { THEMES } from './pages.ts';

const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'guide', path: '/docs/guides/servers/' },
  { name: 'diagnostics', path: '/docs/reference/diagnostics/' },
  { name: 'playground', path: '/playground/' },
] as const;

const WIDTHS = [390, 768, 1440] as const;

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const target of PAGES) {
      test(`${target.name} at ${width}px (${theme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(target.path, { waitUntil: 'networkidle' });
        if (target.name === 'playground') {
          await page.getByText(/\d+ files? ·/).waitFor({ state: 'attached' });
        }
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${target.name}-${width}-${theme}.png`, {
          fullPage: false,
          // The playground's compile time differs between runs.
          mask: [page.locator('.sz-playground [aria-live="polite"]')],
        });
      });
    }
  }
}
