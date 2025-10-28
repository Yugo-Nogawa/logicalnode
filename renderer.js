const { ipcRenderer } = require('electron');

// ツリーデータ構造
let treeData = {
  id: 'root',
  text: '',
  children: []
};

let focusedNodeId = null;
let nodeIdCounter = 1;
let selectedNodeIds = []; // 複数選択されたノードのIDリスト

// Undo/Redo用の履歴管理
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 100;

// クリップボード
let clipboard = null;
let isCut = false;

// 未保存の変更を追跡
window.hasUnsavedChanges = false;
let savedTreeData = null;

// 拡大縮小の基準サイズ
const DEFAULT_FONT_SIZE = 16;

// 履歴に状態を保存
function saveHistory() {
  // 現在の位置より後の履歴を削除
  history = history.slice(0, historyIndex + 1);

  // 新しい状態を追加
  const snapshot = JSON.parse(JSON.stringify({
    treeData: treeData,
    focusedNodeId: focusedNodeId,
    nodeIdCounter: nodeIdCounter
  }));
  history.push(snapshot);

  // 履歴の上限を超えたら古いものを削除
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyIndex++;
  }

  // 未保存の変更をマーク
  checkUnsavedChanges();
}

// 未保存の変更をチェック
function checkUnsavedChanges() {
  if (savedTreeData === null) {
    window.hasUnsavedChanges = false;
  } else {
    const currentData = JSON.stringify(treeData);
    const savedData = JSON.stringify(savedTreeData);
    window.hasUnsavedChanges = currentData !== savedData;
  }
  // ウィンドウタイトルを更新
  ipcRenderer.invoke('update-window-title', window.hasUnsavedChanges);
}

// Undo
function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreFromHistory();
  }
}

// Redo
function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreFromHistory();
  }
}

// 履歴から状態を復元
function restoreFromHistory() {
  if (historyIndex >= 0 && historyIndex < history.length) {
    const snapshot = history[historyIndex];
    treeData = JSON.parse(JSON.stringify(snapshot.treeData));
    focusedNodeId = snapshot.focusedNodeId;
    nodeIdCounter = snapshot.nodeIdCounter;
    renderTree(false);
  }
}

// ノードの生成
function createNode(text = '', children = []) {
  return {
    id: `node-${nodeIdCounter++}`,
    text: text,
    children: children,
    bold: false,
    color: null, // null, 'red', 'blue', 'green', 'orange', 'purple'
    collapsed: false,
    memo: '' // メモ欄
  };
}

// ノードのディープコピー（新しいIDを割り当てる）
function deepCopyNode(node) {
  return {
    id: `node-${nodeIdCounter++}`,
    text: node.text,
    bold: node.bold,
    color: node.color,
    collapsed: node.collapsed,
    memo: node.memo || '',
    children: node.children.map(child => deepCopyNode(child))
  };
}

