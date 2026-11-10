import { createPaletteEditor } from '../editor/palette.js';
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
    const visible = model.inspectorOpen && (model.inspectorKind === 'canvas' || box);
    renderInspectorHeader(visible);
    if (!visible) return;
    if (model.inspectorView === 'box-color') boxColorPicker.render();
    positionInspector();
  }
  const colorLabel = property => ({
    fill: 'Fill', textColor: 'Text', borderColor: 'Border',
    background: 'Background', gridMajor: 'Major grid', gridMinor: 'Minor grid',
  })[property];
  function legacyColorData() {
    const boxes = actions.selectedBoxes();
    const boxColors = Object.fromEntries(['fill', 'textColor', 'borderColor', 'borderSide'].map(key => {
      const property = key === 'borderSide' ? 'borderColor' : key;
      const value = MockoutSelection.commonValue(boxes, box => actions.boxProperty(box, property, key === 'borderSide' ? model.borderTarget.index : undefined));
      const mixed = value === undefined, item = actions.swatch(value);
      const label = mixed ? 'Mixed' : item?.name || 'Transparent';
      return [key, { label, mixed, color: item && !mixed ? actions.colorOf(value) : null, description: `${colorLabel(property)}: ${label}` }];
    }));
    const choosing = model.inspectorView === 'choose';
    const selected = choosing ? MockoutSelection.commonValue(boxes, box => actions.boxProperty(box, model.colorTarget.property, model.colorTarget.side)) : null;
    const items = choosing && model.colorTarget.property !== 'textColor' ? [{ id: null, name: 'Transparent' }, ...model.project.swatches] : model.project.swatches;
    return {
      boxColors,
      canvasColors: Object.fromEntries(['background', 'gridMinor', 'gridMajor'].map(property => [property, { label: colorLabel(property), color: actions.canvasColor(property) }])),
      swatches: items.map(item => ({ id: item.id, name: item.name, color: item.id ? actions.colorOf(item.id) : null, selected: choosing && selected === item.id })),
      direct: Boolean(model.colorTarget?.direct), name: model.swatchName || '', swatchError: model.swatchError || '',
      canDelete: Boolean(model.colorTarget?.editId && model.project.swatches.length > 1 && !model.project.boxes.some(box => actions.boxStyle.usesColor(box, model.colorTarget.editId))),
      light: model.editorLight.color, dark: MockoutProject.resolveColor(model.editorLight.color, model.editorDark, 'dark'),
      darkMode: model.editorDark.mode, mode: model.colorMode, color: model.editorColor,
      hex: model.colorHex ?? model.editorColor.slice(1).toUpperCase(), error: model.colorError || '',
      channels: channelData(),
    };
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
    }, properties: actions.propertyData(), colors: legacyColorData() });
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
  function channelData() {
    const values = model.editorChannels || [0, 0, 0];
    const gray = model.colorMode === 'gray', rgb = model.colorMode === 'rgb';
    const labels = gray ? ['Gray', '', ''] : rgb ? ['Red', 'Green', 'Blue'] : ['Hue', 'Saturation', 'Brightness'];
    const stops = gray ? [['#000000', '#ffffff']] : rgb
      ? values.map((_, channel) => [0, 255].map(value => rgbToHex(...values.map((current, i) => i === channel ? value : current))))
      : [['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
        [rgbToHex(...hsbToRgb(values[0], 0, values[2])), rgbToHex(...hsbToRgb(values[0], 100, values[2]))],
        ['#000000', rgbToHex(...hsbToRgb(values[0], values[1], 100))]];
    return labels.map((label, index) => ({ label, value: values[index] ?? 0, max: gray || rgb ? 255 : [360, 100, 100][index],
      hidden: gray && index > 0, gradient: stops[index] ? `linear-gradient(to right, ${stops[index].join(', ')})` : 'none' }));
  }
  function showColor() {
    model.editorChannels = model.colorMode === 'gray' ? [grayValue(model.editorColor), 0, 0]
      : model.colorMode === 'rgb' ? hexToRgb(model.editorColor) : rgbToHsb(...hexToRgb(model.editorColor));
    model.colorHex = model.editorColor.slice(1).toUpperCase();
    model.colorError = '';
    actions.render();
  }
  function openColorPicker(color, mode, onAccept) {
    model.editorColor = color;
    model.colorMode = mode;
    model.pickerOnAccept = onAccept;
    pushInspectorView('picker', () => document.querySelector(`[data-editor-side="${model.editorSide}"]`).focus());
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
    model.swatchError = '';
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
    model.swatchName = item?.name || '';
    model.swatchError = '';
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
  function updateFromChannels(index, raw) {
    const value = Math.max(0, Math.min(channelData()[index].max, Number(raw) || 0));
    const values = model.editorChannels;
    values[index] = value;
    model.editorColor = rgbToHex(...(model.colorMode === 'gray' ? [value, value, value]
      : model.colorMode === 'hsb' ? hsbToRgb(...values) : values));
    model.colorHex = model.editorColor.slice(1).toUpperCase();
    model.colorError = '';
    actions.render();
  }
  function readHex() {
    const value = model.colorHex.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(value)) {
      model.colorError = 'Enter six hex digits (RRGGBB).';
      actions.render();
      return false;
    }
    if (`#${value.toLowerCase()}` !== model.editorColor) useHex(value);
    return true;
  }
  function useHex(value) {
    model.editorColor = `#${value.toLowerCase()}`;
    if (model.colorMode === 'gray' && new Set(hexToRgb(model.editorColor)).size > 1) {
      model.colorMode = 'rgb';
      }
    showColor();
  }

  function setDarkBehavior(mode) {
    model.editorDark.mode = mode;
    if (mode === 'custom' && !model.editorDark.color) {
      model.editorDark.color = MockoutProject.invertColor(model.editorLight.color);
      model.editorDark.colorMode = model.editorLight.mode;
    }
    actions.render();
  }
  function setColorMode(mode) {
    model.colorMode = mode;
    if (mode === 'gray') {
      const value = grayValue(model.editorColor);
      model.editorColor = rgbToHex(value, value, value);
    }
    showColor();
    revealInspector();
  }
  function setColorHex(text) {
    model.colorHex = text;
    const value = text.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(value)) useHex(value);
    else actions.render();
  }
  function setSwatchName(name) { model.swatchName = name; model.swatchError = ''; renderInspector(); }
  function acceptColor() {
    if (!model.pickerOnAccept || !readHex()) return;
    model.pickerOnAccept(model.editorColor, model.colorMode);
    model.pickerOnAccept = null;
    showInspectorParent('edit');
  }
  function deleteSwatch() {
        const id = model.colorTarget?.editId;
        if (!id || model.project.swatches.length <= 1 || model.project.boxes.some(box => actions.boxStyle.usesColor(box, id))) return;
        actions.change(() => {
          model.project.swatches = model.project.swatches.filter(item => item.id !== id);
          if (model.project.lastStyle) actions.boxStyle.replaceColor(model.project.lastStyle, id, model.project.swatches[0].id);
        });
        model.colorTarget.editId = null;
        showInspectorParent('manage');
  }
  function saveColor() {
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
        const name = model.swatchName.trim();
        if (!name) {
          model.swatchError = 'Give the swatch a name.';
          actions.render();
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
  }

  return {
    actions: {
      boxColorPicker, renderInspector, colorLabel, legacyColorData,
      resetInspectorView, pushInspectorView, showInspectorParent, openSectionSelection, focusSectionSelection,
      renderInspectorHeader, positionInspector, revealInspector, focusPropertySection,
      closeInspector, selectStyleTarget, openInspector, openCanvasInspector, finishStyleEdit,
      finishOpacityEdit, assignFontFamily, rgbToHex, hexToRgb, grayValue,
      rgbToHsb, hsbToRgb, channelData, showColor, openColorPicker,
      openManageSwatches, openColor, applyColor, assignColor, openCanvasColorEditor,
      focusColorField, focusSwatchEditorOpener, openSwatchEditor, openEditorColorPicker, updateFromChannels,
      readHex, useHex, setDarkBehavior, setColorMode, setColorHex, setSwatchName, acceptColor, deleteSwatch, saveColor,
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
      events.on(elements.inspector, 'keydown', event => {
        if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
        const fields = [...elements.inspector.querySelectorAll('button, input, select, a[href]')]
          .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
        const index = fields.indexOf(document.activeElement);
        if (!fields.length || (index >= 0 && (event.shiftKey ? index !== 0 : index !== fields.length - 1))) return;
        event.preventDefault();
        fields[event.shiftKey ? fields.length - 1 : 0].focus();
      });
    },
  };
}
