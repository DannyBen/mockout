import { useSyncExternalStore } from 'react';
import Project from '../core/project.js';
import { HoldButton } from './HoldButton.jsx';

export function Toolbar({ ui }) {
  const { editor: e, toolbar: t } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  const placing = e?.placing || false, locked = e?.locked || false;
  const grids = e ? Project.gridSizes(e.project) : [40, 20, 10, 5, 0];
  return <>
  <div className="corner" aria-label="Canvas controls" onPointerDown={event => { if (event.target.closest('button') && !event.target.closest('.toolbar-menu')) event.preventDefault(); }}>
    <button type="button" tabIndex="-1" data-tool="select" className={(e?.tool || 'select') === 'select' ? 'active' : ''} aria-pressed={(e?.tool || 'select') === 'select'} disabled={placing || locked} onClick={() => ui.commands.setTool('select')} aria-label="Select tool" aria-keyshortcuts="S"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#arrow_selector_tool"></use></svg></button>
    <button type="button" tabIndex="-1" data-tool="box" className={(e?.tool || 'select') === 'box' ? 'active' : ''} aria-pressed={(e?.tool || 'select') === 'box'} disabled={placing || locked} onClick={() => ui.commands.setTool('box')} aria-label="Box tool" aria-keyshortcuts="D"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#crop_square"></use></svg></button>
    <span className="divider"></span>
    <span className="small-label">Grid</span>
    <div className="grid-buttons" role="group" aria-label="Grid size">
      {grids.map(size => <button key={size} type="button" tabIndex={-1} data-grid={size} className={size === (e?.project.grid ?? 10) ? 'active' : ''} aria-pressed={size === (e?.project.grid ?? 10)} disabled={placing || locked} onClick={() => ui.commands.setGrid(size)}>{size || 'Off'}</button>)}
    </div>
    <span className="divider"></span>
    <div id="project-menu-holder">
      <button type="button" tabIndex="-1" id="project-menu-button" disabled={placing} onClick={() => ui.commands.toggleProjectMenu()} aria-label="Project actions" aria-controls="project-menu" aria-expanded={t?.menuOpen || false}><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#more_horiz"></use></svg></button>
      <div id="project-menu" className="toolbar-menu" hidden={!t?.menuOpen} onClick={event => { if (!event.target.closest('.hold-action')) { ui.commands.closeProjectMenu(); document.querySelector('#workspace').focus(); } }}>
        <button type="button" id="save-button" disabled={placing || locked} onClick={() => ui.commands.saveProject()}><span>Save JSON</span><span className="menu-hint">Ctrl+S</span></button>
        {Boolean(window.showSaveFilePicker) && <button type="button" id="save-as-button" disabled={placing} onClick={() => ui.commands.saveProject(true)}><span>Save as…</span><span className="menu-hint">Ctrl+Shift+S</span></button>}
        <button type="button" id="open-button" disabled={placing} onClick={() => ui.commands.chooseProjectFile()}><span>Load JSON</span><span className="menu-hint">Ctrl+O</span></button>
        <button type="button" id="preview-button" disabled={placing} onClick={() => ui.commands.openPreview()}><span>Preview</span><span className="menu-hint">Ctrl+P</span></button>
        <button type="button" id="export-png-button" disabled={placing || t?.exportingPNG} onClick={() => ui.commands.exportPNG()}><span>{t?.exportingPNG ? 'Exporting PNG…' : 'Export PNG…'}</span><span className="menu-hint">Ctrl+E</span></button>
        <hr />
        <button type="button" id="new-blank-button" disabled={placing} onClick={() => ui.commands.newBlank()}><span>New blank</span><span className="menu-hint">Shift+N</span></button>
        <hr />
        <HoldButton ui={ui} id="reset-button" disabled={placing}><span>Reset app</span><span className="menu-hint">Hold</span></HoldButton>
      </div>
    </div>
    <button type="button" tabIndex="-1" id="theme-button" disabled={placing} onClick={() => ui.commands.toggleTheme()} aria-label={`Switch to ${t?.theme === 'dark' ? 'light' : 'dark'} theme`}>
      <svg className="icon" data-icon="light" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#light_mode"></use></svg>
      <svg className="icon" data-icon="dark" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#dark_mode"></use></svg>
    </button>
    <button type="button" tabIndex="-1" id="ai-button" disabled={placing} onClick={() => ui.commands.openAI()} aria-label="Work with AI" aria-haspopup="dialog" aria-controls="ai-dialog"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#auto_awesome"></use></svg></button>
    <button type="button" tabIndex="-1" id="help-button" onClick={() => ui.commands.toggleHelp()} aria-label="Help" aria-controls="help-panel" aria-expanded={t?.helpOpen || false}><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#help"></use></svg></button>
  </div>
  <p id="placement-hint" role="status" hidden={!placing}>Move copy · Click or Enter to place · Esc to cancel</p>

  </>;
}
