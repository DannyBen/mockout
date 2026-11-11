import test from 'node:test';
import assert from 'node:assert/strict';
import Project from '../src/core/project.js';
import { buildVersion } from '../build-version.js';
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

test('Help shows the build version and keeps its header and footer visible while content scrolls', async t => {
  const b = await setup(t);
  await click(b, '#help-button');
  const version = buildVersion(process.cwd());
  assert.match(version, /^\d{2}\.\d{2}\.\d{2}-[a-f0-9]{3}(?:-dirty)?$/);
  assert.equal(await b.evaluate("document.querySelector('#help-panel footer').textContent"), `Mockout v${version} · GitHub`);
  for (const height of [900, 480]) {
    await b.page('Emulation.setDeviceMetricsOverride', { width: 1280, height, deviceScaleFactor: 1, mobile: false });
    const before = await b.evaluate(`(() => {
      const panel = document.querySelector('#help-panel'), content = panel.querySelector('.help-content');
      content.scrollTop = 0;
      return { header: panel.querySelector('header').getBoundingClientRect().toJSON(),
        footer: panel.querySelector('footer').getBoundingClientRect().toJSON(), scrollable: content.scrollHeight > content.clientHeight };
    })()`);
    assert.equal(before.scrollable, true);
    assert.ok(before.footer.bottom <= height - 12);
    const after = await b.evaluate(`(() => {
      const panel = document.querySelector('#help-panel'), content = panel.querySelector('.help-content');
      content.scrollTop = content.scrollHeight;
      return { header: panel.querySelector('header').getBoundingClientRect().toJSON(),
        footer: panel.querySelector('footer').getBoundingClientRect().toJSON(), scrolled: content.scrollTop > 0 };
    })()`);
    assert.equal(after.scrolled, true);
    assert.deepEqual(after.header, before.header);
    assert.deepEqual(after.footer, before.footer);
  }
});

test('dialog arrow navigation reaches color roles and stacked controls while value fields retain native keys', async t => {
  const b = await setup(t);
  await properties(b);
  assert.equal(await b.evaluate('document.activeElement.id'), 'fill-color');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.id'), 'text-color');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.id'), 'border-color');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.id'), 'fill-color');
  await b.key('End');
  assert.equal(await b.evaluate('document.activeElement.id'), 'border-color');
  await b.key('Home');
  await b.key('Enter', { text: '\r' });
  assert.equal(await b.evaluate("document.querySelector('#inspector').dataset.view"), 'box-color');
  await click(b, '[data-edit-palette]');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.hasAttribute("data-palette-hex")'), true);
  await b.key('ArrowUp');
  assert.equal(await b.evaluate('document.activeElement.hasAttribute("data-palette-title")'), true);
  await b.evaluate("document.querySelector('[data-axis=l][data-group=base] input[type=number]').focus()");
  const lightness = await b.evaluate('document.activeElement.valueAsNumber');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.type'), 'number');
  assert.equal(await b.evaluate('document.activeElement.valueAsNumber'), lightness - .1);
  await b.evaluate("document.querySelector('#palette-base-l').focus()");
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.id'), 'palette-base-l');
  await b.evaluate("document.querySelector('[data-palette-dark]').focus()");
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.hasAttribute("data-palette-dark")'), true);
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('[data-palette-editor]').hidden"), true);
});

