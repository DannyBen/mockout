import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Input } from './Input.jsx';
import { ColorBlock } from './ColorBlock.jsx';
import { BoxColorField } from './LegacyColors.jsx';

export function Properties({ ui, inspector: i, data, colors }) {
  const p = data || { values: {}, familyChoice: '', gridBase: 5, gridDivisions: 10 };
  const [googleDraft, setGoogleDraft] = useState(false);
  const category = googleDraft ? 'google' : p.familyChoice;
  const mixedClass = mixed => `field${mixed ? ' mixed' : ''}`;
  const field = id => ({
    value: p.values[id] ?? (['box-font-weight', 'box-font-style'].includes(id) ? 'mixed' : ''),
    'aria-description': p.values[id] === undefined ? 'Mixed values' : undefined,
    placeholder: p.values[id] === undefined ? 'Mixed' : '',
    onCommit: value => ui.commands.setBoxField(id, value),
  });
  const styleField = id => ({
    ...field(id),
    onInput: event => ui.commands.previewStyleField(id, event.currentTarget.value),
    onCommit: value => { ui.commands.previewStyleField(id, value); ui.commands.finishStyleEdit(); },
    onBlur: () => ui.commands.finishStyleEdit(),
  });
  function chooseFamily(value) {
    if (value === 'google') {
      flushSync(() => setGoogleDraft(true));
      // The input stays mounted; reveal it before focusing it.
      queueMicrotask(() => document.querySelector('#box-google-font').focus());
    } else if (value !== 'mixed') {
      setGoogleDraft(false);
      ui.commands.assignFontFamily(value === 'material' ? p.familyChoice === 'material' ? p.family : 'Material Symbols Outlined' : value);
      if (value === 'material') document.querySelector('#box-material-style').focus();
    }
  }
  return <>
    <section id="box-properties" hidden={i.view !== 'properties' || i.kind !== 'box'}>
      <div id="box-appearance-properties" className="section-content" hidden={i.section !== 'box'}>
        <div className="two-fields">
          <label className={mixedClass(p.values['box-width'] === undefined)}>Width <Input {...field('box-width')} id="box-width" type="number" min="1" step="1" /></label>
          <label className={mixedClass(p.values['box-height'] === undefined)}>Height <Input {...field('box-height')} id="box-height" type="number" min="1" step="1" /></label>
        </div>
        <div className="two-fields">
          <label className={mixedClass(p.values['box-radius'] === undefined)}>Radius <Input {...field('box-radius')} id="box-radius" type="number" min="0" step="1" /></label>
          <label className={mixedClass(p.values['box-border-width'] === undefined)}>Border <Input {...field('box-border-width')} id="box-border-width" type="number" min="0" step="1" /></label>
        </div>
        <div className="two-fields">
          <label className={mixedClass(p.values['box-padding-x'] === undefined)}>Padding X <Input {...field('box-padding-x')} id="box-padding-x" type="number" min="0" step="1" /></label>
          <label className={mixedClass(p.values['box-padding-y'] === undefined)}>Padding Y <Input {...field('box-padding-y')} id="box-padding-y" type="number" min="0" step="1" /></label>
        </div>
        <div className={`slider-field${p.values['box-opacity'] === undefined ? ' mixed' : ''}`}>
          <label className="field" htmlFor="box-opacity-range">Opacity</label>
          <Input value={p.values['box-opacity'] ?? 50} onInput={event => ui.commands.previewOpacity(event.currentTarget.value)} onCommit={() => ui.commands.finishOpacityEdit()} onBlur={() => ui.commands.finishOpacityEdit()} aria-valuetext={p.values['box-opacity'] === undefined ? 'Mixed values' : `${p.values['box-opacity']}%`} id="box-opacity-range" type="range" min="0" max="100" step="1" />
          <Input {...field('box-opacity')} id="box-opacity" type="number" min="0" max="100" step="1" aria-label="Opacity percentage" />
        </div>
      </div>
      <div id="border-properties" className="section-content" hidden={i.section !== 'border'}>
        <div className={mixedClass(p.values['border-width'] === undefined)} id="border-width-field" hidden={p.corner}><label htmlFor="border-width">Width</label><Input {...styleField('border-width')} id="border-width" type="number" min="0" max="10000" step="1" /></div>
        <div className="field" id="border-color-field" hidden={p.corner}><label htmlFor="border-side-color">Color</label><BoxColorField ui={ui} colors={colors} id="border-side-color" property="borderColor" side /></div>
        <div className={mixedClass(p.values['border-radius'] === undefined)} id="border-radius-field" hidden={!p.corner}><label htmlFor="border-radius">Radius</label><Input {...styleField('border-radius')} id="border-radius" type="number" min="0" max="10000" step="1" /></div>
      </div>
      <div id="padding-properties" className="section-content" hidden={i.section !== 'padding'}>
        <div className={mixedClass(p.values['side-padding'] === undefined)}><label htmlFor="side-padding">Padding</label><Input {...styleField('side-padding')} id="side-padding" type="number" min="0" max="10000" step="1" /></div>
      </div>
      <div id="color-properties" className="section-content" hidden={i.section !== 'colors'}>
        <div className="field"><label htmlFor="fill-color">Fill</label><BoxColorField ui={ui} colors={colors} id="fill-color" property="fill" /></div>
        <div className="field"><label htmlFor="text-color">Text</label><BoxColorField ui={ui} colors={colors} id="text-color" property="textColor" /></div>
        <div className="field"><label htmlFor="border-color">Border</label><BoxColorField ui={ui} colors={colors} id="border-color" property="borderColor" /></div>
      </div>
      <div id="text-properties" className="section-content" hidden={i.section !== 'text'}>
        <label className={mixedClass(p.values['box-text'] === undefined)}>Text <Input {...field('box-text')} id="box-text" type="text" placeholder={p.values['box-text'] === undefined ? 'Mixed values' : p.materialOnly ? 'Icon name, e.g. arrow_forward' : 'Optional text'} onKeyDown={event => { if (['Backspace', 'Delete'].includes(event.key) && event.currentTarget.value === '' && p.values['box-text'] === undefined) { event.preventDefault(); ui.commands.setBoxField('box-text', ''); } }} /></label>
        <div className="two-fields align-fields">
          <div className="align-group" role="group" aria-label="Horizontal alignment">
            <span className={p.alignX === undefined ? 'mixed' : ''}>Horizontal</span>
            <div className="align-buttons">
              <button type="button" data-align-axis="alignX" data-align-value="left" className={p.alignX === 'left' ? 'active' : ''} aria-pressed={p.alignX === 'left'} onClick={() => ui.commands.setAlignment('alignX', 'left')} aria-label="Align left"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_left"></use></svg></button>
              <button type="button" data-align-axis="alignX" data-align-value="center" className={p.alignX === 'center' ? 'active' : ''} aria-pressed={p.alignX === 'center'} onClick={() => ui.commands.setAlignment('alignX', 'center')} aria-label="Align center"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_center"></use></svg></button>
              <button type="button" data-align-axis="alignX" data-align-value="right" className={p.alignX === 'right' ? 'active' : ''} aria-pressed={p.alignX === 'right'} onClick={() => ui.commands.setAlignment('alignX', 'right')} aria-label="Align right"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#format_align_right"></use></svg></button>
            </div>
          </div>
          <div className="align-group" role="group" aria-label="Vertical alignment">
            <span className={p.alignY === undefined ? 'mixed' : ''}>Vertical</span>
            <div className="align-buttons">
              <button type="button" data-align-axis="alignY" data-align-value="top" className={p.alignY === 'top' ? 'active' : ''} aria-pressed={p.alignY === 'top'} onClick={() => ui.commands.setAlignment('alignY', 'top')} aria-label="Align top"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_top"></use></svg></button>
              <button type="button" data-align-axis="alignY" data-align-value="center" className={p.alignY === 'center' ? 'active' : ''} aria-pressed={p.alignY === 'center'} onClick={() => ui.commands.setAlignment('alignY', 'center')} aria-label="Align middle"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_center"></use></svg></button>
              <button type="button" data-align-axis="alignY" data-align-value="bottom" className={p.alignY === 'bottom' ? 'active' : ''} aria-pressed={p.alignY === 'bottom'} onClick={() => ui.commands.setAlignment('alignY', 'bottom')} aria-label="Align bottom"><svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#vertical_align_bottom"></use></svg></button>
            </div>
          </div>
        </div>
      </div>
      <div id="font-properties" className="section-content" hidden={i.section !== 'font'}>
        <label className={mixedClass(category === 'mixed')}>Family
          <Input as="select" id="box-font-family" value={category} onCommit={chooseFamily}>
            <option value="mixed" hidden>Mixed values</option>
            <option value="">Default</option>
            <option value="google">Google font…</option>
            <option value="material">Material icons…</option>
          </Input>
        </label>
        <label id="google-font-field" className={mixedClass(p.familyChoice === 'google' && p.family === undefined)} hidden={category !== 'google'}>Google family
          <Input id="box-google-font" value={p.familyChoice === 'google' && p.family !== undefined ? p.family : ''} onCommit={value => { ui.commands.setGoogleFont(value); setGoogleDraft(false); }} onBlur={() => setGoogleDraft(false)} type="text" maxLength="80" autoComplete="off" spellCheck="false" placeholder={p.familyChoice === 'google' && p.family === undefined ? 'Mixed values' : 'e.g. Roboto'} />
        </label>
        <label id="material-style-field" className={mixedClass(p.familyChoice === 'material' && p.family === undefined)} hidden={category !== 'material'}>Icon style
          <Input as="select" id="box-material-style" value={p.familyChoice === 'material' && p.family !== undefined ? p.family : 'mixed'} onCommit={value => { if (value !== 'mixed') ui.commands.assignFontFamily(value); }}>
            <option value="mixed" hidden>Mixed values</option>
            <option value="Material Symbols Outlined">Outlined</option>
            <option value="Material Symbols Rounded">Rounded</option>
            <option value="Material Symbols Sharp">Sharp</option>
            <option value="Material Icons">Filled</option>
            <option value="Material Icons Two Tone">Two Tone</option>
          </Input>
        </label>
        <div className="two-fields">
          <label className={mixedClass(p.values['box-font-size'] === undefined)}>Size <Input {...field('box-font-size')} id="box-font-size" type="number" min="1" step="1" /></label>
          <label className={mixedClass(p.values['box-font-weight'] === undefined)}>Weight
            <Input as="select" {...field('box-font-weight')} id="box-font-weight" disabled={p.classicOnly}>
              <option value="mixed" hidden>Mixed values</option>
              <option value="100">100</option><option value="200">200</option><option value="300">300</option>
              <option value="400">400</option><option value="500">500</option><option value="600">600</option>
              <option value="700">700</option><option value="800" disabled={p.symbol}>800</option><option value="900" disabled={p.symbol}>900</option>
            </Input>
          </label>
        </div>
        <label className={mixedClass(p.values['box-font-style'] === undefined)}>Style
          <Input as="select" {...field('box-font-style')} id="box-font-style" disabled={p.classicOnly}>
            <option value="mixed" hidden>Mixed values</option>
            <option value="normal">Normal</option><option value="italic">Italic</option>
          </Input>
        </label>
        <footer className="dialog-footer font-links"><a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer">Browse fonts <svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#open_in_new"></use></svg></a><a id="browse-icons" href={p.classic ? 'https://fonts.google.com/icons?icon.set=Material+Icons' : 'https://fonts.google.com/icons'} target="_blank" rel="noopener noreferrer" hidden={category !== 'material'}>Browse icons <svg className="icon" aria-hidden="true"><use href="assets/material-symbols/sprite.svg#open_in_new"></use></svg></a></footer>
      </div>
    </section>
    <section id="canvas-properties" className="dialog-choice-list" hidden={i.view !== 'properties' || i.kind !== 'canvas' || i.canvasSection !== 'canvas'} aria-label="Canvas colors">
      <ColorBlock className="dialog-choice" data-canvas-color-property="background" {...colors?.canvasColors.background} aria-label={`${colors?.canvasColors.background.label}: ${colors?.canvasColors.background.color.toUpperCase()}`} onClick={() => ui.commands.openCanvasColor('background')} />
      <ColorBlock className="dialog-choice" data-canvas-color-property="gridMinor" {...colors?.canvasColors.gridMinor} aria-label={`${colors?.canvasColors.gridMinor.label}: ${colors?.canvasColors.gridMinor.color.toUpperCase()}`} onClick={() => ui.commands.openCanvasColor('gridMinor')} />
      <ColorBlock className="dialog-choice" data-canvas-color-property="gridMajor" {...colors?.canvasColors.gridMajor} aria-label={`${colors?.canvasColors.gridMajor.label}: ${colors?.canvasColors.gridMajor.color.toUpperCase()}`} onClick={() => ui.commands.openCanvasColor('gridMajor')} />
    </section>
    <section id="grid-properties" hidden={i.view !== 'properties' || i.kind !== 'canvas' || i.canvasSection !== 'grid'} aria-label="Grid settings">
      <label className="field">Smallest grid size (px)
        <Input value={p.gridBase} onCommit={value => ui.commands.setGridSetting('gridBase', value)} id="grid-base" type="number" min="2" max="100" step="1" />
      </label>
      <label className="field">Major line every (cells)
        <Input value={p.gridDivisions} onCommit={value => ui.commands.setGridSetting('gridDivisions', value)} id="grid-divisions" type="number" min="2" max="100" step="1" />
      </label>
    </section>
  </>;
}
