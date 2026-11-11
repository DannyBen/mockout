const test = require('node:test');
const assert = require('node:assert/strict');
const colors = require('../src/core/colors.js').default;
const project = require('../src/core/project.js').default;

const recipe = (count = 6) => ({ name: 'Surface', count, base: { l: 65, c: .14, h: 250 }, step: { l: -8, c: .01, h: 25 } });
const emptyState = () => ({ ...project.freshState(), swatches: [], palettes: [], lastStyle: project.initialStyle([]) });

test('color-block text chooses the higher contrast black or white, including patterned backgrounds', () => {
  for (const hex of ['#ffffff', '#ff0000', '#00ff00', '#ffff00', '#00ffff', '#767676']) {
    assert.equal(colors.contrastingText(hex), '#000000');
  }
  for (const hex of ['#000000', '#0000ff', '#13191f', '#757575']) {
    assert.equal(colors.contrastingText(hex), '#ffffff');
  }
  assert.equal(colors.contrastingText('#fff', '#e7e7e7'), '#000000');
  assert.equal(colors.contrastingText('#000'), '#ffffff');
  assert.equal(colors.contrastingText('#202735', '#4a5567'), '#ffffff');
});

test('OKLCH conversion matches reference colors and round-trips sRGB including neutrals', () => {
  const red = colors.fromHex('#ff0000');
  assert.ok(Math.abs(red.l - 62.7955) < .001);
  assert.ok(Math.abs(red.c - .257683) < .00001);
  assert.ok(Math.abs(red.h - 29.2339) < .001);
  assert.equal(colors.toHex({ l: 65, c: .14, h: 250 }), '#4393e1');
  for (const r of [0, 64, 128, 192, 255]) {
    for (const g of [0, 64, 128, 192, 255]) {
      for (const b of [0, 64, 128, 192, 255]) {
        const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
        assert.equal(colors.toHex(colors.fromHex(hex)), hex);
      }
    }
  }
  assert.equal(colors.fromHex('#ffffff').c, 0);
  assert.equal(colors.fromHex('#000000').h, 0);
});