test('palette dropdown switches colors in place and creates or cancels a new palette', async t => {
  const b = await setup(t);
  await palette(b);
  const selector = '[data-palette-name]';
  assert.deepEqual(await b.evaluate(`Array.from(document.querySelector('${selector}').children, item => [item.tagName, item.textContent])`), [
    ['OPTION', 'Background'], ['OPTION', 'Accent'], ['OPTION', 'New palette…'],
  ]);
  await b.evaluate(`document.querySelector('${selector}').focus()`);
  await b.key('ArrowDown');
  assert.equal(await b.evaluate(`document.querySelector('${selector}').value`), `palette:${fixture.palettes[1].id}`);
  assert.equal(await b.evaluate(`document.activeElement.matches('${selector}')`), true);
  assert.deepEqual(await b.evaluate("Array.from(document.querySelectorAll('[data-palette-colors] button'), item => item.dataset.colorId)"), fixture.palettes[1].colors);
  assert.equal(await b.evaluate("document.querySelector('[data-transparent]').getClientRects().length > 0"), true);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);

  await input(b, selector, 'new', 'change');
  assert.equal(await b.evaluate("document.activeElement.matches('[data-palette-title]')"), true);
  await b.key('Escape');
  assert.equal(await b.evaluate(`document.activeElement.matches('${selector}')`), true);
  assert.equal(await b.evaluate(`document.querySelector('${selector}').value`), `palette:${fixture.palettes[1].id}`);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);

  await input(b, selector, 'new', 'change');
  await input(b, '[data-palette-title]', 'Test palette');
  await click(b, '[data-save-palette]');
  const project = await saved(b);
  assert.equal(project.version, fixture.version);
  assert.equal(project.palettes.length, fixture.palettes.length + 1);
  assert.equal(project.palettes.at(-1).name, 'Test palette');
  assert.equal(await b.evaluate(`document.querySelector('${selector}').value`), `palette:${project.palettes.at(-1).id}`);
  await click(b, `[data-color-id="${project.palettes.at(-1).colors[0]}"]`);
  await click(b, `[data-color-id="${project.palettes.at(-1).colors[0]}"]`);
  assert.equal((await saved(b)).boxes[0].fill, project.palettes.at(-1).colors[0]);
});

test('color strip arrows preview without saving; Escape cancels and Enter commits one undo step', async t => {
  const b = await setup(t);
  await palette(b);
  const original = await b.evaluate("document.querySelector('.box-content').style.backgroundColor");
  await b.key('ArrowDown');
  await b.key('ArrowDown');
  assert.equal(await b.evaluate('document.activeElement.dataset.colorId'), fixture.palettes[0].colors[2]);
  assert.notEqual(await b.evaluate("document.querySelector('.box-content').style.backgroundColor"), original);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('.box-content').style.backgroundColor"), original);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await click(b, '#fill-color');
  await b.key('ArrowDown');
  await b.key('ArrowDown');
  await b.key('Enter');
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), true);
  assert.equal(await b.evaluate('document.activeElement.id'), 'workspace');
  assert.equal((await saved(b)).boxes[0].fill, fixture.palettes[0].colors[2]);
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual(await saved(b), fixture);
});

