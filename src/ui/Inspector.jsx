import { Fragment, useSyncExternalStore } from 'react';
import { PalettePicker } from './PalettePicker.jsx';
import { Properties } from './Properties.jsx';
import { LegacyColors } from './LegacyColors.jsx';
import { moveInList, trapInspectorFocus } from './keyboard.js';

export function Inspector({ ui }) {
  const { inspector: i, inspectorPosition, properties, colors } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return (
  <aside id="inspector" className="mini-dialog" hidden={!i.visible} data-view={i.view} inert={i.locked} aria-label="Inspector" style={inspectorPosition} onKeyDown={trapInspectorFocus}>
    <header id="inspector-header" className="dialog-header">
      <button type="button" id="inspector-nav" className="icon-button" tabIndex="-1" data-action={i.hasParent ? 'back' : 'sections'} aria-label={i.hasParent ? 'Back' : i.menuTitle} onClick={() => ui.commands.navigateInspector()}>
        <svg className="icon" data-nav-icon="sections" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#menu"></use></svg>
        <svg className="icon" data-nav-icon="back" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#chevron_left"></use></svg>
      </button>
      <nav id="inspector-path" className="dialog-path" aria-label="Dialog path">
        {i.parts.map((part, index) => <Fragment key={`${index}-${part.label}`}>
          {index > 0 && <span className="dialog-separator" aria-hidden="true">/</span>}
          {part.view ? <button type="button" tabIndex={-1} className="dialog-crumb" onClick={() => ui.commands.showInspectorParent(part.view)}>{part.label}</button>
            : <strong className="dialog-crumb" aria-current="page">{part.label}</strong>}
        </Fragment>)}
      </nav>
      <button type="button" id="close-inspector" onClick={() => ui.commands.closeInspector()} tabIndex="-1" aria-label="Close dialog" aria-keyshortcuts="Shift+Escape" className="icon-button"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#close"></use></svg></button>
    </header>
    <section id="section-selection" onKeyDown={moveInList} className="dialog-choice-list" hidden={i.view !== 'sections'} aria-label={i.menuTitle}>
      <button type="button" className="dialog-choice" data-property-section="box" onClick={() => ui.commands.choosePropertySection('box')} hidden={i.kind !== 'box'} aria-current={i.section === 'box' ? 'page' : undefined}><span>Box</span><span className="menu-hint">1</span></button>
      <button type="button" className="dialog-choice" data-property-section="colors" onClick={() => ui.commands.choosePropertySection('colors')} hidden={i.kind !== 'box'} aria-current={i.section === 'colors' ? 'page' : undefined}><span>Colors</span><span className="menu-hint">2</span></button>
      <button type="button" className="dialog-choice" data-property-section="text" onClick={() => ui.commands.choosePropertySection('text')} hidden={i.kind !== 'box'} aria-current={i.section === 'text' ? 'page' : undefined}><span>Text</span><span className="menu-hint">3</span></button>
      <button type="button" className="dialog-choice" data-property-section="font" onClick={() => ui.commands.choosePropertySection('font')} hidden={i.kind !== 'box'} aria-current={i.section === 'font' ? 'page' : undefined}><span>Font</span><span className="menu-hint">4</span></button>
      <button type="button" className="dialog-choice" data-property-section="border" onClick={() => ui.commands.choosePropertySection('border')} hidden={i.kind !== 'box'} aria-current={i.section === 'border' ? 'page' : undefined}><span>Border editor</span><span className="menu-hint">O</span></button>
      <button type="button" className="dialog-choice" data-property-section="padding" onClick={() => ui.commands.choosePropertySection('padding')} hidden={i.kind !== 'box'} aria-current={i.section === 'padding' ? 'page' : undefined}><span>Padding editor</span><span className="menu-hint">P</span></button>
      <button type="button" className="dialog-choice" data-property-section="canvas" onClick={() => ui.commands.choosePropertySection('canvas')} hidden={i.kind !== 'canvas'} aria-current={i.canvasSection === 'canvas' ? 'page' : undefined}><span>Colors</span></button>
      <button type="button" className="dialog-choice" data-property-section="grid" onClick={() => ui.commands.choosePropertySection('grid')} hidden={i.kind !== 'canvas'} aria-current={i.canvasSection === 'grid' ? 'page' : undefined}><span>Grid</span></button>
    </section>
    <Properties ui={ui} inspector={i} data={properties} colors={colors} />
    <PalettePicker ui={ui} />
    <LegacyColors ui={ui} inspector={i} colors={colors} />
  </aside>
  );
}
