# swaggerz brand

The mark is two interlocking bolts that read as an S and a Z, in marigold on a transparent background. The second bolt is the first rotated 180°, so the mark is exactly point-symmetric.

| File                                                   | Use                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [`mark.svg`](mark.svg)                                 | The mark in marigold on a transparent 64 × 64 square. Favicons, app icons, avatars. Works on light and dark backgrounds.  |
| [`mark.png`](mark.png)                                 | The mark as a 512 × 512 transparent PNG, for places that need a raster image (package registries, social previews).       |
| [`logo.svg`](logo.svg)                                 | Mark and wordmark for light backgrounds.                                                                                  |
| [`logo-dark.svg`](logo-dark.svg)                       | Mark and wordmark for dark backgrounds.                                                                                   |
| [`logotype.png`](logotype.png)                         | The logotype — "swaggerz" in Passero One — in ink on a transparent background (2506 × 792), for light backgrounds.        |
| [`logotype-dark.png`](logotype-dark.png)               | The logotype in paper, for dark backgrounds.                                                                              |
| [`logotype-lockup.png`](logotype-lockup.png)           | Mark and logotype side by side, for light backgrounds (3218 × 792). Marketing, social media, the docs site header.        |
| [`logotype-lockup-dark.png`](logotype-lockup-dark.png) | Mark and logotype for dark backgrounds.                                                                                   |
| [`glyph.svg`](glyph.svg)                               | The mark in `currentColor` with tight bounds, for monochrome and inline use (one-color print, embossing, UI).             |
| [`file-icon.svg`](file-icon.svg)                       | 16 px file icon for `swaggerz.config.*` on dark themes, marigold.                                                         |
| [`file-icon-light.svg`](file-icon-light.svg)           | The file icon for light themes, in a deeper gold (`#B07A12`, 3.7:1 against white) because marigold is too faint at 16 px. |
| [`source/mark.jpeg`](source/mark.jpeg)                 | The original artwork (white on black) the vector mark was traced from.                                                    |

## Colors

| Name      | Hex       | Role                                                  |
| --------- | --------- | ----------------------------------------------------- |
| Marigold  | `#F2B33D` | The mark, highlights, focus                           |
| Deep gold | `#B07A12` | The mark at icon sizes on light backgrounds           |
| Ink       | `#171614` | Text and the wordmark on light backgrounds            |
| Paper     | `#F6F2EA` | Light backgrounds, text and the wordmark on dark ones |
| Night     | `#141311` | Dark backgrounds                                      |

## Type

- **Source Serif 4** (Semibold for the wordmark and headings): editorial voice.
- **Geist** for interface text, **Geist Mono** for code.

- **Passero One** for the logotype (the `logotype*.png` files): the display voice for marketing and social media. Only the rendered images are kept; the font is downloaded to regenerate them (`build-logotype.mjs`).

All four are licensed under the SIL Open Font License.

## Usage

- Keep clear space around the mark of at least a quarter of its width.
- Do not recolor, rotate, mirror or outline the mark, or put it back on a dark tile. Set "swaggerz" only in Source Serif 4 (the wordmark in `logo.svg`) or Passero One (the logotype images).
- At 16 px and below, use the mark without the wordmark; on light backgrounds at those sizes, use the deep gold variant.

## Regenerating

`build-logo.mjs` writes every SVG from the mark's geometry and the wordmark font (instructions at the top of the file). The geometry was traced from `source/mark.jpeg`: the outline was extracted at sub-pixel precision, each edge refit as a straight line, and the two bolts averaged into an exact 180° rotation of each other (the original's own asymmetry was under 0.05 px). `mark.png` is rendered from `mark.svg`. `build-logotype.mjs` renders the logotype images with a headless browser (instructions at the top of the file).
