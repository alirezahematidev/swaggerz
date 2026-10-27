/**
 * Checks WCAG 2.2 contrast for every text/background pair the site uses, in both themes, read
 * from the palette CSS (src/dashboard/client/tokens.css and src/styles/tokens.css). Body text
 * needs 4.5:1 (AA); the focus ring and other non-text marks need 3:1.
 */
import { palette, type Theme } from '../src/styles/palette.ts';

interface Pair {
  readonly foreground: string;
  readonly backgrounds: readonly string[];
  readonly minimum: number;
  readonly use: string;
}

const PAPER = ['background', 'surface', 'surface-sunken'];

export const PAIRS: readonly Pair[] = [
  { foreground: 'text', backgrounds: PAPER, minimum: 4.5, use: 'body text' },
  {
    foreground: 'text-strong',
    backgrounds: [...PAPER, 'muted', 'highlight'],
    minimum: 4.5,
    use: 'headings, code',
  },
  {
    foreground: 'muted-foreground',
    backgrounds: [...PAPER, 'muted'],
    minimum: 4.5,
    use: 'secondary text',
  },
  { foreground: 'link', backgrounds: PAPER, minimum: 4.5, use: 'links' },
  {
    foreground: 'marigold-ink',
    backgrounds: [...PAPER, 'highlight'],
    minimum: 4.5,
    use: 'kickers, badges',
  },
  // Severity stamps sit on a 10–12% tint of their own color.
  {
    foreground: 'danger',
    backgrounds: [...PAPER, 'mix(danger 10%, background)'],
    minimum: 4.5,
    use: 'error stamps',
  },
  {
    foreground: 'warning',
    backgrounds: [...PAPER, 'mix(warning 12%, background)'],
    minimum: 4.5,
    use: 'warning stamps',
  },
  {
    foreground: 'info',
    backgrounds: [...PAPER, 'mix(info 12%, background)'],
    minimum: 4.5,
    use: 'info stamps',
  },
  { foreground: 'success', backgrounds: PAPER, minimum: 4.5, use: 'success text' },
  // HTTP method stamps, on a 12–14% tint of their color (as in the dashboard).
  ...['get', 'post', 'put', 'patch', 'delete', 'other'].map((method) => ({
    foreground: `method-${method}`,
    backgrounds: [`mix(method-${method} 14%, background)`, `mix(method-${method} 14%, surface)`],
    minimum: 4.5,
    use: `${method.toUpperCase()} stamps`,
  })),
  {
    foreground: 'code-keyword',
    backgrounds: ['surface', 'surface-sunken'],
    minimum: 4.5,
    use: 'code keywords',
  },
  {
    foreground: 'code-string',
    backgrounds: ['surface', 'surface-sunken'],
    minimum: 4.5,
    use: 'code strings',
  },
  {
    foreground: 'code-type',
    backgrounds: ['surface', 'surface-sunken'],
    minimum: 4.5,
    use: 'code types',
  },
  {
    foreground: 'code-number',
    backgrounds: ['surface', 'surface-sunken'],
    minimum: 4.5,
    use: 'code numbers',
  },
  {
    foreground: 'code-comment',
    backgrounds: ['surface', 'surface-sunken'],
    minimum: 4.5,
    use: 'code comments',
  },
  { foreground: 'focus', backgrounds: PAPER, minimum: 3, use: 'focus outline' },
  {
    foreground: 'producthunt-ink',
    backgrounds: ['producthunt'],
    minimum: 4.5,
    use: 'Product Hunt button',
  },
  {
    foreground: 'border-strong',
    backgrounds: ['background'],
    minimum: 1.3,
    use: 'table rules (decorative)',
  },
];

function channels(hex: string): [number, number, number] {
  const value = /^#([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (value === undefined) throw new Error(`Not a #rrggbb color: ${hex}`);
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `mix(color P%, other)`: `color-mix(in srgb, color P%, other)` of two tokens. */
function resolve(colors: Readonly<Record<string, string>>, name: string): string | undefined {
  const mix = /^mix\((\S+) (\d+)%, (\S+)\)$/.exec(name);
  if (mix === null) return colors[name];
  const [, a = '', percent = '0', b = ''] = mix;
  const first = colors[a];
  const second = colors[b];
  if (first === undefined || second === undefined) return undefined;
  const weight = Number(percent) / 100;
  const [r1, g1, b1] = channels(first);
  const [r2, g2, b2] = channels(second);
  const hex = (value: number): string =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r1 * weight + r2 * (1 - weight))}${hex(g1 * weight + g2 * (1 - weight))}${hex(b1 * weight + b2 * (1 - weight))}`;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export function checkContrast(): string[] {
  const problems: string[] = [];
  for (const theme of ['light', 'dark'] as Theme[]) {
    const colors = palette(theme);
    for (const pair of PAIRS) {
      const foreground = colors[pair.foreground];
      if (foreground === undefined) {
        problems.push(`${theme}: --${pair.foreground} is not a palette token`);
        continue;
      }
      for (const background of pair.backgrounds) {
        const color = resolve(colors, background);
        if (color === undefined) {
          problems.push(`${theme}: --${background} is not a palette token`);
          continue;
        }
        const ratio = contrast(foreground, color);
        if (ratio < pair.minimum) {
          problems.push(
            `${theme}: --${pair.foreground} on --${background} is ${ratio.toFixed(2)}:1, needs ${pair.minimum}:1 (${pair.use})`,
          );
        }
      }
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkContrast();
  if (problems.length > 0) {
    console.error(`Contrast below WCAG AA:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Contrast: ${PAIRS.length} token pairs pass in both themes.`);
  }
}
