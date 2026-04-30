const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, pressKeys } = require('./helpers');

test.describe('Search Functionality', () => {
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
   * 検索バーを確実に開くヘルパー
   * input/textareaにフォーカスがあるとCtrl+Fがブラウザのネイティブ検索を開くため、
   * まずEscapeでブラーしてからアプリの検索バーを開く
   */
  async function openSearchBar() {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await window.evaluate(() => showSearchBar());
    await window.waitForTimeout(300);
    // search-inputにフォーカスを確実に当てる
    await window.locator('#search-input').focus();
    await window.waitForTimeout(100);
  }

  async function createNodesWithText() {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Apple');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Banana');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Apple Pie');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Cherry');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
  }

  test('should open search bar with Ctrl+F', async () => {
    // Escape first to blur any focused input, then Ctrl+F
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    await pressKeys(window, 'Control+f');

    const searchBar = window.locator('#search-bar');
    await expect(searchBar).toBeVisible();

    const searchInput = window.locator('#search-input');
    await expect(searchInput).toBeFocused();
  });

  test('should close search bar with Escape', async () => {
    await openSearchBar();
    await expect(window.locator('#search-bar')).toBeVisible();

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await expect(window.locator('#search-bar')).toBeHidden();
  });

  test('should find matching nodes', async () => {
    await createNodesWithText();

    await openSearchBar();

    const searchInput = window.locator('#search-input');
    await searchInput.fill('Apple');
    await window.waitForTimeout(300);

    // 検索結果の表示を確認
    const searchResults = window.locator('#search-results');
    const resultsText = await searchResults.textContent();
    // "1 / 2" のように表示される（スペースあり）
    expect(resultsText).toContain('2');
  });

  test('should navigate between search results with Enter', async () => {
    await createNodesWithText();

    await openSearchBar();
    const searchInput = window.locator('#search-input');
    await searchInput.fill('Apple');
    await window.waitForTimeout(300);

    // Enterで次の結果に移動
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const resultsText = await window.locator('#search-results').textContent();
    expect(resultsText).toContain('2 / 2');
  });

  test('should navigate backward with Shift+Enter', async () => {
    await createNodesWithText();

    await openSearchBar();
    const searchInput = window.locator('#search-input');
    await searchInput.fill('Apple');
    await window.waitForTimeout(300);

    // search-inputにフォーカスを保持
    await searchInput.focus();
    await window.waitForTimeout(100);

    // まずEnterで進む
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Shift+Enterで戻る
    await searchInput.focus();
    await window.waitForTimeout(100);
    await window.keyboard.press('Shift+Enter');
    await window.waitForTimeout(300);

    const resultsText = await window.locator('#search-results').textContent();
    expect(resultsText).toContain('1 / 2');
  });

  test('should show no results for non-matching search', async () => {
    await createNodesWithText();

    await openSearchBar();
    const searchInput = window.locator('#search-input');
    await searchInput.fill('Zebra');
    await window.waitForTimeout(300);

    const resultsText = await window.locator('#search-results').textContent();
    expect(resultsText).toContain('結果なし');
  });

  test('should navigate with prev/next buttons', async () => {
    await createNodesWithText();

    await openSearchBar();
    const searchInput = window.locator('#search-input');
    await searchInput.fill('Apple');
    await window.waitForTimeout(300);

    // 次のボタンをクリック
    const nextBtn = window.locator('#search-next');
    await nextBtn.click();
    await window.waitForTimeout(300);

    let resultsText = await window.locator('#search-results').textContent();
    expect(resultsText).toContain('2 / 2');

    // 前のボタンをクリック
    const prevBtn = window.locator('#search-prev');
    await prevBtn.click();
    await window.waitForTimeout(300);

    resultsText = await window.locator('#search-results').textContent();
    expect(resultsText).toContain('1 / 2');
  });

  test('should close search with close button', async () => {
    await openSearchBar();
    await expect(window.locator('#search-bar')).toBeVisible();

    const closeBtn = window.locator('#search-close');
    await closeBtn.click();
    await window.waitForTimeout(200);

    await expect(window.locator('#search-bar')).toBeHidden();
  });
});
