const test = require('node:test');
const assert = require('node:assert/strict');
const style = require('../public/box-style.js');
const project = require('../public/project.js');
const box = () => ({ id: 1, x: 20, y: 30, w: 400, h: 40, text: 'Progress',
  ...project.freshState().lastStyle });

test('uniform version-1 borders resolve without adding fields or changing saved data', () => {
  const value = box();
  const before = JSON.stringify(value);
  assert.deepEqual(style.values(value, 'borderWidth'), [1, 1, 1, 1]);
  assert.equal(style.value(value, 'radius', 2), 0);
  assert.equal(style.value(value, 'borderColor'), value.borderColor);
  assert.deepEqual(style.copy(value), {});
  assert.equal(JSON.stringify(value), before);
});

test('editing one edge or corner preserves other values; a uniform edit clears that override', () => {
  const value = box();
  style.set(value, 'borderWidth', 10000, 3);
  style.set(value, 'borderColor', null, 1);
  style.set(value, 'radius', 15, 0);
  assert.deepEqual(value.borderWidths, [1, 1, 1, 10000]);
  assert.deepEqual(value.borderColors, ['s3', null, 's3', 's3']);
  assert.deepEqual(value.cornerRadii, [15, 0, 0, 0]);
  assert.equal(style.value(value, 'borderWidth'), undefined);
  const remembered = { ...value, ...style.copy(value) };
  style.set(value, 'borderWidth', 7, 0);
  assert.deepEqual(remembered.borderWidths, [1, 1, 1, 10000]);
  style.set(value, 'borderWidth', 3);
  assert.equal(value.borderWidths, undefined);
  assert.equal(style.value(value, 'borderWidth'), 3);
  assert.deepEqual(value.cornerRadii, [15, 0, 0, 0]);
  assert.deepEqual(value.borderColors, ['s3', null, 's3', 's3']);
});

test('a thick single side can fill a box; opposing borders fit within its stored dimensions', () => {
  const value = { ...box(), borderWidths: [0, 0, 0, 10000] };
  assert.deepEqual(style.widths(value), [0, 0, 0, 400]);
  assert.equal(value.borderWidths[3], 10000);
  assert.deepEqual(style.widths({ ...value, borderWidths: [10000, 0, 0, 0] }), [40, 0, 0, 0]);
  assert.deepEqual(style.widths({ ...value, borderWidths: [0, 300, 0, 300] }), [0, 200, 0, 200]);
  assert.deepEqual(style.widths({ ...box(), w: 5, h: 5, borderWidth: 10 }), [2.5, 2.5, 2.5, 2.5]);
  assert.deepEqual(style.widths({ ...box(), h: 1 }), [1, 0, 0, 0]);
  assert.deepEqual(style.widths({ ...box(), w: 1 }), [0, 0, 0, 1]);
});

test('advanced border values save and reload in version 1 and reject invalid values and swatches', () => {
  const value = project.freshState();
  value.boxes = [box()];
  style.set(value.boxes[0], 'borderWidth', 10000, 3);
  style.set(value.boxes[0], 'borderColor', 's2', 3);
  style.set(value.boxes[0], 'radius', 500, 0);
  value.lastStyle = { ...value.lastStyle, ...style.copy(value.boxes[0]) };
  const loaded = JSON.parse(JSON.stringify(value));
  assert.ok(project.validProject(loaded));
  assert.equal(loaded.version, 1);
  assert.deepEqual(loaded.boxes[0].borderWidths, [1, 1, 1, 10000]);
  assert.deepEqual(project.forExport(loaded).boxes[0].cornerRadii, [500, 0, 0, 0]);
  for (const bad of [[1], [0, 0, 0, -1], [0, 0, 0, '2'], [0, 0, 0, NaN], null, {}]) {
    for (const field of ['borderWidths', 'cornerRadii']) {
      assert.equal(project.validProject({ ...value, boxes: [{ ...box(), [field]: bad }] }), false);
      assert.equal(project.validProject({ ...value, lastStyle: { ...value.lastStyle, [field]: bad } }), false);
    }
  }
  for (const bad of [['missing', null, null, null], ['s1'], null]) {
    assert.equal(project.validProject({ ...value, boxes: [{ ...box(), borderColors: bad }] }), false);
    assert.equal(project.validProject({ ...value, lastStyle: { ...value.lastStyle, borderColors: bad } }), false);
  }
});

test('per-edge swatches count as used colors and replacements preserve unrelated sides', () => {
  const value = { ...box(), borderColors: ['s2', null, 's3', 's2'] };
  assert.equal(style.usesColor(value, 's2'), true);
  assert.equal(style.usesColor(value, 'missing'), false);
  style.replaceColor(value, 's2', 's1');
  assert.deepEqual(value.borderColors, ['s1', null, 's3', 's1']);
  assert.equal(value.textColor, 's1');
});

test('screen-space marker frames keep hit areas separate on small and zoomed boxes', () => {
  for (const [width, height] of [[1, 1], [32, 20], [120, 40], [480, 240]]) {
    const frame = style.markerFrame({ left: 100, top: 100, width, height });
    const points = style.targets.map(target => [frame.left + target.x * frame.width, frame.top + target.y * frame.height]);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      assert.ok(Math.abs(points[i][0] - points[j][0]) >= 32 || Math.abs(points[i][1] - points[j][1]) >= 32);
    }
    assert.equal(frame.left + frame.width / 2, 100 + width / 2);
  }
});
