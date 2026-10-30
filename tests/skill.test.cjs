const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const project = require('../public/project.js');

const directory = join(__dirname, '../public/skills/mockout');
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));

function checkProject(value) {
  assert.ok(project.validProject(value));
  const boxes = new Set(value.boxes.map(box => box.id));
  const swatches = new Set(value.swatches.map(swatch => swatch.id));
  assert.equal(boxes.size, value.boxes.length);
  assert.equal(swatches.size, value.swatches.length);
  assert.ok(value.nextId > Math.max(0, ...boxes));
  for (const box of value.boxes) {
    for (const property of ['x', 'y', 'w', 'h']) assert.equal(box[property] % value.grid, 0);
  }
}

test('skill examples are valid version 1 projects with unique IDs and grid-aligned geometry', () => {
  for (const name of ['starter', 'email-client', 'welcome']) checkProject(read(`examples/${name}.json`));
});

test('the bundled Welcome example matches the app and includes dual colors', () => {
  const welcome = read('examples/welcome.json');
  assert.deepEqual(welcome, JSON.parse(readFileSync(join(__dirname, '../public/welcome.json'), 'utf8')));
  assert.ok(welcome.swatches.some(swatch => swatch.dark));
});

test('the email example includes Material icons and a separate text font', () => {
  const example = read('examples/email-client.json');
  assert.ok(example.boxes.some(box => box.fontFamily === 'Material Symbols Outlined'));
  assert.ok(example.boxes.some(box => box.fontFamily === 'Material Icons'));
  assert.ok(example.boxes.some(box => box.fontFamily === 'Assistant'));
});

test('the skill example can be published one box at a time from its starter', () => {
  let current = read('examples/starter.json');
  const example = read('examples/email-client.json');
  assert.equal(current.boxes.length, 0);
  for (const box of example.boxes) {
    // Each intermediate document must survive a save and reload independently.
    current = JSON.parse(JSON.stringify(current));
    current.boxes.push(box);
    current.nextId = box.id + 1;
    checkProject(current);
  }
  assert.deepEqual(current, example);
});
