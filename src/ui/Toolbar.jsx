export function Toolbar() {
  return <>
  <div className="corner" aria-label="Canvas controls">
    <button type="button" tabIndex="-1" data-tool="select" aria-label="Select tool" aria-keyshortcuts="S"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#arrow_selector_tool"></use></svg></button>
    <button type="button" tabIndex="-1" data-tool="box" aria-label="Box tool" aria-keyshortcuts="D"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#crop_square"></use></svg></button>
    <span className="divider"></span>
    <span className="small-label">Grid</span>
    <div className="grid-buttons" role="group" aria-label="Grid size">
      <button type="button" tabIndex="-1" data-grid="40">40</button>
      <button type="button" tabIndex="-1" data-grid="20">20</button>
      <button type="button" tabIndex="-1" data-grid="10">10</button>
      <button type="button" tabIndex="-1" data-grid="5">5</button>
      <button type="button" tabIndex="-1" data-grid="0">Off</button>
    </div>
    <span className="divider"></span>
    <div id="project-menu-holder">
      <button type="button" tabIndex="-1" id="project-menu-button" aria-label="Project actions" aria-controls="project-menu" aria-expanded="false"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#more_horiz"></use></svg></button>
      <div id="project-menu" className="toolbar-menu" hidden>
        <button type="button" id="save-button"><span>Save JSON</span><span className="menu-hint">Ctrl+S</span></button>
        <button type="button" id="save-as-button"><span>Save as…</span><span className="menu-hint">Ctrl+Shift+S</span></button>
        <button type="button" id="open-button"><span>Load JSON</span><span className="menu-hint">Ctrl+O</span></button>
        <button type="button" id="preview-button"><span>Preview</span><span className="menu-hint">Ctrl+P</span></button>
        <hr />
        <button type="button" id="new-blank-button"><span>New blank</span><span className="menu-hint">Shift+N</span></button>
        <hr />
        <button type="button" id="reset-button" className="hold-action"><span>Reset app</span><span className="menu-hint">Hold</span></button>
      </div>
    </div>
    <button type="button" tabIndex="-1" id="theme-button" aria-label="Switch theme">
      <svg className="icon" data-icon="light" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#light_mode"></use></svg>
      <svg className="icon" data-icon="dark" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#dark_mode"></use></svg>
    </button>
    <button type="button" tabIndex="-1" id="ai-button" aria-label="Work with AI" aria-haspopup="dialog" aria-controls="ai-dialog"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#auto_awesome"></use></svg></button>
    <button type="button" tabIndex="-1" id="help-button" aria-label="Help" aria-controls="help-panel" aria-expanded="false"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#help"></use></svg></button>
  </div>


  </>;
}
