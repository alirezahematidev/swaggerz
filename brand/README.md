# swaggerz brand

| File | Use |
| --- | --- |
| [`mark.svg`](mark.svg) | The mark: a Z whose bars carry the points of curly braces, on a marigold tile. App icons, favicons, avatars. Works on light and dark backgrounds. |
| [`logo.svg`](logo.svg) | Mark and wordmark for light backgrounds. |
| [`logo-dark.svg`](logo-dark.svg) | Mark and wordmark for dark backgrounds. |
| [`glyph.svg`](glyph.svg) | The Z alone in `currentColor`, for monochrome contexts (one-color print, embossing, inline UI). |

## Colors

| Name | Hex | Role |
| --- | --- | --- |
| Marigold | `#F2B33D` | Brand accent: the tile, highlights, focus |
| Ink | `#171614` | Text and the Z on light backgrounds |
| Paper | `#F6F2EA` | Light backgrounds, text on dark backgrounds |
| Night | `#141311` | Dark backgrounds |

## Type

- **Source Serif 4** (Semibold for the wordmark and headings): editorial voice.
- **Geist** for interface text, **Geist Mono** for code.

All three are licensed under the SIL Open Font License.

## Usage

- Keep clear space around the mark of at least a quarter of its width.
- Do not recolor the tile, rotate the mark, or set the wordmark in another typeface.
- At 16 px and below, use `mark.svg` without the wordmark.

`build-logo.mjs` regenerates the files from the geometry and the font.