// ノードIDからノードを検索
function findNode(node, id) {
  if (node.id === id) return node;
  for (let child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// 親ノードを検索
function findParentNode(node, targetId, parent = null) {
  if (node.id === targetId) return parent;
  for (let child of node.children) {
    const found = findParentNode(child, targetId, node);
    if (found) return found;
  }
  return null;
}

// ノードの階層レベルを取得（ルートの子が1、その子が2...）
function getNodeLevel(nodeId) {
  let level = 0;
  let current = findNode(treeData, nodeId);

  while (current) {
    const parent = findParentNode(treeData, current.id);
    if (!parent || parent.id === 'root') {
      break;
    }
    level++;
    current = parent;
  }

  return level + 1; // ルートの子をレベル1とする
}

// すべてのノードを表示順序で取得（レベル情報付き）
function getAllNodesWithLevel(node = treeData, result = []) {
  if (node.id !== 'root') {
    const level = getNodeLevel(node.id);
    result.push({ node, level });
  }

  if (!node.collapsed && node.children) {
    node.children.forEach(child => getAllNodesWithLevel(child, result));
  }

  return result;
}

// 下矢印でのナビゲーション先を取得（同じ階層レベルで次のノード）
function getNextNavigableNode(nodeId) {
  const currentNode = findNode(treeData, nodeId);
  if (!currentNode) return null;

  const currentLevel = getNodeLevel(nodeId);
  const allNodes = getAllNodesWithLevel();

  // 現在のノードのインデックスを探す
  const currentIndex = allNodes.findIndex(item => item.node.id === nodeId);

  // 現在のノードより後ろで、同じレベルのノードを探す
  for (let i = currentIndex + 1; i < allNodes.length; i++) {
    if (allNodes[i].level === currentLevel) {
      return allNodes[i].node;
    }
  }

  return null;
}

// 上矢印でのナビゲーション先を取得（同じ階層レベルで前のノード）
function getPrevNavigableNode(nodeId) {
  const currentNode = findNode(treeData, nodeId);
  if (!currentNode) return null;

  const currentLevel = getNodeLevel(nodeId);
  const allNodes = getAllNodesWithLevel();

  // 現在のノードのインデックスを探す
  const currentIndex = allNodes.findIndex(item => item.node.id === nodeId);

  // 現在のノードより前で、同じレベルのノードを探す（逆順）
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (allNodes[i].level === currentLevel) {
      return allNodes[i].node;
    }
  }

  return null;
}

// 接続線を描画
function drawConnections() {
  // 既存の線を削除
  document.querySelectorAll('.connection-line').forEach(el => el.remove());

  // ルートレベルのノード間の縦線を描画
  const rootContainer = document.getElementById('tree-container');
  const rootNodes = Array.from(rootContainer.children).filter(el =>
    el.classList.contains('tree-node')
  );

  if (rootNodes.length > 1) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('connection-line');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';

    const firstContent = rootNodes[0].querySelector(':scope > .node-content');
    const lastContent = rootNodes[rootNodes.length - 1].querySelector(':scope > .node-content');

    if (firstContent && lastContent) {
      const containerRect = rootContainer.getBoundingClientRect();
      const firstRect = firstContent.getBoundingClientRect();
      const lastRect = lastContent.getBoundingClientRect();

      const firstCenterY = firstRect.top + firstRect.height / 2 - containerRect.top;
      const lastCenterY = lastRect.top + lastRect.height / 2 - containerRect.top;
      const x = firstRect.left - containerRect.left - 20;

      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', x);
      vLine.setAttribute('y1', firstCenterY);
      vLine.setAttribute('x2', x);
      vLine.setAttribute('y2', lastCenterY);
      vLine.setAttribute('stroke', '#d0d0d0');
      vLine.setAttribute('stroke-width', '1');
      svg.appendChild(vLine);

      // 各ルートノードへの横線
      rootNodes.forEach(node => {
        const content = node.querySelector(':scope > .node-content');
        if (!content) return;

        const rect = content.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2 - containerRect.top;
        const left = rect.left - containerRect.left;

        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', x);
        hLine.setAttribute('y1', centerY);
        hLine.setAttribute('x2', left);
        hLine.setAttribute('y2', centerY);
        hLine.setAttribute('stroke', '#d0d0d0');
        hLine.setAttribute('stroke-width', '1');
        svg.appendChild(hLine);
      });

      rootContainer.insertBefore(svg, rootContainer.firstChild);
    }
  }

  // すべての親ノードについて線を描画
  document.querySelectorAll('.node-children').forEach(childrenContainer => {
    const children = Array.from(childrenContainer.children).filter(el =>
      el.classList.contains('tree-node')
    );

    if (children.length === 0) return;

    const parentContent = childrenContainer.parentElement.querySelector('.node-content');
    if (!parentContent) return;

    // 親ノードの位置を取得
    const parentRect = parentContent.getBoundingClientRect();
    const containerRect = childrenContainer.getBoundingClientRect();

    const parentCenterY = parentRect.top + parentRect.height / 2 - containerRect.top;
    const parentRight = parentRect.right - containerRect.left;

    // SVGを作成
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('connection-line');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';

    // 各子ノードに線を引く
    children.forEach((child, index) => {
      const childContent = child.querySelector('.node-content');
      if (!childContent) return;

      const childRect = childContent.getBoundingClientRect();
      const childCenterY = childRect.top + childRect.height / 2 - containerRect.top;
      const childLeft = childRect.left - containerRect.left;

      // 親から最初の子へ横線
      if (index === 0) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', parentRight);
        line.setAttribute('y1', parentCenterY);
        line.setAttribute('x2', childLeft - 40);
        line.setAttribute('y2', parentCenterY);
        line.setAttribute('stroke', '#d0d0d0');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }

      // 子ノードへの横線
      const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hLine.setAttribute('x1', childLeft - 40);
      hLine.setAttribute('y1', childCenterY);
      hLine.setAttribute('x2', childLeft);
      hLine.setAttribute('y2', childCenterY);
      hLine.setAttribute('stroke', '#d0d0d0');
      hLine.setAttribute('stroke-width', '1');
      svg.appendChild(hLine);
    });

    // 兄弟ノード間の縦線（2つ以上の子がいる場合）
    if (children.length > 1) {
      const firstChild = children[0].querySelector('.node-content');
      const lastChild = children[children.length - 1].querySelector('.node-content');

      const firstRect = firstChild.getBoundingClientRect();
      const lastRect = lastChild.getBoundingClientRect();

      const firstCenterY = firstRect.top + firstRect.height / 2 - containerRect.top;
      const lastCenterY = lastRect.top + lastRect.height / 2 - containerRect.top;
      const x = firstRect.left - containerRect.left - 40;

      const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vLine.setAttribute('x1', x);
      vLine.setAttribute('y1', firstCenterY);
      vLine.setAttribute('x2', x);
      vLine.setAttribute('y2', lastCenterY);
      vLine.setAttribute('stroke', '#d0d0d0');
      vLine.setAttribute('stroke-width', '1');
      svg.appendChild(vLine);
    }

    childrenContainer.insertBefore(svg, childrenContainer.firstChild);
  });
}

