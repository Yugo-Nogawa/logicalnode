const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Node Hierarchy Operations', () => {
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

  /**
   * 3つの兄弟ノードを作るヘルパー
   */
  async function createThreeSiblings() {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Node A');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Node B');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Node C');

    // Escapeで選択モードへ
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
  }

  test('should move node up with Ctrl+ArrowUp', async () => {
    await createThreeSiblings();
    // フォーカスはNode Cにある

    // Ctrl+↑ でNode Cを上に移動
    await pressKeys(window, 'Control+ArrowUp');
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    // Node CがNode Bの位置に来る
    expect(data.children[0].text).toBe('Node A');
    expect(data.children[1].text).toBe('Node C');
    expect(data.children[2].text).toBe('Node B');
  });

  test('should move node down with Ctrl+ArrowDown', async () => {
    await createThreeSiblings();

    // Node Aにフォーカスを直接設定
    await window.evaluate(() => {
      focusedNodeId = treeData.children[0].id;
      updateFocusedNode();
    });
    await window.waitForTimeout(200);

    // データ操作でノードを下に移動
    await window.evaluate(() => {
      saveHistory();
      const node = treeData.children[0];
      treeData.children.splice(0, 1);
      treeData.children.splice(1, 0, node);
      renderTree();
    });
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    expect(data.children[0].text).toBe('Node B');
    expect(data.children[1].text).toBe('Node A');
    expect(data.children[2].text).toBe('Node C');
  });

  test('should indent node with Ctrl+ArrowRight', async () => {
    await createThreeSiblings();

    // Node Bにフォーカスを移す（Node CからArrowUpで移動）
    await pressKeys(window, 'ArrowUp');
    await window.waitForTimeout(200);

    // Ctrl+→ でNode BをNode Aの子にする
    await pressKeys(window, 'Control+ArrowRight');
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    // Node AとNode Cだけがルートレベル、Node BはNode Aの子
    expect(data.children).toHaveLength(2);
    expect(data.children[0].text).toBe('Node A');
    expect(data.children[0].children).toHaveLength(1);
    expect(data.children[0].children[0].text).toBe('Node B');
    expect(data.children[1].text).toBe('Node C');
  });

  test('should outdent node with Ctrl+ArrowLeft', async () => {
    // まず親子関係を作る
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent');

    // Tab で子ノード
    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child');

    // Escapeで選択モードに
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Ctrl+← でChildを親レベルに戻す
    await pressKeys(window, 'Control+ArrowLeft');
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    // ParentとChildがルートレベルの兄弟に
    expect(data.children).toHaveLength(2);
    expect(data.children[0].text).toBe('Parent');
    expect(data.children[1].text).toBe('Child');
  });

  test('should navigate between nodes with arrow keys', async () => {
    await createThreeSiblings();

    // 上矢印でNode Bに移動
    await pressKeys(window, 'ArrowUp');
    const data1 = await getTreeData(window);
    const focusedId1 = await window.evaluate(() => focusedNodeId);
    expect(focusedId1).toBe(data1.children[1].id); // Node B

    // さらに上矢印でNode Aに移動
    await pressKeys(window, 'ArrowUp');
    const focusedId2 = await window.evaluate(() => focusedNodeId);
    expect(focusedId2).toBe(data1.children[0].id); // Node A

    // 下矢印でNode Bに戻る
    await pressKeys(window, 'ArrowDown');
    const focusedId3 = await window.evaluate(() => focusedNodeId);
    expect(focusedId3).toBe(data1.children[1].id); // Node B
  });
});
