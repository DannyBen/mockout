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
  await expect(page.locator('.text-editor')).toHaveValue('Updated');
  await page.keyboard.press('Enter');
  await expect(page.locator('.box').first().locator('.box-label')).toHaveText('Updated');
});
