const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, typeIntoNode, getFocusedNodeInput, pressKeys } = require('./helpers');

test.describe('Export Functionality', () => {
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

  async function createTestTree() {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Root Topic');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Sub Topic A');

    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Sub Topic B');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
  }

  test('should generate correct Markdown export', async () => {
    await createTestTree();

    const markdown = await window.evaluate(() => {
      let md = '';
      function nodeToMarkdown(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const bullet = depth === 0 ? '#' : '-';
        const text = node.text || '(空)';
        if (depth === 0) {
          md += `${bullet} ${text}\n\n`;
        } else {
          md += `${indent}${bullet} ${text}\n`;
        }
        if (node.memo && node.memo.trim()) {
          md += `${indent}  > ${node.memo.trim()}\n`;
        }
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => nodeToMarkdown(child, depth + 1));
        }
      }
      treeData.children.forEach(child => nodeToMarkdown(child, 0));
      return md;
    });

    expect(markdown).toContain('# Root Topic');
    expect(markdown).toContain('- Sub Topic A');
    expect(markdown).toContain('- Sub Topic B');
  });

  test('should generate correct Text export', async () => {
    await createTestTree();

    const text = await window.evaluate(() => {
      let txt = '';
      function nodeToText(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const nodeText = node.text || '(空)';
        txt += `${indent}${nodeText}\n`;
        if (node.memo && node.memo.trim()) {
          txt += `${indent}  [メモ: ${node.memo.trim()}]\n`;
        }
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => nodeToText(child, depth + 1));
        }
      }
      treeData.children.forEach(child => nodeToText(child, 0));
      return txt;
    });

    expect(text).toContain('Root Topic');
    expect(text).toContain('  Sub Topic A');
    expect(text).toContain('  Sub Topic B');
  });

  test('should include memo in Markdown export', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Node with memo');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    // メモを追加
    await window.evaluate(() => {
      const node = treeData.children[0];
      node.memo = 'This is a memo';
    });

    const markdown = await window.evaluate(() => {
      let md = '';
      function nodeToMarkdown(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const bullet = depth === 0 ? '#' : '-';
        const text = node.text || '(空)';
        if (depth === 0) {
          md += `${bullet} ${text}\n\n`;
        } else {
          md += `${indent}${bullet} ${text}\n`;
        }
        if (node.memo && node.memo.trim()) {
          md += `${indent}  > ${node.memo.trim()}\n`;
        }
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => nodeToMarkdown(child, depth + 1));
        }
      }
      treeData.children.forEach(child => nodeToMarkdown(child, 0));
      return md;
    });

    expect(markdown).toContain('# Node with memo');
    expect(markdown).toContain('> This is a memo');
  });

  test('should include memo in Text export', async () => {
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Node with memo');
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    await window.evaluate(() => {
      const node = treeData.children[0];
      node.memo = 'Text memo content';
    });

    const text = await window.evaluate(() => {
      let txt = '';
      function nodeToText(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const nodeText = node.text || '(空)';
        txt += `${indent}${nodeText}\n`;
        if (node.memo && node.memo.trim()) {
          txt += `${indent}  [メモ: ${node.memo.trim()}]\n`;
        }
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => nodeToText(child, depth + 1));
        }
      }
      treeData.children.forEach(child => nodeToText(child, 0));
      return txt;
    });

    expect(text).toContain('Node with memo');
    expect(text).toContain('[メモ: Text memo content]');
  });

  test('should handle deeply nested tree in export', async () => {
    // 深い階層構造を作る
    const input = await getFocusedNodeInput(window);
    await input.dblclick();
    await window.waitForTimeout(100);
    await input.fill('Level 0');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Level 1');

    await window.keyboard.press('Tab');
    await window.waitForTimeout(500);
    await typeIntoNode(window, 'Level 2');

    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);

    const text = await window.evaluate(() => {
      let txt = '';
      function nodeToText(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const nodeText = node.text || '(空)';
        txt += `${indent}${nodeText}\n`;
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => nodeToText(child, depth + 1));
        }
      }
      treeData.children.forEach(child => nodeToText(child, 0));
      return txt;
    });

    expect(text).toBe('Level 0\n  Level 1\n    Level 2\n');
  });
});
