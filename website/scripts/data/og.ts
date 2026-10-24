/**
 * Open Graph images (1200 × 630) in the brand style: paper, the page title in Fraunces, the
 * chapter as a kicker and the logo. Text is laid out with the site's own fonts and drawn as
 * paths, so rendering needs no installed fonts; sharp turns the SVG into a PNG.
 */
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { openSync, type Font as FontkitFont } from 'fontkit';
import sharp from 'sharp';
import { CHAPTERS, chapterOf } from '../../src/navigation.ts';
import { ROOT, WEBSITE } from './output.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 88;
type Font = FontkitFont;

/**
 * Static cuts of the site's fonts: fontkit draws variable WOFF2 fonts only at their default
 * instance, so the cards use Fontsource's static files of the same families.
 */
const FONTS = path.join(WEBSITE, 'node_modules', '@fontsource');

function openFont(file: string): Font {
  const font = openSync(path.join(FONTS, file));
  if (!('layout' in font)) throw new Error(`${file} is a font collection`);
  return font;
}

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One line of text as SVG paths, and its width. */
function line(
  font: Font,
  text: string,
  size: number,
  x: number,
  y: number,
  fill: string,
): { svg: string; width: number } {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = 0;
  const paths: string[] = [];
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    const d = glyph.path.toSVG();
    if (d !== '') {
      const gx = x + (cursor + (position?.xOffset ?? 0)) * scale;
      const gy = y - (position?.yOffset ?? 0) * scale;
      paths.push(
        `<path transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`,
      );
    }
    cursor += position?.xAdvance ?? glyph.advanceWidth;
  });
  return { svg: `<g fill="${fill}">${paths.join('')}</g>`, width: cursor * scale };
}

/** Greedy word wrapping by the font's advances. */
function wrap(
  font: Font,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const scale = size / font.unitsPerEm;
  const width = (value: string): number => font.layout(value).advanceWidth * scale;
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (width(candidate) <= maxWidth || current === '') current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1] ?? ''}…`;
    return kept;
  }
  return lines;
}

interface Card {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kicker: string;
}

async function render(
  card: Card,
  fonts: { serif: Font; sans: Font; strong: Font },
  logo: string,
): Promise<Buffer> {
  const titleSize = card.title.length > 34 ? 68 : 82;
  const titleLines = wrap(fonts.serif, card.title, titleSize, WIDTH - MARGIN * 2, 3);
  const parts: string[] = [];
  // Laid out from the top: the kicker, then the title's first baseline below it.
  const kicker = 116;
  let y = kicker + 30 + titleSize * 0.78;
  parts.push(line(fonts.strong, card.kicker.toUpperCase(), 22, MARGIN, kicker, '#8A5A00').svg);
  titleLines.forEach((text, index) => {
    if (index > 0) y += titleSize * 1.1;
    parts.push(line(fonts.serif, text, titleSize, MARGIN, y, '#1B1915').svg);
  });
  const descriptionLines = wrap(fonts.sans, card.description, 28, WIDTH - MARGIN * 2 - 80, 2);
  y += 58;
  for (const text of descriptionLines) {
    parts.push(line(fonts.sans, text, 28, MARGIN, y, '#6B655B').svg);
    y += 40;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#F6F2EA"/>
<rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="#F2B33D"/>
<line x1="${MARGIN}" y1="${HEIGHT - 118}" x2="${WIDTH - MARGIN}" y2="${HEIGHT - 118}" stroke="#E0D8C8" stroke-width="2"/>
${parts.join('\n')}
<svg x="${MARGIN}" y="${HEIGHT - 92}" width="232" height="46" viewBox="0 0 279 56">${logo}</svg>
<title>${escape(card.title)}</title>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function titleOf(page: { id: string; source?: string; title?: string }): Promise<string> {
  if (page.title !== undefined) return page.title;
  if (page.source !== undefined) {
    const text = await readFile(path.join(ROOT, page.source), 'utf8');
    const heading = /^# (.+)$/m.exec(text)?.[1];
    if (heading !== undefined) return heading.replace(/`/g, '');
  }
  for (const extension of ['mdx', 'md']) {
    const file = path.join(WEBSITE, 'src', 'content', 'docs', `${page.id}.${extension}`);
    const text = await readFile(file, 'utf8').catch(() => undefined);
    const title = text === undefined ? undefined : /^title:\s*(.+)$/m.exec(text)?.[1];
    if (title !== undefined) return title.trim().replace(/^['"]|['"]$/g, '');
  }
  return page.id;
}

export async function ogImages(): Promise<void> {
  const fonts = {
    serif: openFont('fraunces/files/fraunces-latin-500-normal.woff2'),
    sans: openFont('figtree/files/figtree-latin-400-normal.woff2'),
    strong: openFont('figtree/files/figtree-latin-600-normal.woff2'),
  };
  // The logo's inner markup (mark and wordmark paths), nested as an SVG of its own.
  const logoSvg = await readFile(path.join(ROOT, 'brand', 'logo.svg'), 'utf8');
  const logo = logoSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const cards: Card[] = [
    {
      id: 'index',
      title: 'Your OpenAPI spec, compiled into the client you would have written by hand.',
      description:
        'Typed, tree-shakeable TypeScript and JavaScript clients from Swagger and OpenAPI.',
      kicker: 'An OpenAPI compiler for TypeScript',
    },
  ];
  for (const chapter of CHAPTERS) {
    for (const page of chapter.pages) {
      const number = chapterOf(page.id)?.number ?? '';
      cards.push({
        id: page.id,
        title: page.external === true ? (page.label ?? page.id) : await titleOf(page),
        description:
          page.description ?? 'Typed API clients compiled from Swagger and OpenAPI documents.',
        kicker: `${number} · ${chapter.label}`,
      });
    }
  }
  // The examples gallery's pages.
  for (const entry of (await readdir(path.join(ROOT, 'examples'), { withFileTypes: true })).filter(
    (e) => e.isDirectory(),
  )) {
    const readme = await readFile(path.join(ROOT, 'examples', entry.name, 'README.md'), 'utf8');
    const title = /^# (.+)$/m.exec(readme)?.[1] ?? entry.name;
    const lead =
      readme
        .split(/\n\s*\n/)
        .find((p) => p.trim() !== '' && !p.startsWith('#') && !p.startsWith('```')) ?? '';
    cards.push({
      id: `examples/${entry.name}`,
      title,
      description: lead
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
      kicker: `${chapterOf('examples')?.number ?? ''} · Examples`,
    });
  }
  const directory = path.join(WEBSITE, 'public', 'og');
  await Promise.all(
    cards.map(async (card) => {
      const file = path.join(directory, `${card.id}.png`);
      await mkdir(path.dirname(file), { recursive: true });
      await sharp(await render(card, fonts, logo)).toFile(file);
    }),
  );
}
