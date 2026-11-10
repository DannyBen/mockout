import { useSyncExternalStore } from 'react';

export function Help({ ui }) {
  const { editor: e, toolbar: t } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  const unavailable = Boolean(e && (e.project.boxes.length || e.savedProjectIssue || e.locked));
  return <>
  <aside id="help-panel" hidden={!t?.helpOpen} aria-label="Keyboard help">
    <header><strong>Help</strong><button type="button" tabIndex="-1" id="close-help" onClick={() => ui.commands.toggleHelp()} aria-label="Close help" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button></header>
    <section>
      <h2>Draw and select</h2>
      <dl>
        <div><dt>Select tool</dt><dd><kbd>S</kbd></dd></div>
        <div><dt>Box tool</dt><dd><kbd>D</kbd></dd></div>
        <div><dt>Select/deselect multiple boxes</dt><dd><kbd>Shift</kbd> + click</dd></div>
        <div><dt>Select an area</dt><dd>Drag empty space</dd></div>
        <div><dt>Add an area to selection</dt><dd><kbd>Shift</kbd> + drag anywhere</dd></div>
        <div><dt>Next box on canvas</dt><dd><kbd>Tab</kbd></dd></div>
        <div><dt>Previous box on canvas</dt><dd><kbd>Shift</kbd> + <kbd>Tab</kbd></dd></div>
        <div><dt>Select all boxes</dt><dd><kbd>Ctrl</kbd> + <kbd>A</kbd></dd></div>
        <div><dt>Edit text</dt><dd><div><kbd>Enter</kbd></div><div><kbd>F2</kbd></div></dd></div>
      </dl>
    </section>
    <section>
      <h2>Properties</h2>
      <dl>
        <div><dt>Box or canvas properties</dt><dd><div><kbd>/</kbd></div><div>Right click</div></dd></div>
        <div><dt>Edit box borders</dt><dd><kbd>O</kbd></dd></div>
        <div><dt>Edit box padding</dt><dd><kbd>P</kbd></dd></div>
        <div><dt>Previous / next editor point</dt><dd><kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd></dd></div>
        <div><dt>Open box properties section</dt><dd><kbd>1</kbd>–<kbd>4</kbd></dd></div>
        <div><dt>Back / close at root</dt><dd><kbd>Esc</kbd></dd></div>
        <div><dt>Close inspector</dt><dd><kbd>Shift</kbd> + <kbd>Esc</kbd></dd></div>
        <div><dt>Clear mixed text</dt><dd><div><kbd>Backspace</kbd></div><div><kbd>Delete</kbd></div></dd></div>
      </dl>
    </section>
    <section>
      <h2>Move and edit</h2>
      <dl>
        <div><dt>Move with contained boxes</dt><dd><div>Drag</div><div><kbd>Arrows</kbd></div></dd></div>
        <div><dt>Move nearest enclosing box</dt><dd><kbd>Ctrl</kbd> + drag</dd></div>
        <div><dt>Move one box</dt><dd><div><kbd>Alt</kbd> + drag</div><div><kbd>Alt</kbd> + <kbd>Arrows</kbd></div></dd></div>
        <div><dt>Resize selection</dt><dd><div>Drag outer handle</div><div><kbd>Shift</kbd> + <kbd>Arrows</kbd></div></dd></div>
        <div><dt>Move five grid steps</dt><dd><kbd>Ctrl</kbd> + <kbd>Arrows</kbd></dd></div>
        <div><dt>Duplicate and place</dt><dd><kbd>Ctrl</kbd> + <kbd>D</kbd></dd></div>
        <div><dt>Copy selection</dt><dd><kbd>Ctrl</kbd> + <kbd>C</kbd></dd></div>
        <div><dt>Paste and place</dt><dd><kbd>Ctrl</kbd> + <kbd>V</kbd></dd></div>
        <div><dt>Nudge copy while placing</dt><dd><kbd>Arrows</kbd></dd></div>
        <div><dt>Place copy</dt><dd><div>Click</div><div><kbd>Enter</kbd></div></dd></div>
        <div><dt>Cancel placement</dt><dd><kbd>Esc</kbd></dd></div>
        <div><dt>Remove</dt><dd><kbd>Delete</kbd></dd></div>
        <div><dt>Undo</dt><dd><kbd>Ctrl</kbd> + <kbd>Z</kbd></dd></div>
        <div><dt>Redo</dt><dd><kbd>Ctrl</kbd> + <kbd>Y</kbd></dd></div>
      </dl>
    </section>
    <section>
      <h2>Canvas</h2>
      <dl>
        <div><dt>Grid size / off</dt><dd><kbd>Alt</kbd> + <kbd>1</kbd>–<kbd>5</kbd></dd></div>
        <div><dt>Canvas options</dt><dd>Right click canvas</dd></div>
        <div><dt>Pan</dt><dd><div><kbd>Space</kbd> + drag</div><div>Middle drag</div><div>Also over property dialogs</div><div><kbd>Arrows</kbd> (no selection)</div></dd></div>
        <div><dt>Scroll up/down</dt><dd>Wheel</dd></div>
        <div><dt>Scroll right/left</dt><dd><kbd>Shift</kbd> + wheel</dd></div>
        <div><dt>Zoom at pointer</dt><dd><kbd>Ctrl</kbd> + wheel</dd></div>
        <div><dt>Zoom in</dt><dd><kbd>+</kbd></dd></div>
        <div><dt>Zoom out</dt><dd><kbd>−</kbd></dd></div>
        <div><dt>Reset zoom</dt><dd><kbd>Ctrl</kbd> + <kbd>0</kbd></dd></div>
      </dl>
    </section>
    <section>
      <h2>Project</h2>
      <dl>
        <div><dt>Save JSON</dt><dd><kbd>Ctrl</kbd> + <kbd>S</kbd></dd></div>
        <div><dt>Save as…</dt><dd><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd></dd></div>
        <div><dt>Open JSON</dt><dd><div><kbd>Ctrl</kbd> + <kbd>O</kbd></div><div>Drop JSON file</div></dd></div>
        <div><dt>New blank project</dt><dd><kbd>Shift</kbd> + <kbd>N</kbd></dd></div>
        <div><dt>Preview</dt><dd><kbd>Ctrl</kbd> + <kbd>P</kbd></dd></div>
        <div><dt>Export PNG</dt><dd><kbd>Ctrl</kbd> + <kbd>E</kbd></dd></div>
        <div><dt>Toggle theme</dt><dd><kbd>T</kbd></dd></div>
        <div><dt>Reset app and load Welcome</dt><dd>Hold Reset app</dd></div>
        <div><dt>Help</dt><dd><kbd>?</kbd></dd></div>
      </dl>
    </section>
    <button type="button" id="welcome-button" disabled={unavailable} onClick={() => ui.commands.loadWelcome()}>Show Welcome example</button>
    <p id="welcome-hint" hidden={!unavailable}>{e?.savedProjectIssue ? 'Resolve the saved project issue first.' : 'Start a new blank project first to show Welcome.'}</p>
    <footer>Mockout · <a href="https://github.com/dannyben/mockout" target="_blank" rel="noopener noreferrer">GitHub</a></footer>
  </aside>


  </>;
}
