const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('application icon references resolve to the bundled Material Symbols', () => {
  const publicDir = join(__dirname, '..', 'public');
  const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
  const sprite = readFileSync(join(publicDir, 'assets/material-symbols/sprite.svg'), 'utf8');
  const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]));
  const icons = [...html.matchAll(/<svg\b[^>]*\bclass="[^"]*\bicon\b[^"]*"[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.ok(icons.length > 0);
  for (const [markup, content] of icons) {
    const reference = /<use href="assets\/material-symbols\/sprite\.svg#([^"]+)"/.exec(content);
    assert.ok(reference, `Icon must use the local library: ${markup}`);
    assert.ok(symbols.has(reference[1]), `Missing symbol: ${reference[1]}`);
  }
});
