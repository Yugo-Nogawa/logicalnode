const { _electron: electron } = require('playwright');
const path = require('path');

/**
 * Electronアプリを起動し、メインウィンドウを返す
 */
async function launchApp() {
  const electronPath = require('electron');
  // ELECTRON_RUN_AS_NODE を除外（設定されているとElectronがNode.jsモードで動作してしまう）
  const env = { ...process.env, NODE_ENV: 'test' };
  delete env.ELECTRON_RUN_AS_NODE;
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '..')],
    env,
  });

  // メインウィンドウが開くのを待つ
  const window = await electronApp.firstWindow();
  // DOMの読み込みを待つ
  await window.waitForLoadState('domcontentloaded');
  // 初期レンダリングの完了を待つ
  await window.waitForSelector('#tree-container .tree-node', { timeout: 10000 });
  // 少し余裕を持たせる
  await window.waitForTimeout(300);

  return { electronApp, window };
}

/**
 * 現在フォーカスされているノードのinputを取得
 */
async function getFocusedNodeInput(window) {
  // focusedNodeIdからDOM要素を特定
  const focusedId = await window.evaluate(() => focusedNodeId);
  if (focusedId) {
    return window.locator(`[data-node-id="${focusedId}"] .node-input`).first();
  }
  // fallback: 最初のnode-input
  return window.locator('.node-input').first();
}

/**
 * 特定のノードIDのinput要素を取得
 */
async function getNodeInput(window, nodeId) {
  return window.locator(`[data-node-id="${nodeId}"] .node-content .node-input`).first();
}

/**
 * フォーカスされたノードのテキストを取得
 */
async function getFocusedNodeText(window) {
  const input = await getFocusedNodeInput(window);
  return input.inputValue();
}

/**
 * すべてのノード数を取得
 */
async function getNodeCount(window) {
  return window.locator('.tree-node').count();
}

/**
 * ノードにテキストを入力（ダブルクリックで編集モードに入る）
 */
async function typeIntoNode(window, text) {
  const input = await getFocusedNodeInput(window);
  // まずreadOnlyを解除してフォーカス
  await input.dblclick();
  await window.waitForTimeout(100);
  await input.fill(text);
  await window.waitForTimeout(100);
}

/**
 * ノードにフォーカスを当てる（クリック）
 */
async function focusNode(window, nodeId) {
  const nodeContent = window.locator(`[data-node-id="${nodeId}"] .node-content`).first();
  await nodeContent.click();
  await window.waitForTimeout(100);
}

/**
 * treeDataをJavaScriptで直接取得
 */
async function getTreeData(window) {
  return window.evaluate(() => JSON.parse(JSON.stringify(window.treeData || treeData)));
}

/**
 * focusedNodeIdをJavaScriptで直接取得
 */
async function getFocusedNodeId(window) {
  return window.evaluate(() => focusedNodeId);
}

/**
 * キーボードショートカットを送信
 */
async function pressKeys(window, keys) {
  await window.keyboard.press(keys);
  await window.waitForTimeout(200);
}

/**
 * アプリを安全に閉じる（未保存ダイアログをスキップ）
 */
async function closeApp(electronApp, window) {
  try {
    // 未保存変更フラグをリセットしてダイアログを回避
    await window.evaluate(() => {
      window.hasUnsavedChanges = false;
    });
  } catch (e) {
    // ウィンドウがすでに閉じている場合は無視
  }
  await electronApp.close();
}

module.exports = {
  launchApp,
  closeApp,
  getFocusedNodeInput,
  getNodeInput,
  getFocusedNodeText,
  getNodeCount,
  typeIntoNode,
  focusNode,
  getTreeData,
  getFocusedNodeId,
  pressKeys,
};
