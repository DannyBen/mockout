import { createPaletteEditor } from '../editor/palette.js';
import { renderColorBlock } from './color-block.js';
import MockoutProject from '../core/project.js';
import MockoutColors from '../core/colors.js';
import MockoutSelection from '../core/selection.js';

export function createInspector({ model, elements, actions, events, ui }) {
  const boxColorPicker = createPaletteEditor(ui, {
    state: () => model.project,
    color: id => actions.colorOf(id),
    theme: () => actions.activeTheme(),
    onPreview: () => actions.render(),
    onLayout: () => { actions.render(); revealInspector(); },
    onPick: id => {
      actions.change(() => applyColor(id));
      boxColorPicker.open(id);
    },
    onSave: draft => {
      let id;
      actions.change(() => { id = MockoutColors.savePalette(model.project, draft); });
      return id;
    },
    onDelete: id => actions.change(() => MockoutColors.deletePalette(model.project, id)),
  });
  function renderInspector() {
    const box = actions.inspectedBox();
    const boxes = actions.selectedBoxes();
    const visible = model.inspectorOpen && (model.inspectorKind === 'canvas' || box);
    renderInspectorHeader(visible);
    if (!visible) return;
    for (const [id, value] of [['grid-base', model.project.gridBase ?? 5], ['grid-divisions', model.project.gridDivisions ?? 10]]) {
      const input = document.getElementById(id);
      if (document.activeElement !== input) input.value = value;
    }
    if (model.inspectorView === 'edit') {
      document.querySelector('#dark-behavior').value = model.editorDark.mode;
      document.querySelector('#swatch-name-field').hidden = !!model.colorTarget?.direct;
      renderColorEditorPreview();
    }
    if (box) {
      for (const [field, getValue] of Object.entries({
        'box-text': item => item.text, 'box-width': item => item.w, 'box-height': item => item.h,
        'box-radius': item => actions.boxProperty(item, 'radius'), 'box-border-width': item => actions.boxProperty(item, 'borderWidth'),
        'border-width': item => actions.boxProperty(item, 'borderWidth', model.borderTarget.index),
        'border-radius': item => actions.boxProperty(item, 'radius', model.borderTarget.index),
        'side-padding': item => actions.boxProperty(item, 'padding', model.paddingTarget.index),
        'box-padding-x': item => actions.boxProperty(item, 'paddingX'), 'box-padding-y': item => actions.boxProperty(item, 'paddingY'),
        'box-opacity': item => Math.round((item.opacity ?? 1) * 100),
      })) {
        const input = document.getElementById(field);
        const value = MockoutSelection.commonValue(boxes, getValue);
        const mixed = value === undefined;
        if (document.activeElement !== input) input.value = mixed ? '' : value;
        input.closest('.field, .slider-field').classList.toggle('mixed', mixed);
        if (mixed) input.setAttribute('aria-description', 'Mixed values');
        else input.removeAttribute('aria-description');
        if (input.type === 'number') input.placeholder = mixed ? 'Mixed' : '';
        if (field === 'box-text') {
          const family = MockoutSelection.commonValue(boxes, actions.fonts.familyOf);
          input.placeholder = mixed ? 'Mixed values' : boxes.every(item => actions.fonts.isMaterial(actions.fonts.familyOf(item)))
            ? 'Icon name, e.g. arrow_forward' : 'Optional text';
        }
      }
      const opacityRange = document.querySelector('#box-opacity-range');
      const opacity = MockoutSelection.commonValue(boxes, item => item.opacity ?? 1);
      if (document.activeElement !== opacityRange) opacityRange.value = opacity === undefined ? 50 : Math.round(opacity * 100);
      opacityRange.setAttribute('aria-valuetext', opacity === undefined ? 'Mixed values' : `${Math.round(opacity * 100)}%`);
      const family = MockoutSelection.commonValue(boxes, actions.fonts.familyOf);
      const familyChoice = MockoutSelection.commonValue(boxes, item => actions.fonts.categoryOf(actions.fonts.familyOf(item))) ?? 'mixed';
      const familySelect = document.querySelector('#box-font-family');
      if (document.activeElement !== familySelect) familySelect.value = familyChoice;
      familySelect.parentElement.classList.toggle('mixed', familyChoice === 'mixed');
      for (const option of document.querySelectorAll('#box-font-weight option')) {
        option.disabled = actions.fonts.isSymbol(family) && Number(option.value) > 700;
      }
      const classicOnly = boxes.every(item => actions.fonts.isClassicIcon(actions.fonts.familyOf(item)));
      document.querySelector('#box-font-weight').disabled = classicOnly;
      document.querySelector('#box-font-style').disabled = classicOnly;
      document.querySelector('#google-font-field').hidden = familyChoice !== 'google';
      const googleInput = document.querySelector('#box-google-font');
      if (document.activeElement !== googleInput) googleInput.value = familyChoice === 'google' && family !== undefined ? family : '';
      googleInput.placeholder = familyChoice === 'google' && family === undefined ? 'Mixed values' : 'e.g. Roboto';
      googleInput.parentElement.classList.toggle('mixed', familyChoice === 'google' && family === undefined);
      document.querySelector('#material-style-field').hidden = familyChoice !== 'material';
      const materialStyle = document.querySelector('#box-material-style');
      materialStyle.value = familyChoice === 'material' && family !== undefined ? family : 'mixed';
      materialStyle.parentElement.classList.toggle('mixed', familyChoice === 'material' && family === undefined);
      const browseIcons = document.querySelector('#browse-icons');
      browseIcons.hidden = familyChoice !== 'material';
      browseIcons.href = actions.fonts.isClassicIcon(family)
        ? 'https://fonts.google.com/icons?icon.set=Material+Icons' : 'https://fonts.google.com/icons';
      for (const [id, getValue] of [
        ['box-font-size', actions.fonts.sizeOf], ['box-font-weight', actions.fonts.weightOf],
        ['box-font-style', actions.fonts.styleOf],
      ]) {
        const input = document.getElementById(id);
        const value = MockoutSelection.commonValue(boxes, getValue);
        const mixed = value === undefined;
        if (document.activeElement !== input) input.value = mixed ? input.tagName === 'SELECT' ? 'mixed' : '' : value;
        input.parentElement.classList.toggle('mixed', mixed);
        if (mixed) input.setAttribute('aria-description', 'Mixed values');
        else input.removeAttribute('aria-description');
      }
      for (const button of elements.alignButtons) {
        const value = MockoutSelection.commonValue(boxes, item => item[button.dataset.alignAxis]);
        const mixed = value === undefined;
        button.closest('.align-group').querySelector('span').classList.toggle('mixed', mixed);
        const active = value === button.dataset.alignValue;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    }
    document.querySelector('#border-width-field').hidden = !!model.borderTarget.corner;
    document.querySelector('#border-color-field').hidden = !!model.borderTarget.corner;
    document.querySelector('#border-radius-field').hidden = !model.borderTarget.corner;
    if (model.inspectorKind === 'box') for (const button of elements.boxColorButtons) renderBoxColorButton(button, boxes);
    if (model.inspectorKind === 'canvas') for (const button of elements.canvasColorButtons) {
      const canvasProperty = button.dataset.canvasColorProperty;
      const displayed = actions.canvasColor(canvasProperty);
      button.setAttribute('aria-label', `${colorLabel(canvasProperty)}: ${displayed.toUpperCase()}`);
      renderColorBlock(button, { color: displayed, label: colorLabel(canvasProperty) });
    }
    if (model.inspectorView === 'choose' || model.inspectorView === 'manage') renderSwatchList();
    if (model.inspectorView === 'box-color') boxColorPicker.render();
    positionInspector();
  }
  const colorLabel = property => ({
    fill: 'Fill', textColor: 'Text', borderColor: 'Border',
    background: 'Background', gridMajor: 'Major grid', gridMinor: 'Minor grid',
  })[property];
  function renderColorEditorPreview() {
    const light = document.querySelector('#swatch-light');
    renderColorBlock(light, { color: model.editorLight.color, label: model.editorLight.color.toUpperCase() });
    light.setAttribute('aria-label', `Edit light color: ${model.editorLight.color.toUpperCase()}`);
    const darkColor = MockoutProject.resolveColor(model.editorLight.color, model.editorDark, 'dark');
    const custom = model.editorDark.mode === 'custom';
    const darkButton = document.querySelector('#swatch-dark');
    const darkPreview = document.querySelector('#swatch-dark-preview');
    darkButton.hidden = !custom;
    darkPreview.hidden = custom;
    const darkValue = custom ? darkButton : darkPreview;
    renderColorBlock(darkValue, { color: darkColor, label: darkColor.toUpperCase() });
    if (custom) darkButton.setAttribute('aria-label', `Edit dark color: ${darkColor.toUpperCase()}`);
  }
  function renderBoxColorButton(button, boxes) {
    const side = button.hasAttribute('data-border-side') ? model.borderTarget.index : undefined;
    const value = MockoutSelection.commonValue(boxes, box => actions.boxProperty(box, button.dataset.colorProperty, side));
    const mixed = value === undefined;
    const item = actions.swatch(value);
    if (mixed) button.setAttribute('aria-description', 'Mixed values');
    else button.removeAttribute('aria-description');
    const name = mixed ? 'Mixed' : item?.name || 'Transparent';
    const property = colorLabel(button.dataset.colorProperty);
    button.setAttribute('aria-label', `${property}: ${name}`);
    renderColorBlock(button, { color: item && !mixed ? actions.colorOf(value) : null, mixed, label: name });
  }
  function resetInspectorView() {
    model.inspectorHistory.length = 0;
    model.inspectorView = 'properties';
    model.pickerOnAccept = null;
    model.colorTarget = null;
  }
  function pushInspectorView(viewName, restoreFocus) {
    model.inspectorHistory.push({ view: model.inspectorView, restoreFocus });
    model.inspectorView = viewName;
  }
  function showInspectorParent(viewName = model.inspectorHistory.at(-1)?.view) {
    const index = model.inspectorHistory.findLastIndex(entry => entry.view === viewName);
    if (index < 0) return;
    const parent = model.inspectorHistory[index];
    model.inspectorHistory.length = index;
    model.inspectorView = parent.view;
    model.pickerOnAccept = null;
    actions.render();
    parent.restoreFocus();
  }
  function openSectionSelection() {
    pushInspectorView('sections', () => elements.inspectorNav.focus());
    actions.render();
    revealInspector();
    focusSectionSelection();
  }
  function focusSectionSelection() {
    document.querySelector('#section-selection [aria-current="page"]').focus();
  }
  function renderInspectorHeader(visible) {
    const properties = model.inspectorView === 'properties';
    const hasParent = model.inspectorHistory.length > 0;
    const menuTitle = model.inspectorKind === 'canvas' ? 'Canvas Properties' : 'Properties';
    const section = model.inspectorKind === 'canvas'
      ? elements.canvasSections.find(item => item.id === model.activeCanvasSection)
      : elements.propertySections[actions.propertySectionIndex()];
    document.querySelector('#delete-swatch').hidden = model.inspectorView !== 'edit' || !model.colorTarget?.editId
      || model.project.swatches.length <= 1 || model.project.boxes.some(item => actions.boxStyle.usesColor(item, model.colorTarget.editId));
    const parts = !visible ? [] : model.inspectorView === 'box-color'
      ? [{ label: model.colorTarget.side === undefined ? colorLabel(model.colorTarget.property) : `${model.borderTarget.name} border` }]
      : model.inspectorView === 'sections' ? [{ label: menuTitle }] : properties
      ? [{ label: section.label }, ...(actions.styleSections.includes(section.id) ? [{ label: actions.styleTarget().name }] : [])]
      : model.inspectorKind === 'canvas'
        ? [{ label: 'Colors', view: 'properties' },
          { label: colorLabel(model.colorTarget.property), ...(model.inspectorView === 'picker' ? { view: 'edit' } : {}) },
          ...(model.inspectorView === 'picker' ? [{ label: model.editorSide === 'light' ? 'Light' : 'Dark' }] : [])]
        : model.inspectorView === 'choose' || model.inspectorView === 'box-color'
          ? [{ label: model.activePropertySection === 'border' ? 'Border' : 'Colors', view: 'properties' },
            ...(model.colorTarget.side !== undefined ? [{ label: model.borderTarget.name }] : []),
            { label: model.colorTarget.side !== undefined ? 'Color' : colorLabel(model.colorTarget.property) }]
          : model.inspectorView === 'manage'
            ? [{ label: model.activePropertySection === 'border' ? 'Border' : 'Colors', view: 'properties' }, { label: 'Swatches' }]
            : model.inspectorView === 'edit'
              ? [{ label: 'Swatches', view: 'manage' },
                { label: model.colorTarget.editId ? actions.swatch(model.colorTarget.editId)?.name || 'Swatch' : 'New' }]
              : [{ label: 'Swatches', view: 'manage' },
                { label: model.colorTarget.editId ? actions.swatch(model.colorTarget.editId)?.name || 'Swatch' : 'New', view: 'edit' },
                { label: model.editorSide === 'light' ? 'Light' : 'Dark' }];
    ui.update({ inspector: {
      visible: Boolean(visible), view: model.inspectorView, kind: model.inspectorKind,
      section: model.activePropertySection, canvasSection: model.activeCanvasSection,
      hasParent, menuTitle, parts, locked: model.fileLocked,
    } });
  }
  function renderSwatchList() {
    const choosing = model.inspectorView === 'choose';
    const list = document.querySelector(choosing ? '#choice-swatch-list' : '#swatch-list');
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const focusedId = focused?.dataset.swatchId;
    const selected = choosing ? MockoutSelection.commonValue(actions.selectedBoxes(), box => actions.boxProperty(box, model.colorTarget.property, model.colorTarget.side)) : null;
    const items = choosing && model.colorTarget.property !== 'textColor'
      ? [{ id: null, name: 'Transparent' }, ...model.project.swatches] : model.project.swatches;
    list.replaceChildren();
    for (const item of items) {
      const choice = document.createElement('button');
      choice.type = 'button'; choice.className = 'dialog-choice';
      choice.dataset.swatchId = item.id ?? '';
      renderColorBlock(choice, { color: item.id ? actions.colorOf(item.id) : null, label: item.name,
        selected: choosing && selected === item.id, action: choosing ? null : 'edit' });
      choice.setAttribute('aria-label', `${choosing ? 'Use' : 'Edit'} ${item.name}`);
      if (choosing) {
        choice.setAttribute('role', 'option');
        choice.setAttribute('aria-selected', String(selected === item.id));
      }
      events.on(choice, 'click', () => choosing ? assignColor(item.id) : openSwatchEditor(item.id));
      list.append(choice);
    }
    const buttons = [...list.querySelectorAll('button')];
    const active = buttons.find(button => button.dataset.swatchId === focusedId)
      || (choosing && selected !== undefined && buttons.find(button => button.dataset.swatchId === (selected ?? '')))
      || buttons[0];
    if (focused) active?.focus();
  }
  function positionInspector() {
    if (elements.inspector.hidden) return;
    if (model.inspectorKind === 'canvas') {
      elements.inspector.style.left = `${Math.max(12, Math.min(model.inspectorPoint.x, window.innerWidth - elements.inspector.offsetWidth - 12))}px`;
      elements.inspector.style.top = `${Math.max(12, Math.min(model.inspectorPoint.y, window.innerHeight - elements.inspector.offsetHeight - 12))}px`;
      return;
    }
    const box = actions.inspectedBox();
    if (!box) return;
    const boxRect = [...elements.canvas.querySelectorAll('.box')].find(element => Number(element.dataset.id) === box.id)?.getBoundingClientRect();
    if (!boxRect) return;
    const frame = actions.styleEditing() ? actions.boxStyle.markerFrame(boxRect) : null;
    const position = frame ? { left: frame.right + 20, top: frame.top } : MockoutSelection.inspectorPosition(boxRect);
    elements.inspector.style.left = `${position.left}px`;
    elements.inspector.style.top = `${position.top}px`;
  }
  function revealInspector() {
    if (elements.inspector.hidden || model.inspectorKind !== 'box') return;
    const pan = MockoutSelection.inspectorPan(elements.inspector.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight });
    if (!pan.x && !pan.y) return;
    model.view.x += pan.x;
    model.view.y += pan.y;
    actions.render();
  }
  function focusPropertySection() {
    if (model.inspectorKind === 'canvas') {
      elements.canvasSections.find(section => section.id === model.activeCanvasSection).element.querySelector('input, button')?.focus();
      return;
    }
    if (actions.styleSections.includes(model.activePropertySection)) {
      const input = document.querySelector(model.activePropertySection === 'padding' ? '#side-padding' : model.borderTarget.corner ? '#border-radius' : '#border-width');
      input.focus();
      input.select();
      return;
    }
    const field = model.activePropertySection === 'text' ? document.querySelector('#box-text')
      : model.lastPropertyFocus.get(model.activePropertySection);
    if (field?.isConnected && !field.closest('[hidden]')) field.focus();
    else elements.propertySections[actions.propertySectionIndex()].element.querySelector('input, select, button')?.focus();
  }
  function closeInspector() {
    model.inspectorOpen = false;
    resetInspectorView();
    elements.workspace.focus();
    actions.render();
  }
  function selectStyleTarget(target) {
    if (elements.inspector.contains(document.activeElement)) document.activeElement.blur();
    if (model.activePropertySection === 'padding') model.paddingTarget = target;
    else model.borderTarget = target;
    resetInspectorView();
    actions.render();
    focusPropertySection();
  }
  function openInspector(id = model.selectedId, showSections = !model.inspectorOpen || model.inspectorView === 'sections') {
    if (id === null) return;
    if (elements.inspector.contains(document.activeElement)) document.activeElement.blur();
    if (model.selectedIds.has(id)) model.selectedId = id;
    else actions.selectOnly(id);
    model.inspectorOpen = true;
    model.inspectorKind = 'box';
    resetInspectorView();
    if (showSections) model.inspectorView = 'sections';
    actions.render();
    revealInspector();
    if (showSections) focusSectionSelection();
    else focusPropertySection();
  }
  function openCanvasInspector(point = null, showSections = !model.inspectorOpen || model.inspectorView === 'sections') {
    actions.selectOnly(null);
    model.inspectorOpen = true;
    model.inspectorKind = 'canvas';
    resetInspectorView();
    if (showSections) model.inspectorView = 'sections';
    model.inspectorPoint = point || { x: 12, y: 12 };
    actions.render();
    if (!point) {
      model.inspectorPoint = { x: (window.innerWidth - elements.inspector.offsetWidth) / 2,
        y: (window.innerHeight - elements.inspector.offsetHeight) / 2 };
      positionInspector();
    }
    if (showSections) focusSectionSelection();
    else focusPropertySection();
  }
  function finishStyleEdit() {
    if (model.styleBefore === null) return;
    const before = model.styleBefore;
    model.styleBefore = null;
    actions.commit(before);
  }
  function finishOpacityEdit() {
    if (model.opacityBefore === null) return;
    const before = model.opacityBefore;
    model.opacityBefore = null;
    actions.commit(before);
  }
  function assignFontFamily(family) {
    actions.change(() => {
      MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, 'fontFamily', family);
      for (const box of actions.selectedBoxes()) {
        if (actions.fonts.isSymbol(family)) box.fontWeight = Math.min(actions.fonts.weightOf(box), 700);
        if (actions.fonts.isClassicIcon(family)) { box.fontWeight = 400; box.fontStyle = 'normal'; }
      }
      actions.rememberStyle(actions.selectedBox());
    });
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
  }
  function hexToRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
  function grayValue(hex) {
    const [r, g, b] = hexToRgb(hex);
    return Math.round(.299 * r + .587 * g + .114 * b);
  }
  function rgbToHsb(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
    }
    return [Math.round((hue + 360) % 360), Math.round(max ? delta / max * 100 : 0), Math.round(max * 100)];
  }
  function hsbToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return parts.map(n => Math.round((n + m) * 255));
  }
  function updateChannelGradients() {
    const values = elements.channels.map(input => Number(input.value));
    let stops;
    if (model.colorMode === 'gray') stops = [['#000000', '#ffffff']];
    else if (model.colorMode === 'rgb') {
      stops = values.map((_, channel) => [0, 255].map(value =>
        rgbToHex(...values.map((current, i) => i === channel ? value : current))));
    } else {
      const [hue, saturation, brightness] = values;
      stops = [
        ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
        [rgbToHex(...hsbToRgb(hue, 0, brightness)), rgbToHex(...hsbToRgb(hue, 100, brightness))],
        ['#000000', rgbToHex(...hsbToRgb(hue, saturation, 100))],
      ];
    }
    elements.channels.forEach((input, i) => input.style.setProperty('--channel-gradient',
      stops[i] ? `linear-gradient(to right, ${stops[i].join(', ')})` : 'none'));
  }
  function showColor() {
    const rgb = model.colorMode === 'rgb';
    const gray = model.colorMode === 'gray';
    const values = gray ? [grayValue(model.editorColor)]
      : rgb ? hexToRgb(model.editorColor) : rgbToHsb(...hexToRgb(model.editorColor));
    elements.channels.forEach((input, i) => {
      input.closest('.slider-field').hidden = gray && i > 0;
      const label = (gray ? ['Gray', '', ''] : rgb ? ['Red', 'Green', 'Blue'] : ['Hue', 'Saturation', 'Brightness'])[i];
      const max = rgb || gray ? 255 : [360, 100, 100][i];
      input.max = max;
      elements.channelValues[i].max = max;
      document.getElementById(`channel-${i + 1}-label`).textContent = label;
      elements.channelValues[i].setAttribute('aria-label', `${gray ? 'Gray' : rgb ? ['Red', 'Green', 'Blue'][i] : ['Hue', 'Saturation', 'Brightness'][i]} value`);
      input.value = values[i] ?? 0;
      elements.channelValues[i].value = values[i] ?? 0;
    });
    updateChannelGradients();
    renderColorBlock(document.querySelector('#color-preview'), { color: model.editorColor, label: model.editorColor.toUpperCase() });
    document.querySelector('#color-hex').value = model.editorColor.slice(1).toUpperCase();
    document.querySelector('#color-error').hidden = true;
    actions.render();
  }
  function openColorPicker(color, mode, onAccept) {
    model.editorColor = color;
    model.colorMode = mode;
    model.pickerOnAccept = onAccept;
    pushInspectorView('picker', () => document.querySelector(`[data-editor-side="${model.editorSide}"]`).focus());
    document.querySelector('#color-mode').value = model.colorMode;
    showColor();
    revealInspector();
    document.querySelector('#color-hex').focus();
  }
  function openManageSwatches(event) {
    const opener = event.currentTarget;
    model.colorTarget = model.inspectorView === 'choose' ? { ...model.colorTarget, editId: null } : { editId: null };
    pushInspectorView('manage', () => opener.focus());
    renderInspector();
    revealInspector();
    (document.querySelector('#swatch-list .dialog-choice') || document.querySelector('#new-swatch')).focus();
  }
  function openColor(property, side) {
    model.colorTarget = { property, side };
    const id = MockoutSelection.commonValue(actions.selectedBoxes(), box => actions.boxProperty(box, property, side));
    pushInspectorView('box-color', focusColorField);
    boxColorPicker.open(id);
    renderInspector();
    revealInspector();
    boxColorPicker.focus();
  }
  function applyColor(id) {
    if (model.colorTarget.property === 'borderColor') {
      for (const box of actions.selectedBoxes()) actions.boxStyle.set(box, 'borderColor', id, model.colorTarget.side);
    } else MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, model.colorTarget.property, id);
    actions.rememberStyle(actions.selectedBox());
  }
  function assignColor(id) {
    if (!model.selectedIds.size || !model.colorTarget) return;
    actions.change(() => applyColor(id));
    showInspectorParent('properties');
  }
  function openCanvasColorEditor(property) {
    model.colorTarget = { property, direct: true };
    document.querySelector('#swatch-error').hidden = true;
    model.editorLight = { color: model.project.canvasColors[property], mode: model.project.canvasColorModes?.[property] ?? 'gray' };
    model.editorDark = { mode: 'invert', color: null, colorMode: model.editorLight.mode,
      ...model.project.canvasDark?.[property] };
    model.editorSide = 'light';
    pushInspectorView('edit', focusColorField);
    renderInspector();
    revealInspector();
    document.querySelector('#swatch-light').focus();
  }
  function focusColorField() {
    const selector = model.inspectorKind === 'box'
      ? model.colorTarget.side !== undefined ? '#border-side-color' : `[data-color-property="${model.colorTarget.property}"]:not([data-border-side])`
      : `[data-canvas-color-property="${model.colorTarget.property}"]`;
    document.querySelector(selector).focus();
  }
  function focusSwatchEditorOpener() {
    const edit = [...document.querySelectorAll('#swatch-list .dialog-choice')]
      .find(button => button.dataset.swatchId === model.colorTarget.editId);
    (edit || document.querySelector('#new-swatch')).focus();
  }
  function openSwatchEditor(id = null) {
    model.colorTarget.editId = id;
    const item = actions.swatch(id);
    model.editorLight = { color: item?.color || '#6746b7',
      mode: item?.mode ?? 'hsb' };
    model.editorDark = { mode: 'invert', color: null, colorMode: model.editorLight.mode, ...item?.dark };
    model.editorSide = 'light';
    document.querySelector('#swatch-name').value = item?.name || '';
    document.querySelector('#swatch-error').hidden = true;
    pushInspectorView('edit', focusSwatchEditorOpener);
    renderInspector();
    revealInspector();
    document.querySelector('#swatch-name').focus();
  }
  function openEditorColorPicker(side) {
    if (side === 'dark' && model.editorDark.mode !== 'custom') return;
    model.editorSide = side;
    const color = side === 'light' ? model.editorLight.color : model.editorDark.color;
    const mode = side === 'light' ? model.editorLight.mode : model.editorDark.colorMode || model.editorLight.mode;
    openColorPicker(color, mode, (chosenColor, chosenMode) => {
      const next = MockoutProject.withPickerColor(model.editorLight, model.editorDark,
        side, chosenColor, chosenMode);
      model.editorLight = next.light;
      model.editorDark = next.dark;
    });
  }
  function updateFromChannels(source, index) {
    const value = Math.max(0, Math.min(Number(source.max), Number(source.value) || 0));
    elements.channels[index].value = value;
    elements.channelValues[index].value = value;
    const values = elements.channels.map(input => Number(input.value));
    model.editorColor = rgbToHex(...(model.colorMode === 'gray' ? [value, value, value]
      : model.colorMode === 'hsb' ? hsbToRgb(...values) : values));
    updateChannelGradients();
    renderColorBlock(document.querySelector('#color-preview'), { color: model.editorColor, label: model.editorColor.toUpperCase() });
    document.querySelector('#color-hex').value = model.editorColor.slice(1).toUpperCase();
    document.querySelector('#color-error').hidden = true;
    actions.render();
  }
  function readHex() {
    const input = document.querySelector('#color-hex');
    const value = input.value.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(value)) {
      const error = document.querySelector('#color-error');
      error.textContent = 'Enter six hex digits (RRGGBB).';
      error.hidden = false;
      return false;
    }
    if (`#${value.toLowerCase()}` !== model.editorColor) useHex(value);
    return true;
  }
  function useHex(value) {
    model.editorColor = `#${value.toLowerCase()}`;
    if (model.colorMode === 'gray' && new Set(hexToRgb(model.editorColor)).size > 1) {
      model.colorMode = 'rgb';
      document.querySelector('#color-mode').value = model.colorMode;
    }
    showColor();
  }

  return {
    actions: {
      boxColorPicker, renderInspector, colorLabel, renderColorEditorPreview, renderBoxColorButton,
      resetInspectorView, pushInspectorView, showInspectorParent, openSectionSelection, focusSectionSelection,
      renderInspectorHeader, renderSwatchList, positionInspector, revealInspector, focusPropertySection,
      closeInspector, selectStyleTarget, openInspector, openCanvasInspector, finishStyleEdit,
      finishOpacityEdit, assignFontFamily, rgbToHex, hexToRgb, grayValue,
      rgbToHsb, hsbToRgb, updateChannelGradients, showColor, openColorPicker,
      openManageSwatches, openColor, applyColor, assignColor, openCanvasColorEditor,
      focusColorField, focusSwatchEditorOpener, openSwatchEditor, openEditorColorPicker, updateFromChannels,
      readHex, useHex,
    },
    init() {
      for (const list of document.querySelectorAll('.dialog-choice-list:not([data-color-grid])')) {
        events.on(list, 'keydown', event => {
          const direction = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }[event.key];
          if (!direction) return;
          event.preventDefault();
          const buttons = [...list.querySelectorAll('button')].filter(button => !button.hidden && !button.disabled);
          const index = buttons.indexOf(document.activeElement);
          const next = direction === 'first' ? 0 : direction === 'last' ? buttons.length - 1
            : (index + direction + buttons.length) % buttons.length;
          buttons[next]?.focus();
          buttons[next]?.scrollIntoView({ block: 'nearest' });
        });
      }
      events.on(window, 'resize', positionInspector);
      events.on(document.querySelector('#box-properties'), 'focusin', event => {
        if (model.inspectorKind === 'box' && model.inspectorView === 'properties') model.lastPropertyFocus.set(model.activePropertySection, event.target);
      });
      events.on(document.querySelector('#close-inspector'), 'click', closeInspector);
      events.on(elements.inspectorNav, 'click', () => {
        if (model.inspectorHistory.length) showInspectorParent();
        else if (model.inspectorView !== 'sections') openSectionSelection();
      });
      for (const button of document.querySelectorAll('[data-inspector-back]')) events.on(button, 'click', () => showInspectorParent());
      for (const button of document.querySelectorAll('[data-property-section]')) events.on(button, 'click', () => {
        if (model.inspectorKind === 'canvas') model.activeCanvasSection = button.dataset.propertySection;
        else {
          model.activePropertySection = button.dataset.propertySection;
          if (actions.styleSections.includes(model.activePropertySection)) model.tool = 'select';
        }
        resetInspectorView();
        actions.render();
        revealInspector();
        focusPropertySection();
      });
      for (const target of actions.boxStyle.targets) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'style-marker';
        marker.dataset.styleTarget = target.id;
        marker.dataset.kind = target.corner ? 'corner' : 'edge';
        marker.dataset.axis = target.x === .5 ? 'horizontal' : 'vertical';
        marker.setAttribute('aria-label', `${target.name} ${target.corner ? 'corner' : 'border'}`);
        marker.setAttribute('aria-controls', 'inspector');
        events.on(marker, 'pointerdown', event => {
          if (event.button === 0 && !model.spaceDown) event.stopPropagation();
        });
        events.on(marker, 'click', () => { if (!model.spaceDown) selectStyleTarget(target); });
        elements.styleMarkers.append(marker);
      }
      events.on(elements.inspector, 'keydown', event => {
        if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
        const fields = [...elements.inspector.querySelectorAll('button, input, select, a[href]')]
          .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
        const index = fields.indexOf(document.activeElement);
        if (!fields.length || (index >= 0 && (event.shiftKey ? index !== 0 : index !== fields.length - 1))) return;
        event.preventDefault();
        fields[event.shiftKey ? fields.length - 1 : 0].focus();
      });
      for (const [id, property] of [['border-width', 'borderWidth'], ['border-radius', 'radius'], ['side-padding', 'padding']]) {
        const input = document.getElementById(id);
        const target = () => property === 'padding' ? model.paddingTarget : model.borderTarget;
        const update = () => {
          if (!model.selectedIds.size || model.fileLocked || input.value === '') return;
          model.styleBefore ??= actions.snapshot();
          const value = Math.max(0, Math.min(10000, input.valueAsNumber));
          for (const box of actions.selectedBoxes()) actions.boxStyle.set(box, property, value, target().index);
          actions.rememberStyle(actions.selectedBox());
          actions.render();
        };
        events.on(input, 'input', update);
        events.on(input, 'change', () => {
          update();
          finishStyleEdit();
          const value = MockoutSelection.commonValue(actions.selectedBoxes(), box => actions.boxProperty(box, property, target().index));
          input.value = value ?? '';
        });
        events.on(input, 'blur', finishStyleEdit);
      }
      events.on(elements.opacityRange, 'input', () => {
        if (!model.selectedIds.size) return;
        model.opacityBefore ??= actions.snapshot();
        MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, 'opacity', Number(elements.opacityRange.value) / 100);
        actions.rememberStyle(actions.selectedBox());
        actions.render();
      });
      events.on(elements.opacityRange, 'change', finishOpacityEdit);
      events.on(elements.opacityRange, 'blur', finishOpacityEdit);
      events.on(elements.fontFamilySelect, 'change', () => {
        const category = elements.fontFamilySelect.value;
        if (category === 'google') {
          const current = MockoutSelection.commonValue(actions.selectedBoxes(), actions.fonts.familyOf);
          document.querySelector('#google-font-field').hidden = false;
          document.querySelector('#material-style-field').hidden = true;
          elements.googleFontInput.value = current && !actions.fonts.isMaterial(current) ? current : '';
          elements.googleFontInput.focus();
          return;
        }
        if (category === 'mixed' || !model.selectedIds.size) return;
        const current = MockoutSelection.commonValue(actions.selectedBoxes(), actions.fonts.familyOf);
        let family = category;
        if (category === 'material') family = actions.fonts.isMaterial(current) ? current : 'Material Symbols Outlined';
        assignFontFamily(family);
        if (category === 'material') elements.materialStyleSelect.focus();
      });
      events.on(elements.materialStyleSelect, 'change', () => {
        const family = elements.materialStyleSelect.value;
        if (!actions.fonts.isMaterial(family) || !model.selectedIds.size) return;
        assignFontFamily(family);
      });
      events.on(elements.googleFontInput, 'change', () => {
        const family = elements.googleFontInput.value.trim().replace(/\s+/g, ' ');
        if (!family || !actions.fonts.validFamily(family) || !model.selectedIds.size) {
          if (family) actions.showNotice('Enter the family name as shown on Google Fonts.');
          return;
        }
        actions.change(() => {
          MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, 'fontFamily', family);
          actions.rememberStyle(actions.selectedBox());
        });
      });
      events.on(elements.googleFontInput, 'blur', () => {
        if (!elements.googleFontInput.value.trim()) renderInspector();
      });
      events.on(document.querySelector('#box-text'), 'keydown', event => {
        if (!['Backspace', 'Delete'].includes(event.key) || event.target.value !== '') return;
        if (MockoutSelection.commonValue(actions.selectedBoxes(), box => box.text) !== undefined) return;
        event.preventDefault();
        actions.change(() => {
          MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, 'text', '');
          actions.rememberStyle(actions.selectedBox());
        });
      });
      for (const button of elements.alignButtons) {
        events.on(button, 'click', () => {
          if (model.selectedIds.size) actions.change(() => {
            MockoutSelection.applyProperty(model.project.boxes, model.selectedIds, button.dataset.alignAxis, button.dataset.alignValue);
            actions.rememberStyle(actions.selectedBox());
          });
        });
      }
      for (const button of elements.boxColorButtons) events.on(button, 'click', () =>
        openColor(button.dataset.colorProperty, button.hasAttribute('data-border-side') ? model.borderTarget.index : undefined));
      for (const button of elements.canvasColorButtons) events.on(button, 'click', () =>
        openCanvasColorEditor(button.dataset.canvasColorProperty));
      for (const button of document.querySelectorAll('[data-manage-swatches]')) events.on(button, 'click', openManageSwatches);
      for (const button of document.querySelectorAll('[data-editor-side]')) events.on(button, 'click', () =>
        openEditorColorPicker(button.dataset.editorSide));
      events.on(document.querySelector('#dark-behavior'), 'change', event => {
        model.editorDark.mode = event.target.value;
        if (model.editorDark.mode === 'custom' && !model.editorDark.color) {
          model.editorDark.color = MockoutProject.invertColor(model.editorLight.color);
          model.editorDark.colorMode = model.editorLight.mode;
        }
        actions.render();
      });
      events.on(document.querySelector('#new-swatch'), 'click', () => openSwatchEditor());
      events.on(document.querySelector('#delete-swatch'), 'click', () => {
        const id = model.colorTarget?.editId;
        if (!id || model.project.swatches.length <= 1 || model.project.boxes.some(box => actions.boxStyle.usesColor(box, id))) return;
        actions.change(() => {
          model.project.swatches = model.project.swatches.filter(item => item.id !== id);
          if (model.project.lastStyle) actions.boxStyle.replaceColor(model.project.lastStyle, id, model.project.swatches[0].id);
        });
        model.colorTarget.editId = null;
        showInspectorParent('manage');
      });
      events.on(document.querySelector('#color-mode'), 'change', event => {
        model.colorMode = event.target.value;
        if (model.colorMode === 'gray') {
          const value = grayValue(model.editorColor);
          model.editorColor = rgbToHex(value, value, value);
        }
        showColor();
        revealInspector();
      });
      elements.channels.forEach((input, i) => events.on(input, 'input', () => updateFromChannels(input, i)));
      elements.channelValues.forEach((input, i) => events.on(input, 'input', () => updateFromChannels(input, i)));
      events.on(document.querySelector('#color-hex'), 'change', readHex);
      events.on(document.querySelector('#color-hex'), 'input', event => {
        const value = event.target.value.trim().replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(value)) useHex(value);
      });
      events.on(document.querySelector('#swatch-name'), 'input', () => {
        document.querySelector('#swatch-error').hidden = true;
      });
      events.on(document.querySelector('#use-color'), 'click', () => {
        if (!model.pickerOnAccept || !readHex()) return;
        model.pickerOnAccept(model.editorColor, model.colorMode);
        model.pickerOnAccept = null;
        showInspectorParent('edit');
      });
      events.on(document.querySelector('#save-color'), 'click', () => {
        if (!model.colorTarget) return;
        if (model.colorTarget.direct) {
          actions.change(() => {
            model.project.canvasColors[model.colorTarget.property] = model.editorLight.color;
            model.project.canvasColorModes = { ...model.project.canvasColorModes, [model.colorTarget.property]: model.editorLight.mode };
            model.project.canvasDark = { ...model.project.canvasDark, [model.colorTarget.property]: { ...model.editorDark } };
          });
          showInspectorParent('properties');
          return;
        }
        const name = document.querySelector('#swatch-name').value.trim();
        if (!name) {
          const error = document.querySelector('#swatch-error');
          error.textContent = 'Give the swatch a name.';
          error.hidden = false;
          document.querySelector('#swatch-name').focus();
          return;
        }
        const dark = { mode: model.editorDark.mode };
        if (model.editorDark.color) dark.color = model.editorDark.color;
        if (model.editorDark.colorMode) dark.colorMode = model.editorDark.colorMode;
        if (model.colorTarget.editId) {
          actions.change(() => { Object.assign(actions.swatch(model.colorTarget.editId),
            { name, color: model.editorLight.color, mode: model.editorLight.mode, dark }); });
        } else {
          actions.change(() => {
            const id = `s${model.project.nextId++}`;
            model.project.swatches.push({ id, name, color: model.editorLight.color, mode: model.editorLight.mode, dark });
            model.colorTarget.editId = id;
            if (model.colorTarget.property && model.selectedIds.size) applyColor(id);
          });
        }
        const managerIndex = model.inspectorHistory.findLastIndex(entry => entry.view === 'manage');
        showInspectorParent(model.inspectorHistory[managerIndex - 1].view);
      });
    },
  };
}
