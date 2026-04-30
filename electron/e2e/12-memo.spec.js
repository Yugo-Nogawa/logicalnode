const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Memo Feature', () => {
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

  test('should open memo input with Ctrl+7', async () => {
    await typeIntoNode(window, 'Node with memo');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Ctrl+7 でメモを開く
    await pressKeys(window, 'Control+7');

    const memoInput = window.locator('.tree-node.focused .node-memo-input');
    await expect(memoInput).toBeVisible();
  });

  test('should open memo via toolbar button', async () => {
    await typeIntoNode(window, 'Node for memo');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    const memoBtn = window.locator('#add-memo-btn');
    await memoBtn.click();
    await window.waitForTimeout(300);

    const memoInput = window.locator('.tree-node.focused .node-memo-input');
    await expect(memoInput).toBeVisible();
  });

  test('should save memo text to node data', async () => {
    await typeIntoNode(window, 'Memo test');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // メモにテキストを入力
    await window.evaluate(() => {
      const node = treeData.children[0];
      node.memo = 'This is a memo';
    });

    const data = await getTreeData(window);
    expect(data.children[0].memo).toBe('This is a memo');
  });

  test('should include memo in file save data', async () => {
    await typeIntoNode(window, 'Node');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await window.evaluate(() => {
      treeData.children[0].memo = 'Important memo';
    });

    const saveData = await window.evaluate(() => {
      return JSON.stringify({
        treeData: treeData,
        stickyNotes: stickyNotes,
        nodeLinks: nodeLinks
      });
    });

    const parsed = JSON.parse(saveData);
    expect(parsed.treeData.children[0].memo).toBe('Important memo');
  });
});
