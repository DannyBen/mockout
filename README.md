# Minimock

Minimock is a small browser-based tool for sketching user interfaces.
It keeps the canvas simple: draw boxes, give them text and color, and arrange
them into a mock without building a real application first.

## The idea

Everything on the canvas is a box. A button can be a colored box with a label;
a text label can be a transparent box; a panel can be a box containing other
boxes. The same few controls work for all of them.

Boxes have size, position, padding, alignment, borders, and rounded corners.
Text sits inside its box and follows its alignment. There is no separate
component library to learn or maintain.

## Drawing and arranging

- Draw, select, move, resize, and duplicate boxes directly on the canvas.
- Snap work to a visible grid, with several grid sizes for broad layout or
  finer detail.
- Move a box and the boxes fully inside it move along with it. This keeps
  related pieces together without creating a permanent group.
- Select several boxes to move or resize them together.
- Pan and zoom to work on different parts of a mock.

## Color

Box fill, text, and border colors use named swatches. When a swatch changes,
every box using it changes too. Colors can be entered as hex values or adjusted
with HSB, RGB, or grayscale controls.

The canvas background and grid colors are set separately, so they do not take
up swatch names meant for the mock itself.

## Fonts and icons

Open a box's properties and move the section control from General to Font.
Enter a family name from Google Fonts, or choose Material icons and an icon style.
For an icon, put its name (such as `arrow_forward`) in the box's Text field.
Filled and Two Tone use the classic Material Icons set; the other styles use
Material Symbols. The Font section links to the matching catalog. Google fonts
and icons need an internet connection in the editor and in exported previews.

## Projects and previews

Minimock keeps the current mock in the browser and can save or open a JSON
project file. You can also drop a JSON project onto the app to open it.
A preview opens the mock as a standalone HTML page with its CSS
embedded, ready for viewing or capturing without the editing controls or grid.

Minimock is an early, deliberately small project. Its goal is to make a quick
UI sketch feel precise without turning the process into a full design system.

## Run locally

Serve the `public` directory with a static HTTP server, then open it in a browser.
For example, run `python3 -m http.server 8000 --directory public` and visit
`http://localhost:8000`. Preview needs HTTP to load the project's CSS.

Run `op test` for dependency-free regression tests covering selection, placement,
and project data.

## Deploy to Cloudflare Workers

Connect this repository to a Cloudflare Worker named `minimock`. Leave the build
command blank and use `npx wrangler deploy` as the deploy command. Wrangler reads
`wrangler.jsonc` and publishes only the files in `public`.