// ツリーをレンダリング
function renderTree(shouldEnterEditMode = false) {
  const container = document.getElementById('tree-container');
  container.innerHTML = '';

  if (treeData.children.length === 0) {
    // 最初のノードを自動作成
    const firstNode = createNode('');
    treeData.children.push(firstNode);
    focusedNodeId = firstNode.id;
    shouldEnterEditMode = true; // 最初のノードは自動で編集モード
  }

  treeData.children.forEach(child => {
    container.appendChild(renderNode(child));
  });

  // 接続線を描画（DOMが完全に構築された後）
  setTimeout(() => {
    drawConnections();
  }, 0);

  // フォーカス状態を更新（パンくずリストも更新される）
  updateFocusedNode();

  // 編集モードに入る場合のみフォーカス
  if (focusedNodeId && shouldEnterEditMode) {
    setTimeout(() => {
      const focusedElement = document.querySelector(`[data-node-id="${focusedNodeId}"]`);
      if (focusedElement) {
        const input = focusedElement.querySelector('.node-input');
        if (input) {
          input.readOnly = false;
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }
    }, 0);
  }
}

// 個別のノードをレンダリング
function renderNode(node) {
  const nodeElement = document.createElement('div');
  nodeElement.className = 'tree-node';
  nodeElement.dataset.nodeId = node.id;

  if (node.id === focusedNodeId) {
    nodeElement.classList.add('focused');
  }

  if (node.children.length > 0) {
    nodeElement.classList.add('has-children');
  }

  const nodeContent = document.createElement('div');
  nodeContent.className = 'node-content';
  nodeContent.draggable = true;

  // ドラッグ＆ドロップイベント
  nodeContent.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    nodeElement.classList.add('dragging');
  });

  nodeContent.addEventListener('dragend', (e) => {
    nodeElement.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  });

  nodeElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    nodeElement.classList.add('drag-over');
  });

  nodeElement.addEventListener('dragleave', (e) => {
    if (e.target === nodeElement) {
      nodeElement.classList.remove('drag-over');
    }
  });

  nodeElement.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    nodeElement.classList.remove('drag-over');

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId === node.id) return; // 自分自身にはドロップできない

    const draggedNode = findNode(treeData, draggedId);
    const draggedParent = findParentNode(treeData, draggedId);

    if (!draggedNode || !draggedParent) return;

    // 子孫ノードへのドロップを防ぐ
    let current = node;
    while (current) {
      if (current.id === draggedId) return;
      current = findParentNode(treeData, current.id);
    }

    saveHistory();

    // ドラッグされたノードを元の位置から削除
    const siblings = draggedParent.children;
    const index = siblings.findIndex(n => n.id === draggedId);
    siblings.splice(index, 1);

    // ドロップ先に追加
    node.children.push(draggedNode);
    focusedNodeId = draggedNode.id;

    renderTree();
    updateToolbar();
  });

  // 折りたたみボタン（常に表示してインデントを揃える）
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'collapse-btn';

  if (node.children.length > 0) {
    collapseBtn.textContent = node.collapsed ? '▶' : '▼';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      node.collapsed = !node.collapsed;
      saveHistory();
      renderTree();
    });
  } else {
    // 子ノードがない場合は透明なスペーサーとして表示
    collapseBtn.style.visibility = 'hidden';
  }

  nodeContent.appendChild(collapseBtn);

  const input = document.createElement('textarea');
  input.className = 'node-input';
  input.value = node.text;
  input.placeholder = 'ノードを入力...';
  input.readOnly = true; // デフォルトは選択モード
  input.rows = 1; // 初期は1行

  // スタイルを適用
  if (node.bold) {
    input.style.fontWeight = 'bold';
  }
  if (node.color) {
    input.style.color = node.color;
  }

  // テキストエリアの自動リサイズ関数
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }

  // 初期サイズを設定
  setTimeout(autoResize, 0);

  // テキスト変更前の値を保存
  let previousText = node.text;
  let inputTimeout = null;

  // イベントリスナー
  input.addEventListener('input', (e) => {
    node.text = e.target.value;
    autoResize(); // テキスト変更時にリサイズ
    updateBreadcrumb(); // パンくずリストを更新

    // デバウンス処理: 入力が止まってから500ms後に履歴を保存
    if (inputTimeout) {
      clearTimeout(inputTimeout);
    }
    inputTimeout = setTimeout(() => {
      if (previousText !== node.text) {
        saveHistory();
        previousText = node.text;
      }
    }, 500);
  });

  input.addEventListener('click', () => {
    focusedNodeId = node.id;
    input.readOnly = false;
    input.focus();
    // 編集モード時はfocusedクラスを削除
    document.querySelectorAll('.tree-node').forEach(el => {
      el.classList.remove('focused');
    });
    previousText = node.text; // 編集開始時の値を保存
  });

  input.addEventListener('focus', () => {
    focusedNodeId = node.id;
    // フォーカス時はfocusedクラスを削除（編集モードの場合）
    if (!input.readOnly) {
      document.querySelectorAll('.tree-node').forEach(el => {
        el.classList.remove('focused');
      });
    } else {
      updateFocusedNode();
    }
    previousText = node.text; // フォーカス時の値を保存
  });

  input.addEventListener('blur', () => {
    // タイムアウトをクリア
    if (inputTimeout) {
      clearTimeout(inputTimeout);
      inputTimeout = null;
    }

    input.readOnly = true;
    // テキストが変更されていたら即座に履歴を保存
    if (previousText !== node.text) {
      saveHistory();
      previousText = node.text;
    }
    // 選択モードに戻ったらfocusedクラスを更新
    updateFocusedNode();
  });

  input.addEventListener('keydown', (e) => {
    handleKeyPress(e, node);
  });

  nodeContent.appendChild(input);

  // メモ欄（textareaで編集可能）
  const memoTextarea = document.createElement('textarea');
  memoTextarea.className = 'node-memo-input';
  memoTextarea.value = node.memo || '';
  memoTextarea.placeholder = 'メモ (Ctrl+7)...';
  memoTextarea.readOnly = true;
  memoTextarea.rows = 1;

  // メモがある場合は表示
  if (node.memo && node.memo.trim() !== '') {
    memoTextarea.style.display = 'block';
  } else {
    memoTextarea.style.display = 'none';
  }

  // メモの自動リサイズ
  function autoResizeMemo() {
    memoTextarea.style.height = 'auto';
    memoTextarea.style.height = memoTextarea.scrollHeight + 'px';
  }

  setTimeout(autoResizeMemo, 0);

  let previousMemo = node.memo || '';
  let memoTimeout = null;

  // メモの入力イベント
  memoTextarea.addEventListener('input', (e) => {
    node.memo = e.target.value;
    autoResizeMemo();

    // 表示/非表示を切り替え
    if (node.memo && node.memo.trim() !== '') {
      memoTextarea.style.display = 'block';
    } else {
      memoTextarea.style.display = 'none';
    }

    // デバウンス処理
    if (memoTimeout) {
      clearTimeout(memoTimeout);
    }
    memoTimeout = setTimeout(() => {
      if (previousMemo !== node.memo) {
        saveHistory();
        previousMemo = node.memo;
      }
    }, 500);
  });

  memoTextarea.addEventListener('click', (e) => {
    e.stopPropagation();
    focusedNodeId = node.id;
    memoTextarea.readOnly = false;
    memoTextarea.style.display = 'block';
    memoTextarea.focus();
    updateFocusedNode();
    previousMemo = node.memo || '';
  });

  memoTextarea.addEventListener('blur', () => {
    if (memoTimeout) {
      clearTimeout(memoTimeout);
      memoTimeout = null;
    }

    memoTextarea.readOnly = true;

    // 空の場合は非表示
    if (!node.memo || node.memo.trim() === '') {
      memoTextarea.style.display = 'none';
    }

    if (previousMemo !== node.memo) {
      saveHistory();
      previousMemo = node.memo || '';
    }
  });

  memoTextarea.addEventListener('keydown', (e) => {
    // Enterで編集を終了（Shift+Enterは改行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      memoTextarea.blur();
    }
    // Escapeで編集を終了
    else if (e.key === 'Escape') {
      e.preventDefault();
      memoTextarea.blur();
    }
  });

  // node-contentとメモを縦に並べるラッパー
  const nodeWrapper = document.createElement('div');
  nodeWrapper.className = 'node-wrapper';
  nodeWrapper.appendChild(nodeContent);
  nodeWrapper.appendChild(memoTextarea);

  nodeElement.appendChild(nodeWrapper);

  // 子ノードをレンダリング（折りたたまれていない場合のみ）
  if (node.children.length > 0 && !node.collapsed) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'node-children';

    node.children.forEach(child => {
      childrenContainer.appendChild(renderNode(child));
    });

    nodeElement.appendChild(childrenContainer);
  }

  return nodeElement;
}

