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

test('properties inspector can follow one box within a multi-selection', () => {
  const boxes = [{ id: 1 }, { id: 2 }];
  const selectionState = {
    selectedId: 2, selectedIds: new Set([1, 2]), inspectorOpen: true, inspectorKind: 'box',
  };
  assert.equal(selection.inspectedBox(boxes, selectionState), boxes[1]);
  assert.equal(selection.inspectedBox(boxes, { ...selectionState, selectedId: 3 }), null);
});

test('mixed properties are detected without treating transparent as mixed', () => {
  const boxes = [{ id: 1, fill: null, w: 20 }, { id: 2, fill: null, w: 30 }];
  assert.equal(selection.commonValue(boxes, box => box.fill), null);
  assert.equal(selection.commonValue(boxes, box => box.w), undefined);
});

test('bulk property edit changes selected boxes only', () => {
  const boxes = [{ id: 1, text: 'One' }, { id: 2, text: 'Two' }, { id: 3, text: 'Three' }];
  selection.applyProperty(boxes, new Set([1, 2]), 'text', 'Shared');
  assert.deepEqual(boxes.map(box => box.text), ['Shared', 'Shared', 'Three']);
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
