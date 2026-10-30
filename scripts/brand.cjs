const { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const project = require('../public/project.js');

const root = resolve(__dirname, '..');
const publicDir = join(root, 'public');
const assets = join(publicDir, 'assets');
const icons = join(assets, 'icons');
const logo = JSON.parse(readFileSync(join(assets, 'logo.json'), 'utf8'));
if (!project.validProject(logo)) throw Error('The logo is not a valid Mockout project.');
if (logo.boxes.length !== 5 || logo.boxes.some(box => box.text || box.fill === null
  || (box.borderColor !== null && box.borderWidth > 0))) {
  throw Error('The M-and-T logo must contain its five filled, borderless boxes.');
}
const tile = logo.boxes[0];
if (tile.x !== 0 || tile.y !== 0 || tile.w !== 100 || tile.h !== 100) {
  throw Error('Keep the logo tile at (0, 0), sized 100 by 100.');
}

const color = (id, theme = 'light') => {
  const swatch = logo.swatches.find(item => item.id === id);
  return project.resolveColor(swatch.color, swatch.dark, theme);
};
const orange = color(tile.fill);
const boxes = (theme = 'light') => logo.boxes.map(box =>
  `  <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.radius}" fill="${color(box.fill, theme)}"/>`
).join('\n');
const svg = (width, height, content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mockout M-and-T logo">\n${content}\n</svg>\n`;
const light = svg(100, 100, boxes());
const dark = svg(100, 100, boxes('dark'));
const square = svg(100, 100, `  <rect width="100" height="100" fill="${orange}"/>\n${boxes()}`);
const maskable = svg(100, 100, `  <rect width="100" height="100" fill="${orange}"/>\n  <g transform="translate(10 10) scale(.8)">\n${boxes()}\n  </g>`);
const social = svg(1200, 630, `  <rect width="1200" height="630" fill="${orange}"/>\n  <g transform="translate(300 15) scale(6)">\n${boxes()}\n  </g>`);

mkdirSync(icons, { recursive: true });
writeFileSync(join(assets, 'logo.svg'), light);
writeFileSync(join(assets, 'logo-dark.svg'), dark);
writeFileSync(join(assets, 'social-mark.svg'), social);
writeFileSync(join(icons, 'favicon.svg'), light);

const temporary = mkdtempSync(join(tmpdir(), 'mockout-brand-'));
try {
  const render = (source, width, height, target) => {
    const input = join(temporary, 'input.svg');
    writeFileSync(input, source);
    execFileSync('rsvg-convert', ['--width', String(width), '--height', String(height), '--output', target, input], { timeout: 30000 });
  };
  for (const size of [192, 512]) {
    render(light, size, size, join(icons, `icon-${size}.png`));
    render(maskable, size, size, join(icons, `icon-${size}-maskable.png`));
  }
  render(light, 32, 32, join(icons, 'favicon-32.png'));
  render(square, 180, 180, join(icons, 'apple-touch-icon.png'));
  render(social, 1200, 630, join(assets, 'social-mark.png'));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = sizes.map(size => {
    const path = join(temporary, `${size}.png`);
    render(light, size, size, path);
    return path;
  });
  execFileSync('magick', [...frames, join(publicDir, 'favicon.ico')], { timeout: 30000 });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const manifest = {
  name: 'Mockout', short_name: 'Mockout',
  description: 'Think inside the box. Rapid UI mockups.',
  id: './', start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: orange, theme_color: orange,
  icons: [192, 512].flatMap(size => [
    { src: `./assets/icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png' },
    { src: `./assets/icons/icon-${size}-maskable.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' },
  ]),
};
writeFileSync(join(publicDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// The Welcome header keeps the same editable boxes as the canonical logo.
const welcome = JSON.parse(readFileSync(join(publicDir, 'welcome.json'), 'utf8'));
for (const box of logo.boxes) {
  const target = welcome.boxes.find(item => item.id === box.id + 90);
  if (!target || target.text) throw Error('The Welcome logo header no longer matches its source.');
  Object.assign(target, box, { id: box.id + 90, y: box.y + 15 });
}
for (const swatch of logo.swatches) {
  const target = welcome.swatches.find(item => item.id === swatch.id);
  if (target) Object.assign(target, swatch);
  else welcome.swatches.push(swatch);
}
if (!project.validProject(welcome)) throw Error('The updated Welcome project is invalid.');
for (const path of ['welcome.json', 'skills/mockout/examples/welcome.json']) {
  writeFileSync(join(publicDir, path), JSON.stringify(welcome, null, 2) + '\n');
}
console.log('Generated logos, favicon, install icons, social card, manifest, and both Welcome copies.');
