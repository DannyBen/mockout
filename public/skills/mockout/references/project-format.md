# Mockout project format, version 1

The [JSON Schema](project.schema.json) defines field types and required fields.
The [starter](../examples/starter.json) is a complete blank document. Read the
existing document before editing it; never substitute an example for live work.

## Document

| Field | Meaning |
| --- | --- |
| `version` | Always `1`. |
| `grid` | Snap size: `gridBase` × `1`, `2`, `4`, or `8`; `0` disables snapping. Use `5` for new mockups by default. |
| `gridBase` | Optional smallest grid size, a whole number from `2` to `100` pixels; omitted means `5`. |
| `gridDivisions` | Optional number of active grid cells between major lines, a whole number from `2` to `100`; omitted means `10`. |
| `nextId` | Next available integer used by the editor to allocate box IDs and new swatch IDs of the form `sN`. Advance it when allocating IDs. |
| `swatches` | Named color roles with a light color and optional dark behavior. |
| `boxes` | Flat array of elements, ordered from back to front. |
| `canvasColors` | Required light colors for `background`, `gridMajor`, and `gridMinor`. |
| `canvasColorModes` | Optional color-picker modes for the three canvas colors. |
| `canvasDark` | Optional dark behavior for each canvas color. |
| `lastStyle` | Optional complete style used when drawing the next box. Keep it valid when changing swatches. |

Numbers are finite JSON numbers. New box IDs must be unique integers. Allocate
from `nextId`, skipping occupied IDs, and increment it. Keep it above existing
box IDs and the numeric suffixes of any swatch IDs named `sN`.
Swatch IDs must also be unique; use stable IDs and preserve existing ones.

## Boxes

Every box needs these fields:

| Fields | Meaning |
| --- | --- |
| `id` | Unique integer ID. |
| `x`, `y` | Absolute canvas coordinates in pixels; negative positions are allowed. |
| `w`, `h` | Width and height in pixels, both greater than zero. |
| `text` | String, including `""` for an empty box. Use `\n` for line breaks. |
| `fill`, `textColor`, `borderColor` | Swatch ID, or `null` for transparent. Never put a hex color here. |
| `borderWidth`, `radius` | Stroke width and corner radius in pixels. Author nonnegative values. |
| `alignX` | `left`, `center`, or `right`. |
| `alignY` | `top`, `center`, or `bottom`. |

Optional fields:

| Fields | Meaning |
| --- | --- |
| `paddingX`, `paddingY` | Nonnegative text padding. Omitted values render as `3`. |
| `opacity` | Whole-box opacity from `0` (invisible) to `1` (fully opaque, the default). Applies to fill, border, and text together. Contained boxes are independent. |
| `borderWidths` | Four nonnegative widths in top, right, bottom, left order. Overrides `borderWidth`. |
| `borderColors` | Four swatch IDs or `null`, in top, right, bottom, left order. Overrides `borderColor`. |
| `cornerRadii` | Four nonnegative radii in top-left, top-right, bottom-right, bottom-left order. Overrides `radius`. |
| `fontFamily` | `""` for system font, a Google Fonts family, or a supported Material icon family. Maximum 80 characters; no leading/trailing whitespace, control characters, `:`, `;`, `"`, or backslash. |
| `fontSize` | Positive pixels; omitted means `13`. |
| `fontWeight` | `100`, `200`, …, `900`; omitted means `400`. |
| `fontStyle` | `normal` or `italic`; omitted means `normal`. |

Draw order follows the array: earlier boxes are behind later ones. Put a panel
before the labels and controls inside it. Containment is geometric; child
coordinates remain absolute. There are no parent pointers, nested boxes, lock
flags, or interactive button behaviors. A label is a box with transparent fill
and border. A button is a styled box with text.

Per-side arrays are optional and apply independently. Keep the uniform fields
present as fallbacks. Editing a uniform field in the editor removes its matching
array. Border widths can be very large (the editor allows up to `10000`); a thick
single side can fill its entire axis for effects such as a progress bar. If
opposing widths exceed a box's size, rendering scales them to fit that axis
without changing saved values or box geometry. Individual corners follow CSS
radius scaling when they do not fit.

Changing grid settings does not snap existing geometry. When changing `gridBase`,
keep the active multiplier by scaling `grid` by the new base divided by the old
base; keep `0` unchanged. Major lines are spaced `grid × gridDivisions` pixels apart.
Align new or changed geometry
deliberately. Browser saves normalize exported positions so the top-left box
starts at `(0, 0)`; reread before every agent edit and do not rely on a cached origin.

### Text fitting

Mockout uses a line height of `1.35 × fontSize`. Allow for all visible and wrapped
lines, padding on both sides, and borders when sizing a text box. An approximate
minimum height is:

```text
line count × fontSize × 1.35 + 2 × paddingY + 2 × borderWidth
```

With per-side widths, replace `2 × borderWidth` with the top and bottom widths.

