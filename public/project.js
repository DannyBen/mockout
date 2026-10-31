const MockoutProject = (() => {
  const fonts = typeof module !== 'undefined' ? require('./fonts.js') : MockoutFonts;
  const defaultCanvasColors = { background: '#ffffff', gridMajor: '#d0d0d0', gridMinor: '#e8e8e8' };
  const colorModeValues = ['hsb', 'rgb', 'gray'];
  const hexColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const validDark = dark => dark === undefined || (dark && typeof dark === 'object' && !Array.isArray(dark)
    && ['invert', 'same', 'custom'].includes(dark.mode)
    && (dark.color == null || hexColor(dark.color))
    && (dark.colorMode === undefined || colorModeValues.includes(dark.colorMode))
    && (dark.mode !== 'custom' || hexColor(dark.color)));

  const makeInitialStyle = swatches => ({
    fill: swatches[0]?.id ?? null,
    textColor: swatches[1]?.id ?? swatches[0]?.id ?? null,
    borderColor: swatches[2]?.id ?? swatches[0]?.id ?? null,
    borderWidth: 1, radius: 0, paddingX: 3, paddingY: 0, opacity: 1,
    alignX: 'center', alignY: 'center',
    fontFamily: '', fontSize: 13, fontWeight: 400, fontStyle: 'normal',
  });

  const validFont = item => (item.fontFamily === undefined || fonts.validFamily(item.fontFamily))
    && (item.fontSize === undefined || (Number.isFinite(item.fontSize) && item.fontSize > 0))
    && (item.fontWeight === undefined || (Number.isInteger(item.fontWeight)
      && item.fontWeight >= 100 && item.fontWeight <= 900 && item.fontWeight % 100 === 0))
    && (item.fontStyle === undefined || ['normal', 'italic'].includes(item.fontStyle));
  const validOpacity = item => item.opacity === undefined
    || (Number.isFinite(item.opacity) && item.opacity >= 0 && item.opacity <= 1);
  const gridSizes = state => [8, 4, 2, 1, 0].map(multiplier => multiplier * (state.gridBase ?? 5));
  const validGridSetting = value => value === undefined
    || (Number.isInteger(value) && value >= 2 && value <= 100);

  return {
    storageKey: 'mockout-project',
    initialStyle: makeInitialStyle,
    gridSizes,

    invertColor(color) {
      return '#' + [1, 3, 5].map(index => (255 - parseInt(color.slice(index, index + 2), 16))
        .toString(16).padStart(2, '0')).join('');
    },

    resolveColor(color, dark, theme) {
      if (theme !== 'dark') return color;
      if (dark?.mode === 'same') return color;
      if (dark?.mode === 'custom') return dark.color;
      return this.invertColor(color);
    },

    withPickerColor(light, dark, side, color, colorMode) {
      return side === 'light'
        ? { light: { color, mode: colorMode }, dark: { ...dark } }
        : { light: { ...light }, dark: { ...dark, mode: 'custom', color, colorMode } };
    },

    suggestedFileName(date = new Date()) {
      const pad = value => String(value).padStart(2, '0');
      const stamp = `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
        + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
      return `mockout-${stamp}.json`;
    },

    freshState() {
      const swatches = [
        { id: 's1', name: 'White', color: '#ffffff', mode: 'hsb' },
        { id: 's2', name: 'Ink', color: '#253047', mode: 'hsb' },
        { id: 's3', name: 'Line', color: '#aeb6c5', mode: 'hsb' },
      ];
      return {
        version: 1, grid: 10, gridBase: 5, gridDivisions: 10,
        nextId: 4, swatches, boxes: [], lastStyle: makeInitialStyle(swatches),
        canvasColors: { ...defaultCanvasColors },
        canvasColorModes: { background: 'gray', gridMajor: 'gray', gridMinor: 'gray' },
      };
    },

    topLeft(boxes) {
      if (!boxes.length) return null;
      let x = Infinity;
      let y = Infinity;
      for (const box of boxes) {
        x = Math.min(x, box.x);
        y = Math.min(y, box.y);
      }
      return { x, y };
    },

    forExport(state) {
      const origin = this.topLeft(state.boxes);
      if (!origin) return state;
      return { ...state, boxes: state.boxes.map(box => ({
        ...box, x: box.x - origin.x, y: box.y - origin.y,
      })) };
    },

    reset(storage, key) {
      storage.removeItem(key);
      return this.freshState();
    },

    validStyle(style, swatches) {
      return style && ['fill', 'textColor', 'borderColor'].every(key =>
        style[key] === null || swatches.some(item => item.id === style[key]))
        && ['borderWidth', 'radius', 'paddingX', 'paddingY'].every(key => Number.isFinite(style[key]) && style[key] >= 0)
        && ['left', 'center', 'right'].includes(style.alignX)
        && ['top', 'center', 'bottom'].includes(style.alignY)
        && validFont(style) && validOpacity(style);
    },

    validProject(value) {
      return value && value.version === 1
        && validGridSetting(value.gridBase) && validGridSetting(value.gridDivisions)
        && gridSizes(value).includes(value.grid)
        && Number.isInteger(value.nextId) && Array.isArray(value.swatches) && Array.isArray(value.boxes)
        && value.swatches.every(s => typeof s.id === 'string' && typeof s.name === 'string'
          && hexColor(s.color) && (s.mode === undefined || colorModeValues.includes(s.mode)) && validDark(s.dark))
        && (value.lastStyle === undefined || this.validStyle(value.lastStyle, value.swatches))
        && value.canvasColors && ['background', 'gridMajor', 'gridMinor'].every(key =>
          hexColor(value.canvasColors[key]))
        && (value.canvasDark === undefined || (value.canvasDark && typeof value.canvasDark === 'object'
          && !Array.isArray(value.canvasDark) && ['background', 'gridMajor', 'gridMinor'].every(key =>
            validDark(value.canvasDark[key]))))
        && (value.canvasColorModes === undefined || (value.canvasColorModes
          && typeof value.canvasColorModes === 'object'
          && !Array.isArray(value.canvasColorModes)
          && ['background', 'gridMajor', 'gridMinor'].every(key =>
            value.canvasColorModes[key] === undefined || colorModeValues.includes(value.canvasColorModes[key]))))
        && value.boxes.every(b => Number.isInteger(b.id) && ['x', 'y', 'w', 'h', 'radius', 'borderWidth'].every(k => Number.isFinite(b[k]))
          && b.w > 0 && b.h > 0 && typeof b.text === 'string'
          && ['paddingX', 'paddingY'].every(k => b[k] === undefined || (Number.isFinite(b[k]) && b[k] >= 0))
          && ['fill', 'textColor', 'borderColor'].every(k => b[k] === null || value.swatches.some(s => s.id === b[k]))
          && ['left', 'center', 'right'].includes(b.alignX) && ['top', 'center', 'bottom'].includes(b.alignY)
          && validFont(b) && validOpacity(b));
    },

    persist(storage, key, state, issue) {
      if (issue) return;
      storage.setItem(key, JSON.stringify(state));
    },
  };
})();

if (typeof module !== 'undefined') module.exports = MockoutProject;
