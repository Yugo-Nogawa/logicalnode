const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');

test.describe('Node Styling', () => {
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

  test('should toggle bold with Ctrl+B', async () => {
    await typeIntoNode(window, 'Bold text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // Ctrl+B で太字にする
    await pressKeys(window, 'Control+b');

    let data = await getTreeData(window);
    expect(data.children[0].bold).toBe(true);

    // boldクラスが適用されている
    const input = await getFocusedNodeInput(window);
    await expect(input).toHaveClass(/bold/);

    // 再度Ctrl+Bで太字を解除
    await pressKeys(window, 'Control+b');

    data = await getTreeData(window);
    expect(data.children[0].bold).toBe(false);
  });

  test('should set red color with Ctrl+2', async () => {
    await typeIntoNode(window, 'Red text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await pressKeys(window, 'Control+2');

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('red');

    const input = await getFocusedNodeInput(window);
    await expect(input).toHaveClass(/color-red/);
  });

  test('should set blue color with Ctrl+3', async () => {
    await typeIntoNode(window, 'Blue text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await pressKeys(window, 'Control+3');

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('blue');
  });

  test('should set green color with Ctrl+4', async () => {
    await typeIntoNode(window, 'Green text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await pressKeys(window, 'Control+4');

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('green');
  });

  test('should set orange color with Ctrl+5', async () => {
    await typeIntoNode(window, 'Orange text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await pressKeys(window, 'Control+5');

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('orange');
  });

  test('should set purple color with Ctrl+6', async () => {
    await typeIntoNode(window, 'Purple text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await pressKeys(window, 'Control+6');

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('purple');
  });

  test('should reset color to default with Ctrl+1', async () => {
    await typeIntoNode(window, 'Some text');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // まず赤にする
    await pressKeys(window, 'Control+2');
    let data = await getTreeData(window);
    expect(data.children[0].color).toBe('red');

    // Ctrl+1でデフォルトに戻す
    await pressKeys(window, 'Control+1');
    data = await getTreeData(window);
    expect(data.children[0].color).toBeNull();
  });

  test('should apply color via toolbar button click', async () => {
    await typeIntoNode(window, 'Click color');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // 赤色ボタンをクリック
    const redBtn = window.locator('.color-btn[data-color="red"]');
    await redBtn.click();
    await window.waitForTimeout(200);

    const data = await getTreeData(window);
    expect(data.children[0].color).toBe('red');
  });

  test('should toggle bold via toolbar button click', async () => {
    await typeIntoNode(window, 'Bold click');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    const boldBtn = window.locator('#bold-btn');
    await boldBtn.click();
    await window.waitForTimeout(200);

    const data = await getTreeData(window);
    expect(data.children[0].bold).toBe(true);
  });
});
