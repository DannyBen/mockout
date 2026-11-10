import test from 'node:test';
import assert from 'node:assert/strict';
import Project from '../src/core/project.js';
import { openBrowser } from './support/browser.js';

const fixture = Project.freshState();
fixture.boxes = [
  { ...fixture.lastStyle, id: 50, x: 37, y: 40, w: 200, h: 100, text: 'First' },
  { ...fixture.lastStyle, id: 51, x: 300, y: 40, w: 180, h: 100, text: 'Second' },
];
fixture.nextId = 52;
const raw = JSON.stringify(fixture);
const saved = b => b.evaluate("JSON.parse(localStorage.getItem('mockout-project'))");
const click = (b, selector) => b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const input = (b, selector, value, type = 'input') => b.evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
  input.dispatchEvent(new Event(${JSON.stringify(type)}, { bubbles: true }));
})()`);
async function setup(t, { storage = raw, script = '' } = {}) {
  const b = await openBrowser({ script: `if (!sessionStorage.getItem('fixture-loaded')) { localStorage.setItem('mockout-project', ${JSON.stringify(storage)}); sessionStorage.setItem('fixture-loaded', '1'); } ${script}` });
  t.after(async () => { await b.close(); assert.deepEqual(b.errors, []); assert.deepEqual(b.requests, []); });
  await b.wait("document.querySelector('#workspace') && document.querySelectorAll('.box').length > 0");
  return b;
}
async function properties(b, section = 'colors') {
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('Tab');
  await b.key('/', { code: 'Slash' });
  await click(b, `[data-property-section="${section}"]`);
}
async function palette(b) {
  await properties(b);
  await click(b, '#fill-color');
  await b.wait("document.querySelector('#box-color-picker:not([hidden]) [data-edit-palette]')");
}

test('inspector keyboard navigation, mixed edits, focus restoration, undo and redo', async t => {
  const b = await setup(t);
  await properties(b, 'box');
  assert.equal(await b.evaluate('document.activeElement.id'), 'box-width');
  await input(b, '#box-width', 250, 'change');
  assert.equal((await saved(b)).boxes[0].w, 250);
  await b.key('Escape');
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.equal((await saved(b)).boxes[0].w, 200);
  await b.key('y', { code: 'KeyY', modifiers: 2 });
  assert.equal((await saved(b)).boxes[0].w, 250);
  await b.key('a', { code: 'KeyA', modifiers: 2 });
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="text"]');
  assert.equal(await b.evaluate("document.querySelector('#box-text').placeholder"), 'Mixed values');
  await b.key('Backspace');
  assert.deepEqual((await saved(b)).boxes.map(box => box.text), ['', '']);
  await b.key('Escape', { modifiers: 8 });
  assert.equal(await b.evaluate('document.activeElement.id'), 'workspace');
  assert.equal(await b.evaluate("document.querySelectorAll('[title]').length"), 0);
});

test('palette preview, Escape, save, stable inputs, independent dark colors, and one-step undo', async t => {
  const b = await setup(t);
  await palette(b);
  const original = await b.evaluate("document.querySelector('.box-content').style.backgroundColor");
  await click(b, '[data-edit-palette]');
  await b.evaluate("window.__slider = document.querySelector('#palette-base-l'); document.querySelector('[data-axis=l][data-group=base] input[type=number]').focus()");
  await input(b, '[data-axis=l][data-group=base] input[type=number]', 55);
  assert.equal(await b.evaluate("document.querySelector('#palette-base-l') === window.__slider"), true);
  assert.notEqual(await b.evaluate("document.querySelector('.box-content').style.backgroundColor"), original);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('#inspector').dataset.view"), 'box-color');
  assert.equal(await b.evaluate("document.activeElement.hasAttribute('data-edit-palette')"), true);
  assert.equal(await b.evaluate("document.querySelector('.box-content').style.backgroundColor"), original);
  await click(b, '[data-edit-palette]');
  await input(b, '[data-axis=l][data-group=base] input[type=number]', 55);
  await input(b, '[data-palette-dark]', 'custom', 'change');
  await input(b, '[data-axis=l][data-group=base] input[type=number]', 25);
  await click(b, '[data-save-palette]');
  const project = await saved(b);
  assert.equal(project.palettes[0].base.l, 55);
  assert.equal(project.palettes[0].dark.base.l, 25);
  assert.deepEqual(project.palettes[0].colors, fixture.palettes[0].colors);
  await b.key('Escape', { modifiers: 8 });
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).palettes, fixture.palettes);
  await b.key('y', { code: 'KeyY', modifiers: 2 });
  assert.deepEqual((await saved(b)).palettes, project.palettes);
});

test('palette hex typing, validation, slider keyboard steps and draft cancellation', async t => {
  const b = await setup(t);
  await palette(b); await click(b, '[data-edit-palette]');
  await b.evaluate("document.querySelector('[data-palette-hex]').focus(); document.querySelector('[data-palette-hex]').select()");
  await b.page('Input.insertText', { text: 'abc' });
  assert.equal(await b.evaluate("document.querySelector('[data-palette-hex]').value"), 'abc');
  await b.page('Input.insertText', { text: 'def' });
  assert.equal(await b.evaluate("document.querySelector('[data-palette-hex]').value"), 'abcdef');
  await b.key('Tab');
  assert.equal(await b.evaluate("document.querySelector('[data-palette-hex]').value"), '#ABCDEF');
  await input(b, '[data-palette-hex]', 'oops');
  await click(b, '[data-save-palette]');
  assert.equal(await b.evaluate("document.querySelector('[data-palette-hex]').validity.valid"), false);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await input(b, '[data-palette-hex]', '#4393e1');
  await b.evaluate("document.querySelector('#palette-step-h').focus()");
  await b.key('ArrowRight');
  assert.equal(await b.evaluate("document.querySelector('[data-axis=h][data-group=step] input[type=number]').value"), '0.1');
  await b.key('Escape');
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
});

test('palette slider pointer capture survives React preview renders', async t => {
  const b = await setup(t);
  await palette(b); await click(b, '[data-edit-palette]');
  const rect = await b.evaluate("(() => { const r = document.querySelector('#palette-base-l').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()");
  await b.evaluate("window.__range = document.querySelector('#palette-base-l'); window.__lost = 0; window.__range.addEventListener('lostpointercapture', () => window.__lost++);");
  await b.mouse('mousePressed', rect.x + rect.width * .6, rect.y + rect.height / 2, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', rect.x + rect.width * .3, rect.y + rect.height / 2, { buttons: 1 });
  assert.equal(await b.evaluate('window.__lost'), 0);
  assert.equal(await b.evaluate("document.querySelector('#palette-base-l') === window.__range"), true);
  const value = await b.evaluate('Number(window.__range.value)');
  assert.ok(value < 40 && value > 20, `Expected range near 30, got ${value}`);
  await b.mouse('mouseReleased', rect.x + rect.width * .3, rect.y + rect.height / 2, { button: 'left', buttons: 0, clickCount: 1 });
  await click(b, '[data-save-palette]');
  assert.equal((await saved(b)).palettes[0].base.l, value);
});

test('canvas pointer capture, grid nudges, duplicate cancellation and text editing', async t => {
  const b = await setup(t);
  const rect = await b.evaluate("(() => { const r = document.querySelector('.box').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 30 }; })()");
  await b.mouse('mousePressed', rect.x, rect.y, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', rect.x + 20, rect.y + 20, { buttons: 1 });
  assert.equal(await b.evaluate("document.querySelector('#workspace').hasPointerCapture(1)"), true);
  await b.mouse('mouseReleased', rect.x + 20, rect.y + 20, { button: 'left', buttons: 0, clickCount: 1 });
  const moved = (await saved(b)).boxes[0];
  assert.equal(moved.x % 10, 0);
  await b.key('ArrowRight');
  assert.equal((await saved(b)).boxes[0].x, moved.x + 10);
  await b.key('d', { code: 'KeyD', modifiers: 2 });
  assert.equal(await b.evaluate("document.querySelectorAll('.placing').length"), 1);
  await b.key('Escape');
  assert.equal((await saved(b)).boxes.length, 2);
  await b.key('Enter');
  await b.page('Input.insertText', { text: 'Edited text' });
  await b.key('Enter');
  assert.equal((await saved(b)).boxes[0].text, 'Edited text');
});

test('canvas inspector dismisses outside; Save choices wrap focus and restore it', async t => {
  const b = await setup(t);
  await b.evaluate("document.querySelector('#workspace').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 500 }))");
  await click(b, '[data-property-section="grid"]');
  assert.equal(await b.evaluate('document.activeElement.id'), 'grid-base');
  await b.mouse('mousePressed', 1100, 800, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseReleased', 1100, 800, { button: 'left', buttons: 0, clickCount: 1 });
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), true);
  await b.key('s', { code: 'KeyS', modifiers: 2 });
  assert.equal(await b.evaluate('document.activeElement.id'), 'save-once');
  await b.key('ArrowUp');
  assert.equal(await b.evaluate('document.activeElement.id'), 'save-connected-file');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.id'), 'save-once');
  await b.key('Escape');
  await b.wait("document.activeElement.id === 'workspace'");
});

test('connected file autosave, unfocused polling, undo, malformed updates and conflicts', async t => {
  const b = await setup(t, { script: `window.FileSystemObserver = undefined;
    window.__fileReady = navigator.storage.getDirectory().then(async dir => {
      window.__handle = await dir.getFileHandle('shared.json', { create: true });
      window.showSaveFilePicker = async () => window.__handle;
    });` });
  await b.evaluate('window.__fileReady');
  await b.key('s', { code: 'KeyS', modifiers: 2 }); await click(b, '#save-connected-file');
  await b.wait("document.querySelector('#file-status').dataset.state === 'connected' && !document.querySelector('#save-project-dialog').open");
  await b.evaluate("document.querySelector('#workspace').focus()"); await b.key('Tab'); await b.key('ArrowRight');
  await b.wait("window.__handle.getFile().then(file => file.text()).then(text => JSON.parse(text).boxes[0].x === 0 && JSON.parse(text).boxes[1].x === 260)");
  await b.page('Page.reload');
  await b.wait("document.querySelector('#file-status')?.dataset.state === 'connected'");
  await b.evaluate('window.__fileReady');
  const exported = await b.evaluate('window.__handle.getFile().then(file => file.text()).then(JSON.parse)');
  const external = structuredClone(exported); external.boxes[0].text = 'Changed externally';
  const { targetId: background } = await b.send('Target.createTarget', { url: 'about:blank' });
  await b.send('Target.activateTarget', { targetId: background });
  assert.equal(await b.evaluate('document.hasFocus()'), false);
  await b.evaluate(`(async () => { const w = await window.__handle.createWritable(); await w.write(${JSON.stringify(JSON.stringify(external))}); await w.close(); })()`);
  await b.wait("document.querySelector('.box-label').textContent === 'Changed externally'");
  await b.page('Page.bringToFront');
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('Tab');
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  await b.wait("window.__handle.getFile().then(file => file.text()).then(text => JSON.parse(text).boxes[0].text === 'First')");
  // Hold a local edit in progress, so external polling must report a conflict.
  await b.key('/', { code: 'Slash' }); await click(b, '[data-property-section="box"]');
  await input(b, '#box-opacity-range', 60);
  const incoming = structuredClone(external); incoming.boxes[0].text = 'Conflicting external edit';
  await b.evaluate(`(async () => { const w = await window.__handle.createWritable(); await w.write(${JSON.stringify(JSON.stringify(incoming))}); await w.close(); })()`);
  await b.wait("document.querySelector('#file-status').dataset.state === 'conflict'");
  assert.match(await b.evaluate("document.querySelector('#notice-message').textContent"), /both changed/);
  await click(b, '#reload-file');
  await b.wait("document.querySelector('.box-label').textContent === 'Conflicting external edit' && document.querySelector('#file-status').dataset.state === 'connected'");
  await b.evaluate("(async () => { const w = await window.__handle.createWritable(); await w.write('{broken'); await w.close(); })()");
  await b.wait("document.querySelector('#file-status').dataset.state === 'error'");
  assert.equal(await b.evaluate("document.querySelector('.box-label').textContent"), 'Conflicting external edit');
  assert.equal(await b.evaluate('window.__handle.getFile().then(file => file.text())'), '{broken');
});

test('unsupported browser storage remains byte-for-byte untouched after editing', async t => {
  const unsupported = '{"version":2,"keep":"untouched"}';
  const b = await openBrowser({ script: `localStorage.setItem('mockout-project', ${JSON.stringify(unsupported)})` });
  t.after(async () => { await b.close(); assert.deepEqual(b.errors, []); });
  await b.wait("document.querySelector('#notice:not([hidden])')");
  await click(b, '[data-grid="20"]');
  await click(b, '#theme-button');
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), unsupported);
  assert.match(await b.evaluate("document.querySelector('#notice-message').textContent"), /left untouched/);
});

test('storage access denial still leaves the editor and manual Save available', async t => {
  const b = await openBrowser({ script: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });` });
  t.after(async () => { await b.close(); assert.deepEqual(b.errors, []); });
  await b.wait("document.querySelector('#notice:not([hidden])')");
  assert.match(await b.evaluate("document.querySelector('#notice-message').textContent"), /Could not read/);
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('s', { code: 'KeyS', modifiers: 2 });
  assert.equal(await b.evaluate("document.querySelector('#save-project-dialog').open"), true);
});

