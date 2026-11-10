const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

test('application icon references resolve to the bundled Material Symbols', () => {
  const uiDir = join(__dirname, '../src/ui');
  const source = readdirSync(uiDir).filter(file => file.endsWith('.jsx'))
    .map(file => readFileSync(join(uiDir, file), 'utf8')).join('\n');
  const sprite = readFileSync(join(__dirname, '../public/assets/material-symbols/sprite.svg'), 'utf8');
  const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]));
  const references = [...source.matchAll(/(?:href="assets\/material-symbols\/sprite\.svg#|<Icon name=")([\w_]+)/g)];
  assert.ok(references.length > 0);
  for (const [, reference] of references) assert.ok(symbols.has(reference), `Missing symbol: ${reference}`);
});
