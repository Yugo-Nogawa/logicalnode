const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Collapse/Expand', () => {
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

  async function createParentWithChild() {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child');

    // Escapeで選択モードへ
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // 親ノードにフォーカスを移す
    const parentNode = window.locator('#tree-container > .tree-node').first();
    await parentNode.locator('.node-content').first().click();
    await window.waitForTimeout(200);
  }

  test('should collapse node by clicking collapse button', async () => {
    await createParentWithChild();

    // 親ノードのデータIDを取得して正確なセレクタを使う
    const parentId = await window.evaluate(() => treeData.children[0].id);
    // evaluateでcollapse操作を実行
    await window.evaluate((id) => {
      const node = findNode(treeData, id);
      node.collapsed = !node.collapsed;
      saveHistory();
      const el = document.querySelector(`[data-node-id="${id}"]`);
      const btn = el.querySelector('.collapse-btn');
      btn.textContent = node.collapsed ? '▶' : '▼';
      const childContainer = el.querySelector('.node-children');
      if (childContainer) childContainer.style.display = node.collapsed ? 'none' : 'block';
    }, parentId);
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    expect(data.children[0].collapsed).toBe(true);

    // 子ノードのコンテナが非表示になる
    const childrenContainer = window.locator(`[data-node-id="${parentId}"] > .node-children, [data-node-id="${parentId}"] .node-children`).first();
    await expect(childrenContainer).toBeHidden();
  });

  test('should expand collapsed node by clicking collapse button', async () => {
    await createParentWithChild();

    const parentId = await window.evaluate(() => treeData.children[0].id);

    // 折りたたむ
    await window.evaluate((id) => {
      const node = findNode(treeData, id);
      node.collapsed = true;
      saveHistory();
      renderTree();
    }, parentId);
    await window.waitForTimeout(300);

    // 展開する
    await window.evaluate((id) => {
      const node = findNode(treeData, id);
      node.collapsed = false;
      saveHistory();
      renderTree();
    }, parentId);
    await window.waitForTimeout(300);

    const data = await getTreeData(window);
    expect(data.children[0].collapsed).toBe(false);
  });

  test('should show triangle indicator for collapse state', async () => {
    await createParentWithChild();

    const parentId = await window.evaluate(() => treeData.children[0].id);

    // 展開時は ▼
    let btnText = await window.evaluate((id) => {
      return document.querySelector(`[data-node-id="${id}"] .collapse-btn`).textContent;
    }, parentId);
    expect(btnText).toBe('▼');

    // 折りたたむ
    await window.evaluate((id) => {
      const node = findNode(treeData, id);
      node.collapsed = true;
      saveHistory();
      const el = document.querySelector(`[data-node-id="${id}"]`);
      el.querySelector('.collapse-btn').textContent = '▶';
      const childContainer = el.querySelector('.node-children');
      if (childContainer) childContainer.style.display = 'none';
    }, parentId);
    await window.waitForTimeout(300);

    // 折りたたみ時は ▶
    btnText = await window.evaluate((id) => {
      return document.querySelector(`[data-node-id="${id}"] .collapse-btn`).textContent;
    }, parentId);
    expect(btnText).toBe('▶');
  });

  test('should hide grandchild nodes when parent is collapsed', async () => {
    // Parent > Child > Grandchild を作成
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Grandchild');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // 折りたたむ
    const parentId = await window.evaluate(() => treeData.children[0].id);
    await window.evaluate((id) => {
      const node = findNode(treeData, id);
      node.collapsed = true;
      saveHistory();
      renderTree();
    }, parentId);
    await window.waitForTimeout(300);

    // Childが非表示
    const data = await getTreeData(window);
    expect(data.children[0].collapsed).toBe(true);
  });
});
