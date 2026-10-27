import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('draw, save, reopen, and preview a box', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByRole('link', { name: 'GitHub' }))
    .toHaveAttribute('href', 'https://github.com/dannyben/minimock');
  await page.getByRole('button', { name: 'Close help' }).click();
  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(260, 220);
  await page.mouse.up();
  await expect(page.locator('.box')).toHaveCount(1);

  await page.keyboard.press('Enter');
  await page.locator('.text-editor').fill('Button');
  await page.keyboard.press('Enter');
  await expect(page.locator('.box-label')).toHaveText('Button');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('minimock.json');
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(project.version).toBe(1);
  expect(project.boxes).toHaveLength(1);
  expect(project.boxes[0].text).toBe('Button');

  await page.locator('.box').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.box')).toHaveCount(0);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'minimock.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator('.box-label')).toHaveText('Button');

  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Control+p');
  const popup = await popupPromise;
  await expect(popup).toHaveTitle('Minimock preview');
  await expect(popup.locator('#mock .box-label')).toHaveText('Button');
  await expect(popup.locator('#workspace, script')).toHaveCount(0);
});

test('unsupported saved data stays untouched', async ({ page }) => {
  await page.goto('/');
  const saved = JSON.stringify({ version: 2, boxes: [{ text: 'Keep me' }] });
  await page.evaluate(value => localStorage.setItem('onion-ui-canvas-v1', value), saved);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saved project is unsupported');

  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  await expect(page.locator('.box')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('onion-ui-canvas-v1'))).toBe(saved);
});

test('Ctrl+A selects canvas boxes but keeps native text selection in the editor', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('b');
  for (const [left, right] of [[100, 200], [250, 350]]) {
    await page.mouse.move(left, 140);
    await page.mouse.down();
    await page.mouse.move(right, 200);
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Help' }).click();
  await page.keyboard.press('Control+a');
  await expect(page.locator('.box.selected')).toHaveCount(2);
  expect(await page.evaluate(() => getSelection().toString())).toBe('');

  await page.keyboard.press('Escape');
  await page.locator('.box').first().click();
  await page.keyboard.press('Enter');
  await page.locator('.text-editor').fill('Original');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Updated');
  await expect(page.locator('.text-editor')).toHaveText('Updated');
  await page.keyboard.press('Enter');
  await expect(page.locator('.box').first().locator('.box-label')).toHaveText('Updated');
});

test('dropping a valid JSON project opens it, while an invalid one leaves it untouched', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  const project = await page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')));
  await page.keyboard.press('Delete');
  await expect(page.locator('.box')).toHaveCount(0);

  const drop = content => page.evaluate(json => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([json], 'minimock.json', { type: 'application/json' }));
    document.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, content);
  await drop(JSON.stringify(project));
  await expect(page.locator('.box')).toHaveCount(1);

  await drop(JSON.stringify({ version: 2, boxes: [] }));
  await expect(page.getByRole('alert')).toContainText('Could not open project');
  await expect(page.locator('.box')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')))).toEqual(project);
});

test('text editing stays in the label position and preserves line breaks', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(300, 240);
  await page.mouse.up();
  await page.keyboard.press('Enter');
  await page.locator('.text-editor').fill('Control');
  await page.keyboard.press('Enter');

  const before = await page.locator('.box-label').boundingBox();
  await page.keyboard.press('Enter');
  const during = await page.locator('.text-editor').boundingBox();
  expect(during.x).toBeCloseTo(before.x, 1);
  expect(during.y).toBeCloseTo(before.y, 1);
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Readout');
  await page.keyboard.press('Enter');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')));
  expect(saved.boxes[0].text).toBe('Control\nReadout');
});

test('keyboard and handle resizing can reach a rendered 5×5 box on the 5 px grid', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('4');
  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(120, 160);
  await page.mouse.up();
  await page.locator('.box').click({ button: 'right' });
  await page.locator('#box-padding-y').fill('3');
  await page.locator('#box-padding-y').press('Tab');
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');

  const sizes = () => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('onion-ui-canvas-v1')).boxes[0];
    const rect = document.querySelector('.box').getBoundingClientRect();
    return { saved: [saved.w, saved.h], rendered: [rect.width, rect.height] };
  });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowUp');
  }
  expect(await sizes()).toEqual({ saved: [5, 5], rendered: [5, 5] });

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
  }
  const handle = await page.locator('.handle[data-handle="se"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 15, handle.y + handle.height / 2 - 15);
  await page.mouse.up();
  expect(await sizes()).toEqual({ saved: [5, 5], rendered: [5, 5] });
});

test('zoom reaches 2000% without moving the point under the cursor', async ({ page }) => {
  await page.goto('/');
  const anchor = { x: 320, y: 240 };
  const atAnchor = () => page.evaluate(({ x, y }) => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('#canvas')).transform);
    return { zoom: matrix.a, worldX: (x - matrix.e) / matrix.a, worldY: (y - matrix.f) / matrix.a };
  }, anchor);
  const before = await atAnchor();
  await page.evaluate(({ x, y }) => document.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, clientX: x, clientY: y, deltaY: -2000,
  })), anchor);
  const after = await atAnchor();
  expect(after.zoom).toBe(20);
  expect(after.worldX).toBeCloseTo(before.worldX, 5);
  expect(after.worldY).toBeCloseTo(before.worldY, 5);

  await page.keyboard.press('Control+0');
  expect((await atAnchor()).zoom).toBe(1);
});

test('Shift+wheel pans sideways while ordinary wheel pans vertically', async ({ page }) => {
  await page.goto('/');
  const pan = () => page.evaluate(() => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('#canvas')).transform);
    return { x: matrix.e, y: matrix.f };
  });
  await page.mouse.move(500, 400);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Shift');
  expect(await pan()).toEqual({ x: -120, y: 0 });

  await page.mouse.wheel(0, 120);
  expect(await pan()).toEqual({ x: -120, y: -120 });
});

test('bare arrows pan an empty selection and move a selected box', async ({ page }) => {
  await page.goto('/');
  const pan = () => page.evaluate(() => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('#canvas')).transform);
    return { x: matrix.e, y: matrix.f };
  });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  expect(await pan()).toEqual({ x: -40, y: -40 });

  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  await page.keyboard.press('v');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')).boxes[0].x);
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')).boxes[0].x);
  expect(after).toBe(before + 10);
  expect(await pan()).toEqual({ x: -40, y: -40 });
});
