const test = require('node:test');
const assert = require('node:assert/strict');
const project = require('../public/project.js');
const key = project.storageKey;

const valid = () => ({
  version: 1, grid: 10, nextId: 2,
  swatches: [{ id: 's1', name: 'White', color: '#ffffff' }],
  canvasColors: { background: '#ffffff', gridMajor: '#eeeeee', gridMinor: '#dddddd' },
  boxes: [{ id: 1, x: 10, y: 20, w: 100, h: 50, radius: 0, borderWidth: 1,
    text: 'Hello', fill: 's1', textColor: 's1', borderColor: 's1', alignX: 'center', alignY: 'center' }],
});

test('version 1 projects remain valid; unsupported versions and broken boxes are rejected', () => {
  assert.equal(key, 'minimock-project');
  assert.ok(project.validProject(valid()));
  assert.ok(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], w: 1, h: 1 }] }));
  assert.equal(project.validProject({ ...valid(), version: 2 }), false);
  assert.equal(project.validProject({ ...valid(), boxes: [{ ...valid().boxes[0], w: 0 }] }), false);
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
