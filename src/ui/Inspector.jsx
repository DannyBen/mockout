import { Fragment, useSyncExternalStore } from 'react';
import { PalettePicker } from './PalettePicker.jsx';

export function Inspector({ ui }) {
  const { inspector: i } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
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
    <section id="box-properties" hidden={i.view !== 'properties' || i.kind !== 'box'}>
      <div id="box-appearance-properties" className="section-content" hidden={i.section !== 'box'}>
        <div className="two-fields">
          <label className="field">Width <input id="box-width" type="number" min="1" step="1" /></label>
          <label className="field">Height <input id="box-height" type="number" min="1" step="1" /></label>
        </div>
        <div className="two-fields">
          <label className="field">Radius <input id="box-radius" type="number" min="0" step="1" /></label>
          <label className="field">Border <input id="box-border-width" type="number" min="0" step="1" /></label>
        </div>
        <div className="two-fields">
          <label className="field">Padding X <input id="box-padding-x" type="number" min="0" step="1" /></label>
          <label className="field">Padding Y <input id="box-padding-y" type="number" min="0" step="1" /></label>
        </div>
        <div className="slider-field">
          <label className="field" htmlFor="box-opacity-range">Opacity</label>
          <input id="box-opacity-range" type="range" min="0" max="100" step="1" />
          <input id="box-opacity" type="number" min="0" max="100" step="1" aria-label="Opacity percentage" />
        </div>
      </div>
      <div id="border-properties" className="section-content" hidden={i.section !== 'border'}>
        <div className="field" id="border-width-field"><label htmlFor="border-width">Width</label><input id="border-width" type="number" min="0" max="10000" step="1" /></div>
        <div className="field" id="border-color-field"><label htmlFor="border-side-color">Color</label><button type="button" id="border-side-color" data-color-property="borderColor" data-border-side=""></button></div>
        <div className="field" id="border-radius-field"><label htmlFor="border-radius">Radius</label><input id="border-radius" type="number" min="0" max="10000" step="1" /></div>
      </div>
      <div id="padding-properties" className="section-content" hidden={i.section !== 'padding'}>
        <div className="field"><label htmlFor="side-padding">Padding</label><input id="side-padding" type="number" min="0" max="10000" step="1" /></div>
      </div>
      <div id="color-properties" className="section-content" hidden={i.section !== 'colors'}>
        <div className="field"><label htmlFor="fill-color">Fill</label><button type="button" id="fill-color" data-color-property="fill"></button></div>
        <div className="field"><label htmlFor="text-color">Text</label><button type="button" id="text-color" data-color-property="textColor"></button></div>
        <div className="field"><label htmlFor="border-color">Border</label><button type="button" id="border-color" data-color-property="borderColor"></button></div>
      </div>
      <div id="text-properties" className="section-content" hidden={i.section !== 'text'}>
        <label className="field">Text <input id="box-text" type="text" placeholder="Optional text" /></label>
        <div className="two-fields align-fields">
          <div className="align-group" role="group" aria-label="Horizontal alignment">
            <span>Horizontal</span>
            <div className="align-buttons">
              <button type="button" data-align-axis="alignX" data-align-value="left" aria-label="Align left"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_left"></use></svg></button>
              <button type="button" data-align-axis="alignX" data-align-value="center" aria-label="Align center"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_center"></use></svg></button>
              <button type="button" data-align-axis="alignX" data-align-value="right" aria-label="Align right"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_right"></use></svg></button>
            </div>
          </div>
          <div className="align-group" role="group" aria-label="Vertical alignment">
            <span>Vertical</span>
            <div className="align-buttons">
              <button type="button" data-align-axis="alignY" data-align-value="top" aria-label="Align top"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_top"></use></svg></button>
              <button type="button" data-align-axis="alignY" data-align-value="center" aria-label="Align middle"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_center"></use></svg></button>
              <button type="button" data-align-axis="alignY" data-align-value="bottom" aria-label="Align bottom"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_bottom"></use></svg></button>
            </div>
          </div>
        </div>
      </div>
      <div id="font-properties" className="section-content" hidden={i.section !== 'font'}>
        <label className="field">Family
          <select id="box-font-family">
            <option value="mixed" hidden>Mixed values</option>
            <option value="">Default</option>
            <option value="google">Google font…</option>
            <option value="material">Material icons…</option>
          </select>
        </label>
        <label id="google-font-field" className="field" hidden>Google family
          <input id="box-google-font" type="text" maxLength="80" autoComplete="off" spellCheck="false" placeholder="e.g. Roboto" />
        </label>
        <label id="material-style-field" className="field" hidden>Icon style
          <select id="box-material-style">
            <option value="mixed" hidden>Mixed values</option>
            <option value="Material Symbols Outlined">Outlined</option>
            <option value="Material Symbols Rounded">Rounded</option>
            <option value="Material Symbols Sharp">Sharp</option>
            <option value="Material Icons">Filled</option>
            <option value="Material Icons Two Tone">Two Tone</option>
          </select>
        </label>
        <div className="two-fields">
          <label className="field">Size <input id="box-font-size" type="number" min="1" step="1" /></label>
          <label className="field">Weight
            <select id="box-font-weight">
              <option value="mixed" hidden>Mixed values</option>
              <option value="100">100</option><option value="200">200</option><option value="300">300</option>
              <option value="400">400</option><option value="500">500</option><option value="600">600</option>
              <option value="700">700</option><option value="800">800</option><option value="900">900</option>
            </select>
          </label>
        </div>
        <label className="field">Style
          <select id="box-font-style">
            <option value="mixed" hidden>Mixed values</option>
            <option value="normal">Normal</option><option value="italic">Italic</option>
          </select>
        </label>
        <footer className="dialog-footer font-links"><a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer">Browse fonts <svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#open_in_new"></use></svg></a><a id="browse-icons" href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer" hidden>Browse icons <svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#open_in_new"></use></svg></a></footer>
      </div>
    </section>
    <section id="canvas-properties" className="dialog-choice-list" hidden={i.view !== 'properties' || i.kind !== 'canvas' || i.canvasSection !== 'canvas'} aria-label="Canvas colors">
      <button type="button" className="dialog-choice" data-canvas-color-property="background"></button>
      <button type="button" className="dialog-choice" data-canvas-color-property="gridMinor"></button>
      <button type="button" className="dialog-choice" data-canvas-color-property="gridMajor"></button>
    </section>
    <section id="grid-properties" hidden={i.view !== 'properties' || i.kind !== 'canvas' || i.canvasSection !== 'grid'} aria-label="Grid settings">
      <label className="field">Smallest grid size (px)
        <input id="grid-base" type="number" min="2" max="100" step="1" />
      </label>
      <label className="field">Major line every (cells)
        <input id="grid-divisions" type="number" min="2" max="100" step="1" />
      </label>
    </section>
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