test('color strip mouse preview, double click, and a click on the selected color commit and close', async t => {
  const b = await setup(t);
  await palette(b);
  const id = fixture.palettes[0].colors[2];
  const rect = await b.evaluate(`(() => { const r = document.querySelector('[data-color-id="${id}"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const original = await b.evaluate("document.querySelector('.box-content').style.backgroundColor");
  await b.mouse('mousePressed', rect.x, rect.y, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseReleased', rect.x, rect.y, { button: 'left', buttons: 0, clickCount: 1 });
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), false);
  assert.notEqual(await b.evaluate("document.querySelector('.box-content').style.backgroundColor"), original);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await b.mouse('mousePressed', rect.x, rect.y, { button: 'left', buttons: 1, clickCount: 2 });
  await b.mouse('mouseReleased', rect.x, rect.y, { button: 'left', buttons: 0, clickCount: 2 });
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), true);
  assert.equal((await saved(b)).boxes[0].fill, id);
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="colors"]');
  await click(b, '#fill-color');
  await click(b, `[data-color-id="${id}"]`);
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), true);
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="colors"]');
  await click(b, '#fill-color');
  await click(b, '[data-transparent]');
  assert.equal((await saved(b)).boxes[0].fill, id);
  await click(b, '[data-transparent]');
  assert.equal(await b.evaluate("document.querySelector('#inspector').hidden"), true);
  assert.equal((await saved(b)).boxes[0].fill, null);
});

test('all dropdowns retain the native Dark selector appearance in both themes', async t => {
  const b = await setup(t);
  await palette(b);
  const styles = await b.evaluate(`['light', 'dark'].map(theme => {
    document.documentElement.dataset.uiTheme = theme;
    return Array.from(document.querySelectorAll('select'), select => getComputedStyle(select).appearance);
  })`);
  for (const theme of styles) {
    assert.ok(theme.length > 2, 'check all dropdowns, including font and legacy color fields');
    for (const appearance of theme) assert.equal(appearance, 'auto');
  }
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

test('keyed canvas nodes preserve pointer capture and editable drafts through rerenders', async t => {
  const b = await setup(t);
  await b.evaluate("document.querySelector('#workspace').focus(); window.__box = document.querySelector('.box'); void 0");
  await b.key('Tab');
  await b.key('Enter');
  await b.page('Input.insertText', { text: 'Unfinished draft' });
  await b.evaluate('window.__editor = document.activeElement; window.__anchor = getSelection().anchorNode; window.__offset = getSelection().anchorOffset');
  await b.key('Alt');
  assert.equal(await b.evaluate('document.activeElement === window.__editor && getSelection().anchorNode === window.__anchor && getSelection().anchorOffset === window.__offset'), true);
  assert.equal(await b.evaluate("document.querySelector('.box') === window.__box"), true);
  assert.equal((await saved(b)).boxes[0].text, 'First');
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('.box-label').textContent"), 'First');
  await b.key('Enter');
  await b.page('Input.insertText', { text: 'Saved draft' });
  await b.key('Tab');
  assert.equal((await saved(b)).boxes[0].text, 'Saved draft');
  assert.equal(await b.evaluate("document.querySelector('.box.selected').dataset.id"), '51');
  await b.key('a', { code: 'KeyA', modifiers: 2 });
  const rect = await b.evaluate("(() => { const r = document.querySelector('.selection-bounds [data-handle=se]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()");
  await b.mouse('mousePressed', rect.x, rect.y, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', rect.x + 20, rect.y + 20, { buttons: 1 });
  assert.equal(await b.evaluate("document.querySelector('#workspace').hasPointerCapture(1)"), true);
  await b.mouse('mouseReleased', rect.x + 20, rect.y + 20, { button: 'left', buttons: 0, clickCount: 1 });
  assert.deepEqual((await saved(b)).boxes.map(box => box.w), [223, 200]);
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).boxes.map(box => box.w), [200, 180]);
});

test('drawing, marquee, zoom and native pointer cancellation retain gesture boundaries', async t => {
  const b = await setup(t);
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('d', { code: 'KeyD' });
  await b.mouse('mousePressed', 100, 180, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', 250, 260, { buttons: 1 });
  assert.equal(await b.evaluate("document.querySelectorAll('.box.drawing').length"), 1);
  assert.equal((await saved(b)).boxes.length, 2);
  await b.mouse('mouseReleased', 250, 260, { button: 'left', buttons: 0, clickCount: 1 });
  assert.equal((await saved(b)).boxes.length, 3);
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).boxes, fixture.boxes);
  await b.key('s', { code: 'KeyS' });
  const rect = await b.evaluate("(() => { const r = document.querySelector('.box').getBoundingClientRect(); return { x: r.x, y: r.y }; })()");
  await b.mouse('mousePressed', rect.x + 20, rect.y + 20, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', rect.x + 50, rect.y + 50, { buttons: 1 });
  await b.evaluate("document.querySelector('#workspace').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }))");
  await b.mouse('mouseReleased', rect.x + 50, rect.y + 50, { button: 'left', buttons: 0, clickCount: 1 });
  assert.deepEqual((await saved(b)).boxes, fixture.boxes);
  await b.mouse('mousePressed', rect.x - 10, rect.y - 10, { button: 'left', buttons: 1, clickCount: 1 });
  await b.mouse('mouseMoved', rect.x + 210, rect.y + 110, { buttons: 1 });
  assert.equal(await b.evaluate("document.querySelectorAll('.marquee').length"), 1);
  await b.mouse('mouseReleased', rect.x + 210, rect.y + 110, { button: 'left', buttons: 0, clickCount: 1 });
  assert.equal(await b.evaluate("document.querySelectorAll('.box.selected').length"), 1);
  await b.key('+', { code: 'Equal', modifiers: 2 });
  assert.equal(await b.evaluate("document.querySelector('#canvas').style.transform.includes('scale(1.2)')"), true);
  await b.key('0', { code: 'Digit0', modifiers: 2 });
  assert.equal(await b.evaluate("document.querySelector('#canvas').style.transform.includes('scale(1)')"), true);
});

test('reset hold cancels on release and completes once; AI copy feedback clears on close', async t => {
  const b = await setup(t, { script: `Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } });` });
  await click(b, '#ai-button');
  await click(b, '[data-ai-prompt="quick"]');
  await b.wait("document.querySelector('#ai-copy-status').textContent.startsWith('Copied.')");
  assert.match(await b.evaluate('window.__copied'), /mockout/i);
  await click(b, '#close-ai-dialog');
  await b.wait("document.activeElement.id === 'workspace'");
  await click(b, '#ai-button');
  assert.equal(await b.evaluate("document.querySelector('#ai-copy-status').textContent"), '');
  // Native focus restoration precedes the close event and its focus handler.
  await b.evaluate("window.__aiClosed = new Promise(resolve => document.querySelector('#ai-dialog').addEventListener('close', () => resolve(true), { once: true })); void 0");
  await b.key('Escape');
  await b.evaluate('window.__aiClosed');
  await b.wait("document.activeElement.id === 'workspace'");
  await click(b, '#project-menu-button');
  await b.evaluate("document.querySelector('#reset-button').focus()");
  await b.key('Enter');
  await b.evaluate('new Promise(resolve => setTimeout(resolve, 1300))');
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  assert.equal(await b.evaluate('document.activeElement.id'), 'reset-button');
  await b.page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await b.wait("document.querySelector('#reset-button').classList.contains('holding')");
  await b.wait("JSON.parse(localStorage.getItem('mockout-project')).boxes.length > 2");
  await b.page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await b.evaluate("document.querySelector('.holding')"), null);
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.ok((await saved(b)).boxes.length > 2);
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

test('toolbar menus, help, theme and custom grid choices follow editor state', async t => {
  const b = await setup(t);
  await click(b, '#project-menu-button');
  assert.equal(await b.evaluate("document.querySelector('#project-menu-button').getAttribute('aria-expanded')"), 'true');
  assert.equal(await b.evaluate('document.activeElement.id'), 'save-button');
  await b.key('ArrowUp');
  assert.equal(await b.evaluate('document.activeElement.id'), 'reset-button');
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('#project-menu').hidden"), true);
  assert.equal(await b.evaluate('document.activeElement.id'), 'workspace');
  await b.key('?', { code: 'Slash', modifiers: 8 });
  assert.equal(await b.evaluate("document.querySelector('#help-panel').hidden"), false);
  assert.equal(await b.evaluate("document.querySelector('#welcome-button').disabled"), true);
  await click(b, '#close-help');
  assert.equal(await b.evaluate("document.querySelector('#help-button').getAttribute('aria-expanded')"), 'false');
  await click(b, '#theme-button');
  assert.equal(await b.evaluate('document.documentElement.dataset.uiTheme'), 'dark');
  assert.equal(await b.evaluate("document.querySelector('#theme-button').getAttribute('aria-label')"), 'Switch to light theme');
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('/' , { code: 'Slash' });
  await click(b, '[data-property-section="grid"]');
  await input(b, '#grid-base', 7, 'change');
  assert.deepEqual(await b.evaluate("[...document.querySelectorAll('[data-grid]')].map(button => button.textContent)"), ['56', '28', '14', '7', 'Off']);
  await click(b, '[data-grid="28"]');
  assert.equal((await saved(b)).grid, 28);
  assert.equal(await b.evaluate("document.querySelector('[data-grid=\"28\"]').getAttribute('aria-pressed')"), 'true');
});

test('property fields retain unfinished input and selection through rerenders; fonts and alignment commit once', async t => {
  const b = await setup(t);
  await properties(b, 'box');
  await b.evaluate("window.__width = document.querySelector('#box-width'); window.__width.select()");
  await b.page('Input.insertText', { text: '-' });
  await click(b, '#theme-button');
  assert.equal(await b.evaluate("document.querySelector('#box-width') === window.__width && window.__width.validity.badInput"), true);
  assert.equal((await saved(b)).boxes[0].w, 200);
  await b.evaluate('window.__width.select()');
  await b.page('Input.insertText', { text: '245' });
  await b.key('Tab');
  assert.equal((await saved(b)).boxes[0].w, 250);
  await b.key('Escape');
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="font"]');
  await input(b, '#box-font-family', 'google', 'change');
  await b.wait("document.activeElement.id === 'box-google-font'");
  await input(b, '#box-google-font', 'Roboto', 'change');
  assert.equal((await saved(b)).boxes[0].fontFamily, 'Roboto');
  await input(b, '#box-font-family', 'material', 'change');
  assert.equal(await b.evaluate('document.activeElement.id'), 'box-material-style');
  await input(b, '#box-material-style', 'Material Icons', 'change');
  assert.equal(await b.evaluate("document.querySelector('#box-font-weight').disabled && document.querySelector('#box-font-style').disabled"), true);
  await b.key('Escape');
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="text"]');
  await click(b, '[data-align-axis="alignY"][data-align-value="center"]');
  assert.equal((await saved(b)).boxes[0].alignY, 'center');
  assert.equal((await saved(b)).boxes[0].alignX, fixture.boxes[0].alignX);
  await b.evaluate("document.querySelector('#box-text').focus(); document.querySelector('#box-text').setSelectionRange(1, 3)");
  await click(b, '#theme-button');
  assert.deepEqual(await b.evaluate("[document.querySelector('#box-text').selectionStart, document.querySelector('#box-text').selectionEnd]"), [1, 3]);
});

test('canvas color drafts, legacy channels, validation, independent dark colors and undo', async t => {
  const b = await setup(t);
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="canvas"]');
  await click(b, '[data-canvas-color-property="background"]');
  await click(b, '#swatch-light');
  assert.equal(await b.evaluate('document.activeElement.id'), 'color-hex');
  await input(b, '#color-hex', '112233');
  assert.equal(await b.evaluate("document.querySelector('#color-mode').value"), 'rgb');
  assert.equal(await b.evaluate("document.querySelector('#workspace').style.backgroundColor"), 'rgb(17, 34, 51)');
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await input(b, '#color-hex', 'bad', 'change');
  await click(b, '#use-color');
  assert.equal(await b.evaluate("document.querySelector('#color-error').hidden"), false);
  await input(b, '#color-hex', '112233');
  await click(b, '#use-color');
  await input(b, '#dark-behavior', 'custom', 'change');
  await click(b, '#swatch-dark');
  await input(b, '#color-mode', 'hsb', 'change');
  await input(b, '#channel-1', 180);
  assert.equal(await b.evaluate("document.querySelector('#channel-1-value').value"), '180');
  await input(b, '#color-hex', 'aabbcc');
  await click(b, '#use-color');
  await click(b, '#save-color');
  assert.equal((await saved(b)).canvasColors.background, '#112233');
  assert.equal((await saved(b)).canvasDark.background.color, '#aabbcc');
  await b.key('Escape', { modifiers: 8 });
  await b.key('z', { code: 'KeyZ', modifiers: 2 });
  assert.deepEqual((await saved(b)).canvasColors, fixture.canvasColors);
  await b.key('/', { code: 'Slash' });
  await click(b, '[data-property-section="canvas"]');
  await click(b, '[data-canvas-color-property="background"]');
  await click(b, '#swatch-light');
  await input(b, '#color-hex', '445566');
  await b.key('Escape');
  assert.equal(await b.evaluate('document.activeElement.id'), 'swatch-light');
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('#workspace').style.backgroundColor"), 'rgb(255, 255, 255)');
  assert.deepEqual((await saved(b)).canvasColors, fixture.canvasColors);
});

test('Save dialog handles picker errors, cancellation and a busy native write', async t => {
  const b = await setup(t, { script: `window.__saveMode = 'error';
    window.__fileReady = navigator.storage.getDirectory().then(async dir => { window.__handle = await dir.getFileHandle('dialog.json', { create: true }); });
    window.showSaveFilePicker = () => window.__saveMode === 'pending' ? new Promise(resolve => window.__resolvePicker = resolve)
      : Promise.reject(new DOMException(window.__saveMode, window.__saveMode === 'abort' ? 'AbortError' : 'NotAllowedError'));` });
  await b.evaluate('window.__fileReady');
  await b.key('s', { code: 'KeyS', modifiers: 2 });
  await click(b, '#save-connected-file');
  await b.wait("!document.querySelector('#save-project-error').hidden && !document.querySelector('#save-once').disabled");
  assert.equal(await b.evaluate('document.activeElement.id'), 'save-connected-file');
  await b.evaluate("window.__saveMode = 'abort'");
  await click(b, '#save-connected-file');
  await b.wait("!document.querySelector('#save-connected-file').disabled");
  assert.equal(await b.evaluate("document.querySelector('#save-project-error').hidden"), true);
  await b.evaluate("window.__saveMode = 'pending'");
  await click(b, '#save-connected-file');
  assert.equal(await b.evaluate("document.querySelector('#close-save-project').disabled"), true);
  await b.key('Escape');
  assert.equal(await b.evaluate("document.querySelector('#save-project-dialog').open"), true);
  await b.evaluate('window.__resolvePicker(window.__handle)');
  await b.wait("!document.querySelector('#save-project-dialog').open && document.querySelector('#file-status').dataset.state === 'connected'");
  assert.equal(await b.evaluate('window.__handle.getFile().then(file => file.text()).then(JSON.parse).then(project => project.version)'), 1);
});

test('Open dialog shows file choices and opens a local copy without rewriting the file', async t => {
  const b = await setup(t, { script: `window.__fileReady = navigator.storage.getDirectory().then(async dir => {
    window.__handle = await dir.getFileHandle('open.json', { create: true });
    const writer = await window.__handle.createWritable(); await writer.write(${JSON.stringify(raw)}); await writer.close();
    window.showOpenFilePicker = async () => [window.__handle];
  });` });
  await b.evaluate('window.__fileReady');
  await b.key('o', { code: 'KeyO', modifiers: 2 });
  await b.wait("document.querySelector('#open-project-dialog').open && !document.querySelector('#open-local-copy').disabled");
  assert.equal(await b.evaluate('document.activeElement.id'), 'open-local-copy');
  assert.equal(await b.evaluate("document.querySelector('#open-project-name').textContent"), 'open.json');
  await click(b, '#open-local-copy');
  await b.wait("!document.querySelector('#open-project-dialog').open");
  await b.key('Tab'); await b.key('ArrowRight');
  assert.equal(await b.evaluate("document.querySelector('#file-status').dataset.state"), 'local');
  assert.equal(await b.evaluate('window.__handle.getFile().then(file => file.text())'), raw);
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

test('PNG Save As renders all boxes at 2× with margins, opacity and current theme, without changing the project', async t => {
  const project = structuredClone(fixture);
  project.boxes[0].x = -37;
  project.boxes[0].opacity = .5;
  project.boxes[1].x = 1200;
  project.canvasColors.background = '#123456';
  project.canvasDark = { background: { mode: 'custom', color: '#abcdef' } };
  const storage = JSON.stringify(project);
  const b = await setup(t, { storage, script: `
    window.__writes = 0;
    window.showSaveFilePicker = async options => {
      window.__pickerOptions = options;
      window.__pickerActive = navigator.userActivation.isActive;
      return { createWritable: async () => ({
        write: async blob => { window.__png = blob; }, close: async () => { window.__writes++; }
      }) };
    };` });
  // Selection, zoom and pan must not appear in the image or change its bounds.
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('a', { code: 'KeyA', modifiers: 2 });
  await b.evaluate("document.querySelector('#workspace').dispatchEvent(new WheelEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: 200, clientX: 400, clientY: 300 }))");
  for (const [index, background] of [[0, [18, 52, 86, 255]], [1, [171, 205, 239, 255]]]) {
    if (index) await click(b, '#theme-button');
    if (index) await b.key('e', { code: 'KeyE', modifiers: 2 });
    else {
      await click(b, '#project-menu-button');
      assert.equal(await b.evaluate(`(() => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('#export-png-button span'));
        return range.getClientRects().length;
      })()`), 1, 'Export PNG should stay on one line');
      await click(b, '#export-png-button');
    }
    await b.wait(`window.__writes === ${index + 1} && !document.querySelector('#export-png-button').disabled`);
    const image = await b.evaluate(`(async () => {
      const bitmap = await createImageBitmap(window.__png);
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      const fill = getComputedStyle(document.querySelector('.box-content')).backgroundColor;
      const reference = document.createElement('canvas').getContext('2d');
      reference.fillStyle = ${JSON.stringify(project.canvasColors.background)};
      if (${index}) reference.fillStyle = ${JSON.stringify(project.canvasDark.background.color)};
      reference.fillRect(0, 0, 1, 1); reference.globalAlpha = .5; reference.fillStyle = fill; reference.fillRect(0, 0, 1, 1);
      return { type: window.__png.type, width: canvas.width, height: canvas.height,
        margin: pixel(10, 10), fill: pixel(60, 70), expectedFill: [...reference.getImageData(0, 0, 1, 1).data],
        farBox: pixel(2600, 70), clean: !document.querySelector('#mock'), options: window.__pickerOptions, active: window.__pickerActive };
    })()`);
    assert.equal(image.type, 'image/png');
    assert.deepEqual([image.width, image.height], [2914, 280]);
    assert.deepEqual(image.margin, background);
    image.fill.forEach((channel, i) => assert.ok(Math.abs(channel - image.expectedFill[i]) <= 1));
    assert.notDeepEqual(image.farBox, background);
    assert.equal(image.clean, true);
    assert.equal(image.active, true);
    assert.match(image.options.suggestedName, /^mockout-\d{6}-\d{6}\.png$/);
    assert.deepEqual(image.options.types[0].accept, { 'image/png': ['.png'] });
    assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), storage);
    assert.equal(await b.evaluate("document.querySelector('#file-status').dataset.state"), 'local');
  }
});

test('PNG export shortcut downloads when Save As is unavailable', async t => {
  const b = await setup(t, { script: `window.showSaveFilePicker = undefined;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.endsWith('.png')) {
        window.__downloadName = this.download;
        window.__download = fetch(this.href).then(response => response.blob()).then(createImageBitmap).then(image => {
          const size = [image.width, image.height]; image.close(); return size;
        });
      }
    };` });
  assert.equal(await b.evaluate("document.querySelector('#export-png-button .menu-hint').textContent"), 'Ctrl+E');
  await b.evaluate("document.querySelector('#workspace').focus()");
  await b.key('e', { code: 'KeyE', modifiers: 2 });
  await b.wait('window.__download && !document.querySelector("#export-png-button").disabled');
  assert.deepEqual(await b.evaluate('window.__download'), [966, 280]);
  assert.match(await b.evaluate('window.__downloadName'), /\.png$/);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
});

test('PNG picker cancellation, write errors and empty boards leave the editor usable', async t => {
  const b = await setup(t, { script: `window.__mode = 'pending'; window.__pickerCalls = 0;
    window.showSaveFilePicker = () => {
      window.__pickerCalls++;
      if (window.__mode === 'pending') return new Promise((resolve, reject) => { window.__cancel = () => reject(new DOMException('Canceled', 'AbortError')); });
      return Promise.resolve({ createWritable: async () => { throw new Error('Write failed'); } });
    };` });
  await click(b, '#project-menu-button'); await click(b, '#export-png-button');
  assert.equal(await b.evaluate("document.querySelector('#export-png-button').disabled"), true);
  await b.evaluate('window.__cancel()');
  await b.wait("!document.querySelector('#export-png-button').disabled");
  assert.equal(await b.evaluate("document.querySelector('#notice').hidden"), true);
  await b.evaluate("window.__mode = 'error'");
  await click(b, '#project-menu-button'); await click(b, '#export-png-button');
  await b.wait("document.querySelector('#notice-message').textContent.includes('Write failed')");
  assert.equal(await b.evaluate("document.querySelector('#mock')"), null);
  assert.equal(await b.evaluate("localStorage.getItem('mockout-project')"), raw);
  await click(b, '#project-menu-button'); await click(b, '#new-blank-button');
  await b.wait("document.querySelectorAll('.box').length === 0");
  await click(b, '#project-menu-button'); await click(b, '#export-png-button');
  assert.match(await b.evaluate("document.querySelector('#notice-message').textContent"), /Draw a box/);
  assert.equal(await b.evaluate('window.__pickerCalls'), 2);
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
