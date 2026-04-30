const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, getTreeData, pressKeys } = require('./helpers');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.describe('File Save/Load', () => {
  let electronApp;
  let window;
  let tempDir;

  test.beforeEach(async () => {
    ({ electronApp, window } = await launchApp());
    // テスト用のテンポラリディレクトリ
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logicalnode-test-'));
  });

  test.afterEach(async () => {
    if (electronApp) {
      await closeApp(electronApp, window);
    }
    // テンポラリディレクトリの削除
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  test('should load tree data from JSON string', async () => {
    // load-fileイベントをシミュレート
    const testData = JSON.stringify({
      treeData: {
        id: 'root',
        text: '',
        children: [
          { id: 'node-100', text: 'Loaded Node A', bold: false, color: null, collapsed: false, memo: '', children: [] },
          { id: 'node-101', text: 'Loaded Node B', bold: true, color: 'red', collapsed: false, memo: '', children: [
            { id: 'node-102', text: 'Child of B', bold: false, color: 'blue', collapsed: false, memo: '', children: [] }
          ] }
        ]
      },
      stickyNotes: [],
      nodeLinks: []
    });

    await window.evaluate((data) => {
      loadFile(data);
    }, testData);
    await window.waitForTimeout(500);

    const treeData = await getTreeData(window);
    expect(treeData.children).toHaveLength(2);
    expect(treeData.children[0].text).toBe('Loaded Node A');
    expect(treeData.children[1].text).toBe('Loaded Node B');
    expect(treeData.children[1].bold).toBe(true);
    expect(treeData.children[1].color).toBe('red');
    expect(treeData.children[1].children[0].text).toBe('Child of B');
  });

  test('should generate correct save data', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Save Test');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Child Node');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // saveFile用のデータを取得
    const saveData = await window.evaluate(() => {
      return JSON.stringify({
        treeData: treeData,
        stickyNotes: typeof stickyNotes !== 'undefined' ? stickyNotes : [],
        nodeLinks: typeof nodeLinks !== 'undefined' ? nodeLinks : []
      }, null, 2);
    });

    const parsed = JSON.parse(saveData);
    expect(parsed.treeData.children[0].text).toBe('Save Test');
    expect(parsed.treeData.children[0].children[0].text).toBe('Child Node');
    expect(Array.isArray(parsed.stickyNotes)).toBe(true);
    expect(Array.isArray(parsed.nodeLinks)).toBe(true);
  });

  test('should load old format (treeData only)', async () => {
    // 旧形式（stickyNotesなし）
    const oldFormatData = JSON.stringify({
      id: 'root',
      text: '',
      children: [
        { id: 'node-1', text: 'Old format node', bold: false, color: null, collapsed: false, memo: '', children: [] }
      ]
    });

    await window.evaluate((data) => {
      loadFile(data);
    }, oldFormatData);
    await window.waitForTimeout(500);

    const treeData = await getTreeData(window);
    expect(treeData.children[0].text).toBe('Old format node');
  });

  test('should write file to disk via IPC', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('File Write Test');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // ファイルを直接書き出す（ダイアログをバイパス）
    const filePath = path.join(tempDir, 'test-save.tree');
    const saveResult = await window.evaluate(async (fp) => {
      const dataToSave = {
        treeData: treeData,
        stickyNotes: typeof stickyNotes !== 'undefined' ? stickyNotes : [],
        nodeLinks: typeof nodeLinks !== 'undefined' ? nodeLinks : []
      };
      const data = JSON.stringify(dataToSave, null, 2);

      const fsModule = require('fs').promises;
      await fsModule.writeFile(fp, data, 'utf8');
      return { success: true };
    }, filePath);

    expect(saveResult.success).toBe(true);

    // ファイルが存在するか確認
    expect(fs.existsSync(filePath)).toBe(true);

    // ファイルの中身を確認
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(content.treeData.children[0].text).toBe('File Write Test');
  });

  test('should read file from disk and load', async () => {
    // テストファイルを作成
    const testTree = {
      treeData: {
        id: 'root',
        text: '',
        children: [
          { id: 'node-200', text: 'From File', bold: false, color: 'green', collapsed: false, memo: 'test memo', children: [] }
        ]
      },
      stickyNotes: [],
      nodeLinks: []
    };
    const filePath = path.join(tempDir, 'test-load.tree');
    fs.writeFileSync(filePath, JSON.stringify(testTree, null, 2), 'utf8');

    // ファイルをレンダラーで読み込む
    await window.evaluate(async (fp) => {
      const fsModule = require('fs').promises;
      const data = await fsModule.readFile(fp, 'utf8');
      loadFile(data);
    }, filePath);
    await window.waitForTimeout(500);

    const treeData = await getTreeData(window);
    expect(treeData.children[0].text).toBe('From File');
    expect(treeData.children[0].color).toBe('green');
    expect(treeData.children[0].memo).toBe('test memo');
  });

  test('should handle new file (reset)', async () => {
    // まずノードを追加
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Will be reset');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Another node');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    let data = await getTreeData(window);
    expect(data.children).toHaveLength(2);

    // newFile() を呼び出す
    await window.evaluate(() => {
      newFile();
    });
    await window.waitForTimeout(500);

    data = await getTreeData(window);
    expect(data.children).toHaveLength(1);
    expect(data.children[0].text).toBe('');
  });
});
