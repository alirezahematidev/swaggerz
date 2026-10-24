/**
 * Performance budgets: no layout shift while a page loads (metric-adjusted fallback fonts, sized
 * images), little JavaScript on content pages, and the playground within 600 KB gzipped.
 */
import { gzipSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1500);
      }),
  );
}

/** Gzipped bytes of every script the page loaded, workers included. */
async function scriptBytes(page: Page, request: APIRequestContext): Promise<number> {
  const urls = await page.evaluate(() =>
    (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .map((entry) => entry.name)
      .filter((name) => /\.m?js(\?|$)/.test(name)),
  );
  let total = 0;
  for (const url of new Set(urls)) total += gzipSync(await (await request.get(url)).body()).length;
  return total;
}

for (const path of ['/', '/docs/guides/data-fetching/']) {
  test(`${path} does not shift while loading`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    expect(await layoutShift(page)).toBeLessThan(0.001);
  });
}

test('a content page loads little JavaScript', async ({ page, request }) => {
  await page.goto('/docs/guides/overlays/', { waitUntil: 'networkidle' });
  // Starlight's search, TOC and sidebar scripts, the theme switch and the twin panel.
  expect(await scriptBytes(page, request)).toBeLessThan(40_000);
});

test('the playground stays within 600 KB of gzipped JavaScript', async ({ page, request }) => {
  await page.goto('/playground/', { waitUntil: 'networkidle' });
  await page.getByText(/\d+ files? ·/).waitFor();
  // React, the dashboard's components and the worker with the compiler.
  expect(await scriptBytes(page, request)).toBeLessThan(600_000);
});
