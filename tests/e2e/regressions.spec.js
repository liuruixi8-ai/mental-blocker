'use strict';
const {
  test, expect, LEVELS, openLevel, play, swipe, pointerFor, hud, blocks,
  expectedBlocks, savedCompleted, load, loadWithCompleted,
} = require('./helpers');

test('restart resets the move counter and block positions (#1)', async ({ page }, testInfo) => {
  await openLevel(page, 2);
  await play(page, ['2,0 R', '2,1 L', '2,0 U'], { pointer: pointerFor(testInfo) });
  expect((await hud(page)).moves).toBe(3);
  await page.locator('#restart').click();
  await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
  expect(await blocks(page)).toEqual(expectedBlocks(2));
  expect(await hud(page)).toMatchObject({ moves: 0, overPar: false });
  await expect(page.locator('#moves')).toHaveText('0/2 moves');
  await swipe(page, 2, 0, 'R', { pointer: pointerFor(testInfo) });
  await expect(page.locator('#moves')).toHaveText('1/2 moves');
  await page.locator('#restart').click();
  await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
  expect(await blocks(page)).toEqual(expectedBlocks(2));
  await expect(page.locator('#moves')).toHaveText('0/2 moves');
});

test('locked levels reject pointer and keyboard activation (#2)', async ({ page }, testInfo) => {
  await openLevel(page, 1);
  await page.locator('#open-menu').click();
  const locked = page.locator('#level-grid [data-level="21"]');
  await expect(locked).toHaveJSProperty('disabled', true);
  // Physical input bypasses Playwright's aria-disabled actionability check.
  const box = await locked.boundingBox();
  if (pointerFor(testInfo) === 'touch') {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect(page.locator('#level-select')).toBeVisible();
  await page.locator('#level-grid [data-level="1"]').focus();
  await page.keyboard.press('Tab');
  await expect(locked).not.toBeFocused();
  // Even a synthetic event bypassing the native disabled attribute cannot enter a level.
  await locked.dispatchEvent('click');
  await expect(page.locator('#level-select')).toBeVisible();
  // Disabled levels cannot gain focus or react to keyboard activation.
  await page.locator('#level-grid').evaluate(el => {
    el.tabIndex = -1;
    el.focus();
  });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.locator('#level-select')).toBeVisible();
  await expect(page.locator('#level-label')).toHaveText(`LEVEL 1 OF ${LEVELS.length}`);
  expect(await savedCompleted(page)).toEqual([]);
});

test('leaving a safe zone removes the checkmark (#3)', async ({ page }, testInfo) => {
  const pointer = pointerFor(testInfo);
  await openLevel(page, 4);
  await play(page, ['1,2 L', '1,1 U'], { pointer });
  await expect(page.locator('.block.on-zone')).toHaveCount(1);
  expect((await hud(page)).zonesLeft).toBe(1);
  await swipe(page, 0, 1, 'L', { pointer });
  await expect(page.locator('.block.on-zone')).toHaveCount(0);
  expect((await hud(page)).zonesLeft).toBe(2);
});

test('gaps in saved progress block access to the last level (#4)', async ({ page }) => {
  const last = LEVELS.length;
  await loadWithCompleted(page, [last - 1]);
  const tile = page.locator(`#level-grid [data-level="${last}"]`);
  await expect(tile).toHaveJSProperty('disabled', true);
  await tile.dispatchEvent('click');
  await expect(page.locator('#game')).toBeHidden();
  await expect(page.locator('#message')).toBeHidden();
});

test('old completion flags cannot unlock levels and are retained', async ({ page }) => {
  await page.goto('/');
  const legacy = JSON.stringify({ completed: Array.from({ length: LEVELS.length }, (_, i) => i + 1) });
  await page.evaluate(raw => localStorage.setItem('safezone.v1', raw), legacy);
  await page.reload();
  await expect(page.locator('#level-grid button:disabled')).toHaveCount(LEVELS.length - 1);
  await expect(page.locator('#level-grid [data-level="1"]')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('safezone.v1'))).toBe(legacy);
});

test('an over-limit saved score cannot unlock the next puzzle', async ({ page }) => {
  await load(page, JSON.stringify({ bestMoves: { 1: 2 } }));
  await expect(page.locator('#level-grid [data-level="2"]')).toHaveJSProperty('disabled', true);
  await page.locator('#level-grid [data-level="2"]').dispatchEvent('click');
  await expect(page.locator('#game')).toBeHidden();
});

for (const [name, moves] of [
  ['one move over the limit', ['2,0 R', '2,1 L', '2,0 R', '2,1 U', '0,1 R']],
  ['several moves over the limit', ['2,0 R', '2,1 L', '2,0 R', '2,1 L', '2,0 R', '2,1 L', '2,0 R', '2,1 U', '0,1 R']],
]) {
  test(`solving ${name} keeps the next level locked, including after reload (#5, #6)`, async ({ page }, testInfo) => {
    await openLevel(page, 3);
    await play(page, moves, { pointer: pointerFor(testInfo) });
    expect((await hud(page)).moves).toBe(moves.length);
    await expect(page.locator('#message')).toBeVisible();
    await expect(page.locator('#message-text')).toContainText('no more than 4 moves');
    expect(await savedCompleted(page)).toEqual([1, 2]);
    await page.getByRole('button', { name: 'Level Select', exact: true }).click();
    await expect(page.locator('#level-grid [data-level="3"]')).toHaveAttribute('data-done', 'false');
    await expect(page.locator('#level-grid [data-level="4"]')).toHaveAttribute('data-locked', 'true');
    await page.reload();
    await expect(page.locator('#level-grid [data-level="4"]')).toHaveAttribute('data-locked', 'true');
  });
}
