const MinimockProject = (() => {
  const defaultCanvasColors = { background: '#ffffff', gridMajor: '#f1f1f1', gridMinor: '#f1f1f1' };

  const makeInitialStyle = swatches => ({
    fill: swatches[0]?.id ?? null,
    textColor: swatches[1]?.id ?? swatches[0]?.id ?? null,
    borderColor: swatches[2]?.id ?? swatches[0]?.id ?? null,
    borderWidth: 1, radius: 0, paddingX: 3, paddingY: 0,
    alignX: 'center', alignY: 'center',
  });

  return {
    storageKey: 'minimock-project',
    initialStyle: makeInitialStyle,

    freshState() {
      const swatches = [
        { id: 's1', name: 'White', color: '#ffffff' },
        { id: 's2', name: 'Ink', color: '#253047' },
        { id: 's3', name: 'Line', color: '#aeb6c5' },
      ];
      return {
        version: 1, grid: 10, nextId: 4, swatches, boxes: [], lastStyle: makeInitialStyle(swatches),
        canvasColors: { ...defaultCanvasColors },
      };
    },

    clearBoard(state) { return { ...state, boxes: [] }; },

    reset(storage, key) {
      storage.removeItem(key);
      return this.freshState();
    },

    validStyle(style, swatches) {
      return style && ['fill', 'textColor', 'borderColor'].every(key =>
        style[key] === null || swatches.some(item => item.id === style[key]))
        && ['borderWidth', 'radius', 'paddingX', 'paddingY'].every(key => Number.isFinite(style[key]) && style[key] >= 0)
        && ['left', 'center', 'right'].includes(style.alignX)
        && ['top', 'center', 'bottom'].includes(style.alignY);
    },

    validProject(value) {
      return value && value.version === 1 && [0, 5, 10, 20, 40].includes(value.grid)
        && Number.isInteger(value.nextId) && Array.isArray(value.swatches) && Array.isArray(value.boxes)
        && value.swatches.every(s => typeof s.id === 'string' && typeof s.name === 'string' && /^#[0-9a-f]{6}$/i.test(s.color))
        && (value.lastStyle === undefined || this.validStyle(value.lastStyle, value.swatches))
        && value.canvasColors && ['background', 'gridMajor', 'gridMinor'].every(key =>
          /^#[0-9a-f]{6}$/i.test(value.canvasColors[key]))
        && value.boxes.every(b => Number.isInteger(b.id) && ['x', 'y', 'w', 'h', 'radius', 'borderWidth'].every(k => Number.isFinite(b[k]))
          && b.w > 0 && b.h > 0 && typeof b.text === 'string'
          && ['paddingX', 'paddingY'].every(k => b[k] === undefined || (Number.isFinite(b[k]) && b[k] >= 0))
          && ['fill', 'textColor', 'borderColor'].every(k => b[k] === null || value.swatches.some(s => s.id === b[k]))
          && ['left', 'center', 'right'].includes(b.alignX) && ['top', 'center', 'bottom'].includes(b.alignY));
    },

    persist(storage, key, state, issue) {
      if (issue) return;
      storage.setItem(key, JSON.stringify(state));
    },
  };
})();

if (typeof module !== 'undefined') module.exports = MinimockProject;
