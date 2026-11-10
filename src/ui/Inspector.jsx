import { Fragment, useSyncExternalStore } from 'react';
import { PalettePicker } from './PalettePicker.jsx';
import { Properties } from './Properties.jsx';

export function Inspector({ ui }) {
  const { inspector: i, properties } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return (
  <aside id="inspector" className="mini-dialog" hidden={!i.visible} data-view={i.view} inert={i.locked} aria-label="Inspector">
    <header id="inspector-header" className="dialog-header">
      <button type="button" id="inspector-nav" className="icon-button" tabIndex="-1" data-action={i.hasParent ? 'back' : 'sections'} aria-label={i.hasParent ? 'Back' : i.menuTitle}>
        <svg className="icon" data-nav-icon="sections" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#menu"></use></svg>
        <svg className="icon" data-nav-icon="back" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#chevron_left"></use></svg>
      </button>
      <nav id="inspector-path" className="dialog-path" aria-label="Dialog path">
        {i.parts.map((part, index) => <Fragment key={`${index}-${part.label}`}>
          {index > 0 && <span className="dialog-separator" aria-hidden="true">/</span>}
          {part.view ? <button type="button" tabIndex={-1} className="dialog-crumb" onClick={() => ui.actions.showInspectorParent(part.view)}>{part.label}</button>
            : <strong className="dialog-crumb" aria-current="page">{part.label}</strong>}
        </Fragment>)}
      </nav>
      <button type="button" id="close-inspector" tabIndex="-1" aria-label="Close dialog" aria-keyshortcuts="Shift+Escape" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button>
    </header>
    <section id="section-selection" className="dialog-choice-list" hidden={i.view !== 'sections'} aria-label={i.menuTitle}>
      <button type="button" className="dialog-choice" data-property-section="box" hidden={i.kind !== 'box'} aria-current={i.section === 'box' ? 'page' : undefined}><span>Box</span><span className="menu-hint">1</span></button>
      <button type="button" className="dialog-choice" data-property-section="colors" hidden={i.kind !== 'box'} aria-current={i.section === 'colors' ? 'page' : undefined}><span>Colors</span><span className="menu-hint">2</span></button>
      <button type="button" className="dialog-choice" data-property-section="text" hidden={i.kind !== 'box'} aria-current={i.section === 'text' ? 'page' : undefined}><span>Text</span><span className="menu-hint">3</span></button>
      <button type="button" className="dialog-choice" data-property-section="font" hidden={i.kind !== 'box'} aria-current={i.section === 'font' ? 'page' : undefined}><span>Font</span><span className="menu-hint">4</span></button>
      <button type="button" className="dialog-choice" data-property-section="border" hidden={i.kind !== 'box'} aria-current={i.section === 'border' ? 'page' : undefined}><span>Border editor</span><span className="menu-hint">O</span></button>
      <button type="button" className="dialog-choice" data-property-section="padding" hidden={i.kind !== 'box'} aria-current={i.section === 'padding' ? 'page' : undefined}><span>Padding editor</span><span className="menu-hint">P</span></button>
      <button type="button" className="dialog-choice" data-property-section="canvas" hidden={i.kind !== 'canvas'} aria-current={i.canvasSection === 'canvas' ? 'page' : undefined}><span>Colors</span></button>
      <button type="button" className="dialog-choice" data-property-section="grid" hidden={i.kind !== 'canvas'} aria-current={i.canvasSection === 'grid' ? 'page' : undefined}><span>Grid</span></button>
    </section>
    <Properties ui={ui} inspector={i} data={properties} />
    <PalettePicker ui={ui} />
    <section id="swatch-chooser" hidden={i.view !== 'choose'} aria-label="Choose swatch">
      <div id="choice-swatch-list" className="dialog-choice-list" role="listbox" aria-label="Swatches"></div>
      <footer className="dialog-footer">
        <button type="button" id="choice-manage-swatches" data-manage-swatches="">Manage swatches</button>
      </footer>
    </section>
    <section id="swatch-manager" hidden={i.view !== 'manage'} aria-label="Manage swatches">
      <div id="swatch-list" className="dialog-choice-list" aria-label="Project swatches"></div>
      <footer className="dialog-footer">
        <button type="button" id="new-swatch">New swatch</button>
      </footer>
    </section>
    <section id="color-editor" hidden={i.view !== 'edit'} aria-label="Edit colors">
      <div id="swatch-name-field" className="field"><label htmlFor="swatch-name">Name</label><input id="swatch-name" type="text" maxLength="60" placeholder="Swatch name" /></div>
      <div className="field"><label htmlFor="swatch-light">Light</label><button type="button" id="swatch-light" data-editor-side="light"></button></div>
      <div className="field"><label htmlFor="dark-behavior">Dark</label><select id="dark-behavior"><option value="invert">Invert</option><option value="same">Same</option><option value="custom">Custom</option></select></div>
      <div className="field"><span aria-hidden="true"></span><button type="button" id="swatch-dark" data-editor-side="dark" hidden></button><output id="swatch-dark-preview" aria-label="Dark color"></output></div>
      <p id="swatch-error" role="alert" hidden></p>
      <footer className="dialog-footer">
        <button type="button" id="delete-swatch" className="icon-button" aria-label="Delete swatch" hidden><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#delete"></use></svg></button>
        <button type="button" data-inspector-back="">Cancel</button>
        <button type="button" id="save-color" className="primary">Save</button>
      </footer>
    </section>
    <section id="color-picker" hidden={i.view !== 'picker'} aria-label="Color picker">
      <label className="field">Hex <input id="color-hex" type="text" maxLength="7" spellCheck="false" autoComplete="off" placeholder="RRGGBB" /></label>
      <label className="field">Mode <select id="color-mode"><option value="hsb">HSB</option><option value="rgb">RGB</option><option value="gray">Grayscale</option></select></label>
      <div className="slider-field"><label htmlFor="channel-1" id="channel-1-label">H</label><input id="channel-1" type="range" min="0" max="360" /><input id="channel-1-value" type="number" min="0" max="360" aria-label="Hue value" /></div>
      <div className="slider-field"><label htmlFor="channel-2" id="channel-2-label">S</label><input id="channel-2" type="range" min="0" max="100" /><input id="channel-2-value" type="number" min="0" max="100" aria-label="Saturation value" /></div>
      <div className="slider-field"><label htmlFor="channel-3" id="channel-3-label">B</label><input id="channel-3" type="range" min="0" max="100" /><input id="channel-3-value" type="number" min="0" max="100" aria-label="Brightness value" /></div>
      <div id="color-preview" aria-label="Color preview"></div>
      <p id="color-error" role="alert" hidden></p>
      <footer className="dialog-footer">
        <button type="button" data-inspector-back="">Cancel</button>
        <button type="button" id="use-color" className="primary">Save</button>
      </footer>
    </section>
  </aside>
  );
}
