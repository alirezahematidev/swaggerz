# swaggerz brand

The mark is two interlocking bolts that read as an S and a Z, in marigold on a transparent background. The second bolt is the first rotated 180°, so the mark is exactly point-symmetric.

| File                                         | Use                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`mark.svg`](mark.svg)                       | The mark in marigold on a transparent 64 × 64 square. Favicons, app icons, avatars. Works on light and dark backgrounds.  |
| [`mark.png`](mark.png)                       | The mark as a 512 × 512 transparent PNG, for places that need a raster image (package registries, social previews).       |
| [`logo.svg`](logo.svg)                       | Mark and wordmark for light backgrounds.                                                                                  |
| [`logo-dark.svg`](logo-dark.svg)             | Mark and wordmark for dark backgrounds.                                                                                   |
| [`glyph.svg`](glyph.svg)                     | The mark in `currentColor` with tight bounds, for monochrome and inline use (one-color print, embossing, UI).             |
| [`file-icon.svg`](file-icon.svg)             | 16 px file icon for `swaggerz.config.*` on dark themes, marigold.                                                         |
| [`file-icon-light.svg`](file-icon-light.svg) | The file icon for light themes, in a deeper gold (`#B07A12`, 3.7:1 against white) because marigold is too faint at 16 px. |
| [`source/mark.jpeg`](source/mark.jpeg)       | The original artwork (white on black) the vector mark was traced from.                                                    |

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

All three are licensed under the SIL Open Font License.

## Usage

- Keep clear space around the mark of at least a quarter of its width.
- Do not recolor, rotate, mirror or outline the mark, put it back on a dark tile, or set the wordmark in another typeface.
- At 16 px and below, use the mark without the wordmark; on light backgrounds at those sizes, use the deep gold variant.

## Regenerating

`build-logo.mjs` writes every SVG from the mark's geometry and the wordmark font (instructions at the top of the file). The geometry was traced from `source/mark.jpeg`: the outline was extracted at sub-pixel precision, each edge refit as a straight line, and the two bolts averaged into an exact 180° rotation of each other (the original's own asymmetry was under 0.05 px). `mark.png` is rendered from `mark.svg`.
