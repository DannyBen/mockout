import MockoutProject from '../core/project.js';
import MockoutColors from '../core/colors.js';
import MockoutSelection from '../core/selection.js';
import MockoutPlacement from '../core/placement.js';
import MockoutFonts from '../core/fonts.js';
import MockoutBoxStyle from '../core/box-style.js';

export function createSelectors({ model, elements, actions }) {
  const STORAGE_KEY = MockoutProject.storageKey;
  const { initialStyle } = MockoutProject;
  const boxStyle = MockoutBoxStyle;
  const fonts = MockoutFonts;
  const freshState = () => MockoutProject.freshState();
  const validProject = value => MockoutProject.validProject(value);
  const snapshot = () => JSON.stringify(model.project);
  const selectedBox = () => model.project.boxes.find(b => b.id === model.selectedId);
  const selectedBoxes = () => model.project.boxes.filter(b => model.selectedIds.has(b.id));
  const propertySectionIndex = () => elements.propertySections.findIndex(section => section.id === model.activePropertySection);
  const paddingX = box => box.paddingX ?? 3;
  const paddingY = box => box.paddingY ?? 3;
  const boxProperty = (box, property, side) => ['borderWidth', 'borderColor', 'radius', 'padding', 'paddingX', 'paddingY'].includes(property)
    ? boxStyle.value(box, property, side) : box[property];
  const styleSections = ['border', 'padding'];
  const styleTarget = () => model.activePropertySection === 'padding' ? model.paddingTarget : model.borderTarget;
  const styleTargets = () => model.activePropertySection === 'padding' ? boxStyle.targets.filter(target => !target.corner) : boxStyle.targets;
  const styleEditing = () => model.inspectorOpen && model.inspectorKind === 'box' && styleSections.includes(model.activePropertySection)
    && model.inspectorView !== 'sections' && !model.textEditor && !model.placement && !model.fileLocked;
  const styleOf = box => ({
    fill: box.fill, textColor: box.textColor, borderColor: box.borderColor,
    borderWidth: box.borderWidth, radius: box.radius, opacity: box.opacity ?? 1,
    paddingX: paddingX(box), paddingY: paddingY(box), alignX: box.alignX, alignY: box.alignY,
    fontFamily: fonts.familyOf(box), fontSize: fonts.sizeOf(box),
    fontWeight: fonts.weightOf(box), fontStyle: fonts.styleOf(box),
    ...boxStyle.copy(box),
  });
  function rememberStyle(box) { model.project.lastStyle = styleOf(box); }
  function selectOnly(id) {
    const next = MockoutSelection.selectOnly({ selectedId: model.selectedId, selectedIds: model.selectedIds, isolatedCopyIds: model.isolatedCopyIds, inspectorOpen: model.inspectorOpen }, id);
    model.selectedId = next.selectedId;
    model.selectedIds = next.selectedIds;
    model.isolatedCopyIds = next.isolatedCopyIds;
    model.inspectorOpen = next.inspectorOpen;
  }
  const inspectedBox = () => MockoutSelection.inspectedBox(model.project.boxes,
    { selectedId: model.selectedId, selectedIds: model.selectedIds, inspectorOpen: model.inspectorOpen, inspectorKind: model.inspectorKind });
  const swatch = id => model.project.swatches.find(s => s.id === id);
  const activeTheme = () => document.documentElement.dataset.uiTheme || 'light';
  const resolvedColor = (color, dark) => MockoutProject.resolveColor(color, dark, activeTheme());
  const draftColor = () => {
    const light = model.inspectorView === 'picker' && model.editorSide === 'light' ? model.editorColor : model.editorLight.color;
    const dark = model.inspectorView === 'picker' && model.editorSide === 'dark'
      ? { ...model.editorDark, color: model.editorColor }
      : model.editorDark;
    return resolvedColor(light, dark);
  };
  const colorOf = id => {
    if (!id) return 'transparent';
    if (model.inspectorOpen && ['edit', 'picker'].includes(model.inspectorView) && model.colorTarget?.editId === id) return draftColor();
    const preview = model.inspectorOpen && model.inspectorView === 'box-color' ? actions.boxColorPicker.preview(id, activeTheme()) : null;
    if (preview) return preview;
    const palette = model.project.palettes?.find(item => item.colors.includes(id));
    return palette?.dark ? MockoutColors.toHex(MockoutColors.paletteValue(palette, palette.colors.indexOf(id), activeTheme()))
      : resolvedColor(MockoutColors.hexFor(model.project.swatches, id, model.project.palettes), swatch(id).dark);
  };
  function canvasColor(property) {
    if (model.inspectorOpen && ['edit', 'picker'].includes(model.inspectorView) && model.colorTarget?.direct
      && model.colorTarget.property === property) return draftColor();
    return resolvedColor(model.project.canvasColors[property], model.project.canvasDark?.[property]);
  }
  function boxColor(box, property, side) {
    const value = boxProperty(box, property, side);
    if (model.inspectorOpen && ['edit', 'picker'].includes(model.inspectorView) && model.colorTarget) {
      if (model.colorTarget.editId && value === model.colorTarget.editId) return draftColor();
      if (model.inspectorKind === 'box' && !model.colorTarget.editId && model.selectedIds.has(box.id)
        && property === model.colorTarget.property && (model.colorTarget.side === undefined || side === model.colorTarget.side)) return draftColor();
    }
    return colorOf(value);
  }
  const snap = n => MockoutPlacement.snap(n, model.project.grid);
  const minimum = () => 1;

  return {
    actions: {
      STORAGE_KEY, initialStyle, boxStyle, fonts, freshState, validProject, snapshot, selectedBox,
      selectedBoxes, propertySectionIndex, boxProperty, styleSections, styleTarget, styleTargets,
      styleEditing, styleOf, rememberStyle, selectOnly, inspectedBox, swatch, activeTheme, colorOf,
      canvasColor, boxColor, snap, minimum
    },
    init() {
    },
  };
}