// フォーカスされたノードのスタイルを更新
function updateFocusedNode() {
  document.querySelectorAll('.tree-node').forEach(el => {
    el.classList.remove('focused');
    el.classList.remove('selected');
  });

  if (focusedNodeId) {
    const focusedElement = document.querySelector(`[data-node-id="${focusedNodeId}"]`);
    if (focusedElement) {
      focusedElement.classList.add('focused');
    }
  }

  // 複数選択されたノードにスタイルを適用
  selectedNodeIds.forEach(nodeId => {
    const element = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (element && nodeId !== focusedNodeId) {
      element.classList.add('selected');
    }
  });

  // パンくずリストを更新
  updateBreadcrumb();
}

// パンくずリストを更新
function updateBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;

  if (!focusedNodeId) {
    breadcrumb.innerHTML = '';
    return;
  }

  // 現在のノードから親を辿ってパスを取得
  const path = [];
  let currentId = focusedNodeId;

  while (currentId) {
    const node = findNode(treeData, currentId);
    if (node) {
      path.unshift(node);
      const parent = findParentNode(treeData, currentId);
      currentId = parent && parent.id !== 'root' ? parent.id : null;
    } else {
      break;
    }
  }

  // パンくずリストを構築
  breadcrumb.innerHTML = '';
  path.forEach((node, index) => {
    const item = document.createElement('span');
    item.className = 'breadcrumb-item';
    // テキストを30文字に制限
    const text = node.text || '(空)';
    item.textContent = text.length > 30 ? text.substring(0, 30) + '...' : text;
    item.title = text; // ホバーで全文表示
    breadcrumb.appendChild(item);

    if (index < path.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '›';
      breadcrumb.appendChild(separator);
    }
  });
}

// キーボード操作の処理（編集モード内）
function handleKeyPress(e, node) {
  // Enter: 兄弟ノードを追加（Shift+Enterで上に、Enterで下に）
  if (e.key === 'Enter') {
    // キーリピートを無視
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation(); // イベントの伝播を停止
    const parent = findParentNode(treeData, node.id);
    if (parent) {
      saveHistory(); // 履歴を保存
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === node.id);
      const newNode = createNode('');
      // Shift+Enterで上に、Enterで下に挿入
      const insertIndex = e.shiftKey ? index : index + 1;
      siblings.splice(insertIndex, 0, newNode);
      focusedNodeId = newNode.id;
      renderTree(false); // 選択モードで作成
    }
  }

  // Tab: 子ノードを追加
  else if (e.key === 'Tab' && !e.shiftKey) {
    // キーリピートを無視
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation(); // イベントの伝播を停止
    saveHistory(); // 履歴を保存
    const newNode = createNode('');
    node.children.push(newNode);
    focusedNodeId = newNode.id;
    renderTree(true); // 自動フォーカス有効
  }

  // Escape: 編集モードから選択モードへ
  else if (e.key === 'Escape') {
    e.preventDefault();
    e.target.blur();
  }
}

// ファイル保存（上書き保存）
async function saveFile() {
  const data = JSON.stringify(treeData, null, 2);
  const result = await ipcRenderer.invoke('save-file', data);

  if (result.success) {
    console.log('File saved successfully');
    // 保存済みデータを更新
    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    ipcRenderer.invoke('update-window-title', false);
  } else if (!result.canceled) {
    console.error('Failed to save file:', result.error);
  }
}

// ファイル別名保存
async function saveFileAs() {
  const data = JSON.stringify(treeData, null, 2);
  const result = await ipcRenderer.invoke('save-file-as', data);

  if (result.success) {
    console.log('File saved as successfully');
    // 保存済みデータを更新
    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    ipcRenderer.invoke('update-window-title', false);
  } else if (!result.canceled) {
    console.error('Failed to save file:', result.error);
  }
}

// ファイル読み込み
function loadFile(data) {
  try {
    const parsed = JSON.parse(data);
    treeData = parsed;
    focusedNodeId = treeData.children.length > 0 ? treeData.children[0].id : null;

    // ノードIDカウンターを更新
    let maxId = 0;
    function updateCounter(node) {
      const match = node.id.match(/node-(\d+)/);
      if (match) {
        maxId = Math.max(maxId, parseInt(match[1]));
      }
      node.children.forEach(updateCounter);
    }
    treeData.children.forEach(updateCounter);
    nodeIdCounter = maxId + 1;

    // 読み込んだデータを保存済みとしてマーク
    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    ipcRenderer.invoke('update-window-title', false);

    renderTree();
  } catch (err) {
    console.error('Failed to parse file:', err);
  }
}

// 新規ファイル
function newFile() {
  treeData = {
    id: 'root',
    text: '',
    children: []
  };
  nodeIdCounter = 1;
  focusedNodeId = null;
  savedTreeData = null;
  window.hasUnsavedChanges = false;
  renderTree();
}

