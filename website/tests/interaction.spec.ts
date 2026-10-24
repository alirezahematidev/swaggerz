/**
 * The site's own widgets, used the way a reader would: the search dialog, the "On this page"
 * menu, disclosures that find-in-page and links must open, and the landing page's phone menu.
 */
import { expect, test } from '@playwright/test';

test('search opens with the keyboard, finds pages and closes with Escape', async ({ page }) => {
  await page.goto('/docs/guides/validation/');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Search the documentation' });
  await expect(dialog).toBeVisible();
  // The dialog covers the viewport's middle, not only the header it is declared in.
  const box = await dialog.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(150);
  await page.keyboard.type('zod schema');
  const options = dialog.getByRole('option');
  await expect(options.first()).toBeVisible();
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // Opened from its button, closing gives the button focus back.
  const trigger = page.getByRole('button', { name: /^Search/ });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('the search button opens the dialog on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Search/ }).click();
  await expect(page.getByRole('dialog', { name: 'Search the documentation' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Search' })).toBeFocused();
});

for (const width of [390, 1440]) {
  test(`"On this page" opens, follows a link and closes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/guides/servers/');
    const toggle = page.locator('.toc > .disclosure-button');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('#page-toc-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    }
    await panel.getByRole('link').nth(2).click();
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
}

test('a link to an API entry opens its disclosure', async ({ page }) => {
  await page.goto('/docs/reference/api/#UserConfig');
  const entry = page.locator('#UserConfig');
  await expect(entry.locator('.disclosure-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(entry.locator('.disclosure-panel')).toBeVisible();
});

test('a closed disclosure keeps its text reachable by find-in-page', async ({ page }) => {
  await page.goto('/docs/reference/cli/');
  const panel = page.locator('#help-generate');
  await expect(panel).toHaveAttribute('hidden', 'until-found');
  await page.locator('.ref-help > .disclosure-button').first().click();
  await expect(page.locator('.ref-help').first().locator('.disclosure-panel')).toBeVisible();
});

test('the landing page menu opens on a phone and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  const nav = page.getByRole('navigation', { name: 'Main menu' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Playground' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
});