For example, two lines at 20px need 54px for text. With 10px vertical padding and
a 1px border, they need 76px total: use at least 80px on a 5px grid. A transparent
border still occupies space when `borderWidth` is nonzero. Available text width
also excludes horizontal padding and borders, so allow for additional wrapping.

Each box applies one font size and weight to all its text. Use separate boxes for
a heading and a smaller subtitle. Estimates depend on the font and line wrapping;
leave room when rendering is unavailable and inspect the actual layout when you can.

## Swatches and dual colors

A swatch has `id`, `name`, and `color`; light colors use six-digit `#RRGGBB`.
Optional `mode` (`hsb`, `rgb`, or `gray`) controls the picker, not rendering.
All three box color references resolve through the same swatch list.

Example role swatch:

```json
{
  "id": "surface",
  "name": "Surface",
  "color": "#ffffff",
  "mode": "gray",
  "dark": { "mode": "custom", "color": "#202735", "colorMode": "hsb" }
}
```

`dark` is optional on a swatch. The same dark object can be assigned to each
property in `canvasDark`:

| Dark behavior | Object |
| --- | --- |
| Invert, the default when omitted | `{ "mode": "invert" }` |
| Use the light color unchanged | `{ "mode": "same" }` |
| Explicit dark color | `{ "mode": "custom", "color": "#202735" }` |

For `invert` and `same`, an unused `color` may be omitted or `null`; the editor
can save either representation. `custom` requires a six-digit hex color.
Optional `colorMode` is a picker mode: `hsb`, `rgb`, or `gray`.
These colors belong in `swatches` or canvas settings, not directly on boxes.
Do not duplicate light/dark boxes or create separate light/dark layouts.

Removing a swatch requires updating all matching references, including `borderColors`,
`lastStyle.fill`, `lastStyle.textColor`, and `lastStyle.borderColor` if present.
Prefer reusing or editing existing roles rather than deleting them.

## Last style

`lastStyle` uses the box style fields without `id`, geometry, or `text`.
When present, it requires `fill`, `textColor`, `borderColor`, `borderWidth`,
`radius`, **both** padding fields, `alignX`, and `alignY`. Opacity, font fields,
and the three per-side arrays are optional. Preserve per-side swatch references
in `lastStyle` when removing a swatch.

## Icons

Both Unicode symbols and Material icons are ordinary boxes. The following
fragments show icon-specific fields to set on an otherwise complete box.

### Unicode symbols

Put the actual character in `text` and use a normal text font:

```json
{ "text": "♥", "fontFamily": "", "fontSize": 20 }
```

For example, `♥`, `→`, or `✦` can serve as simple icons. With `fontFamily: ""`,
the font panel correctly shows **Default**: the symbol is a character in the
normal font. Resizing it does not turn it into a Material icon. Glyph appearance
and availability can vary with the font and platform.

### Material icons

Put the icon's ligature name in `text` and select a Material font:

```json
{
  "text": "favorite",
  "fontFamily": "Material Symbols Outlined",
  "fontSize": 20,
  "fontWeight": 400,
  "fontStyle": "normal"
}
```

This renders the icon named `favorite`; the font panel shows **Material**.
Supported icon font families are `Material Symbols Outlined`,
`Material Symbols Rounded`, `Material Symbols Sharp`, `Material Icons`, and
`Material Icons Two Tone`. Put the icon's ligature name, such as `search`, in
`text`. Use normal style; use weight `400` for classic Material Icons and at most
`700` for Material Symbols. Use separate boxes for an icon and a normal text label.
The bundled [email client](../examples/email-client.json) demonstrates real icon
boxes using `Material Symbols Outlined` and `Material Icons`, alongside
normal text in `Assistant`. Inspect its box font fields and swatch references
when adding icons. The larger [Welcome project](../examples/welcome.json) uses
Material Symbols in its Type & Icons card and demonstrates more detailed layouts
with paired light/dark colors.

Use a `textColor` swatch reference for either kind of icon, and allow enough room
for the glyph and padding. Prefer Material for a consistent interface icon set;
Unicode is useful for simple text symbols. Verify font loading during visual
checks so a Material ligature name is not mistaken for the intended rendered icon.

## Checks beyond JSON Schema

Before publishing each box, check:

- Unique box IDs and unique swatch IDs; `nextId` remains free and advances.
- `grid` is `0` or one of the four doubling steps derived from `gridBase`.
- Every non-null color reference, including `lastStyle`, names an existing swatch.
- New geometry follows the chosen grid and all boxes have positive dimensions.
- Backgrounds precede their contents, and no unwanted box covers existing work.
- Unrelated fields, user content, and existing layout are preserved.

JSON Schema checks structure; it cannot enforce references to IDs elsewhere in
the document or the intended appearance. If the Mockout source is locally
available, its `public/project.js` exports `validProject` for an additional check.
