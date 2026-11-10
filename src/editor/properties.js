import Selection from '../core/selection.js';

export function createProperties({ model, actions }) {
  const fieldProperties = {
    'box-text': ['text', value => value],
    'box-width': ['w', value => Math.max(actions.minimum(), actions.snap(Number(value) || actions.minimum()))],
    'box-height': ['h', value => Math.max(actions.minimum(), actions.snap(Number(value) || actions.minimum()))],
    'box-radius': ['radius', nonnegative], 'box-border-width': ['borderWidth', nonnegative],
    'box-padding-x': ['paddingX', nonnegative], 'box-padding-y': ['paddingY', nonnegative],
    'box-opacity': ['opacity', value => Math.round(Math.max(0, Math.min(100, Number(value) || 0))) / 100],
    'box-font-size': ['fontSize', value => Math.max(1, Number(value) || 1)],
    'box-font-weight': ['fontWeight', Number], 'box-font-style': ['fontStyle', value => value],
  };
  function nonnegative(value) { return Math.max(0, Number(value) || 0); }
  const sideProperty = id => id === 'side-padding' ? ['padding', model.paddingTarget.index]
    : [id === 'border-width' ? 'borderWidth' : 'radius', model.borderTarget.index];
  function propertyData() {
    const boxes = actions.selectedBoxes();
    const common = get => Selection.commonValue(boxes, get);
    const values = Object.fromEntries(Object.entries(fieldProperties).map(([id, [property]]) => [id,
      common(box => property === 'opacity' ? Math.round((box.opacity ?? 1) * 100)
        : property === 'fontSize' ? actions.fonts.sizeOf(box) : property === 'fontWeight' ? actions.fonts.weightOf(box)
        : property === 'fontStyle' ? actions.fonts.styleOf(box) : actions.boxProperty(box, property)),
    ]));
    for (const id of ['border-width', 'border-radius', 'side-padding']) {
      const [property, side] = sideProperty(id);
      values[id] = common(box => actions.boxProperty(box, property, side));
    }
    const family = common(actions.fonts.familyOf);
    return {
      values, family, familyChoice: common(box => actions.fonts.categoryOf(actions.fonts.familyOf(box))) ?? 'mixed',
      classicOnly: boxes.length > 0 && boxes.every(box => actions.fonts.isClassicIcon(actions.fonts.familyOf(box))),
      materialOnly: boxes.length > 0 && boxes.every(box => actions.fonts.isMaterial(actions.fonts.familyOf(box))),
      symbol: actions.fonts.isSymbol(family), classic: actions.fonts.isClassicIcon(family),
      corner: Boolean(model.borderTarget.corner),
      borderSide: model.borderTarget.index,
      alignX: common(box => box.alignX), alignY: common(box => box.alignY),
      gridBase: model.project.gridBase ?? 5, gridDivisions: model.project.gridDivisions ?? 10,
    };
  }
  function setBoxField(id, value) {
    if (!model.selectedIds.size || model.fileLocked || (value === '' && id !== 'box-text')) return;
    const [property, transform] = fieldProperties[id];
    actions.change(() => {
      if (['borderWidth', 'radius', 'paddingX', 'paddingY'].includes(property)) {
        for (const box of actions.selectedBoxes()) actions.boxStyle.set(box, property, transform(value));
      } else Selection.applyProperty(model.project.boxes, model.selectedIds, property, transform(value));
      actions.rememberStyle(actions.selectedBox());
    });
  }
  function previewStyleField(id, value) {
    if (!model.selectedIds.size || model.fileLocked || value === '' || !Number.isFinite(Number(value))) return;
    model.styleBefore ??= actions.snapshot();
    const [property, side] = sideProperty(id);
    for (const box of actions.selectedBoxes()) actions.boxStyle.set(box, property, Math.max(0, Math.min(10000, Number(value))), side);
    actions.rememberStyle(actions.selectedBox());
    actions.render();
  }
  function previewOpacity(value) {
    if (!model.selectedIds.size || model.fileLocked) return;
    model.opacityBefore ??= actions.snapshot();
    Selection.applyProperty(model.project.boxes, model.selectedIds, 'opacity', Number(value) / 100);
    actions.rememberStyle(actions.selectedBox());
    actions.render();
  }
  function setGridSetting(property, value) {
    if (value === '' || model.fileLocked || !Number.isFinite(Number(value))) return;
    const next = Math.max(2, Math.min(100, Math.round(Number(value))));
    actions.change(() => {
      if (property === 'gridBase') model.project.grid = model.project.grid / (model.project.gridBase ?? 5) * next;
      model.project[property] = next;
    });
  }
  function setAlignment(axis, value) {
    if (!model.selectedIds.size || model.fileLocked) return;
    actions.change(() => {
      Selection.applyProperty(model.project.boxes, model.selectedIds, axis, value);
      actions.rememberStyle(actions.selectedBox());
    });
  }
  function setGoogleFont(value) {
    const family = value.trim().replace(/\s+/g, ' ');
    if (!family || !actions.fonts.validFamily(family) || !model.selectedIds.size) {
      if (family) actions.showNotice('Enter the family name as shown on Google Fonts.');
      return;
    }
    actions.assignFontFamily(family);
  }
  return { actions: { propertyData, setBoxField, previewStyleField, previewOpacity, setGridSetting, setAlignment, setGoogleFont }, init() {} };
}
