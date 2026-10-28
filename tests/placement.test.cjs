const test = require('node:test');
const assert = require('node:assert/strict');
const placement = require('../public/placement.js');

test('duplicate starts under the cursor after the canvas is panned', () => {
  const source = { x: 100, y: 100, w: 150, h: 120 };
  const view = { x: 0, y: -450, zoom: 1 };
  const cursor = placement.worldPoint({ clientX: 700, clientY: 500 }, { left: 0, top: 0 }, view);
  const offset = placement.duplicateOffset(source, cursor, 10);
  const copy = { x: source.x + offset.x, y: source.y + offset.y };

  assert.ok(Math.abs(copy.x + source.w / 2 - 700) <= 5);
  assert.ok(Math.abs(copy.y + view.y + source.h / 2 - 500) <= 5);
  assert.notEqual(copy.y, source.y + 10);
});

test('duplicate stays under the cursor with zoom and a shifted workspace', () => {
  const source = { x: 100, y: 100, w: 80, h: 60 };
  const rect = { left: 20, top: 30 };
  const view = { x: -100, y: -200, zoom: 2 };
  const cursor = placement.worldPoint({ clientX: 500, clientY: 400 }, rect, view);
  const offset = placement.duplicateOffset(source, cursor, 5);

  assert.equal(rect.left + view.x + (source.x + offset.x + source.w / 2) * view.zoom, 500);
  assert.equal(rect.top + view.y + (source.y + offset.y + source.h / 2) * view.zoom, 400);
});

test('placement follows pointer movement and keeps keyboard nudges', () => {
  const first = { x: 630, y: 890 };
  const origin = { x: 700, y: 500 };

  assert.deepEqual(placement.moveDelta(first, origin, { x: 750, y: 530 }, { x: 0, y: 0 }, 1, 10),
    { x: 50, y: 30 });
  assert.deepEqual(placement.moveDelta(first, origin, { x: 750, y: 530 }, { x: 10, y: -20 }, 1, 10),
    { x: 60, y: 10 });
  assert.deepEqual(placement.duplicateOffset(first, null, 5), { x: 5, y: 5 });
});
