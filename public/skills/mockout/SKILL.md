---
name: mockout
description: Create and edit Mockout mockups through a shared local JSON file, guide the user through connecting that file, and build visibly box by box. Use when the user asks to start a Mockout project or change an existing Mockout layout.
---

# Mockout

Collaborate with the user in [Mockout](https://mockout.sector-seven.com) by editing
the same JSON file that their browser has open. Every element is an editable box.
The browser saves the user's edits automatically and reloads valid external edits.

## Establish the shared file

- If the user supplied a project path, use it. Otherwise ask for the path to the
  file they want to share. A browser filename alone does not give you its path.
- You need read/write access to that exact file on the user's computer or a shared
  filesystem. An uploaded copy or a separate cloud workspace is not a live connection.
  If that access is unavailable, explain the requirement before promising live edits.
- If they have work open in Mockout but no file yet, guide them to **Ctrl+S** or
  **… → Save JSON**, choose a location accessible to you, and share its path.
- If the requested path does not exist and they want a new project, create it from
  [starter.json](examples/starter.json). Ask them to open it with **… → Load JSON**
  or drag it into Mockout. Preserve existing files unless replacement was requested.
- Before the first edit in a session, have the user confirm that the bottom-left
  status shows the intended filename with a circled check. **Local session** only
  saves in the browser. **Reconnect** renews file permission; ask them to grant
  read/write access. A download alone does not establish a file connection.
- Reuse an already confirmed connection during the conversation. Do not repeat
  setup for each request. On a later session, confirm it again; permission may
  need renewing after a browser restart.

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
with contained elements, and paired light/dark colors. It is the same Welcome
project shipped with Mockout and is included in this skill for local use.
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
Do not claim that a browser is connected or a change is visible unless you can
observe it or the user confirms it. If an external edit has not appeared, ask the
user to return to the Mockout tab; browsers without file observation check on focus.

## Inspect the result when supported

Include visual inspection in the workflow when you have browser or screenshot
tools. Choose when to check based on layout complexity, uncertainty, and the cost
of rendering. There is no fixed frequency; keep saving box by box regardless of
how often you inspect the result.

Open [live Mockout](https://mockout.sector-seven.com/) in a separate browser
context. Load the current JSON through its normal file input (`#open-file` for
browser automation), wait for
fonts and layout, and inspect the result.
Keep this inspection separate from the user's active canvas and file connection.
Look for clipped text, unintended overlaps, missing icons, and poor contrast.
DOM scroll-size measurements can flag possible text overflow for closer inspection.

If visual tools are unavailable, continue using the format checks and
[text-fitting guidance](references/project-format.md#text-fitting). State that
the result has not been visually inspected; do not claim a rendered check.

## Design conventions

- Default new mockups to a 5px grid. Align box coordinates and dimensions to that
  grid. When extending an existing project, respect its chosen grid and geometry;
  do not rescale existing work to impose the default. `grid: 0` disables snapping.
- Use a small palette with role names such as **Surface**, **Text**, **Border**,
  **Button**, and **Accent 1**. Reuse swatches and provide readable light/dark pairs.
  Swatch names are user-owned labels; box colors refer to swatch IDs.
- Place containing backgrounds earlier in the boxes array, then their contents.
  Coordinates are absolute; there are no nested children or group IDs.
  On a new empty canvas, a starting position around `(40, 80)` leaves room for
  Mockout's floating toolbar.
- Keep geometry on the grid. Text size, padding, and stroke width can use the
  values needed for readability. Do not proportionally scale a group as a
  substitute for explicitly editing its box geometry.

After a useful section is visible, briefly describe what changed and continue the
requested work. Do not stop for approval after every element unless asked.
