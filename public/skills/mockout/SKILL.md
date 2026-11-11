---
name: mockout
description: Create and edit Mockout mockups through a shared local JSON file, building visibly box by box. Use for Mockout layouts, visual inspection, or exporting project JSON to PNG through its browser renderer.
---

# Mockout

Collaborate with the user in [Mockout](https://mockout.sector-seven.com) by editing
the same JSON file that their browser has open. Every element is an editable box.
The browser saves the user's edits automatically and reloads valid external edits.

## Use the shared file

- If the user supplied a project path, use it. Otherwise ask for the path to the
  file they want to share. A browser filename alone does not give you its path.
- You need read/write access to that exact file on the user's computer or a shared
  filesystem. An uploaded copy or a separate cloud workspace is not a live connection.
  If that access is unavailable, explain the requirement before promising live edits.
- For users new to this workflow, briefly explain that Mockout and the agent edit
  the same file. If they have work open but no file yet, guide them to **Ctrl+S →
  Save and connect**, choose a location accessible to you, and share its path.
- If the requested path does not exist and they want a new project, create it from
  [starter.json](examples/starter.json). Ask them to open it with **… → Load JSON**
  or drag it into Mockout, choose **Open connected file**, and grant read/write
  permission. **Open a local copy** does not connect the file. Preserve existing
  files unless replacement was requested.
- When the shared path is known and accessible, proceed with the requested edits.
  Reuse the conversation's setup; do not require a connection-status confirmation
  before editing or at the start of every session. Ask only when the intended
  file or access is unclear, or troubleshoot when updates are reported missing.
  A browser connection enables live updates; it is not required to prepare JSON.

Read [the project format](references/project-format.md) before your first edit.
The [JSON Schema](references/project.schema.json) describes the document structure.
Keep `version` at `1`. Leave unsupported data untouched and report the problem;
do not migrate the file or clear browser storage.

## Build visibly, box by box

**Create one complete box and save it before working on the next box.** The user
should see the mockup develop while you work. Publish the screen frame, then the
sidebar, then its first button, and so on. Make requested changes to existing
boxes incrementally too.

Each save contains the whole valid JSON document, with just that next change.
Do not build the entire mockup privately and publish it at the end. Do not replay
a finished mockup through a tight loop of writes: those updates can be coalesced
and do not provide useful live progress. Separate construction steps with actual
file saves, without artificial delays or confirmation after every box.

Use [email-client.json](examples/email-client.json) for an interface with Material
icon boxes and a Google font. For a richer layout, consult
[welcome.json](examples/welcome.json): it contains Material icons, typography, panels
with contained elements, and OKLCH palettes with light/dark recipes. It is the
same Welcome project shipped with Mockout and is included in this skill for local use.
Consult it when those features are relevant; do not
paste a completed example over the user's work. For a new project, start with
the small starter and build the requested design box by box.

## Save without replacing the user's edits

For every construction step:

1. Read the current file again and record its modification timestamp. Apply only
   the next intended change to this freshly read document. Preserve unrelated
   content, IDs, swatches, settings, and fields you do not need to change.
2. Check the structure and the semantic rules in the format reference. Serialize
   the complete document as UTF-8 JSON. No comments, trailing commas, or nonfinite
   numbers. Never truncate or stream a partial document into the connected file.
3. Write a temporary sibling file and close it. Just before replacing the target,
   check its timestamp again. If it changed, discard the temporary file, reread,
   and reapply the small change. If edits keep colliding or the intent is ambiguous,
   stop and coordinate with the user instead of repeatedly overwriting.
4. Atomically replace the original file with the completed temporary file using
   the filesystem's replace/rename operation. Keep the same target path. Then move
   on to constructing the next box.

This is a best-effort timestamp check, not a cross-process lock. If Mockout shows
**Conflict**, both sides changed before synchronization completed. Stop writing
and let the user choose **Reload file** (use the disk version) or **Save ours**
(use the browser canvas), then reread the chosen result before continuing.
For **Save failed** or **File error**, resolve the reported problem first.
Report file edits as file edits; describe them as visible in the user's browser
only when observed or reported by the user.

### If updates do not appear

Use connection checks as troubleshooting, not a routine checkpoint. Ask what the
bottom-left status shows: the intended filename without `.json` and a circled
check indicate a connection. **Local session** means the browser is working on a
local copy; reopen the shared file with **Open connected file**. **Reconnect**
renews read/write permission, which may be needed after a browser restart.
If the file is connected, have the user return to the Mockout tab to prompt a
fresh check, then investigate file timestamps or errors if updates are still missing.

## Inspect the result when supported

Include visual inspection in the workflow when you have browser or screenshot
tools. Choose when to check based on layout complexity, uncertainty, and the cost
of rendering. There is no fixed frequency; keep saving box by box regardless of
how often you inspect the result.

Open [live Mockout](https://mockout.sector-seven.com/) in a separate browser
context. Load the current JSON through its normal file input (`#open-file` for
browser automation), choose **Open a local copy**, wait for fonts and layout,
and inspect the result.
Keep this inspection separate from the user's active canvas and file connection.
Look for clipped text, unintended overlaps, missing icons, and poor contrast.
DOM scroll-size measurements can flag possible text overflow for closer inspection.

If visual tools are unavailable, continue using the format checks and
[text-fitting guidance](references/project-format.md#text-fitting). State that
the result has not been visually inspected; do not claim a rendered check.

### Get a PNG from project JSON

With browser automation and download access, use Mockout's existing PNG exporter:

1. In the separate inspection context described above, load the JSON as a local
   copy. Wait until the Open dialog has closed and the project has rendered.
2. Choose the desired light or dark theme, configure your browser tool to capture
   downloads, then click **… → Export PNG…** (`#export-png-button`). The export
   includes the entire mockup at 2× resolution with 20px margins and the active
   canvas background, without editor controls; it is independent of canvas zoom.
3. Wait for the download to finish, retrieve the PNG to a path you can read, and
   inspect it with your image tools or provide it to the user.

If the native Save As picker cannot be automated but page JavaScript is available,
set `window.showSaveFilePicker = undefined` in that separate inspection page
before exporting. This uses Mockout's normal download fallback. Keep this change
out of the user's active browser session.

A headless browser can perform the same workflow. Editing JSON alone cannot
produce a PNG: without browser rendering and file retrieval, report that export
is unavailable in your environment rather than claiming an image was generated.

## Design conventions

- Default new mockups to a 5px grid. Align box coordinates and dimensions to that
  grid. When extending an existing project, respect its chosen grid and geometry;
  do not rescale existing work to impose the default. `grid: 0` disables snapping.
- Start new projects with named **Background** and **Accent** palettes, as in the
  starter. Choose a base color and L/C/H steps to generate `3`, `6`, or `9` colors;
  reuse those slots across surfaces, text, borders, and controls. Box color fields
  still reference swatch IDs, not hex values. See
  [palette recipes](references/project-format.md#palette-recipes) for the format.
- Author the light recipe first. Set `dark.mode` explicitly: **Inverse** reverses
  lightness, **Same** keeps the light colors, and **Custom** provides an independent
  dark recipe. Inverse suits many neutral ramps; choose Same or Custom when an
  accent or a surface should behave differently. For a small theme variation,
  copy the light recipe into Custom and adjust it; the two recipes are independent.
  Check contrast in both themes.
- Preserve palette IDs and slot order when editing. Update the generated light
  and dark fallback hexes along with the recipe. Preserve existing standalone
  swatches in older projects; opening a project is not a request to convert it.
- For icons, follow the [Unicode and Material examples](references/project-format.md#icons).
  Unicode uses a normal font and the literal symbol; Material uses an icon font
  and a ligature name. Keep normal text labels in separate boxes from Material icons.
- Place containing backgrounds earlier in the boxes array, then their contents.
  Coordinates are absolute; there are no nested children or group IDs.
  On a new empty canvas, a starting position around `(40, 80)` leaves room for
  Mockout's floating toolbar.
- Keep geometry on the grid. Text size, padding, and stroke width can use the
  values needed for readability. Do not proportionally scale a group as a
  substitute for explicitly editing its box geometry.

After a useful section is visible, briefly describe what changed and continue the
requested work. Do not stop for approval after every element unless asked.