// グローバルキーボードイベント（選択モード用）
document.addEventListener('keydown', (e) => {
  // 入力中（編集モード）は無視
  if (document.activeElement.tagName === 'TEXTAREA') {
    return;
  }

  const focusedNode = findNode(treeData, focusedNodeId);
  if (!focusedNode) return;

  // ノード追加系のキーはリピートを無視
  if (e.repeat && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Delete')) {
    e.preventDefault();
    return;
  }

  // ArrowUp: 前のノードへ移動 or Ctrl+ArrowUp: ノードを上に移動
  if (e.key === 'ArrowUp') {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + ArrowUp: 同じ階層レベルで上のノードの位置に移動
      // 複数選択時は全て移動
      const nodesToMove = selectedNodeIds.length > 0 ?
        selectedNodeIds.map(id => findNode(treeData, id)).filter(n => n) :
        [focusedNode];

      const prevNode = getPrevNavigableNode(focusedNode.id);

      if (!prevNode) {
        return;
      }

      const isTargetSelected = nodesToMove.find(n => n.id === prevNode.id);
      if (isTargetSelected) {
        return;
      }

      saveHistory();

      // 移動先の親を先に取得
      const targetParent = findParentNode(treeData, prevNode.id);
      if (!targetParent) {
        return;
      }

      const targetIndex = targetParent.children.findIndex(n => n.id === prevNode.id);
      if (targetIndex === -1) {
        return;
      }

      // 移動するノードを親ごとにグループ化
      const nodesByParent = new Map();
      nodesToMove.forEach(node => {
        const parent = findParentNode(treeData, node.id);
        if (parent) {
          if (!nodesByParent.has(parent.id)) {
            nodesByParent.set(parent.id, []);
          }
          nodesByParent.get(parent.id).push(node);
        }
      });

      // 各親から削除（インデックスの大きい順に）
      nodesByParent.forEach((nodes, parentId) => {
        const parent = findNode(treeData, parentId);
        if (parent) {
          const nodesWithIndex = nodes.map(node => ({
            node: node,
            index: parent.children.findIndex(n => n.id === node.id)
          })).sort((a, b) => b.index - a.index);

          nodesWithIndex.forEach(({ node, index }) => {
            if (index !== -1) {
              parent.children.splice(index, 1);
            }
          });
        }
      });

      // 移動先の親に一括挿入
      targetParent.children.splice(targetIndex, 0, ...nodesToMove);

      renderTree();
      updateToolbar();
    } else if (e.shiftKey) {
      // Shift + ArrowUp: 範囲選択を拡張
      const prevNode = getPrevNavigableNode(focusedNode.id);
      if (prevNode) {
        if (!selectedNodeIds.includes(focusedNode.id)) {
          selectedNodeIds.push(focusedNode.id);
        }
        focusedNodeId = prevNode.id;
        if (!selectedNodeIds.includes(prevNode.id)) {
          selectedNodeIds.push(prevNode.id);
        }
        renderTree();
        updateToolbar();
      }
    } else {
      // ArrowUp: 前のノードへナビゲート（選択解除）
      selectedNodeIds = [];
      const prevNode = getPrevNavigableNode(focusedNode.id);
      if (prevNode) {
        focusedNodeId = prevNode.id;
        renderTree();
        updateToolbar();
      }
    }
  }

  // ArrowDown: 次のノードへ移動 or Ctrl+ArrowDown: ノードを下に移動
  else if (e.key === 'ArrowDown') {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + ArrowDown: 同じ階層レベルで下のノードの位置に移動
      // 複数選択時は全て移動
      const nodesToMove = selectedNodeIds.length > 0 ?
        selectedNodeIds.map(id => findNode(treeData, id)).filter(n => n) :
        [focusedNode];

      const nextNode = getNextNavigableNode(focusedNode.id);

      if (!nextNode) {
        return;
      }

      const isTargetSelected = nodesToMove.find(n => n.id === nextNode.id);
      if (isTargetSelected) {
        return;
      }

      saveHistory();

      // 移動先の親を先に取得
      const targetParent = findParentNode(treeData, nextNode.id);
      if (!targetParent) {
        return;
      }

      const targetIndex = targetParent.children.findIndex(n => n.id === nextNode.id);
      if (targetIndex === -1) {
        return;
      }

      // 移動するノードを親ごとにグループ化
      const nodesByParent = new Map();
      nodesToMove.forEach(node => {
        const parent = findParentNode(treeData, node.id);
        if (parent) {
          if (!nodesByParent.has(parent.id)) {
            nodesByParent.set(parent.id, []);
          }
          nodesByParent.get(parent.id).push(node);
        }
      });

      // 各親から削除（インデックスの大きい順に）
      nodesByParent.forEach((nodes, parentId) => {
        const parent = findNode(treeData, parentId);
        if (parent) {
          const nodesWithIndex = nodes.map(node => ({
            node: node,
            index: parent.children.findIndex(n => n.id === node.id)
          })).sort((a, b) => b.index - a.index);

          nodesWithIndex.forEach(({ node, index }) => {
            if (index !== -1) {
              parent.children.splice(index, 1);
            }
          });
        }
      });

      // 移動先の親に挿入（次のノードの後ろに）
      targetParent.children.splice(targetIndex + 1, 0, ...nodesToMove);

      renderTree();
      updateToolbar();
    } else if (e.shiftKey) {
      // Shift + ArrowDown: 範囲選択を拡張
      const nextNode = getNextNavigableNode(focusedNode.id);
      if (nextNode) {
        if (!selectedNodeIds.includes(focusedNode.id)) {
          selectedNodeIds.push(focusedNode.id);
        }
        focusedNodeId = nextNode.id;
        if (!selectedNodeIds.includes(nextNode.id)) {
          selectedNodeIds.push(nextNode.id);
        }
        renderTree();
        updateToolbar();
      }
    } else {
      // ArrowDown: 次のノードへナビゲート（選択解除）
      selectedNodeIds = [];
      const nextNode = getNextNavigableNode(focusedNode.id);
      if (nextNode) {
        focusedNodeId = nextNode.id;
        renderTree();
        updateToolbar();
      }
    }
  }

  // ArrowRight: 子ノードへ移動 or Ctrl+ArrowRight: ノードを右に移動（インデント）
  else if (e.key === 'ArrowRight') {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + ArrowRight: ノードを右に移動（前の兄弟の子にする）
      // 複数選択時は全て移動
      const nodesToMove = selectedNodeIds.length > 0 ?
        selectedNodeIds.map(id => findNode(treeData, id)).filter(n => n) :
        [focusedNode];

      // 最初のノードの親と位置を取得
      const parent = findParentNode(treeData, focusedNode.id);

      if (parent) {
        const siblings = parent.children;
        const index = siblings.findIndex(n => n.id === focusedNode.id);

        if (index > 0) {
          // 前の兄弟が選択されていないか確認
          const prevSibling = siblings[index - 1];
          const isPrevSiblingSelected = nodesToMove.find(n => n.id === prevSibling.id);

          if (isPrevSiblingSelected) {
            return;
          }

          saveHistory();

          // 移動するノードを親ごとにグループ化
          const nodesByParent = new Map();
          nodesToMove.forEach(node => {
            const p = findParentNode(treeData, node.id);
            if (p) {
              if (!nodesByParent.has(p.id)) {
                nodesByParent.set(p.id, []);
              }
              nodesByParent.get(p.id).push(node);
            }
          });

          // 各親から削除（インデックスの大きい順に）
          nodesByParent.forEach((nodes, parentId) => {
            const p = findNode(treeData, parentId);
            if (p) {
              const nodesWithIndex = nodes.map(node => ({
                node: node,
                index: p.children.findIndex(n => n.id === node.id)
              })).sort((a, b) => b.index - a.index);

              nodesWithIndex.forEach(({ node, index }) => {
                if (index !== -1) {
                  p.children.splice(index, 1);
                }
              });
            }
          });

          // 前の兄弟の子として追加
          prevSibling.children.push(...nodesToMove);

          renderTree();
          updateToolbar();
        }
      }
    } else {
      // ArrowRight: 子ノードへナビゲート
      if (focusedNode.children.length > 0) {
        focusedNodeId = focusedNode.children[0].id;
        renderTree();
        updateToolbar();
      }
    }
  }

  // ArrowLeft: 親ノードへ移動 or Ctrl+ArrowLeft: ノードを左に移動（アウトデント）
  else if (e.key === 'ArrowLeft') {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + ArrowLeft: ノードを左に移動（親の兄弟にする）
      // 複数選択時は全て移動
      const nodesToMove = selectedNodeIds.length > 0 ?
        selectedNodeIds.map(id => findNode(treeData, id)).filter(n => n) :
        [focusedNode];

      const parent = findParentNode(treeData, focusedNode.id);
      if (parent && parent.id !== 'root') {
        const grandParent = findParentNode(treeData, parent.id);
        if (grandParent) {
          // 親ノード自体が選択されていないか確認
          const isParentSelected = nodesToMove.find(n => n.id === parent.id);
          if (isParentSelected) {
            return;
          }

          saveHistory();

          // 移動先の位置を先に取得
          const parentIndex = grandParent.children.findIndex(n => n.id === parent.id);

          // 移動するノードを親ごとにグループ化
          const nodesByParent = new Map();
          nodesToMove.forEach(node => {
            const p = findParentNode(treeData, node.id);
            if (p) {
              if (!nodesByParent.has(p.id)) {
                nodesByParent.set(p.id, []);
              }
              nodesByParent.get(p.id).push(node);
            }
          });

          // 各親から削除（インデックスの大きい順に）
          nodesByParent.forEach((nodes, parentId) => {
            const p = findNode(treeData, parentId);
            if (p) {
              const nodesWithIndex = nodes.map(node => ({
                node: node,
                index: p.children.findIndex(n => n.id === node.id)
              })).sort((a, b) => b.index - a.index);

              nodesWithIndex.forEach(({ node, index }) => {
                if (index !== -1) {
                  p.children.splice(index, 1);
                }
              });
            }
          });

          // 祖父ノードの子として追加（親の後ろに）
          grandParent.children.splice(parentIndex + 1, 0, ...nodesToMove);
          renderTree();
          updateToolbar();
        }
      }
    } else {
      // ArrowLeft: 親ノードへナビゲート
      const parent = findParentNode(treeData, focusedNode.id);
      if (parent && parent.id !== 'root') {
        focusedNodeId = parent.id;
        renderTree();
        updateToolbar();
      }
    }
  }

  // Escape: 複数選択を解除
  else if (e.key === 'Escape') {
    e.preventDefault();
    if (selectedNodeIds.length > 0) {
      selectedNodeIds = [];
      renderTree();
      updateToolbar();
    }
  }

  // Enter: 編集モードに入る（選択モード時）
  else if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.querySelector(`[data-node-id="${focusedNodeId}"] .node-input`);
    if (input) {
      input.readOnly = false;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  // Tab: 子ノードを追加（選択モード時）
  else if (e.key === 'Tab') {
    e.preventDefault();
    saveHistory(); // 履歴を保存
    const newNode = createNode('');
    focusedNode.children.push(newNode);
    focusedNodeId = newNode.id;
    renderTree(true); // 自動フォーカス有効
  }

  // Delete: ノードを削除（選択モード時）
  else if (e.key === 'Delete') {
    e.preventDefault();

    // 複数選択されている場合は全て削除
    if (selectedNodeIds.length > 0) {
      saveHistory();

      selectedNodeIds.forEach(nodeId => {
        const node = findNode(treeData, nodeId);
        const parent = findParentNode(treeData, nodeId);
        if (node && parent) {
          const siblings = parent.children;
          const index = siblings.findIndex(n => n.id === nodeId);
          if (index !== -1) {
            siblings.splice(index, 1);
          }
        }
      });

      selectedNodeIds = [];

      // フォーカスを適切な位置に移動
      const allNodes = getAllNodesFlat(treeData);
      if (allNodes.length > 0) {
        focusedNodeId = allNodes[0].id;
      } else {
        focusedNodeId = null;
      }

      renderTree();
    } else {
      // 単一ノードの削除
      const parent = findParentNode(treeData, focusedNode.id);
      if (parent) {
        saveHistory(); // 履歴を保存
        const siblings = parent.children;
        const index = siblings.findIndex(n => n.id === focusedNode.id);
        siblings.splice(index, 1);

        // フォーカスを移動
        if (siblings.length > 0) {
          focusedNodeId = siblings[Math.max(0, index - 1)].id;
        } else if (parent.id !== 'root') {
          focusedNodeId = parent.id;
        } else {
          focusedNodeId = null;
        }

        renderTree();
      }
    }
  }

  // Ctrl/Cmd + Z: Undo
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  // Ctrl/Cmd + Shift + Z または Ctrl/Cmd + Y: Redo
  else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
           ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
    e.preventDefault();
    redo();
  }

  // スペースまたはF2: 編集モードに入る
  else if (e.key === ' ' || e.key === 'F2') {
    e.preventDefault();
    const input = document.querySelector(`[data-node-id="${focusedNodeId}"] .node-input`);
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  // Ctrl/Cmd + B: 太字切り替え
  else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    focusedNode.bold = !focusedNode.bold;
    saveHistory();
    renderTree();
    updateToolbar();
  }

  // Ctrl/Cmd + 1-5: 色変更
  else if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const colors = [null, 'red', 'blue', 'green', 'orange', 'purple'];
    focusedNode.color = colors[parseInt(e.key)];
    saveHistory();
    renderTree();
    updateToolbar();
  }

  // Ctrl/Cmd + 0: ズームリセット
  else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    const html = document.documentElement;
    html.style.fontSize = DEFAULT_FONT_SIZE + 'px';
    setTimeout(() => drawConnections(), 10);
  }

  // Ctrl/Cmd + Plus/=: ズームイン
  else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    const html = document.documentElement;
    const currentSize = parseFloat(getComputedStyle(html).fontSize);
    html.style.fontSize = (currentSize + 1) + 'px';
    setTimeout(() => drawConnections(), 10);
  }

  // Ctrl/Cmd + Minus/-: ズームアウト
  else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
    e.preventDefault();
    const html = document.documentElement;
    const currentSize = parseFloat(getComputedStyle(html).fontSize);
    if (currentSize > 10) {
      html.style.fontSize = (currentSize - 1) + 'px';
    }
    setTimeout(() => drawConnections(), 10);
  }

  // Ctrl/Cmd + 7: メモ編集
  else if ((e.ctrlKey || e.metaKey) && e.key === '7') {
    e.preventDefault();
    const memoInput = document.querySelector(`[data-node-id="${focusedNodeId}"] .node-memo-input`);
    if (memoInput) {
      memoInput.readOnly = false;
      memoInput.style.display = 'block';
      memoInput.focus();
      memoInput.setSelectionRange(memoInput.value.length, memoInput.value.length);
    }
  }

  // Ctrl/Cmd + C: コピー
  else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    clipboard = deepCopyNode(focusedNode);
    isCut = false;
    console.log('ノードをコピーしました');
  }

  // Ctrl/Cmd + X: カット
  else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    clipboard = deepCopyNode(focusedNode);
    isCut = true;

    // ノードを削除
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent) {
      saveHistory();
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === focusedNode.id);
      siblings.splice(index, 1);

      // フォーカスを移動
      if (siblings.length > 0) {
        focusedNodeId = siblings[Math.max(0, index - 1)].id;
      } else if (parent.id !== 'root') {
        focusedNodeId = parent.id;
      } else {
        focusedNodeId = null;
      }

      renderTree();
      updateToolbar();
      console.log('ノードをカットしました');
    }
  }

  // Ctrl/Cmd + V: ペースト
  else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    if (clipboard) {
      saveHistory();
      const pastedNode = deepCopyNode(clipboard);
      focusedNode.children.push(pastedNode);
      focusedNodeId = pastedNode.id;
      renderTree();
      updateToolbar();
      console.log('ノードをペーストしました');
    }
  }

  // Ctrl/Cmd + F: 検索バーを表示
  else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    showSearchBar();
  }
});

