const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Clipboard Operations', () => {
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

  async function createTwoNodes() {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Node A');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Node B');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
  }

  async function focusNodeById(nodeId) {
    await window.evaluate((id) => {
      focusedNodeId = id;
      updateFocusedNode();
    }, nodeId);
    await window.waitForTimeout(200);
  }

  test('should copy node with Ctrl+C', async () => {
    await createTwoNodes();

    // Node Bにフォーカスがある状態でコピー
    await pressKeys(window, 'Control+c');

    const clip = await window.evaluate(() => clipboard);
    expect(clip).not.toBeNull();
    expect(clip.text).toBe('Node B');
  });

  test('should paste node with Ctrl+V', async () => {
    await createTwoNodes();

    // Node Bをコピー
    await pressKeys(window, 'Control+c');

    // Node Aにevaluateで直接フォーカスを移動
    const nodeAId = await window.evaluate(() => treeData.children[0].id);
    await focusNodeById(nodeAId);

    // ペースト（Node Aの子になる）
    await pressKeys(window, 'Control+v');
    await window.waitForTimeout(500);

    const data = await getTreeData(window);
    expect(data.children[0].text).toBe('Node A');
    expect(data.children[0].children).toHaveLength(1);
    expect(data.children[0].children[0].text).toBe('Node B');
  });

  test('should cut node with Ctrl+X', async () => {
    await createTwoNodes();

    // Node Bをカット
    await pressKeys(window, 'Control+x');
    await window.waitForTimeout(500);

    const data = await getTreeData(window);
    expect(data.children).toHaveLength(1);
    expect(data.children[0].text).toBe('Node A');

    // クリップボードにNode Bがある
    const clip = await window.evaluate(() => clipboard);
    expect(clip.text).toBe('Node B');
  });

  test('should paste cut node to new location', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent A');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Parent B');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child of B');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Child of Bをカット
    await pressKeys(window, 'Control+x');
    await window.waitForTimeout(500);

    // Parent Aにevaluateで直接フォーカスを移動
    const nodeAId = await window.evaluate(() => treeData.children[0].id);
    await focusNodeById(nodeAId);

    // ペースト
    await pressKeys(window, 'Control+v');
    await window.waitForTimeout(500);

    const data = await getTreeData(window);
    expect(data.children[0].text).toBe('Parent A');
    expect(data.children[0].children).toHaveLength(1);
    expect(data.children[0].children[0].text).toBe('Child of B');
    expect(data.children[1].text).toBe('Parent B');
    expect(data.children[1].children).toHaveLength(0);
  });

  test('should copy node with children', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Parent');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // 親ノードにevaluateで直接フォーカスを移動
    const parentId = await window.evaluate(() => treeData.children[0].id);
    await focusNodeById(parentId);

    // Parentをコピー
    await pressKeys(window, 'Control+c');

    const clip = await window.evaluate(() => clipboard);
    expect(clip).not.toBeNull();
    expect(clip.text).toBe('Parent');
    expect(clip.children).toHaveLength(1);
    expect(clip.children[0].text).toBe('Child');
  });

  test('should paste creates independent copy (not reference)', async () => {
    await createTwoNodes();

    // Node Bをコピー
    await pressKeys(window, 'Control+c');

    // Node Aに移動してペースト
    const nodeAId = await window.evaluate(() => treeData.children[0].id);
    await focusNodeById(nodeAId);
    await pressKeys(window, 'Control+v');
    await window.waitForTimeout(500);

    const data = await getTreeData(window);
    // ペーストされたノードは元のNode Bとは異なるIDを持つ
    const originalNodeB = data.children[1];
    const pastedNodeB = data.children[0].children[0];
    expect(pastedNodeB).toBeTruthy();
    expect(pastedNodeB.text).toBe('Node B');
    expect(pastedNodeB.id).not.toBe(originalNodeB.id);
  });
});
