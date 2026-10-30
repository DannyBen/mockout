const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const project = require('../public/project.js');

const publicDir = join(__dirname, '../public');
const read = path => JSON.parse(readFileSync(join(publicDir, path), 'utf8'));
const pngSize = path => {
  const bytes = readFileSync(join(publicDir, path));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test('Welcome uses the editable logo geometry and both color palettes', () => {
  const logo = read('assets/logo.json');
  const welcome = read('welcome.json');
  assert.equal(project.validProject(logo), true);
  const origin = welcome.boxes.find(box => box.id === 91);
  for (const box of logo.boxes) {
    const embedded = welcome.boxes.find(item => item.id === box.id + 90);
    assert.ok(embedded);
    assert.deepEqual([embedded.x - origin.x, embedded.y - origin.y, embedded.w, embedded.h, embedded.radius],
      [box.x, box.y, box.w, box.h, box.radius]);
    for (const theme of ['light', 'dark']) {
      const source = logo.swatches.find(swatch => swatch.id === box.fill);
      const target = welcome.swatches.find(swatch => swatch.id === embedded.fill);
      assert.equal(project.resolveColor(source.color, source.dark, theme), project.resolveColor(target.color, target.dark, theme));
    }
  }
});

test('manifest and platform images have matching sizes and the logo theme color', () => {
  const logo = read('assets/logo.json');
  const manifest = read('manifest.webmanifest');
  assert.equal(manifest.theme_color, logo.swatches.find(swatch => swatch.id === 'brand').color);
  assert.equal(manifest.background_color, manifest.theme_color);
  for (const icon of manifest.icons) {
    assert.deepEqual(pngSize(icon.src), icon.sizes.split('x').map(Number));
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  assert.deepEqual(pngSize('assets/icons/apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(pngSize('assets/social-mark.png'), [1200, 630]);
  const ico = readFileSync(join(publicDir, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + index * 16] || 256);
  assert.deepEqual(sizes, [16, 24, 32, 48, 64, 128, 256]);
});
