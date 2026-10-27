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

test('P toggles box or canvas properties and remains a normal input character', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('p');
  await expect(page.locator('#canvas-properties')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator('#inspector')).toBeHidden();

  await page.keyboard.press('b');
  await page.mouse.move(100, 140);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  await page.keyboard.press('p');
  await expect(page.locator('#box-properties')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator('#inspector')).toBeHidden();

  await page.keyboard.press('p');
  await page.locator('#box-text').click();
  await page.keyboard.press('p');
  await expect(page.locator('#box-text')).toHaveValue('p');
});

test('Ctrl+D copies contained boxes as one cancellable placement and one undo step', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('b');
  for (const [x1, y1, x2, y2] of [[100, 140, 250, 260], [130, 170, 160, 200]]) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
  }
  const project = () => page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')));
  const original = await project();
  await page.keyboard.press('v');
  await page.mouse.click(110, 150);
  await page.keyboard.press('Control+d');
  await expect(page.locator('.box.placing')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.evaluate(saved => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify(saved)], 'minimock.json', { type: 'application/json' }));
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, original);
  await expect(page.locator('.box.placing')).toHaveCount(2);
  expect(await project()).toEqual(original);
  await page.keyboard.press('Escape');
  await expect(page.locator('.box')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  expect(await project()).toEqual(original);

  await page.keyboard.press('Control+d');
  await page.keyboard.press('ArrowRight');
  await page.mouse.move(210, 150);
  await page.mouse.click(210, 150);
  const placed = await project();
  expect(placed.boxes).toHaveLength(4);
  expect(placed.boxes.slice(0, 2)).toEqual(original.boxes);
  expect(placed.boxes.slice(2).map(box => box.x)).toEqual(original.boxes.map(box => box.x + 120));
  await page.keyboard.press('Control+z');
  expect((await project()).boxes).toEqual(original.boxes);
});

test('moving overlapping copies of multiple containers leaves originals in place', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('b');
  for (const [x1, y1, x2, y2] of [
    [100, 140, 250, 260], [130, 170, 160, 200],
    [350, 140, 500, 260], [380, 170, 410, 200],
  ]) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
  }
  const project = () => page.evaluate(() => JSON.parse(localStorage.getItem('onion-ui-canvas-v1')));
  const original = await project();
  await page.keyboard.press('v');
  await page.mouse.click(110, 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(360, 150);
  await page.keyboard.up('Shift');
  await expect(page.locator('.box.selected')).toHaveCount(2);
  await page.keyboard.press('Control+d');
  await expect(page.locator('.box.placing')).toHaveCount(4);
  await page.keyboard.press('Enter');
  const placed = await project();
  expect(placed.boxes).toHaveLength(8);
  expect(await page.evaluate(() => document.elementFromPoint(140, 175).closest('.box').dataset.id))
    .toBe(String(placed.boxes[4].id));

  await page.mouse.move(125, 165);
  await page.mouse.down();
  await page.mouse.move(135, 165);
  await page.mouse.up();
  const moved = await project();
  for (const before of placed.boxes) {
    const after = moved.boxes.find(box => box.id === before.id);
    expect([after.x, after.y]).toEqual(before.id < placed.boxes[4].id
      ? [before.x, before.y] : [before.x + 10, before.y]);
  }
  expect(moved.boxes.filter(box => original.boxes.some(source => source.id === box.id)))
    .toEqual(original.boxes);
  const copyIds = new Set(placed.boxes.slice(4).map(box => box.id));
  expect(moved.boxes.slice(-4).every(box => copyIds.has(box.id))).toBe(true);
  expect(await page.evaluate(() => document.elementFromPoint(140, 175).closest('.box').dataset.id))
    .toBe(String(placed.boxes[4].id));
  await page.mouse.click(800, 500);
  await expect(page.locator('.box.selected')).toHaveCount(0);
  expect(await page.evaluate(() => document.elementFromPoint(140, 175).closest('.box').dataset.id))
    .toBe(String(placed.boxes[4].id));
});
