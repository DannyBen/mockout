import BoxStyle from './box-style.js';

const MockoutColors = (() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = hue => ((hue % 360) + 360) % 360;
  const axes = ['l', 'c', 'h'];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const channels = value => object(value) && axes.every(axis => Number.isFinite(value[axis]));

  function contrastingText(...backgrounds) {
    const luminances = backgrounds.map(hex => {
      const color = hex.length === 4 ? '#' + [...hex.slice(1)].map(value => value + value).join('') : hex;
      return [1, 3, 5].reduce((sum, offset, index) => {
        const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
        const linear = value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        return sum + linear * [.2126, .7152, .0722][index];
      }, 0);
    });
    const black = Math.min(...luminances.map(value => (value + .05) / .05));
    const white = Math.min(...luminances.map(value => 1.05 / (value + .05)));
    return black >= white ? '#000000' : '#ffffff';
  }

  // Oklab matrices: https://bottosson.github.io/posts/oklab/
  function fromHex(hex) {
    const [r, g, b] = [1, 3, 5].map(index => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
    const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
    const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s;
    const blue = .0259040371 * l + .7827717662 * m - .808675766 * s;
    const c = Math.hypot(a, blue);
    return { l: clamp((.2104542553 * l + .793617785 * m - .0040720468 * s) * 100, 0, 100),
      c: c < 1e-7 ? 0 : c, h: c < 1e-7 ? 0 : wrap(Math.atan2(blue, a) * 180 / Math.PI) };
  }

  function linearRGB({ l, c, h }) {
    const angle = h * Math.PI / 180, a = c * Math.cos(angle), b = c * Math.sin(angle), L = l / 100;
    const x = (L + .3963377774 * a + .2158037573 * b) ** 3;
    const y = (L - .1055613458 * a - .0638541728 * b) ** 3;
    const z = (L - .0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * x - 3.3077115913 * y + .2309699292 * z,
      -1.2684380046 * x + 2.6097574011 * y - .3413193965 * z,
      -.0041960863 * x - .7034186147 * y + 1.707614701 * z];
  }

  const inGamut = rgb => rgb.every(channel => channel >= -1e-7 && channel <= 1 + 1e-7);
  function maxChroma(l, h, ceiling = .4) {
    let low = 0, high = ceiling;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(linearRGB({ l, c: mid, h }))) low = mid;
      else high = mid;
    }
    return low;
  }

  function toHex(value) {
    const color = { l: clamp(value.l, 0, 100), c: Math.max(0, value.c), h: wrap(value.h) };
    let rgb = linearRGB(color);
    if (!inGamut(rgb)) rgb = linearRGB({ ...color, c: maxChroma(color.l, color.h, color.c) });
    return '#' + rgb.map(channel => {
      const value = clamp(channel, 0, 1);
      return Math.round(255 * (value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055))
        .toString(16).padStart(2, '0');
    }).join('');
  }

  const baseValue = color => color.oklch ?? fromHex(color.color);
  const relativeValue = (base, offset) => Object.fromEntries(axes.map(axis => [axis, baseValue(base)[axis] + offset[axis]]));
  function paletteRecipe(palette, theme = 'light') {
    if (theme !== 'dark') return palette;
    if (palette.dark?.mode === 'inverse') return { ...palette,
      base: { ...palette.base, l: 100 - palette.base.l }, step: { ...palette.step, l: -palette.step.l } };
    return palette.dark?.mode === 'custom' ? { ...palette, base: palette.dark.base, step: palette.dark.step } : palette;
  }
  const paletteValue = (palette, index, theme = 'light') => {
    const recipe = paletteRecipe(palette, theme);
    return Object.fromEntries(axes.map(axis => [axis, recipe.base[axis] + index * recipe.step[axis]]));
  };
  function stepLimits(palette, axis) {
    const intervals = palette.count - 1;
    let min, max;
    if (axis === 'l') {
      min = -palette.base.l / intervals;
      max = (100 - palette.base.l) / intervals;
    } else if (axis === 'c') {
      const end = paletteValue(palette, intervals);
      const lightness = end.l > 1 && end.l < 99 ? end.l : 60;
      min = -palette.base.c / intervals;
      max = (maxChroma(lightness, end.h) - palette.base.c) / intervals;
    } else {
      min = -360 / palette.count;
      max = 360 / palette.count;
    }
    // Align range endpoints with the numeric fields' increments.
    const increment = axis === 'c' ? .001 : .1;
    const lower = Number((Math.ceil((min - 1e-9) / increment) * increment).toFixed(3));
    const upper = Number((Math.floor((max + 1e-9) / increment) * increment).toFixed(3));
    return lower <= upper ? [lower, upper] : [lower, lower];
  }
  const hexFor = (colors, id, palettes = []) => {
    const color = colors.find(item => item.id === id);
    if (!color) return null;
    const palette = palettes.find(item => item.colors.includes(id));
    if (palette) return toHex(paletteValue(palette, palette.colors.indexOf(id)));
    return color.relative ? toHex(relativeValue(colors.find(item => item.id === color.relative.base), color.relative))
      : color.oklch ? toHex(color.oklch) : color.color;
  };

  const validBase = value => channels(value) && value.l >= 0 && value.l <= 100
    && value.c >= 0 && value.c <= .4 && value.h >= 0 && value.h <= 360;
  const validStep = value => channels(value) && Math.abs(value.l) <= 100
    && Math.abs(value.c) <= .4 && Math.abs(value.h) <= 360;
  const validDarkRecipe = dark => dark === undefined || (object(dark) && ['inverse', 'same', 'custom'].includes(dark.mode)
    && ((dark.mode !== 'custom' && dark.base === undefined && dark.step === undefined)
      || (validBase(dark.base) && validStep(dark.step))));
  const validRecipe = palette => object(palette) && typeof palette.name === 'string' && palette.name.trim() !== ''
    && [3, 6, 9].includes(palette.count) && validBase(palette.base) && validStep(palette.step) && validDarkRecipe(palette.dark);

  function valid(colors, palettes = []) {
    if (!colors.every(color => {
      if (color.oklch !== undefined && (!channels(color.oklch) || color.relative !== undefined
        || color.oklch.l < 0 || color.oklch.l > 100 || color.oklch.c < 0 || color.oklch.c > .4
        || color.oklch.h < 0 || color.oklch.h > 360)) return false;
      if (color.relative === undefined) return true;
      const offset = color.relative;
      const base = colors.find(item => item.id === offset?.base);
      return channels(offset) && Math.abs(offset.l) <= 100 && Math.abs(offset.c) <= .4 && Math.abs(offset.h) <= 360
        && typeof offset.base === 'string' && base !== undefined && base !== color && base.relative === undefined;
    })) return false;
    if (!Array.isArray(palettes)) return false;
    const ids = new Set(), slots = new Set();
    return palettes.every(palette => {
      if (!validRecipe(palette) || typeof palette.id !== 'string' || ids.has(palette.id)
        || !Array.isArray(palette.colors) || palette.colors.length !== palette.count) return false;
      ids.add(palette.id);
      return palette.colors.every(id => {
        const color = colors.find(item => item.id === id);
        if (!color || color.oklch !== undefined || color.relative !== undefined || slots.has(id)) return false;
        slots.add(id);
        return true;
      });
    });
  }

  function usedColors(state) {
    const used = new Set();
    for (const box of [...state.boxes, state.lastStyle].filter(Boolean)) {
      for (const id of [box.fill, box.textColor, box.borderColor, ...(box.borderColors ?? [])]) used.add(id);
    }
    for (const color of state.swatches) if (color.relative) used.add(color.relative.base);
    return used;
  }

  const isUnassigned = (state, id) => state.swatches.some(color => color.id === id)
    && !(state.palettes ?? []).some(palette => palette.colors.includes(id));

  function retainedSwatches(state, palette, removed) {
    if (!removed.length) return state.swatches;
    const used = usedColors(state);
    return state.swatches.filter(color => !removed.includes(color.id) || used.has(color.id)).map(color => {
      if (!removed.includes(color.id)) return color;
      const index = palette.colors.indexOf(color.id);
      return { ...color, color: toHex(paletteValue(palette, index)), ...(palette.dark ? {
        dark: { mode: 'custom', color: toHex(paletteValue(palette, index, 'dark')), colorMode: 'rgb' },
      } : {}) };
    });
  }

  function replaceColor(state, id, replacement) {
    if (!isUnassigned(state, id)) throw Error('This color is not unassigned.');
    if (replacement !== null && !state.swatches.some(color => color.id === replacement)) throw Error('This color no longer exists.');
    if (id === replacement) return;
    for (const box of [...state.boxes, state.lastStyle].filter(Boolean)) BoxStyle.replaceColor(box, id, replacement);
    // Older relative colors may still need this swatch as their base.
    if (!usedColors(state).has(id)) state.swatches = state.swatches.filter(color => color.id !== id);
  }

  function deletePalette(state, id) {
    const palette = state.palettes?.find(item => item.id === id);
    if (!palette) throw Error('This palette no longer exists.');
    state.swatches = retainedSwatches(state, palette, palette.colors);
    state.palettes = state.palettes.filter(item => item.id !== id);
  }

  function savePalette(state, draft) {
    if (!validRecipe(draft)) throw Error('Enter a palette name and valid LCH values.');
    const existing = state.palettes?.find(item => item.id === draft.id);
    if (draft.id && !existing) throw Error('This palette no longer exists.');
    let nextId = state.nextId;
    const allocate = prefix => {
      let id;
      do { id = `${prefix}${nextId++}`; } while (state.swatches.some(color => color.id === id)
        || state.palettes?.some(palette => palette.id === id));
      return id;
    };
    const palette = { id: existing?.id ?? allocate('p'), name: draft.name.trim(), count: draft.count,
      base: { ...draft.base }, step: { ...draft.step }, colors: existing?.colors.slice(0, draft.count) ?? [] };
    const dark = draft.dark ?? existing?.dark ?? (existing ? undefined : { mode: 'inverse' });
    if (dark) {
      palette.dark = { mode: dark.mode };
      if (dark.base) Object.assign(palette.dark, { base: { ...dark.base }, step: { ...dark.step } });
    }
    while (palette.colors.length < palette.count) palette.colors.push(allocate('s'));
    const removed = existing?.colors.slice(draft.count) ?? [];
    const swatches = retainedSwatches(state, existing, removed).map(color => ({ ...color }));
    palette.colors.forEach((id, index) => {
      let color = swatches.find(item => item.id === id);
      if (!color) { color = { id }; swatches.push(color); }
      Object.assign(color, { name: `${palette.name} ${index + 1}`, color: toHex(paletteValue(palette, index)), mode: 'rgb' });
      if (palette.dark && palette.dark.mode !== 'same') {
        color.dark = { mode: 'custom', color: toHex(paletteValue(palette, index, 'dark')), colorMode: 'rgb' };
      } else if (palette.dark || !color.dark) color.dark = { mode: 'same' };
    });
    state.swatches = swatches;
    state.palettes = existing ? state.palettes.map(item => item.id === palette.id ? palette : item)
      : [...(state.palettes ?? []), palette];
    state.nextId = nextId;
    return palette.id;
  }

  return { fromHex, toHex, maxChroma, contrastingText, baseValue, relativeValue, hexFor, paletteRecipe, paletteValue, stepLimits, valid, isUnassigned, replaceColor, deletePalette, savePalette };
})();

export default MockoutColors;
