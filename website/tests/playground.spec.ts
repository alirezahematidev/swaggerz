/**
 * The playground, used as a reader would: each option changes the output, a share link
 * reproduces the playground, an error points at its line, lint adds findings, and phones get the
 * folded options and the pane switch. That its output equals the CLI's is checked when the site
 * is built (scripts/playground.ts).
 */
import { expect, test, type Page } from '@playwright/test';

/** Waits for the compile that follows a change and returns the status line. */
async function compiled(page: Page): Promise<string> {
  const status = page.locator('section[aria-label="Generated code"] [aria-live="polite"]');
  await page.waitForTimeout(300);
  await expect(status.locator('.animate-spin')).toHaveCount(0);
  await expect(status).toHaveText(/files? ·|Nothing generated/);
  return (await status.textContent()) ?? '';
}

const choose = (page: Page, group: string, option: string) =>
  page.locator(`[aria-label="${group}"]`).getByRole('radio', { name: option, exact: true }).click();

const fileNames = (page: Page) => page.locator('nav[aria-label="Generated files"]').innerText();

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/', { waitUntil: 'networkidle' });
  await compiled(page);
});

test('each option changes what is generated', async ({ page }) => {
  const cases: readonly (readonly [string, string, RegExp])[] = [
    ['Hooks', 'React', /react-query\//],
    ['Hooks', 'Vue', /vue-query\//],
    ['Hooks', 'Svelte', /svelte-query\//],
    ['Hooks', 'Solid', /solid-query\//],
    ['Hooks', 'SWR', /swr\//],
    ['Validation', 'Zod', /zod\//],
    ['Validation', 'Valibot', /valibot\//],
    ['Validation', 'ArkType', /arktype\//],
    ['Language', 'JavaScript', /\.js/],
  ];
  for (const [group, option, expected] of cases) {
    await choose(page, group, option);
    await compiled(page);
    await expect.poll(() => fileNames(page), `${group}: ${option}`).toMatch(expected);
  }
  await choose(page, 'Transport', 'axios');
  await choose(page, 'Dates', 'Date');
  await choose(page, 'Read / write', 'Merged');
  await compiled(page);
  await page.locator('nav[aria-label="Generated files"]').getByText('swaggerz.config.ts').click();
  const config = page.locator('section[aria-label="Generated code"] pre');
  await expect(config).toContainText("adapter: 'axios'");
  await expect(config).toContainText("dates: 'Date'");
  await expect(config).toContainText("readWrite: 'merged'");
});

test('every sample compiles', async ({ page }) => {
  for (const sample of [
    'Petstore 3.1',
    'Swagger 2.0',
    'readOnly / writeOnly',
    'Webhooks',
    'OpenAPI 3.2',
  ]) {
    await page
      .locator('[aria-label="Samples"]')
      .getByRole('radio', { name: sample, exact: true })
      .click();
    expect(await compiled(page), sample).toMatch(/files? ·/);
  }
});

test('a share link reproduces the specification and the options', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page
    .locator('[aria-label="Samples"]')
    .getByRole('radio', { name: 'Webhooks', exact: true })
    .click();
  await choose(page, 'Hooks', 'Vue');
  const before = await compiled(page);
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const other = await context.newPage();
  await other.goto(url, { waitUntil: 'networkidle' });
  expect((await compiled(other)).split(' · ').slice(0, 3)).toEqual(before.split(' · ').slice(0, 3));
  await expect(
    other.locator('[aria-label="Hooks"]').getByRole('radio', { name: 'Vue', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('an error in the specification points at its line', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'Specification' });
  const original = await editor.inputValue();
  await editor.fill(original.replace('paths:', 'paths: [unclosed'));
  expect(await compiled(page)).toMatch(/Nothing generated/);
  const jump = page
    .locator('section[aria-label="Specification"]')
    .getByRole('button', { name: /^line \d+/ })
    .first();
  const line = Number(/\d+/.exec((await jump.textContent()) ?? '')?.[0]);
  await jump.click();
  expect(
    await editor.evaluate(
      (el: HTMLTextAreaElement) => el.value.slice(0, el.selectionStart).split('\n').length,
    ),
  ).toBe(line);
});

test('lint adds findings to the problems', async ({ page }) => {
  await page
    .locator('[aria-label="Samples"]')
    .getByRole('radio', { name: 'Swagger 2.0', exact: true })
    .click();
  await compiled(page);
  const problems = page.locator('section[aria-label="Specification"] [aria-label="Problems"] li');
  const without = await problems.count();
  await page.getByRole('switch').click();
  await compiled(page);
  expect(await problems.count()).toBeGreaterThan(without);
});

test('on a phone the options fold away and the panes switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#playground-options')).toBeHidden();
  await page.getByRole('button', { name: /^Options/ }).click();
  await expect(page.locator('#playground-options')).toBeVisible();
  await page.locator('[aria-label="Pane"]').getByRole('radio', { name: 'Output' }).click();
  await expect(page.locator('section[aria-label="Generated code"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
