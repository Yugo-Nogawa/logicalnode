import { ref, computed } from 'vue';

export function useTreeLogic() {
  // ツリーデータ構造
  const treeData = ref({
    id: 'root',
    text: '',
    children: [],
  });

  const focusedNodeId = ref(null);
  const nodeIdCounter = ref(1);
  const selectedNodeIds = ref([]);

  // Undo/Redo用の履歴管理
  const history = ref([]);
  const historyIndex = ref(-1);
  const MAX_HISTORY = 100;

  // クリップボード
  const clipboard = ref(null);
  const isCut = ref(false);

  // ノードの生成
  const createNode = (text = '', children = []) => {
    return {
      id: `node-${nodeIdCounter.value++}`,
      text: text,
      children: children,
      bold: false,
      color: null,
      collapsed: false,
      memo: '',
    };
  };

  // ノードIDからノードを検索
  const findNode = (node, id) => {
    if (node.id === id) return node;
    for (let child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  // 親ノードを検索
  const findParentNode = (node, targetId, parent = null) => {
    if (node.id === targetId) return parent;
    for (let child of node.children) {
      const found = findParentNode(child, targetId, node);
      if (found) return found;
    }
    return null;
  };

  // フォーカス中のノード
  const focusedNode = computed(() => {
    if (!focusedNodeId.value) return null;
    return findNode(treeData.value, focusedNodeId.value);
  });

  // パンくずリスト
  const breadcrumb = computed(() => {
    if (!focusedNodeId.value) return [];

    const path = [];
    let currentId = focusedNodeId.value;

    while (currentId) {
      const node = findNode(treeData.value, currentId);
      if (node) {
        const text = node.text || '(空)';
        path.unshift({
          text: text.length > 30 ? text.substring(0, 30) + '...' : text,
          fullText: text,
        });
        const parent = findParentNode(treeData.value, currentId);
        currentId = parent && parent.id !== 'root' ? parent.id : null;
      } else {
        break;
      }
    }

    return path;
  });

  // 履歴に状態を保存
  const saveHistory = () => {
    // 現在の位置より後の履歴を削除
    history.value = history.value.slice(0, historyIndex.value + 1);

    // 新しい状態を追加
    const snapshot = JSON.parse(
      JSON.stringify({
        treeData: treeData.value,
        focusedNodeId: focusedNodeId.value,
        nodeIdCounter: nodeIdCounter.value,
      })
    );
    history.value.push(snapshot);

    // 履歴の上限を超えたら古いものを削除
    if (history.value.length > MAX_HISTORY) {
      history.value.shift();
    } else {
      historyIndex.value++;
    }
  };

  // Undo
  const undo = () => {
    if (historyIndex.value > 0) {
      historyIndex.value--;
      restoreFromHistory();
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      restoreFromHistory();
    }
  };

  // 履歴から状態を復元
  const restoreFromHistory = () => {
    if (historyIndex.value >= 0 && historyIndex.value < history.value.length) {
      const snapshot = history.value[historyIndex.value];
      treeData.value = JSON.parse(JSON.stringify(snapshot.treeData));
      focusedNodeId.value = snapshot.focusedNodeId;
      nodeIdCounter.value = snapshot.nodeIdCounter;
    }
  };

  // ノードのディープコピー（新しいIDを割り当てる）
  const deepCopyNode = (node) => {
    return {
      id: `node-${nodeIdCounter.value++}`,
      text: node.text,
      bold: node.bold,
      color: node.color,
      collapsed: node.collapsed,
      memo: node.memo || '',
      children: node.children.map((child) => deepCopyNode(child)),
    };
  };

  // 子ノードを追加
  const addChildNode = () => {
    if (!focusedNodeId.value) return;

    const node = findNode(treeData.value, focusedNodeId.value);
    if (node) {
      saveHistory();
      const newNode = createNode('');
      node.children.push(newNode);
      focusedNodeId.value = newNode.id;
    }
  };

  // 兄弟ノードを追加
  const addSiblingNode = () => {
    if (!focusedNodeId.value) return;

    const node = findNode(treeData.value, focusedNodeId.value);
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent) {
        saveHistory();
        const siblings = parent.children;
        const index = siblings.findIndex((n) => n.id === node.id);
        const newNode = createNode('');
        siblings.splice(index + 1, 0, newNode);
        focusedNodeId.value = newNode.id;
      }
    }
  };

  // ノードを左に移動（アウトデント）
  const outdentNode = () => {
    const node = focusedNode.value;
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent && parent.id !== 'root') {
        const grandParent = findParentNode(treeData.value, parent.id);
        if (grandParent) {
          saveHistory();
          const siblings = parent.children;
          const index = siblings.findIndex((n) => n.id === node.id);
          siblings.splice(index, 1);

          const parentIndex = grandParent.children.findIndex((n) => n.id === parent.id);
          grandParent.children.splice(parentIndex + 1, 0, node);
        }
      }
    }
  };

  // ノードを右に移動（インデント）
  const indentNode = () => {
    const node = focusedNode.value;
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent) {
        const siblings = parent.children;
        const index = siblings.findIndex((n) => n.id === node.id);
        if (index > 0) {
          saveHistory();
          const prevSibling = siblings[index - 1];
          siblings.splice(index, 1);
          prevSibling.children.push(node);
        }
      }
    }
  };

  // ノードを上に移動
  const moveNodeUp = () => {
    const node = focusedNode.value;
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent) {
        const siblings = parent.children;
        const index = siblings.findIndex((n) => n.id === node.id);
        if (index > 0) {
          saveHistory();
          [siblings[index - 1], siblings[index]] = [siblings[index], siblings[index - 1]];
        }
      }
    }
  };

  // ノードを下に移動
  const moveNodeDown = () => {
    const node = focusedNode.value;
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent) {
        const siblings = parent.children;
        const index = siblings.findIndex((n) => n.id === node.id);
        if (index < siblings.length - 1) {
          saveHistory();
          [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
        }
      }
    }
  };

  // 太字切り替え
  const toggleBold = () => {
    const node = focusedNode.value;
    if (node) {
      node.bold = !node.bold;
      saveHistory();
    }
  };

  // 色設定
  const setColor = (color) => {
    const node = focusedNode.value;
    if (node) {
      node.color = color === 'null' ? null : color;
      saveHistory();
    }
  };

  // ノード削除
  const deleteNode = () => {
    const node = focusedNode.value;
    if (node) {
      const parent = findParentNode(treeData.value, node.id);
      if (parent) {
        saveHistory();
        const siblings = parent.children;
        const index = siblings.findIndex((n) => n.id === node.id);
        siblings.splice(index, 1);

        // フォーカスを移動
        if (siblings.length > 0) {
          focusedNodeId.value = siblings[Math.max(0, index - 1)].id;
        } else if (parent.id !== 'root') {
          focusedNodeId.value = parent.id;
        } else {
          focusedNodeId.value = null;
        }
      }
    }
  };

  // コピー
  const copyNode = () => {
    const node = focusedNode.value;
    if (node) {
      clipboard.value = deepCopyNode(node);
      isCut.value = false;
    }
  };

  // カット
  const cutNode = () => {
    const node = focusedNode.value;
    if (node) {
      clipboard.value = deepCopyNode(node);
      isCut.value = true;
      deleteNode();
    }
  };

  // ペースト
  const pasteNode = () => {
    const node = focusedNode.value;
    if (node && clipboard.value) {
      saveHistory();
      const pastedNode = deepCopyNode(clipboard.value);
      node.children.push(pastedNode);
      focusedNodeId.value = pastedNode.id;
    }
  };

  // ツリーを平坦化してノードリストを取得
  const getFlatNodeList = (node = treeData.value, result = []) => {
    if (node.id !== 'root') {
      result.push(node);
    }
    if (node.children && !node.collapsed) {
      node.children.forEach((child) => getFlatNodeList(child, result));
    }
    return result;
  };

  // ノードの階層レベルを取得
  const getNodeLevel = (nodeId) => {
    let level = 0;
    let current = findNode(treeData.value, nodeId);

    while (current) {
      const parent = findParentNode(treeData.value, current.id);
      if (!parent || parent.id === 'root') {
        break;
      }
      level++;
      current = parent;
    }

    return level + 1; // ルートの子をレベル1とする
  };

  // すべてのノードを表示順序で取得（レベル情報付き）
  const getAllNodesWithLevel = (node = treeData.value, result = []) => {
    if (node.id !== 'root') {
      const level = getNodeLevel(node.id);
      result.push({ node, level });
    }

    if (!node.collapsed && node.children) {
      node.children.forEach((child) => getAllNodesWithLevel(child, result));
    }

    return result;
  };

  // 前のノードへ移動（同じレベルのノード間のみ）
  const moveToPreviousNode = () => {
    const currentNode = findNode(treeData.value, focusedNodeId.value);
    if (!currentNode) return;

    // 常に複数選択を解除（元の挙動に合わせる）
    selectedNodeIds.value = [];

    const currentLevel = getNodeLevel(focusedNodeId.value);
    const allNodes = getAllNodesWithLevel();

    // 現在のノードのインデックスを探す
    const currentIndex = allNodes.findIndex((item) => item.node.id === focusedNodeId.value);

    // 現在のノードより前で、同じレベルのノードを探す（逆順）
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allNodes[i].level === currentLevel) {
        focusedNodeId.value = allNodes[i].node.id;
        return;
      }
    }
  };

  // 次のノードへ移動（同じレベルのノード間のみ）
  const moveToNextNode = () => {
    const currentNode = findNode(treeData.value, focusedNodeId.value);
    if (!currentNode) return;

    // 常に複数選択を解除（元の挙動に合わせる）
    selectedNodeIds.value = [];

    const currentLevel = getNodeLevel(focusedNodeId.value);
    const allNodes = getAllNodesWithLevel();

    // 現在のノードのインデックスを探す
    const currentIndex = allNodes.findIndex((item) => item.node.id === focusedNodeId.value);

    // 現在のノードより後ろで、同じレベルのノードを探す
    for (let i = currentIndex + 1; i < allNodes.length; i++) {
      if (allNodes[i].level === currentLevel) {
        focusedNodeId.value = allNodes[i].node.id;
        return;
      }
    }
  };

  // ノードフォーカス処理
  const handleFocusNode = (nodeId) => {
    focusedNodeId.value = nodeId;
    selectedNodeIds.value = [];
  };

  // 初期ノードを作成
  if (treeData.value.children.length === 0) {
    const firstNode = createNode('');
    treeData.value.children.push(firstNode);
    focusedNodeId.value = firstNode.id;
  }

  return {
    treeData,
    focusedNodeId,
    selectedNodeIds,
    nodeIdCounter,
    history,
    historyIndex,
    focusedNode,
    breadcrumb,
    findNode,
    findParentNode,
    saveHistory,
    undo,
    redo,
    createNode,
    addChildNode,
    addSiblingNode,
    outdentNode,
    indentNode,
    moveNodeUp,
    moveNodeDown,
    moveToPreviousNode,
    moveToNextNode,
    toggleBold,
    setColor,
    deleteNode,
    copyNode,
    cutNode,
    pasteNode,
    handleFocusNode,
  };
}
