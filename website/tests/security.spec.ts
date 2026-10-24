/**
 * Every page works under its Content Security Policy: no violations (blocked inline scripts or
 * styles, third-party requests) and no console errors.
 */
import { expect, test } from '@playwright/test';
import { TEMPLATES } from './pages.ts';

for (const template of TEMPLATES) {
  test(`${template.name} runs without CSP violations or errors`, async ({ page, baseURL }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('404'))
        problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    const foreign: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(baseURL ?? '') && !request.url().startsWith('data:'))
        foreign.push(request.url());
    });
    await page.goto(template.path, { waitUntil: 'networkidle' });
    if (template.name === 'playground') await page.getByText(/\d+ files? ·/).waitFor();
    expect(problems).toEqual([]);
    expect(foreign).toEqual([]);
  });
}
