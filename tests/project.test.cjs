const test = require('node:test');
const assert = require('node:assert/strict');
const project = require('../public/project.js');
const fonts = require('../public/fonts.js');
const key = project.storageKey;

test('new project files suggest a compact timestamped name', () => {
  assert.equal(project.suggestedFileName(new Date(2026, 9, 29, 14, 30, 45)),
    'mockout-261029-143045.json');
});

const valid = () => ({
  version: 1, grid: 10, nextId: 2,
  swatches: [{ id: 's1', name: 'White', color: '#ffffff' }],
  canvasColors: { background: '#ffffff', gridMajor: '#eeeeee', gridMinor: '#dddddd' },
  boxes: [{ id: 1, x: 10, y: 20, w: 100, h: 50, radius: 0, borderWidth: 1,
    text: 'Hello', fill: 's1', textColor: 's1', borderColor: 's1', alignX: 'center', alignY: 'center' }],
});

test('version 1 projects remain valid; unsupported versions and broken boxes are rejected', () => {
  assert.equal(key, 'mockout-project');
  assert.ok(project.validProject(valid()));
  assert.ok(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], w: 1, h: 1 }] }));
  assert.equal(project.validProject({ ...valid(), version: 2 }), false);
  assert.equal(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], w: 0 }] }), false);
  assert.ok(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0],
    fontFamily: 'Roboto Slab', fontSize: 18, fontWeight: 700, fontStyle: 'italic' }] }));
  assert.ok(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0],
    fontFamily: 'Material Icons Two Tone' }] }));
  assert.equal(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], fontSize: -2 }] }), false);
  assert.equal(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], fontFamily: 'No; font' }] }), false);
});

test('font links include Google variants and both Material icon sets without duplicates', () => {
  assert.deepEqual({ family: fonts.familyOf({}), size: fonts.sizeOf({}),
    weight: fonts.weightOf({}), style: fonts.styleOf({}) },
  { family: '', size: 13, weight: 400, style: 'normal' });
  assert.deepEqual({ family: project.freshState().lastStyle.fontFamily,
    size: project.freshState().lastStyle.fontSize }, { family: '', size: 13 });
  const boxes = [
    { fontFamily: 'Roboto Slab', fontWeight: 700, fontStyle: 'italic' },
    { fontFamily: 'Roboto Slab', fontWeight: 700, fontStyle: 'italic' },
    { fontFamily: 'Material Symbols Outlined', fontWeight: 700 },
    { fontFamily: 'Material Icons' },
    { fontFamily: 'Material Icons Two Tone' },
    {},
  ];
  const links = fonts.stylesheets(boxes);
  assert.equal(links.length, 6);
  assert.ok(links.some(url => url.includes('family=Roboto+Slab&display=swap')));
  assert.ok(links.some(url => url.includes('family=Roboto+Slab%3Aital%2Cwght%401%2C700')));
  assert.ok(links.some(url => url.includes('family=Material+Symbols+Outlined&display=block')));
  assert.ok(links.some(url => url.includes('family=Material+Symbols+Outlined%3Awght%40700')));
  assert.ok(links.some(url => url.includes('family=Material+Icons&display=block')));
  assert.ok(links.some(url => url.includes('family=Material+Icons+Two+Tone&display=block')));
  assert.equal(fonts.stylesheets([{ fontFamily: 'Material Icons Two Tone', fontWeight: 700 }]).length, 1);
  assert.equal(fonts.categoryOf('Material Icons Two Tone'), 'material');
  assert.ok(fonts.stylesheets([{ fontFamily: 'Roboto', fontWeight: 700 }])
    .some(url => url.includes('family=Roboto%3Awght%40700')));
});

test('autosave leaves unsupported saved data untouched', () => {
  const stored = new Map([[key, '{"version":2}']]);
  const storage = { setItem(key, value) { stored.set(key, value); } };

  project.persist(storage, key, valid(), 'Saved project is unsupported.');

  assert.equal(stored.get(key), '{"version":2}');
});

test('supported projects autosave under the current key', () => {
  const stored = new Map();
  const storage = { setItem(key, value) { stored.set(key, value); } };

  project.persist(storage, key, valid(), '');

  assert.deepEqual(JSON.parse(stored.get(key)), valid());
});

test('JSON export starts at the top-left box without changing live or autosaved coordinates', () => {
  const live = valid();
  live.boxes.push({ ...live.boxes[0], id: 2, x: 100000, y: 100000 });
  live.boxes[0].x = 99950;
  live.boxes[0].y = 100020;
  const stored = new Map();
  const storage = { setItem(key, value) { stored.set(key, value); } };

  const exported = project.forExport(live);
  project.persist(storage, key, live, '');

  assert.deepEqual(exported.boxes.map(box => [box.x, box.y]), [[0, 20], [50, 0]]);
  assert.equal(exported.version, 1);
  assert.deepEqual(live.boxes.map(box => [box.x, box.y]), [[99950, 100020], [100000, 100000]]);
  assert.deepEqual(JSON.parse(stored.get(key)), live);
  assert.deepEqual(project.forExport({ ...live, boxes: [] }).boxes, []);
});

test('Clear board removes boxes but preserves project settings and the prior state', () => {
  const before = valid();
  before.grid = 5;
  const after = project.clearBoard(before);

  assert.deepEqual(after.boxes, []);
  assert.equal(after.grid, 5);
  assert.deepEqual(after.swatches, before.swatches);
  assert.deepEqual(after.canvasColors, before.canvasColors);
  assert.equal(before.boxes.length, 1);
});

test('Reset app removes the saved project and returns version 1 defaults', () => {
  const stored = new Map([[key, '{"version":2}']]);
  const storage = { removeItem(key) { stored.delete(key); } };

  const after = project.reset(storage, key);

  assert.equal(stored.has(key), false);
  assert.equal(after.version, 1);
  assert.equal(after.grid, 10);
  assert.deepEqual(after.boxes, []);
  assert.equal(after.swatches.length, 3);
});
