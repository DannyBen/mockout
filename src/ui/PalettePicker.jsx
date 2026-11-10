import { useLayoutEffect, useRef, useSyncExternalStore, useMemo } from 'react';
import Colors from '../core/colors.js';
import { ColorBlock } from './ColorBlock.jsx';
import { Icon } from './Icon.jsx';

function moveInList(event) {
  const direction = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' }[event.key];
  if (!direction) return;
  event.preventDefault();
  const buttons = [...event.currentTarget.querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement);
  const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1 : (index + direction + buttons.length) % buttons.length;
  buttons[next]?.focus(); buttons[next]?.scrollIntoView({ block: 'nearest' });
}

// Keep unfinished and invalid numeric input intact while a field has focus.
function NumberInput({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (document.activeElement !== ref.current) ref.current.value = value; });
  return <input ref={ref} type="number" defaultValue={value} {...props} />;
}

function PaletteSlider({ axis, group, label, recipe, count, api }) {
  const index = ['l', 'c', 'h'].indexOf(axis);
  const min = group === 'base' ? 0 : [-100, -.4, -360][index];
  const max = [100, .4, 360][index];
  const limits = group === 'step' ? Colors.stepLimits(recipe, axis)
    : axis === 'c' ? [0, recipe.base.l > 0 && recipe.base.l < 100 ? Math.floor(Colors.maxChroma(recipe.base.l, recipe.base.h) * 1000) / 1000 : 0] : [min, max];
  if (group === 'step') { limits[0] = Math.min(0, limits[0]); limits[1] = Math.max(0, limits[1]); }
  const step = group === 'step';
  const rangeMin = step ? -1 : limits[0], rangeMax = step ? 1 : limits[1];
  const value = recipe[group][axis];
  const position = step ? api.stepPosition(value, limits) : value;
  const gradient = useMemo(() => {
    const stops = Array.from({ length: 25 }, (_, stop) => {
      const position = rangeMin + (rangeMax - rangeMin) * stop / 24;
      const value = step ? api.stepValue(position, limits, axis) : position;
      const preview = { ...recipe, [group]: { ...recipe[group], [axis]: value } };
      const color = Colors.paletteValue(preview, group === 'base' ? 0 : count - 1);
      if (axis !== 'l' && (color.l <= 1 || color.l >= 99)) color.l = 60;
      if (axis === 'h' && color.c < .02) color.c = .12;
      return Colors.toHex(color);
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [axis, group, recipe.base.l, recipe.base.c, recipe.base.h, recipe.step.l, recipe.step.c, recipe.step.h, count, rangeMin, rangeMax]);
  const edit = event => {
    const input = event.currentTarget;
    if (input.value === '' || !input.validity.valid) return;
    api.setChannel(axis, group, input.type === 'range' && step ? api.stepValue(input.valueAsNumber, limits, axis) : input.valueAsNumber);
  };
  const keyDown = event => {
    if (!step) return;
    const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[event.key];
    if (!direction && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    api.setChannel(axis, group, event.key === 'Home' ? limits[0] : event.key === 'End' ? limits[1]
      : Math.max(limits[0], Math.min(limits[1], api.rounded(value + direction * api.increment(axis), axis))));
  };
  return <div className="palette-slider" data-axis={axis} data-group={group}>
    <label htmlFor={`palette-${group}-${axis}`}>{step ? 'Step' : label}</label>
    <div className="palette-track" style={{ '--channel-gradient': gradient }}>
      <input id={`palette-${group}-${axis}`} type="range" min={rangeMin} max={rangeMax} step={step ? 'any' : api.increment(axis)}
        value={position} onInput={edit} onKeyDown={keyDown} onDoubleClick={step ? () => api.setChannel(axis, group, 0) : undefined}
        disabled={limits[0] === limits[1]} aria-label={`${label} ${group} slider`} aria-valuetext={String(value)}
        aria-description={step ? 'Double-click to reset the step to zero.' : undefined} />
      <span className="palette-marks" aria-hidden="true">
        {step ? <><span className="palette-step-span" style={{ '--start': Math.min(.5, (position + 1) / 2), '--end': Math.max(.5, (position + 1) / 2) }} /><span className="palette-zero" /></>
          : Array.from({ length: count }, (_, i) => {
            let mark = Colors.paletteValue(recipe, i)[axis];
            if (axis === 'h' && (mark < 0 || mark > 360)) mark = ((mark % 360) + 360) % 360;
            const position = limits[1] > limits[0] ? Math.max(0, Math.min(1, (mark - limits[0]) / (limits[1] - limits[0]))) : .5;
            return <span key={i} className="palette-tick" data-value={Number(mark.toFixed(3))} style={{ '--position': position }} />;
          })}
      </span>
    </div>
    <NumberInput value={Number(value.toFixed(axis === 'c' ? 3 : 1))} min={min} max={max} step={api.increment(axis)} aria-label={`${label} ${group} value`} onInput={edit} />
  </div>;
}

export function PalettePicker({ ui }) {
  const { palette: p, inspector } = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  const hexRef = useRef(null);
  useLayoutEffect(() => { hexRef.current?.setCustomValidity(p?.hexError || ''); }, [p?.hexError]);
  if (!p) return <section id="box-color-picker" hidden aria-label="Choose palette color" />;
  const { api, draft, choosing } = p;
  const recipe = p.recipe || { base: { l: 60, c: .12, h: 250 }, step: { l: 0, c: 0, h: 0 } };
  return <section id="box-color-picker" hidden={inspector.view !== 'box-color'} aria-label="Choose palette color" onKeyDown={api.escape}>
    <div className="palette-layout">
      <div className="palette-list">
        <button type="button" data-palette-name="" hidden={Boolean(draft)} disabled={Boolean(draft)} aria-label="Choose palette" aria-haspopup="listbox" aria-controls="palette-choices" aria-expanded={choosing} onClick={api.toggleChoices}><span data-palette-label="">{p.label}</span><Icon name="keyboard_arrow_down" /></button>
        <input data-palette-title="" type="text" maxLength="60" aria-label="Palette name" placeholder="Palette name" hidden={!draft} value={draft?.name || ''} onChange={event => api.rename(event.target.value)} />
        <ColorBlock data-transparent="" hidden={Boolean(draft) || choosing} aria-pressed={p.selectedId === null} selected={p.selectedId === null} label="Transparent" onClick={() => api.pick(null)} />
        <p data-palette-hint="" hidden={Boolean(draft) || !choosing}>Choose palette</p>
        <div data-palette-colors="" data-color-grid="" className="dialog-choice-list" role="listbox" aria-label="Palette colors" hidden={choosing} onKeyDown={moveInList}>
          {p.entries.map(item => <ColorBlock key={`${draft ? 'draft' : 'color'}-${item.id}`} as={draft ? 'output' : 'button'} color={item.color} label={item.name}
            {...(!draft ? { 'data-color-id': item.id, role: 'option', 'aria-selected': item.id === p.selectedId, onClick: () => api.pick(item.id) } : {})}
            selected={!draft && item.id === p.selectedId} aria-label={`${item.name}: ${item.color.toUpperCase()}`} />)}
        </div>
        <div id="palette-choices" data-palette-choices="" data-color-grid="" className="dialog-choice-list" role="listbox" aria-label="Choose palette" hidden={!choosing} onKeyDown={moveInList}>
          {p.palettes.map(item => <button key={item.id} type="button" className="dialog-choice" data-palette-id={item.id} role="option" aria-selected={item.id === (p.paletteId ?? '')} onClick={() => api.choose(item.id)}>{item.name}</button>)}
          <button type="button" data-new-palette="" className="dialog-choice" role="option" aria-selected="false" disabled={Boolean(draft)} onClick={() => api.begin(false)}>New palette</button>
        </div>
      </div>
      <div data-palette-editor="" hidden={!draft}>
        <header className="palette-editor-header">
          <input ref={hexRef} data-palette-hex="" type="text" maxLength="7" spellCheck="false" autoComplete="off" aria-label="Base hex color" placeholder="#RRGGBB" value={p.hex} onChange={event => api.setHex(event.target.value)} onBlur={api.acceptHex} />
          <div data-palette-sides="" className="palette-theme" role="group" aria-label="Palette theme" hidden={draft?.dark?.mode !== 'custom'}>
            {['light', 'dark'].map(side => <button key={side} type="button" data-palette-side={side} className="icon-button" aria-label={`Edit ${side} palette`} aria-pressed={p.side === side} onClick={() => api.setSide(side)}><Icon name={`${side}_mode`} /></button>)}
          </div>
          <div className="align-buttons" role="group" aria-label="Number of colors">
            {p.counts.map(({ count, disabled }) => <button key={count} type="button" data-count={count} aria-pressed={count === draft?.count} disabled={disabled} className={count === draft?.count ? 'active' : ''} onClick={() => api.setCount(count)}>{count}</button>)}
          </div>
        </header>
        <div className="palette-editor-body">
          {['l', 'c', 'h'].map((axis, index) => <div key={axis} className="palette-channel">
            {['base', 'step'].map(group => <PaletteSlider key={group} axis={axis} group={group} label={['Lightness', 'Chroma', 'Hue'][index]} recipe={recipe} count={draft?.count ?? 6} api={api} />)}
          </div>)}
        </div>
      </div>
    </div>
    <p role="alert" hidden={!p.error}>{p.error}</p>
    <footer className="dialog-footer">
      <button type="button" data-delete-palette="" className="icon-button" aria-label="Delete palette" hidden={Boolean(draft)} disabled={Boolean(draft) || !p.canDelete}
        aria-description={!p.canEdit ? 'Choose a palette to delete.' : p.canDelete ? 'Delete this palette. You can undo this change.' : 'Palette colors are still in use.'} onClick={api.remove}><Icon name="delete" /></button>
      <button type="button" data-edit-palette="" className="icon-button" aria-label="Edit palette" hidden={Boolean(draft)} disabled={Boolean(draft) || !p.canEdit}
        aria-description={p.canEdit ? 'Edit this palette' : 'Existing colors have no palette recipe.'} onClick={() => api.begin(true)}><Icon name="edit" /></button>
      <div className="palette-theme-actions" data-palette-theme-actions="" hidden={!draft}>
        <select data-palette-dark="" aria-label="Dark palette behavior" value={draft?.dark?.mode ?? 'same'} onChange={event => api.setMode(event.target.value)}><option value="inverse">Dark: Inverse</option><option value="same">Dark: Same</option><option value="custom">Dark: Custom</option></select>
        <button type="button" data-copy-palette="" hidden={!draft || draft.dark?.mode !== 'custom'} onClick={api.copy}>Copy from {p.side === 'dark' ? 'light' : 'dark'}</button>
      </div>
      <button type="button" data-cancel-palette="" hidden={!draft} onClick={api.cancel}>Cancel</button>
      <button type="button" data-save-palette="" className="primary" hidden={!draft} onClick={api.save}>Save</button>
    </footer>
  </section>;
}
