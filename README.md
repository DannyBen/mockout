


# Mocking tool

## What was tried

- Vector graphic editor
- Paint.NET editor
- FigCraft and VectorCraft

## What is out of the question

- Heavy duty tools like figma
- Tools with endless menus and control surfaces

## What is mandatory

- Easy grid with snapping
- Heavy reliance on keyboard control
- Ability to define color swatches
- Ability to build reusable components 

## What is optional

- Smart snap to other objects, as long as it does not right with snap to grid

## Desired workflow

1. Create a few boxes that each describe their content - like header, body, sidebar
2. Double click a box to enter its editing (lets say clicked Header)
3. In header, repeat the process, for example, by creating boxes that say "button" and "readout"
4. In each of the components we can repeat with minimal styling, like adding a colorful edge, applying swatches, adding text etc

## Canvas prototype

Run `op serve` and open the URL it prints. Press `V` to select boxes: click one, Shift-click to add or remove one, drag from empty space to select boxes fully inside the marquee, or use Tab/Shift+Tab to cycle through boxes in creation order. The cycle wraps at either end and pans to reveal an offscreen box. Auto move contained elements: dragging a selected box also moves boxes fully contained by it at drag start; each box moves once. Alt+drag moves only the box under the pointer, even in Box mode. Press `B` and drag to draw a box. A box that encloses another sits behind it; moving a box onto another brings the moved box forward. Hold Space and drag, use the middle mouse button, or scroll to pan around the canvas. Ctrl+wheel zooms at the pointer; `+`/`-` zoom at the center, and Ctrl+0 resets to 100%. The toolbar and properties stay the same size while the canvas zooms.

Right-click a box to open properties, or right-click empty canvas to set its background and grid colors directly. Canvas colors do not use swatches; the background appears in Preview, while the grid does not. Escape goes back or closes properties. Press Enter or F2, or double-click a box, to edit its text. Box colors use named swatches; create or edit them with HSB, RGB, or Grayscale sliders or a hex value. Shared swatch changes preview on linked boxes until saved. An unused swatch can be deleted from its editor.

Use `1`, `2`, `3`, `4`, `5` for 40, 20, 10, 5 px grids and Off. A stronger grid line appears every ten cells. Padding X controls left/right space; Padding Y controls top/bottom space. New boxes inherit the last edited box style, with empty text and the size you draw. Drag any selected resize handle to resize all selected boxes, each snapped to the grid. Arrow keys move the selection; Shift+arrows resize it. Ctrl+arrows move five grid steps, and Ctrl+Shift+arrows resize five grid steps. Ctrl+D duplicates, Delete removes, and Ctrl+Z/Ctrl+Y undo and redo. The canvas restores locally on reopening; Open and Save exchange JSON project files. Preview opens a static HTML copy with embedded CSS; use the browser to save or capture it.