// IPCイベントリスナー
ipcRenderer.on('save-file', saveFile);
ipcRenderer.on('save-file-as', saveFileAs);
ipcRenderer.on('load-file', (event, data) => loadFile(data));
ipcRenderer.on('new-file', newFile);

// ツールバーのイベントリスナー
document.getElementById('bold-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    focusedNode.bold = !focusedNode.bold;
    saveHistory();
    renderTree();
    updateToolbar();
  }
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const focusedNode = findNode(treeData, focusedNodeId);
    if (focusedNode) {
      const color = btn.dataset.color;
      focusedNode.color = color === 'null' ? null : color;
      saveHistory();
      renderTree();
      updateToolbar();
    }
  });
});

// ツールバーの状態を更新
function updateToolbar() {
  const focusedNode = findNode(treeData, focusedNodeId);

  // 太字ボタン
  const boldBtn = document.getElementById('bold-btn');
  if (focusedNode && focusedNode.bold) {
    boldBtn.classList.add('active');
  } else {
    boldBtn.classList.remove('active');
  }

  // カラーボタン
  document.querySelectorAll('.color-btn').forEach(btn => {
    const color = btn.dataset.color;
    const nodeColor = focusedNode ? focusedNode.color : null;

    if ((color === 'null' && nodeColor === null) || color === nodeColor) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ツールバーボタンのイベントリスナー
document.getElementById('add-child-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    saveHistory();
    const newNode = createNode('');
    focusedNode.children.push(newNode);
    focusedNodeId = newNode.id;
    renderTree(true);
  }
});

document.getElementById('add-sibling-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent) {
      saveHistory();
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === focusedNode.id);
      const newNode = createNode('');
      siblings.splice(index + 1, 0, newNode);
      focusedNodeId = newNode.id;
      renderTree(true);
    }
  }
});

