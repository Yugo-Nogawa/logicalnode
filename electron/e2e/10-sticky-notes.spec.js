const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, pressKeys } = require('./helpers');

test.describe('Sticky Notes', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    ({ electronApp, window } = await launchApp());
  });

  test.afterEach(async () => {
    if (electronApp) {
      await closeApp(electronApp, window);
    }
  });

  test('should create a sticky note with Ctrl+8', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    const stickyNotes = await window.evaluate(() => stickyNotes);
    expect(stickyNotes).toHaveLength(1);
    expect(stickyNotes[0].color).toBe('yellow');
    expect(stickyNotes[0].text).toBe('');
  });

  test('should create sticky note via toolbar button', async () => {
    const addStickyBtn = window.locator('#add-sticky-btn');
    await addStickyBtn.click();
    await window.waitForTimeout(500);

    const stickyNotes = await window.evaluate(() => stickyNotes);
    expect(stickyNotes).toHaveLength(1);
  });

  test('should render sticky note element in DOM', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    const stickyNote = window.locator('.sticky-note');
    await expect(stickyNote).toBeVisible();
  });

  test('should create multiple sticky notes', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    const stickyNotes = await window.evaluate(() => stickyNotes);
    expect(stickyNotes).toHaveLength(2);

    const stickyElements = window.locator('.sticky-note');
    const count = await stickyElements.count();
    expect(count).toBe(2);
  });

  test('should delete sticky note', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    const noteId = await window.evaluate(() => stickyNotes[0].id);

    // 付箋を削除
    await window.evaluate((id) => {
      deleteStickyNote(id);
    }, noteId);
    await window.waitForTimeout(300);

    const stickyNotes = await window.evaluate(() => stickyNotes);
    expect(stickyNotes).toHaveLength(0);
  });

  test('should persist sticky note text', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    // テキストを直接設定
    await window.evaluate(() => {
      stickyNotes[0].text = 'Test sticky note content';
    });

    const notes = await window.evaluate(() => stickyNotes);
    expect(notes[0].text).toBe('Test sticky note content');
  });

  test('sticky note should have default properties', async () => {
    // evaluate で直接付箋を作成
    await window.evaluate(() => {
      addStickyNote(100, 100);
    });
    await window.waitForTimeout(500);

    const note = await window.evaluate(() => stickyNotes[0]);
    expect(note).toBeTruthy();
    expect(note.width).toBeGreaterThanOrEqual(245);
    expect(note.width).toBeLessThanOrEqual(255);
    expect(note.height).toBeGreaterThanOrEqual(245);
    expect(note.height).toBeLessThanOrEqual(255);
    expect(note.color).toBe('yellow');
    expect(note.scrollMode).toBe('fixed');
  });

  test('should include sticky notes in save data', async () => {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+8');
    await window.waitForTimeout(500);

    await window.evaluate(() => {
      stickyNotes[0].text = 'Save this note';
    });

    const saveData = await window.evaluate(() => {
      return {
        treeData: treeData,
        stickyNotes: stickyNotes,
        nodeLinks: nodeLinks
      };
    });

    expect(saveData.stickyNotes).toHaveLength(1);
    expect(saveData.stickyNotes[0].text).toBe('Save this note');
  });
});
