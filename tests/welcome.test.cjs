const test = require('node:test');
const assert = require('node:assert/strict');
const project = require('../public/project.js');
const fonts = require('../public/fonts.js');
const welcome = require('../public/welcome.json');

test('Welcome boxes use the active grid for positions and sizes', () => {
  assert.equal(project.validProject(welcome), true);
  assert.ok(welcome.grid > 0);
  for (const box of welcome.boxes) {
    for (const key of ['x', 'y', 'w', 'h']) {
      assert.equal(box[key] % welcome.grid, 0, `box ${box.id} ${key}`);
    }
  }
});

test('Welcome icon-font examples use Material fonts and icon names', () => {
  for (const id of [87, 88, 89]) {
    const box = welcome.boxes.find(item => item.id === id);
    assert.equal(fonts.categoryOf(box.fontFamily), 'material');
    assert.match(box.text, /^[a-z_]+$/);
  }
});
