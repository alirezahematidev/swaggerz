import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/**
 * Tests of the built site (run `pnpm build` first): accessibility in both themes, budgets, and
 * screenshots of key pages at phone, tablet and desktop widths.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}-{platform}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' } },
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `pnpm astro preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: process.env.CI === undefined,
  },
});
