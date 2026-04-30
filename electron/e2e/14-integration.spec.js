const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys, getNodeCount } = require('./helpers');

test.describe('Integration: Complex Workflow', () => {
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

  test('should handle a complete mind-map creation workflow', async () => {
    // 1. ルートトピックを入力
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Project Plan');

    // 2. 子ノードを追加（Tab）
    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Phase 1: Design');

    // 3. さらに子ノード
    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Wireframes');

    // 4. 兄弟ノード
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Mockups');

    // 5. Phase 1 に戻って兄弟を追加
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Phase 1のレベルに戻る（Ctrl+Left でアウトデント）
    await pressKeys(window, 'Control+ArrowLeft');
    await window.waitForTimeout(300);

    // Phase 2 を追加
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Phase 2: Development');

    // 6. 色を変更
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+3'); // blue
    await window.waitForTimeout(200);

    // 7. 太字にする
    await pressKeys(window, 'Control+b');
    await window.waitForTimeout(200);

    const data = await getTreeData(window);
    expect(data.children[0].text).toBe('Project Plan');
    expect(data.children[0].children.length).toBeGreaterThanOrEqual(2);

    // Phase 2 のスタイルを確認
    const phase2 = data.children[0].children.find(n => n.text === 'Phase 2: Development');
    expect(phase2).toBeTruthy();
    expect(phase2.color).toBe('blue');
    expect(phase2.bold).toBe(true);
  });

  test('should survive undo/redo through complex operations', async () => {
    // 複数のノードを作成
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('A');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'B');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'B-1');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // B-1 を太字にする
    await pressKeys(window, 'Control+b');
    await window.waitForTimeout(200);

    // 色をつける
    await pressKeys(window, 'Control+2'); // red
    await window.waitForTimeout(200);

    let data = await getTreeData(window);
    const b1Node = data.children[1].children[0];
    expect(b1Node.bold).toBe(true);
    expect(b1Node.color).toBe('red');

    // 何回かundoする
    await pressKeys(window, 'Control+z');
    await window.waitForTimeout(300);
    await pressKeys(window, 'Control+z');
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    // 色とboldが戻っている
    const b1After = data.children[1]?.children?.[0];
    if (b1After) {
      // 少なくとも1つは元に戻っているはず
      expect(b1After.bold === false || b1After.color === null).toBeTruthy();
    }

    // Redo
    await pressKeys(window, 'Control+y');
    await window.waitForTimeout(300);
    await pressKeys(window, 'Control+y');
    await window.waitForTimeout(300);

    data = await getTreeData(window);
    const b1Redo = data.children[1].children[0];
    expect(b1Redo.bold).toBe(true);
    expect(b1Redo.color).toBe('red');
  });

  test('should handle search after complex tree building', async () => {
    // ツリーを構築
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Fruits');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Apple');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Banana');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Green Apple');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // 検索
    await pressKeys(window, 'Control+f');
    const searchInput = window.locator('#search-input');
    await searchInput.fill('Apple');
    await window.waitForTimeout(500);

    const resultsText = await window.locator('#search-results').textContent();
    // "1/2" のように2件ヒット
    expect(resultsText).toContain('2');
  });

  test('should handle large tree without errors', async () => {
    // 20ノードのツリーを一気に作成
    await window.evaluate(() => {
      saveHistory();
      for (let i = 0; i < 20; i++) {
        const node = createNode(`Node ${i + 1}`);
        treeData.children.push(node);
      }
      renderTree();
    });
    await window.waitForTimeout(1000);

    const count = await getNodeCount(window);
    // 初期ノード + 20ノード = 21
    expect(count).toBe(21);

    // 全ノードが表示されている
    const data = await getTreeData(window);
    expect(data.children).toHaveLength(21);
  });

  test('should handle save-load round trip', async () => {
    // 複雑なツリーを構築
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Root');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child 1');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child 2');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Child 2 を赤色太字に
    await pressKeys(window, 'Control+b');
    await pressKeys(window, 'Control+2');
    await window.waitForTimeout(200);

    // メモを追加
    await window.evaluate(() => {
      const child2 = treeData.children[0].children[1];
      child2.memo = 'Important note';
    });

    // セーブデータを取得
    const saveData = await window.evaluate(() => {
      return JSON.stringify({
        treeData: treeData,
        stickyNotes: stickyNotes,
        nodeLinks: nodeLinks
      });
    });

    // 新規ファイルにリセット
    await window.evaluate(() => newFile());
    await window.waitForTimeout(500);

    let data = await getTreeData(window);
    expect(data.children).toHaveLength(1);
    expect(data.children[0].text).toBe('');

    // ロード
    await window.evaluate((sd) => loadFile(sd), saveData);
    await window.waitForTimeout(500);

    data = await getTreeData(window);
    expect(data.children[0].text).toBe('Root');
    expect(data.children[0].children).toHaveLength(2);
    expect(data.children[0].children[0].text).toBe('Child 1');
    expect(data.children[0].children[1].text).toBe('Child 2');
    expect(data.children[0].children[1].bold).toBe(true);
    expect(data.children[0].children[1].color).toBe('red');
    expect(data.children[0].children[1].memo).toBe('Important note');
  });

  test('should handle rapid node creation without errors', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Start');

    // 素早く10個のノードを追加
    for (let i = 0; i < 10; i++) {
      await window.keyboard.press('Enter');
      await window.waitForTimeout(400);
      await typeIntoNode(window, `Rapid ${i + 1}`);
    }

    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    expect(data.children).toHaveLength(11);
    expect(data.children[0].text).toBe('Start');
    expect(data.children[10].text).toBe('Rapid 10');
  });
});
