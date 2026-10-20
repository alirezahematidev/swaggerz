/**
 * Renders the logotype — "swaggerz" in Passero One — to transparent PNGs at 2x, alone and next to
 * the mark, for light (ink) and dark (paper) backgrounds.
 *
 * The font is not kept in the repository. To regenerate:
 *   curl -LO https://raw.githubusercontent.com/google/fonts/main/ofl/passeroone/PasseroOne-Regular.ttf
 *   node scripts/runtimes.ts chromium        # installs Playwright into .runtimes/ once
 *   node brand/build-logotype.mjs PasseroOne-Regular.ttf brand/mark.svg brand
 *   rm PasseroOne-Regular.ttf
 */
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../.runtimes/package.json', import.meta.url));
const { chromium } = require('playwright');
const [font, markFile, out] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const mark = await readFile(markFile, 'utf8');
const fontData = (await readFile(font)).toString('base64');
const variants = [
  { file: 'logotype.png', color: '#171614', withMark: false },
  { file: 'logotype-dark.png', color: '#F6F2EA', withMark: false },
  { file: 'logotype-lockup.png', color: '#171614', withMark: true },
  { file: 'logotype-lockup-dark.png', color: '#F6F2EA', withMark: true },
];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const variant of variants) {
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'Passero One'; src: url(data:font/ttf;base64,${fontData}) format('truetype'); }
    html, body { margin: 0; background: transparent; }
    #logo { display: inline-flex; align-items: center; gap: 56px; padding: 36px 48px; }
    #logo svg { width: 300px; height: 300px; flex: none; }
    #text { font-family: 'Passero One'; font-size: 300px; line-height: 1; color: ${variant.color}; letter-spacing: 0.01em; padding-bottom: 0.08em; }
  </style></head><body><div id="logo">${variant.withMark ? mark.replace('<svg', '<svg aria-hidden="true"') : ''}<span id="text">swaggerz</span></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => document.fonts.check("300px 'Passero One'"));
  if (!loaded) throw new Error('Passero One did not load');
  await page
    .locator('#logo')
    .screenshot({ path: path.join(out, variant.file), omitBackground: true });
  console.log('wrote', variant.file);
}
await browser.close();
