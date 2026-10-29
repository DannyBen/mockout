const test = require('node:test');
const assert = require('node:assert/strict');
const project = require('../public/project.js');
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
