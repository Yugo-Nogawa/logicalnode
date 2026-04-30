const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, getNodeCount, getFocusedNodeId, getTreeData } = require('./helpers');

test.describe('App Launch & Initial State', () => {
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

  test('should launch the app and show a window', async () => {
    const title = await window.title();
    expect(title).toContain('Logical Node');
  });

  test('should display the toolbar', async () => {
    const toolbar = window.locator('#toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('should display the tree container', async () => {
    const container = window.locator('#tree-container');
    await expect(container).toBeVisible();
  });

  test('should create one initial empty node', async () => {
    const count = await getNodeCount(window);
    expect(count).toBe(1);
  });

  test('should focus the initial node', async () => {
    const focusedId = await getFocusedNodeId(window);
    expect(focusedId).toBeTruthy();
    expect(focusedId).toMatch(/^node-/);
  });

  test('should have correct initial tree data structure', async () => {
    const data = await getTreeData(window);
    expect(data.id).toBe('root');
    expect(data.children).toHaveLength(1);
    expect(data.children[0].text).toBe('');
    expect(data.children[0].bold).toBe(false);
    expect(data.children[0].color).toBeNull();
    expect(data.children[0].collapsed).toBe(false);
  });

  test('should not have unsaved changes initially', async () => {
    const hasUnsaved = await window.evaluate(() => window.hasUnsavedChanges);
    expect(hasUnsaved).toBe(false);
  });

  test('should display toolbar buttons', async () => {
    await expect(window.locator('#add-child-btn')).toBeVisible();
    await expect(window.locator('#add-sibling-btn')).toBeVisible();
    await expect(window.locator('#outdent-btn')).toBeVisible();
    await expect(window.locator('#indent-btn')).toBeVisible();
    await expect(window.locator('#move-up-btn')).toBeVisible();
    await expect(window.locator('#move-down-btn')).toBeVisible();
    await expect(window.locator('#bold-btn')).toBeVisible();
  });

  test('should display color buttons', async () => {
    const colorBtns = window.locator('.color-btn');
    const count = await colorBtns.count();
    expect(count).toBe(6); // black, red, blue, green, orange, purple
  });

  test('search bar should be hidden initially', async () => {
    const searchBar = window.locator('#search-bar');
    await expect(searchBar).toBeHidden();
  });
});
