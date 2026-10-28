const test = require('node:test');
const assert = require('node:assert/strict');
const selection = require('../public/selection.js');

test('switching boxes keeps the properties inspector open and shows the new box', () => {
  const boxes = [{ id: 1, text: 'First' }, { id: 2, text: 'Second' }];
  const before = {
    selectedId: 1, selectedIds: new Set([1]), isolatedCopyIds: null,
    inspectorOpen: true, inspectorKind: 'box', inspectorView: 'properties',
  };

  const after = selection.selectOnly(before, 2);

  assert.equal(after.inspectorOpen, true);
  assert.equal(after.inspectorView, 'properties');
  assert.equal(after.selectedId, 2);
  assert.deepEqual([...after.selectedIds], [2]);
  assert.equal(selection.inspectedBox(boxes, after), boxes[1]);
  assert.equal(before.selectedId, 1);
});

test('the inspector position follows the selected box', () => {
  const panel = { width: 200, height: 150 };
  const viewport = { width: 800, height: 600 };

  assert.deepEqual(selection.inspectorPosition({ left: 100, right: 180, top: 50 }, panel, viewport),
    { left: 192, top: 50 });
  assert.deepEqual(selection.inspectorPosition({ left: 400, right: 480, top: 200 }, panel, viewport),
    { left: 492, top: 200 });
});

test('selecting another box ends isolated-copy selection', () => {
  const before = { selectedId: 1, selectedIds: new Set([1]), isolatedCopyIds: new Set([1]), inspectorOpen: false };

  assert.equal(selection.selectOnly(before, 1).isolatedCopyIds, before.isolatedCopyIds);
  assert.equal(selection.selectOnly(before, 2).isolatedCopyIds, null);
});

test('container drag chooses the smallest enclosing box', () => {
  const outer = { id: 1, x: 0, y: 0, w: 400, h: 400 };
  const inner = { id: 2, x: 100, y: 100, w: 200, h: 200 };
  const child = { id: 3, x: 150, y: 150, w: 50, h: 50 };
  const unrelated = { id: 4, x: 500, y: 500, w: 50, h: 50 };
  const boxes = [outer, inner, child, unrelated];

  assert.equal(selection.nearestContainer(boxes, child), inner);
  assert.equal(selection.nearestContainer(boxes, inner), outer);
  assert.equal(selection.nearestContainer(boxes, outer), null);
  assert.equal(selection.nearestContainer(boxes, unrelated), null);
});
