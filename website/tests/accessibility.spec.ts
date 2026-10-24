/** axe on every page template, in both themes. */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEMPLATES, THEMES } from './pages.ts';

for (const theme of THEMES) {
  for (const template of TEMPLATES) {
    test(`${template.name} has no accessibility violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(template.path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      if (template.name === 'playground') await page.getByText(/\d+ files? ·/).waitFor();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help} — ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join(', ')}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