test('gamut mapping preserves requested coordinates and wraps relative hue', () => {
  const requested = { l: 90, c: .4, h: -30 };
  const before = { ...requested };
  assert.match(colors.toHex(requested), /^#[\da-f]{6}$/);
  assert.deepEqual(requested, before);
  assert.equal(colors.toHex(requested), colors.toHex({ ...requested, h: 330 }));
  assert.equal(colors.toHex({ l: 200, c: .4, h: 20 }), '#ffffff');
  assert.equal(colors.toHex({ l: -20, c: .4, h: 20 }), '#000000');
});

test('lightness steps use the full remaining lightness range across the color count', () => {
  const palette = { ...recipe(), base: { l: 100, c: .068, h: 65.5 } };
  assert.deepEqual(colors.stepLimits(palette, 'l'), [-20, 0]);
  assert.deepEqual(colors.stepLimits({ ...palette, count: 3 }, 'l'), [-50, 0]);
  assert.deepEqual(colors.stepLimits({ ...palette, count: 9 }, 'l'), [-12.5, 0]);
  assert.deepEqual(colors.stepLimits({ ...palette, base: { ...palette.base, l: 0 } }, 'l'), [0, 20]);
  for (const count of [3, 6, 9]) {
    for (const l of [0, 17.4, 50, 83.9, 100]) {
      const current = { ...palette, count, base: { ...palette.base, l } };
      for (const step of colors.stepLimits(current, 'l')) {
        const last = colors.paletteValue({ ...current, step: { ...current.step, l: step } }, count - 1).l;
        assert.ok(last >= -1e-9 && last <= 100 + 1e-9);
      }
    }
  }
});

test('chroma and hue step ranges stay useful for the whole palette', () => {
  const palette = { ...recipe(), base: { l: 100, c: .068, h: 65.5 }, step: { l: -8, c: 0, h: 0 } };
  const [min, max] = colors.stepLimits(palette, 'c');
  assert.equal(min, -.013);
  assert.ok(max > 0 && max < .02);
  const samples = Array.from({ length: 25 }, (_, i) => colors.toHex(colors.paletteValue({ ...palette,
    step: { ...palette.step, c: min + (max - min) * i / 24 } }, 5)));
  assert.ok(new Set(samples).size >= 20);
  assert.deepEqual(colors.stepLimits(palette, 'h'), [-60, 60]);
  assert.deepEqual(colors.stepLimits({ ...palette, count: 9 }, 'h'), [-40, 40]);
  const before = JSON.stringify(palette);
  for (const axis of ['l', 'c', 'h']) colors.stepLimits(palette, axis);
  assert.equal(JSON.stringify(palette), before);
});

test('palette recipes generate all slots and survive version-1 save/load', () => {
  const state = project.freshState();
  const id = colors.savePalette(state, recipe());
  const palette = state.palettes.find(item => item.id === id);
  assert.equal(palette.colors.length, 6);
  assert.deepEqual(colors.paletteValue(palette, 5), { l: 25, c: .19, h: 375 });
  for (const [i, slot] of palette.colors.entries()) {
    assert.equal(colors.hexFor(state.swatches, slot, state.palettes), colors.toHex(colors.paletteValue(palette, i)));
    assert.equal(state.swatches.find(color => color.id === slot).name, `Surface ${i + 1}`);
  }
  const loaded = JSON.parse(JSON.stringify(project.forExport(state)));
  assert.equal(loaded.version, 1);
  assert.equal(project.validProject(loaded), true);
  assert.deepEqual(loaded.palettes, state.palettes);
});

test('custom dark recipes save independently with stable shared slots in version 1', () => {
  const state = project.freshState(), palette = state.palettes[0];
  const before = structuredClone(palette);
  const dark = { mode: 'custom', base: { l: 20, c: .02, h: 260 }, step: { l: 8, c: 0, h: 0 } };
  colors.savePalette(state, { ...palette, dark });
  const saved = state.palettes[0];
  assert.deepEqual(saved.colors, before.colors);
  assert.deepEqual(saved.base, before.base);
  assert.deepEqual(colors.paletteValue(saved, 5, 'dark'), { l: 60, c: .02, h: 260 });
  for (const [index, id] of saved.colors.entries()) {
    const swatch = state.swatches.find(color => color.id === id);
    assert.equal(swatch.color, colors.toHex(colors.paletteValue(saved, index)));
    assert.equal(swatch.dark.color, colors.toHex(colors.paletteValue(saved, index, 'dark')));
  }
  const loaded = JSON.parse(JSON.stringify(state));
  assert.equal(loaded.version, 1);
  assert.equal(project.validProject(loaded), true);
  assert.deepEqual(loaded.palettes[0].dark, dark);
  dark.base.l = 99;
  assert.equal(saved.dark.base.l, 20);
  colors.savePalette(state, { ...recipe(), id: saved.id });
  assert.equal(state.palettes[0].dark.base.l, 20);
});

test('Same retains a custom recipe for later while using the light colors', () => {
  const state = project.freshState(), palette = state.palettes[0];
  const dark = { mode: 'same', base: { l: 20, c: .02, h: 260 }, step: { l: 8, c: 0, h: 0 } };
  colors.savePalette(state, { ...palette, dark });
  const saved = state.palettes[0];
  assert.deepEqual(colors.paletteValue(saved, 2, 'dark'), colors.paletteValue(saved, 2));
  assert.deepEqual(saved.dark, dark);
  assert.ok(saved.colors.every(id => state.swatches.find(color => color.id === id).dark.mode === 'same'));
  assert.equal(project.validProject(state), true);
});

test('palette saves preserve older per-swatch dark overrides when no palette policy is provided', () => {
  const state = project.freshState(), palette = state.palettes[0];
  delete palette.dark;
  const swatch = state.swatches.find(color => color.id === palette.colors[0]);
  swatch.dark = { mode: 'custom', color: '#123456', colorMode: 'rgb' };
  colors.savePalette(state, { ...palette, name: 'Renamed' });
  assert.deepEqual(state.swatches.find(color => color.id === swatch.id).dark, swatch.dark);
  assert.equal(state.palettes[0].dark, undefined);
  assert.equal(project.validProject(state), true);
});

test('new palettes default to lightness inversion without changing chroma or hue', () => {
  const state = project.freshState();
  for (const palette of state.palettes) {
    assert.deepEqual(palette.dark, { mode: 'inverse' });
    for (const [index, id] of palette.colors.entries()) {
      const light = colors.paletteValue(palette, index), dark = colors.paletteValue(palette, index, 'dark');
      assert.ok(Math.abs(dark.l - (100 - light.l)) < 1e-9);
      assert.equal(dark.c, light.c);
      assert.equal(dark.h, light.h);
      assert.equal(state.swatches.find(color => color.id === id).dark.color, colors.toHex(dark));
    }
  }
  const palette = state.palettes[0], before = structuredClone(palette);
  const inverted = colors.paletteRecipe(palette, 'dark');
  inverted.base.l = 99;
  assert.deepEqual(palette, before);
  assert.equal(project.validProject(JSON.parse(JSON.stringify(state))), true);
});

test('Inverse follows light edits while preserving an inactive custom recipe', () => {
  const state = project.freshState(), palette = state.palettes[0];
  const dark = { mode: 'inverse', base: { l: 35, c: .12, h: 20 }, step: { l: 1, c: 0, h: 0 } };
  colors.savePalette(state, { ...palette, base: { l: 80, c: .03, h: 250 }, step: { l: -5, c: .001, h: 2 }, dark });
  const saved = state.palettes[0];
  assert.deepEqual(colors.paletteValue(saved, 2, 'dark'), { l: 30, c: .032, h: 254 });
  assert.deepEqual(saved.dark, dark);
  const old = structuredClone(state);
  delete old.palettes[0].dark;
  old.swatches.filter(color => old.palettes[0].colors.includes(color.id)).forEach(color => { color.dark = { mode: 'same' }; });
  const original = JSON.stringify(old);
  assert.equal(project.validProject(old), true);
  assert.equal(JSON.stringify(old), original);
  colors.savePalette(old, { ...old.palettes[0], name: 'Renamed' });
  assert.equal(old.palettes[0].dark, undefined);
  assert.ok(old.swatches.filter(color => old.palettes[0].colors.includes(color.id)).every(color => color.dark.mode === 'same'));
});

test('invalid dark recipes reject saving without modifying project data', () => {
  const state = project.freshState(), palette = state.palettes[0];
  for (const dark of [null, {}, { mode: 'custom' },
    { mode: 'auto', base: palette.base, step: palette.step },
    { mode: 'custom', base: { ...palette.base, l: 101 }, step: palette.step },
    { mode: 'same', base: palette.base, step: { l: 0, c: .5, h: 0 } }]) {
    const invalid = { ...palette, dark }, before = JSON.stringify(state);
    assert.throws(() => colors.savePalette(state, invalid));
    assert.equal(JSON.stringify(state), before);
    assert.equal(project.validProject({ ...state, palettes: [invalid, state.palettes[1]] }), false);
  }
});

test('editing and extending a palette preserves existing slot IDs and other palettes', () => {
  const state = emptyState();
  const id = colors.savePalette(state, recipe(3));
  const original = structuredClone(state.palettes[0]);
  colors.savePalette(state, { ...recipe(3), name: 'Accent' });
  const second = structuredClone(state.palettes[1]);
  const draft = { ...original, count: 9, name: 'Renamed', base: { l: 40, c: .08, h: 100 } };
  assert.equal(colors.savePalette(state, draft), id);
  assert.equal(state.palettes[0].colors.length, 9);
  assert.deepEqual(state.palettes[0].colors.slice(0, 3), original.colors);
  assert.deepEqual(state.palettes[1], second);
  const count = state.swatches.length, nextId = state.nextId;
  colors.savePalette(state, structuredClone(state.palettes[0]));
  assert.equal(state.swatches.length, count);
  assert.equal(state.nextId, nextId);
  assert.equal(project.validProject(state), true);
});

test('reducing a palette detaches used slots, preserves both themes and removes unused slots', () => {
  const state = emptyState();
  colors.savePalette(state, recipe(9));
  const palette = state.palettes[0];
  state.boxes = [{ id: 101, x: 0, y: 0, w: 100, h: 100, text: '',
    ...project.initialStyle(state.swatches), fill: palette.colors[8], borderColors: [null, palette.colors[5], null, null] }];
  state.lastStyle.fill = palette.colors[4];
  colors.savePalette(state, { ...palette, count: 6 });
  assert.equal(state.palettes[0].colors.length, 6);
  assert.equal(colors.isUnassigned(state, palette.colors[8]), true);
  assert.equal(state.swatches.some(color => color.id === palette.colors[7]), false);
  colors.savePalette(state, { ...state.palettes[0], count: 3 });
  assert.equal(state.palettes[0].colors.length, 3);
  for (const index of [4, 5, 8]) {
    const swatch = state.swatches.find(color => color.id === palette.colors[index]);
    assert.equal(colors.isUnassigned(state, swatch.id), true);
    assert.equal(swatch.color, colors.toHex(colors.paletteValue(palette, index)));
    assert.equal(project.resolveColor(swatch.color, swatch.dark, 'dark'), colors.toHex(colors.paletteValue(palette, index, 'dark')));
  }
  assert.equal(state.boxes[0].fill, palette.colors[8]);
  assert.equal(state.boxes[0].borderColors[1], palette.colors[5]);
  assert.equal(state.lastStyle.fill, palette.colors[4]);
  assert.equal(project.validProject(state), true);
});

test('legacy swatches remain readable without adding a palette or changing saved colors', () => {
  const state = emptyState();
  delete state.palettes;
  state.swatches = [
    { id: 's1', name: 'White', color: '#ffffff', mode: 'hsb' },
    { id: 's2', name: 'Ink', color: '#253047', mode: 'hsb' },
    { id: 's3', name: 'Line', color: '#aeb6c5', mode: 'hsb' },
  ];
  state.lastStyle = project.initialStyle(state.swatches);
  const before = JSON.stringify(state);
  assert.equal(project.validProject(state), true);
  for (const color of state.swatches) assert.equal(colors.hexFor(state.swatches, color.id), color.color);
  assert.equal(state.palettes, undefined);
  assert.equal(JSON.stringify(state), before);
});

test('deleting an unused palette removes its slots and preserves other palettes and IDs', () => {
  const state = project.freshState();
  const [background, accent] = structuredClone(state.palettes);
  const nextId = state.nextId;
  colors.deletePalette(state, accent.id);
  assert.deepEqual(state.palettes, [background]);
  assert.deepEqual(state.swatches.map(color => color.id), background.colors);
  assert.equal(state.nextId, nextId);
  assert.equal(project.validProject(JSON.parse(JSON.stringify(state))), true);
  colors.savePalette(state, recipe());
  assert.equal(state.swatches.some(color => accent.colors.includes(color.id)), false);
  assert.equal(project.validProject(state), true);
});

test('palette deletion preserves used colors and relative bases, and rejects missing palettes', () => {
  const references = [
    (state, id) => { state.lastStyle.textColor = id; },
    (state, id) => { state.boxes = [{ id: 100, x: 0, y: 0, w: 100, h: 50, text: '',
      ...state.lastStyle, fill: id }]; },
    (state, id) => { state.boxes = [{ id: 100, x: 0, y: 0, w: 100, h: 50, text: '',
      ...state.lastStyle, borderColors: [null, id, null, null] }]; },
    (state, id) => { state.swatches.push({ id: 'relative', name: 'Relative', color: '#ffffff',
      relative: { base: id, l: 0, c: 0, h: 0 } }); },
  ];
  for (const reference of references) {
    const state = project.freshState(), palette = state.palettes[1];
    reference(state, palette.colors[0]);
    colors.deletePalette(state, palette.id);
    assert.equal(state.palettes.some(item => item.id === palette.id), false);
    const swatch = state.swatches.find(color => color.id === palette.colors[0]);
    assert.equal(colors.isUnassigned(state, swatch.id), true);
    assert.equal(swatch.color, colors.toHex(colors.paletteValue(palette, 0)));
    assert.equal(project.resolveColor(swatch.color, swatch.dark, 'dark'), colors.toHex(colors.paletteValue(palette, 0, 'dark')));
    assert.equal(project.validProject(state), true);
  }
  const state = project.freshState(), before = JSON.stringify(state);
  assert.throws(() => colors.deletePalette(state, 'missing'), /no longer exists/);
  assert.equal(JSON.stringify(state), before);
});

test('detaching a palette freezes Same, Inverse and Custom dark appearances', () => {
  for (const dark of [{ mode: 'same' }, { mode: 'inverse' }, { mode: 'custom',
    base: { l: 25, c: .08, h: 15 }, step: { l: 4, c: 0, h: 25 } }]) {
    const state = emptyState();
    colors.savePalette(state, { ...recipe(), dark });
    const palette = state.palettes[0];
    state.lastStyle.fill = palette.colors[3];
    colors.deletePalette(state, palette.id);
    assert.equal(state.palettes.length, 0);
    assert.equal(state.swatches.length, 1);
    const swatch = state.swatches[0];
    assert.equal(swatch.color, colors.toHex(colors.paletteValue(palette, 3)));
    assert.equal(project.resolveColor(swatch.color, swatch.dark, 'dark'), colors.toHex(colors.paletteValue(palette, 3, 'dark')));
    assert.equal(project.validProject(JSON.parse(JSON.stringify(state))), true);
  }
});

test('replacing an unassigned slot repairs shared box and drawing-style references independently', () => {
  const state = project.freshState(), [background, accent] = state.palettes;
  const [fill, other] = background.colors, replacement = accent.colors[0];
  state.boxes = [
    { ...state.lastStyle, id: 100, x: 0, y: 0, w: 100, h: 50, text: '', fill },
    { ...state.lastStyle, id: 101, x: 100, y: 0, w: 100, h: 50, text: '', fill: other,
      textColor: fill, borderColors: [fill, null, fill, null] },
  ];
  colors.deletePalette(state, background.id);
  colors.replaceColor(state, fill, replacement);
  assert.equal(state.boxes[0].fill, replacement);
  assert.equal(state.boxes[1].textColor, replacement);
  assert.deepEqual(state.boxes[1].borderColors, [replacement, null, replacement, null]);
  assert.equal(state.lastStyle.fill, replacement);
  assert.equal(state.swatches.some(color => color.id === fill), false);
  assert.equal(state.boxes[1].fill, other);
  assert.equal(colors.isUnassigned(state, other), true);
  colors.replaceColor(state, other, null);
  assert.equal(state.boxes[1].fill, null);
  assert.equal(project.validProject(state), true);
});

test('repairing a detached slot keeps any base needed by older relative colors', () => {
  const state = project.freshState(), palette = state.palettes[1], id = palette.colors[0];
  state.lastStyle.fill = id;
  state.swatches.push({ id: 'relative', name: 'Relative', color: '#ffffff', relative: { base: id, l: 4, c: 0, h: 0 } });
  colors.deletePalette(state, palette.id);
  const before = colors.hexFor(state.swatches, 'relative');
  colors.replaceColor(state, id, null);
  assert.equal(state.lastStyle.fill, null);
  assert.equal(colors.hexFor(state.swatches, 'relative'), before);
  assert.equal(project.validProject(state), true);
});

test('invalid recipes and palette references are rejected without partial saves', () => {
  const state = emptyState();
  for (const draft of [{ ...recipe(), name: '' }, { ...recipe(), count: 4 },
    { ...recipe(), base: { l: 101, c: 0, h: 0 } }, { ...recipe(), step: { l: 0, c: .5, h: 0 } }]) {
    const before = JSON.stringify(state);
    assert.throws(() => colors.savePalette(state, draft));
    assert.equal(JSON.stringify(state), before);
  }
  colors.savePalette(state, recipe(3));
  const palette = state.palettes[0];
  for (const invalid of [null, {}, { ...palette, count: 4 }, { ...palette, colors: ['missing', ...palette.colors.slice(1)] },
    { ...palette, colors: [palette.colors[0], palette.colors[0], palette.colors[2]] }]) {
    assert.equal(project.validProject({ ...state, palettes: [invalid] }), false);
  }
  assert.equal(project.validProject({ ...state, palettes: [palette, { ...palette }] }), false);
  assert.equal(project.validProject({ ...state, palettes: [palette, { ...palette, id: 'other' }] }), false);
  assert.equal(project.validProject({ ...state, palettes: {} }), false);
});

test('earlier pilot color records remain readable without conversion', () => {
  const state = project.freshState();
  state.swatches.push({ id: 'base', name: 'Color 1', color: '#4393e1', oklch: { l: 65, c: .14, h: 250 } },
    { id: 'relative', name: 'Color 1a', color: '#75baff', relative: { base: 'base', l: 12, c: 0, h: 0 } });
  const before = JSON.stringify(state);
  assert.equal(project.validProject(state), true);
  assert.equal(colors.hexFor(state.swatches, 'relative'), '#75baff');
  assert.equal(JSON.stringify(state), before);
});