document.getElementById('outdent-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent && parent.id !== 'root') {
      const grandParent = findParentNode(treeData, parent.id);
      if (grandParent) {
        saveHistory();
        const siblings = parent.children;
        const index = siblings.findIndex(n => n.id === focusedNode.id);
        siblings.splice(index, 1);

        const parentIndex = grandParent.children.findIndex(n => n.id === parent.id);
        grandParent.children.splice(parentIndex + 1, 0, focusedNode);
        renderTree();
        updateToolbar();
      }
    }
  }
});

document.getElementById('indent-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent) {
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === focusedNode.id);
      if (index > 0) {
        saveHistory();
        const prevSibling = siblings[index - 1];
        siblings.splice(index, 1);
        prevSibling.children.push(focusedNode);
        renderTree();
        updateToolbar();
      }
    }
  }
});

document.getElementById('move-up-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent) {
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === focusedNode.id);
      if (index > 0) {
        saveHistory();
        [siblings[index - 1], siblings[index]] = [siblings[index], siblings[index - 1]];
        renderTree();
        updateToolbar();
      }
    }
  }
});

document.getElementById('move-down-btn').addEventListener('click', () => {
  const focusedNode = findNode(treeData, focusedNodeId);
  if (focusedNode) {
    const parent = findParentNode(treeData, focusedNode.id);
    if (parent) {
      const siblings = parent.children;
      const index = siblings.findIndex(n => n.id === focusedNode.id);
      if (index < siblings.length - 1) {
        saveHistory();
        [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
        renderTree();
        updateToolbar();
      }
    }
  }
});

document.getElementById('add-memo-btn').addEventListener('click', () => {
  const memoInput = document.querySelector(`[data-node-id="${focusedNodeId}"] .node-memo-input`);
  if (memoInput) {
    memoInput.readOnly = false;
    memoInput.style.display = 'block';
    memoInput.focus();
    memoInput.setSelectionRange(memoInput.value.length, memoInput.value.length);
  }
});

// 初期レンダリング
renderTree(true);

// 初期状態を履歴に保存
saveHistory();

// 初期状態を保存済みとしてマーク（新規ファイルなので未保存フラグはfalse）
savedTreeData = null;
window.hasUnsavedChanges = false;

// 初期ツールバー状態を更新
updateToolbar();

// 検索機能
let searchResults = [];
let currentSearchIndex = -1;

function showSearchBar() {
  const searchBar = document.getElementById('search-bar');
  const searchInput = document.getElementById('search-input');
  searchBar.style.display = 'flex';
  searchInput.focus();
  searchInput.select();
}

function hideSearchBar() {
  const searchBar = document.getElementById('search-bar');
  searchBar.style.display = 'none';
  searchResults = [];
  currentSearchIndex = -1;
  updateSearchResults();
  // 検索ハイライトをクリア
  clearSearchHighlights();
}

function clearSearchHighlights() {
  document.querySelectorAll('.node-input').forEach(input => {
    input.style.backgroundColor = '';
  });
}

function performSearch(query) {
  if (!query) {
    searchResults = [];
    currentSearchIndex = -1;
    clearSearchHighlights();
    updateSearchResults();
    return;
  }

  // すべてのノードを検索
  searchResults = [];
  const allNodes = getAllNodesFlat(treeData);

  allNodes.forEach(node => {
    if (node.text.toLowerCase().includes(query.toLowerCase())) {
      searchResults.push(node.id);
    }
  });

  currentSearchIndex = searchResults.length > 0 ? 0 : -1;
  updateSearchResults();
  highlightSearchResults();

  if (currentSearchIndex >= 0) {
    focusSearchResult(currentSearchIndex);
  }
}

function getAllNodesFlat(node, result = []) {
  if (node.id !== 'root') {
    result.push(node);
  }
  if (node.children) {
    node.children.forEach(child => getAllNodesFlat(child, result));
  }
  return result;
}

function highlightSearchResults() {
  clearSearchHighlights();

  searchResults.forEach((nodeId, index) => {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement) {
      const input = nodeElement.querySelector('.node-input');
      if (input) {
        if (index === currentSearchIndex) {
          input.style.backgroundColor = '#ffa500'; // オレンジ（現在の結果）
        } else {
          input.style.backgroundColor = '#ffff99'; // 黄色（その他の結果）
        }
      }
    }
  });
}

