const test = require('node:test');
const assert = require('node:assert/strict');
const placement = require('../public/placement.js');

test('arrow nudges reach the next grid line in either direction without skipping one', () => {
  for (const [value, left, right] of [
    [33, 30, 40], [37, 30, 40], [40, 30, 50],
    [-33, -40, -30], [-37, -40, -30], [-40, -50, -30], [0, -10, 10],
  ]) {
    assert.equal(placement.nudge(value, -1, 10), left);
    assert.equal(placement.nudge(value, 1, 10), right);
    assert.equal(placement.nudge(value, 0, 10), value);
  }
  assert.equal(placement.nudge(37, -1, 5), 35);
  assert.equal(placement.nudge(37, 1, 5), 40);
});

test('fast arrow nudges count five grid lines from off-grid and aligned positions', () => {
  assert.equal(placement.nudge(37, 1, 10, 5), 80);
  assert.equal(placement.nudge(37, -1, 10, 5), -10);
  assert.equal(placement.nudge(40, 1, 10, 5), 90);
  assert.equal(placement.nudge(40, -1, 10, 5), -10);
});

test('arrows with the grid off keep pixel movement and fractional positions', () => {
  assert.equal(placement.nudge(37, 1, 0), 38);
  assert.equal(placement.nudge(37.5, -1, 0), 36.5);
  assert.equal(placement.nudge(37.5, 1, 0, 5), 42.5);
});

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

test('duplicate starts one grid step away before the pointer moves', () => {
  const source = { x: 100, y: 100, w: 80, h: 60 };
  assert.deepEqual(placement.duplicateOffset(source, null, 5), { x: 5, y: 5 });
  assert.deepEqual(placement.duplicateOffset(source, null, 0), { x: 10, y: 10 });
});
