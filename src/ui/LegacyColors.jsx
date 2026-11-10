import { ColorBlock } from './ColorBlock.jsx';
import { Input } from './Input.jsx';
import { Icon } from './Icon.jsx';
import { moveInList } from './keyboard.js';

export function BoxColorField({ ui, colors, property, side = false, ...props }) {
  const value = colors?.boxColors[side ? 'borderSide' : property];
  return <ColorBlock {...props} {...value} aria-label={value?.description} aria-description={value?.mixed ? 'Mixed values' : undefined}
    data-color-property={property} data-border-side={side ? '' : undefined}
    onClick={() => ui.commands.openColor(property, side ? ui.getSnapshot().properties.borderSide : undefined)} />;
}

export function LegacyColors({ ui, inspector: i, colors: c }) {
  const choosing = i.view === 'choose';
  return <>
    <section id="swatch-chooser" hidden={!choosing} aria-label="Choose swatch">
      <div id="choice-swatch-list" onKeyDown={moveInList} className="dialog-choice-list" role="listbox" aria-label="Swatches">
        {c?.swatches.map(item => <ColorBlock key={item.id ?? ''} className="dialog-choice" data-swatch-id={item.id ?? ''}
          color={item.color} label={item.name} selected={item.selected} role="option" aria-selected={item.selected}
          aria-label={`Use ${item.name}`} onClick={() => ui.commands.assignColor(item.id)} />)}
      </div>
      <footer className="dialog-footer"><button type="button" id="choice-manage-swatches" data-manage-swatches="" onClick={ui.commands?.openManageSwatches}>Manage swatches</button></footer>
    </section>
    <section id="swatch-manager" hidden={i.view !== 'manage'} aria-label="Manage swatches">
      <div id="swatch-list" onKeyDown={moveInList} className="dialog-choice-list" aria-label="Project swatches">
        {c?.swatches.filter(item => item.id !== null).map(item => <ColorBlock key={item.id} className="dialog-choice" data-swatch-id={item.id}
          color={item.color} label={item.name} action="edit" aria-label={`Edit ${item.name}`} onClick={() => ui.commands.openSwatchEditor(item.id)} />)}
      </div>
      <footer className="dialog-footer"><button type="button" id="new-swatch" onClick={() => ui.commands.openSwatchEditor()}>New swatch</button></footer>
    </section>
    <section id="color-editor" hidden={i.view !== 'edit'} aria-label="Edit colors">
      <div id="swatch-name-field" className="field" hidden={c?.direct}><label htmlFor="swatch-name">Name</label><Input id="swatch-name" type="text" maxLength="60" placeholder="Swatch name" value={c?.name} onInput={event => ui.commands.setSwatchName(event.currentTarget.value)} /></div>
      <div className="field"><label htmlFor="swatch-light">Light</label><ColorBlock id="swatch-light" data-editor-side="light" color={c?.light} label={c?.light.toUpperCase()} aria-label={`Edit light color: ${c?.light.toUpperCase()}`} onClick={() => ui.commands.openEditorColorPicker('light')} /></div>
      <div className="field"><label htmlFor="dark-behavior">Dark</label><Input as="select" id="dark-behavior" value={c?.darkMode ?? 'invert'} onCommit={ui.commands?.setDarkBehavior}><option value="invert">Invert</option><option value="same">Same</option><option value="custom">Custom</option></Input></div>
      <div className="field"><span aria-hidden="true"></span><ColorBlock id="swatch-dark" data-editor-side="dark" hidden={c?.darkMode !== 'custom'} color={c?.dark} label={c?.dark.toUpperCase()} aria-label={`Edit dark color: ${c?.dark.toUpperCase()}`} onClick={() => ui.commands.openEditorColorPicker('dark')} /><ColorBlock as="output" id="swatch-dark-preview" aria-label="Dark color" hidden={c?.darkMode === 'custom'} color={c?.dark} label={c?.dark.toUpperCase()} /></div>
      <p id="swatch-error" role="alert" hidden={!c?.swatchError}>{c?.swatchError}</p>
      <footer className="dialog-footer">
        <button type="button" id="delete-swatch" className="icon-button" aria-label="Delete swatch" hidden={!c?.canDelete} onClick={() => ui.commands.deleteSwatch()}><Icon name="delete" /></button>
        <button type="button" data-inspector-back="" onClick={() => ui.commands.showInspectorParent()}>Cancel</button>
        <button type="button" id="save-color" className="primary" onClick={() => ui.commands.saveColor()}>Save</button>
      </footer>
    </section>
    <section id="color-picker" hidden={i.view !== 'picker'} aria-label="Color picker">
      <label className="field">Hex <Input id="color-hex" type="text" maxLength="7" spellCheck="false" autoComplete="off" placeholder="RRGGBB" value={c?.hex} onInput={event => ui.commands.setColorHex(event.currentTarget.value)} onCommit={value => { ui.commands.setColorHex(value); ui.commands.readColorHex(); }} /></label>
      <label className="field">Mode <Input as="select" id="color-mode" value={c?.mode ?? 'hsb'} onCommit={ui.commands?.setColorMode}><option value="hsb">HSB</option><option value="rgb">RGB</option><option value="gray">Grayscale</option></Input></label>
      {(c?.channels || [{}, {}, {}]).map((channel, index) => <div key={index} className="slider-field" hidden={channel.hidden}>
        <label htmlFor={`channel-${index + 1}`} id={`channel-${index + 1}-label`}>{channel.label}</label>
        <Input id={`channel-${index + 1}`} type="range" min="0" max={channel.max ?? 360} value={channel.value ?? 0} style={{ '--channel-gradient': channel.gradient }} onInput={event => ui.commands.setColorChannel(index, event.currentTarget.value)} />
        <Input id={`channel-${index + 1}-value`} type="number" min="0" max={channel.max ?? 360} value={channel.value ?? 0} aria-label={`${channel.label} value`} onInput={event => ui.commands.setColorChannel(index, event.currentTarget.value)} />
      </div>)}
      <ColorBlock as="div" id="color-preview" aria-label="Color preview" color={c?.color} label={c?.color.toUpperCase()} />
      <p id="color-error" role="alert" hidden={!c?.error}>{c?.error}</p>
      <footer className="dialog-footer"><button type="button" data-inspector-back="" onClick={() => ui.commands.showInspectorParent()}>Cancel</button><button type="button" id="use-color" className="primary" onClick={() => ui.commands.acceptColor()}>Save</button></footer>
    </section>
  </>;
}