test('standalone Preview includes bundled styles, theme colors and clean box markup', async t => {
  const b = await setup(t, { script: `window.open = () => ({ location: { replace(url) { window.__preview = fetch(url).then(response => response.text()); } }, close() {} });` });
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('p', { code: 'KeyP', modifiers: 2 });
  await b.wait('window.__preview');
  const html = await b.evaluate('window.__preview');
  assert.match(html, /<title>Mockout preview<\/title>/);
  assert.match(html, /\.box\s*\{/);
  assert.match(html, /First/);
  assert.match(html, /Second/);
  assert.doesNotMatch(html, /class="handle"|class="box selected"|src\/main|index-.*\.css/);
});

test('border and padding point shortcuts preserve field focus and group undo', async t => {
  const b = await setup(t);
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('Tab');
  await b.key('o', { code: 'KeyO' });
  assert.equal(await b.evaluate('document.activeElement.id'), 'border-width');
  await input(b, '#border-width', 7);
  await b.key('ArrowRight', { modifiers: 1 });
  assert.equal(await b.evaluate("document.querySelector('[data-style-target][aria-pressed=true]').dataset.styleTarget"), 'tr');
  assert.equal(await b.evaluate('document.activeElement.id'), 'border-radius');
  await b.key('Escape', { modifiers: 8 });
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).boxes, fixture.boxes);
  await b.key('p', { code: 'KeyP' });
  assert.equal(await b.evaluate('document.activeElement.id'), 'side-padding');
  await input(b, '#side-padding', 12);
  await b.key('Escape', { modifiers: 8 });
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).boxes, fixture.boxes);
});
