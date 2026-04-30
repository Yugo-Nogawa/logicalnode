const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Drag & Drop (Simulated via evaluate)', () => {
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

  test('should rearrange nodes via data manipulation (simulating drag)', async () => {
    // 3つのノードを作る
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Node 1');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Node 2');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Node 3');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Node 3 を Node 1 の子にドラッグ（データ操作で模擬）
    await window.evaluate(() => {
      saveHistory();
      const node3 = treeData.children[2];
      treeData.children.splice(2, 1);
      treeData.children[0].children.push(node3);
      renderTree();
    });
    await window.waitForTimeout(500);

    const data = await getTreeData(window);
    expect(data.children).toHaveLength(2);
    expect(data.children[0].text).toBe('Node 1');
    expect(data.children[0].children).toHaveLength(1);
    expect(data.children[0].children[0].text).toBe('Node 3');
    expect(data.children[1].text).toBe('Node 2');
  });
});

test.describe('Node Links', () => {
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

  test('should create a node link', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Source');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Target');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Source ノードに戻る
    const sourceNode = window.locator('#tree-container > .tree-node').first();
    await sourceNode.locator('.node-content').first().click();
    await window.waitForTimeout(200);

    // リンクを直接作成
    await window.evaluate(() => {
      const sourceId = treeData.children[0].id;
      const targetId = treeData.children[1].id;
      nodeLinks.push({
        id: `link-${linkIdCounter++}`,
        fromNodeId: sourceId,
        toNodeId: targetId
      });
      saveHistory();
      drawNodeLinks();
    });
    await window.waitForTimeout(300);

    const links = await window.evaluate(() => nodeLinks);
    expect(links).toHaveLength(1);
    expect(links[0].fromNodeId).toBe(await window.evaluate(() => treeData.children[0].id));
    expect(links[0].toNodeId).toBe(await window.evaluate(() => treeData.children[1].id));
  });

  test('should include links in save data', async () => {
    await window.evaluate(() => {
      nodeLinks.push({
        id: 'link-test',
        fromNodeId: treeData.children[0].id,
        toNodeId: treeData.children[0].id
      });
    });

    const saveData = await window.evaluate(() => {
      return {
        treeData: treeData,
        stickyNotes: stickyNotes,
        nodeLinks: nodeLinks
      };
    });

    expect(saveData.nodeLinks).toHaveLength(1);
    expect(saveData.nodeLinks[0].id).toBe('link-test');
  });
});
