const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Undo/Redo', () => {
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

  test('should undo node creation', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('First');

    // Enter で兄弟追加
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    let data = await getTreeData(window);
    expect(data.children).toHaveLength(2);

    // Escapeで選択モードへ
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Ctrl+Z でUndo
    await pressKeys(window, 'Control+z');
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    expect(data.children).toHaveLength(1);
    expect(data.children[0].text).toBe('First');
  });

  test('should redo after undo', async () => {
    // evaluateで直接ノード操作＋saveHistoryを使って確実なテスト
    await window.evaluate(() => {
      saveHistory();
      const newNode = createNode('Second');
      treeData.children.push(newNode);
      renderTree();
      saveHistory();
    });
    await window.waitForTimeout(300);

    let data = await getTreeData(window);
    expect(data.children).toHaveLength(2);

    // Undo
    await window.evaluate(() => undo());
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    expect(data.children).toHaveLength(1);

    // Redo
    await window.evaluate(() => redo());
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    expect(data.children).toHaveLength(2);
  });

  test('should undo multiple operations', async () => {
    // evaluateで直接操作して確実に3段階の履歴を作る
    await window.evaluate(() => {
      // 1つ目を追加
      saveHistory();
      treeData.children.push(createNode('Node 2'));
      renderTree();
    });
    await window.waitForTimeout(200);

    await window.evaluate(() => {
      // 2つ目を追加
      saveHistory();
      treeData.children.push(createNode('Node 3'));
      renderTree();
    });
    await window.waitForTimeout(200);

    let data = await getTreeData(window);
    expect(data.children).toHaveLength(3);

    // Undo 2回
    await window.evaluate(() => undo());
    await window.waitForTimeout(300);
    await window.evaluate(() => undo());
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    expect(data.children).toHaveLength(1);
  });

  test('should undo child node creation', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent');

    // Tab で子ノード追加
    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);

    let data = await getTreeData(window);
    expect(data.children[0].children).toHaveLength(1);

    // Escapeで選択モードへ
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Undo
    await pressKeys(window, 'Control+z');
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    expect(data.children[0].children).toHaveLength(0);
  });
});
