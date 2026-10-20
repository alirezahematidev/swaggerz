/**
 * Regenerates the logo files in this directory from the mark's geometry and the wordmark font.
 * The wordmark is Source Serif 4 Semibold, converted to outlines so the SVGs render identically
 * without the font installed.
 *
 *   cd "$(mktemp -d)" && npm init -y >/dev/null && npm i opentype.js@1.3.4 @fontsource/source-serif-4@5
 *   node <repo>/brand/build-logo.mjs <repo>/brand   # run from that directory
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// The tools live in the working directory (see above), not next to this file.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const opentype = require('opentype.js');

const OUT = process.argv[2] ?? '.';
const INK = '#171614';
const PAPER = '#F6F2EA';
/** Marigold, the brand gold. */
const GOLD = '#F2B33D';
/** A deeper gold for small marks on light backgrounds, where marigold is too faint. */
const GOLD_DEEP = '#B07A12';

/**
 * The mark: two interlocking bolts forming an S and a Z, traced from `source/mark.jpeg` and made
 * exactly point-symmetric (the second bolt is the first rotated 180° about the centre). Units: a
 * 64 × 64 square with the mark 56 wide, centred.
 */
const BOLT = [
  [4, 45.14],
  [25.38, 27.99],
  [17.14, 16.3],
  [53.8, 10.24],
  [47.69, 22.56],
  [39.43, 26.95],
  [44.48, 16.35],
  [27.32, 19.49],
  [32.54, 30.68],
];
const round = (n) => Math.round(n * 100) / 100;
const bolts = [BOLT, BOLT.map(([x, y]) => [round(64 - x), round(64 - y)])];
/** Path data, optionally scaled and translated (for the 16 px file icon). */
const markPath = (scale = 1, dx = 0, dy = 0) =>
  bolts
    .map(
      (points) =>
        `M${points.map(([x, y]) => `${round(x * scale + dx)} ${round(y * scale + dy)}`).join('L')}Z`,
    )
    .join('');
const BOX = { x: 4, y: 10.24, width: 56, height: 43.52 };

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="swaggerz">${body}</svg>\n`;
const write = (name, content) => {
  writeFileSync(path.join(OUT, name), content);
};

// The mark on a transparent square, for app icons, favicons and avatars.
write('mark.svg', svg('0 0 64 64', `<path d="${markPath()}" fill="${GOLD}"/>`));
// Tight bounds in `currentColor`, for monochrome and inline use.
write(
  'glyph.svg',
  svg(
    `${BOX.x} ${BOX.y} ${BOX.width} ${BOX.height}`,
    `<path d="${markPath()}" fill="currentColor"/>`,
  ),
);
// 16 px file icons: the mark fills the width of the icon grid.
const ICON = 15 / BOX.width;
const iconPath = markPath(ICON, 0.5 - BOX.x * ICON, 8 - 32 * ICON);
write('file-icon.svg', svg('0 0 16 16', `<path d="${iconPath}" fill="${GOLD}"/>`));
write('file-icon-light.svg', svg('0 0 16 16', `<path d="${iconPath}" fill="${GOLD_DEEP}"/>`));

// Lockup: the mark and the wordmark, the wordmark's x-height centred on the mark.
const font = opentype.parse(
  readFileSync('node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff')
    .buffer,
);
function lockup(textColor) {
  const height = 56;
  const markHeight = 44;
  const scale = markHeight / BOX.height;
  const markWidth = BOX.width * scale;
  const mark = markPath(scale, -BOX.x * scale, (height - markHeight) / 2 - BOX.y * scale);
  const fontSize = 46;
  const text = 'swaggerz';
  const box = font.getPath(text, 0, 0, fontSize).getBoundingBox();
  const gap = 14;
  const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * fontSize;
  const baseline = height / 2 + xHeight / 2;
  const textPath = font.getPath(text, markWidth + gap - box.x1, baseline, fontSize);
  const width = Math.ceil(markWidth + gap + (box.x2 - box.x1) + 2);
  return svg(
    `0 0 ${width} ${height}`,
    `<path d="${mark}" fill="${GOLD}"/><path d="${textPath.toPathData(2)}" fill="${textColor}"/>`,
  );
}
write('logo.svg', lockup(INK));
write('logo-dark.svg', lockup(PAPER));
