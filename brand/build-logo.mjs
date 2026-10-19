/**
 * Regenerates the logo files in this directory. The wordmark is Source Serif 4 Semibold,
 * converted to outlines so the SVGs render identically without the font installed.
 *
 *   cd "$(mktemp -d)" && npm init -y >/dev/null && npm i opentype.js@1.3.4 @fontsource/source-serif-4@5
 *   node <repo>/brand/build-logo.mjs   # run from that directory; writes to the current directory
 */
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';

const INK = '#171614', PAPER = '#F6F2EA', GOLD = '#F2B33D';
const font = opentype.parse(readFileSync('node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff').buffer);

// The mark: a Z whose bars carry the points of curly braces, on a marigold tile.
const Z = (x1, x2, top, bottom, nose, r) => {
  const m = (x1 + x2) / 2;
  return `M${x1} ${top} L${m - r} ${top} Q${m} ${top} ${m} ${top - nose} Q${m} ${top} ${m + r} ${top} L${x2} ${top} L${x1} ${bottom} L${m - r} ${bottom} Q${m} ${bottom} ${m} ${bottom + nose} Q${m} ${bottom} ${m + r} ${bottom} L${x2} ${bottom}`;
};
const zPath = Z(16.5, 47.5, 22.5, 41.5, 4, 7.5);
const markBody = (x = 0, y = 0, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><rect x="2" y="2" width="60" height="60" rx="18" fill="${GOLD}"/><path d="${zPath}" fill="none" stroke="${INK}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="swaggerz">${markBody()}</svg>\n`;
writeFileSync('mark.svg', mark);

// Glyph-only mark (no tile) for monochrome use.
const glyph = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 12 48 40" role="img" aria-label="swaggerz"><path d="${zPath}" fill="none" stroke="${color}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;
writeFileSync('glyph.svg', glyph('currentColor'));

// Lockup: mark + wordmark set in Source Serif 4 Semibold, converted to outlines.
function lockup(textColor) {
  const fontSize = 46;
  const text = 'swaggerz';
  const p = font.getPath(text, 0, 0, fontSize);
  const box = p.getBoundingBox();
  const markSize = 64;
  const gap = 16;
  // Align the wordmark's x-height center with the mark's center.
  const xHeight = (font.tables.os2.sxHeight / font.unitsPerEm) * fontSize;
  const baseline = markSize / 2 + xHeight / 2;
  const textPath = font.getPath(text, markSize + gap - box.x1, baseline, fontSize);
  const width = Math.ceil(markSize + gap + (box.x2 - box.x1) + 2);
  const d = textPath.toPathData(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${markSize}" role="img" aria-label="swaggerz">${markBody()}<path d="${d}" fill="${textColor}"/></svg>\n`;
}
writeFileSync('logo.svg', lockup(INK));
writeFileSync('logo-dark.svg', lockup(PAPER));
console.log('x-height', font.tables.os2.sxHeight, font.unitsPerEm);