function focusSearchResult(index) {
  if (index < 0 || index >= searchResults.length) return;

  const nodeId = searchResults[index];
  focusedNodeId = nodeId;

  // ノードが折りたたまれた親の中にある場合、親を展開する
  expandParentsOfNode(nodeId);

  renderTree();

  // ノードまでスクロール
  setTimeout(() => {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement) {
      nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    highlightSearchResults();
  }, 100);
}

function expandParentsOfNode(nodeId) {
  let currentId = nodeId;
  while (currentId) {
    const parent = findParentNode(treeData, currentId);
    if (parent && parent.id !== 'root') {
      parent.collapsed = false;
      currentId = parent.id;
    } else {
      break;
    }
  }
}

function nextSearchResult() {
  if (searchResults.length === 0) return;
  currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
  focusSearchResult(currentSearchIndex);
  updateSearchResults();
}

function prevSearchResult() {
  if (searchResults.length === 0) return;
  currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
  focusSearchResult(currentSearchIndex);
  updateSearchResults();
}

function updateSearchResults() {
  const resultsSpan = document.getElementById('search-results');
  if (searchResults.length === 0) {
    resultsSpan.textContent = '結果なし';
  } else {
    resultsSpan.textContent = `${currentSearchIndex + 1} / ${searchResults.length}`;
  }
}

// 検索バーのイベントリスナー
document.getElementById('search-input').addEventListener('input', (e) => {
  performSearch(e.target.value);
});

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      prevSearchResult();
    } else {
      nextSearchResult();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideSearchBar();
  }
});

document.getElementById('search-next').addEventListener('click', nextSearchResult);
document.getElementById('search-prev').addEventListener('click', prevSearchResult);
document.getElementById('search-close').addEventListener('click', hideSearchBar);

// エクスポート機能
function exportAsMarkdown() {
  let markdown = '';

  function nodeToMarkdown(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const bullet = depth === 0 ? '#' : '-';
    const text = node.text || '(空)';

    if (depth === 0) {
      markdown += `${bullet} ${text}\n\n`;
    } else {
      markdown += `${indent}${bullet} ${text}\n`;
    }

    if (node.memo && node.memo.trim()) {
      markdown += `${indent}  > ${node.memo.trim()}\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => nodeToMarkdown(child, depth + 1));
    }
  }

  treeData.children.forEach(child => nodeToMarkdown(child, 0));

  ipcRenderer.invoke('export-markdown', markdown).then(result => {
    if (result.success) {
      console.log('Markdown exported successfully');
    } else if (!result.canceled) {
      console.error('Failed to export markdown:', result.error);
    }
  });
}

function exportAsText() {
  let text = '';

  function nodeToText(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const nodeText = node.text || '(空)';
    text += `${indent}${nodeText}\n`;

    if (node.memo && node.memo.trim()) {
      text += `${indent}  [メモ: ${node.memo.trim()}]\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => nodeToText(child, depth + 1));
    }
  }

  treeData.children.forEach(child => nodeToText(child, 0));

  ipcRenderer.invoke('export-text', text).then(result => {
    if (result.success) {
      console.log('Text exported successfully');
    } else if (!result.canceled) {
      console.error('Failed to export text:', result.error);
    }
  });
}

async function exportAsPNG() {
  const treeContainer = document.getElementById('tree-container');

  // html2canvasライブラリがないので、代わりにスクリーンショット機能を使う
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // ツリーコンテナのサイズを取得
    const rect = treeContainer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 背景を白にする
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 簡易的なレンダリング（テキストのみ）
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';

    let y = 20;
    function drawNode(node, depth = 0) {
      const x = 20 + (depth * 40);
      const text = node.text || '(空)';
      ctx.fillText(text, x, y);
      y += 20;

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => drawNode(child, depth + 1));
      }
    }

    treeData.children.forEach(child => drawNode(child, 0));

    const dataURL = canvas.toDataURL('image/png');

    const result = await ipcRenderer.invoke('export-png', dataURL);
    if (result.success) {
      console.log('PNG exported successfully');
    } else if (!result.canceled) {
      console.error('Failed to export PNG:', result.error);
    }
  } catch (err) {
    console.error('Failed to create PNG:', err);
  }
}

// エクスポートイベントリスナー
ipcRenderer.on('export-markdown', exportAsMarkdown);
ipcRenderer.on('export-text', exportAsText);
ipcRenderer.on('export-png', exportAsPNG);

// ウィンドウへのファイルドラッグアンドドロップ処理
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  // ファイルがドロップされた場合のみ処理
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];

    // .treeファイルのみ受け入れる
    if (file.path.endsWith('.tree')) {
      try {
        // 新規ウィンドウでファイルを開く
        const result = await ipcRenderer.invoke('open-file-in-new-window', file.path);
        if (!result.success) {
          console.error('Failed to open file in new window:', result.error);
        }
      } catch (err) {
        console.error('Error opening file:', err);
      }
    } else {
      console.log('Only .tree files are supported');
    }
  }
});
