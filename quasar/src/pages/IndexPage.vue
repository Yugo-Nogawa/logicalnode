<template>
  <q-page class="logical-node-page">
    <!-- ツールバー -->
    <div id="toolbar">
      <div class="toolbar-group">
        <button @click="addChildNode(true)" class="toolbar-btn" title="子ノード追加 (Tab)">
          子ノード
        </button>
        <button @click="addSiblingNode(true)" class="toolbar-btn" title="兄弟ノード追加 (Enter)">
          兄弟
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button @click="outdentNode" class="toolbar-btn" title="階層を上げる (Ctrl+←)">
          ← 上へ
        </button>
        <button @click="indentNode" class="toolbar-btn" title="階層を下げる (Ctrl+→)">
          下へ →
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button @click="moveNodeUp" class="toolbar-btn" title="順序を上げる (Ctrl+↑)">
          ↑ 上
        </button>
        <button @click="moveNodeDown" class="toolbar-btn" title="順序を下げる (Ctrl+↓)">
          ↓ 下
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button @click="addMemo" class="toolbar-btn" title="メモ追加 (Ctrl+7)">
          メモ
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button
          @click="toggleBold"
          class="toolbar-btn"
          :class="{ active: focusedNode?.bold }"
          title="太字 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">色:</span>
        <button
          v-for="color in colors"
          :key="color.value"
          @click="setColor(color.value)"
          class="color-btn"
          :class="{ active: focusedNode?.color === color.value }"
          :title="color.title"
          :style="{ backgroundColor: color.bg }"
        ></button>
      </div>
    </div>

    <!-- パンくずリスト -->
    <div id="breadcrumb">
      <template v-for="(item, index) in breadcrumb" :key="index">
        <span class="breadcrumb-item" :title="item.fullText">{{ item.text }}</span>
        <span v-if="index < breadcrumb.length - 1" class="breadcrumb-separator">›</span>
      </template>
    </div>

    <!-- 検索バー -->
    <div v-if="searchVisible" id="search-bar">
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        id="search-input"
        placeholder="検索... (Esc で閉じる)"
        @input="performSearch"
        @keydown="handleSearchKeydown"
      />
      <span id="search-results">{{ searchResultText }}</span>
      <button @click="prevSearchResult" class="search-nav-btn" title="前を検索 (Shift+Enter)">
        ↑
      </button>
      <button @click="nextSearchResult" class="search-nav-btn" title="次を検索 (Enter)">
        ↓
      </button>
      <button @click="hideSearchBar" class="search-nav-btn" title="閉じる (Esc)">×</button>
    </div>

    <!-- メインコンテンツ -->
    <div id="main-content">
      <div id="tree-container">
        <TreeNode
          v-for="child in treeData.children"
          :key="child.id"
          :node="child"
          :focusedNodeId="focusedNodeId"
          :selectedNodeIds="selectedNodeIds"
          @focus-node="onNodeFocus"
          @update-node="saveHistory"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import TreeNode from 'components/TreeNode.vue';
import { useTreeLogic } from 'src/composables/useTreeLogic';

// ツリーロジックを使用
const {
  treeData,
  focusedNodeId,
  selectedNodeIds,
  focusedNode,
  breadcrumb,
  saveHistory,
  undo,
  redo,
  addChildNode: addChildNodeBase,
  addSiblingNode: addSiblingNodeBase,
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
  findParentNode,
} = useTreeLogic();

// ノード追加をラップして、新しいノードにフォーカスを当てる
const addChildNode = (openInEditMode = false) => {
  addChildNodeBase();
  // 編集モードで開く場合のみfocusとイベントを実行
  if (openInEditMode) {
    // 2重のnextTickでDOMの更新を確実に待つ
    nextTick(() => {
      nextTick(() => {
        if (focusedNodeId.value) {
          const event = new CustomEvent('enter-edit-mode', { detail: { nodeId: focusedNodeId.value } });
          window.dispatchEvent(event);
        }
      });
    });
  }
  // 選択モードの場合は何もしない（focusedNodeIdが更新されるだけ）
};

const addSiblingNode = (openInEditMode = false) => {
  addSiblingNodeBase();
  // 編集モードで開く場合のみfocusとイベントを実行
  if (openInEditMode) {
    // 2重のnextTickでDOMの更新を確実に待つ
    nextTick(() => {
      nextTick(() => {
        if (focusedNodeId.value) {
          const event = new CustomEvent('enter-edit-mode', { detail: { nodeId: focusedNodeId.value } });
          window.dispatchEvent(event);
        }
      });
    });
  }
  // 選択モードの場合は何もしない（focusedNodeIdが更新されるだけ）
};

// 検索関連
const searchVisible = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const currentSearchIndex = ref(-1);
const searchInputRef = ref(null);

const searchResultText = computed(() => {
  if (searchResults.value.length === 0) {
    return '結果なし';
  }
  return `${currentSearchIndex.value + 1} / ${searchResults.value.length}`;
});

// カラー定義
const colors = [
  { value: null, title: 'デフォルト', bg: '#333' },
  { value: 'red', title: '赤 (Ctrl+1)', bg: 'red' },
  { value: 'blue', title: '青 (Ctrl+2)', bg: 'blue' },
  { value: 'green', title: '緑 (Ctrl+3)', bg: 'green' },
  { value: 'orange', title: 'オレンジ (Ctrl+4)', bg: 'orange' },
  { value: 'purple', title: '紫 (Ctrl+5)', bg: 'purple' },
];

// メモ追加
const addMemo = () => {
  if (focusedNodeId.value) {
    const event = new CustomEvent('open-memo', { detail: { nodeId: focusedNodeId.value } });
    window.dispatchEvent(event);
  }
};

// 検索関連の関数
const showSearchBar = () => {
  searchVisible.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
};

const hideSearchBar = () => {
  searchVisible.value = false;
  searchQuery.value = '';
  searchResults.value = [];
  currentSearchIndex.value = -1;
};

const getAllNodesFlat = (node, result = []) => {
  if (node.id !== 'root') {
    result.push(node);
  }
  if (node.children) {
    node.children.forEach((child) => getAllNodesFlat(child, result));
  }
  return result;
};

const performSearch = () => {
  if (!searchQuery.value) {
    searchResults.value = [];
    currentSearchIndex.value = -1;
    return;
  }

  const allNodes = getAllNodesFlat(treeData.value);
  searchResults.value = allNodes
    .filter((node) => node.text.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .map((node) => node.id);

  currentSearchIndex.value = searchResults.value.length > 0 ? 0 : -1;
  if (currentSearchIndex.value >= 0) {
    focusSearchResult(currentSearchIndex.value);
  }
};

const focusSearchResult = (index) => {
  if (index < 0 || index >= searchResults.value.length) return;
  const nodeId = searchResults.value[index];
  handleFocusNode(nodeId);
};

const nextSearchResult = () => {
  if (searchResults.value.length === 0) return;
  currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length;
  focusSearchResult(currentSearchIndex.value);
};

const prevSearchResult = () => {
  if (searchResults.value.length === 0) return;
  currentSearchIndex.value =
    (currentSearchIndex.value - 1 + searchResults.value.length) % searchResults.value.length;
  focusSearchResult(currentSearchIndex.value);
};

const handleSearchKeydown = (e) => {
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
};

// グローバルキーボードイベント
const handleGlobalKeydown = (e) => {
  const activeElement = document.activeElement;

  // 編集モード中（TEXTAREAにfocusがあり、readOnlyでない）かチェック
  const isInEditMode = (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && !activeElement.readOnly;

  // Tabキーは常にpreventDefaultする（ボタンなどへのフォーカス移動を防ぐ）
  if (e.key === 'Tab') {
    e.preventDefault();
    if (isInEditMode) {
      // 編集モード中：子ノードを作成して編集モードで開く
      addChildNode(true);
    } else {
      // 選択モード：子ノードを作成して編集モードで開く
      addChildNode(true);
    }
    return;
  }

  // Enterキーの処理
  if (e.key === 'Enter') {
    e.preventDefault();
    if (isInEditMode) {
      // 編集モード中：兄弟ノードを作成して選択モードで開く（元の挙動に合わせる）
      addSiblingNode(false);
    } else {
      // 選択モード：編集モードに入る
      enterEditMode();
    }
    return;
  }

  // 編集モード中の場合、その他のキーは無視（矢印キーは後で処理）
  if (isInEditMode && !(e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    // 矢印キー以外のキーは編集モード中は無視
    return;
  }

  // 矢印キーの処理（編集モード中の特殊処理）
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // 編集モード中の場合、カーソルが端にあるかチェック
    if (isInEditMode && activeElement.tagName === 'TEXTAREA') {
      const textarea = activeElement;
      const cursorPos = textarea.selectionStart;
      const textLength = textarea.value.length;

      // 上下矢印：複数行の場合は無視
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && textarea.value.includes('\n')) {
        return;
      }

      // 左矢印：カーソルが先頭にない場合は無視
      if (e.key === 'ArrowLeft' && cursorPos > 0 && !(e.ctrlKey || e.metaKey)) {
        return;
      }

      // 右矢印：カーソルが末尾にない場合は無視
      if (e.key === 'ArrowRight' && cursorPos < textLength && !(e.ctrlKey || e.metaKey)) {
        return;
      }
    }
    // ここで矢印キーの処理を続ける（編集モードでも選択モードでも）
  }

  // Ctrl/Cmd + S: 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
  // Ctrl/Cmd + F: 検索
  else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    showSearchBar();
  }
  // Ctrl/Cmd + Z: Undo
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Ctrl/Cmd + Shift + Z または Ctrl/Cmd + Y: Redo
  else if (
    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
    ((e.ctrlKey || e.metaKey) && e.key === 'y')
  ) {
    e.preventDefault();
    redo();
  }
  // ArrowUp: 前のノードへ移動 or Ctrl+ArrowUp: ノードを上に移動
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      moveNodeUp();
    } else {
      moveToPreviousNode();
      // 元のElectron版ではinputにfocusしない（focusedクラスの表示のみ）
    }
  }
  // ArrowDown: 次のノードへ移動 or Ctrl+ArrowDown: ノードを下に移動
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      moveNodeDown();
    } else {
      moveToNextNode();
      // 元のElectron版ではinputにfocusしない（focusedクラスの表示のみ）
    }
  }
  // ArrowRight: 子ノードへ移動 or Ctrl+ArrowRight: インデント
  else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + →: インデント
      indentNode();
    } else {
      // →: 子ノードへ移動（選択を維持）
      if (focusedNode.value && focusedNode.value.children.length > 0) {
        const firstChildId = focusedNode.value.children[0].id;
        focusedNodeId.value = firstChildId; // 選択を解除せずに移動
        // 元のElectron版ではinputにfocusしない（focusedクラスの表示のみ）
      }
    }
  }
  // ArrowLeft: 親ノードへ移動 or Ctrl+ArrowLeft: アウトデント
  else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + ←: アウトデント
      outdentNode();
    } else {
      // ←: 親ノードへ移動（選択を維持）
      if (focusedNode.value) {
        const parent = findParentNode(treeData.value, focusedNode.value.id);
        if (parent && parent.id !== 'root') {
          focusedNodeId.value = parent.id; // 選択を解除せずに移動
          // 元のElectron版ではinputにfocusしない（focusedクラスの表示のみ）
        }
      }
    }
  }
  // Delete: ノード削除
  else if (e.key === 'Delete') {
    e.preventDefault();
    deleteNode();
  }
  // Ctrl/Cmd + B: 太字
  else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    toggleBold();
  }
  // Ctrl/Cmd + 1-5: 色変更
  else if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    const colorValues = [null, 'red', 'blue', 'green', 'orange', 'purple'];
    setColor(colorValues[parseInt(e.key)]);
  }
  // Ctrl/Cmd + C: コピー
  else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    copyNode();
  }
  // Ctrl/Cmd + X: カット
  else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    cutNode();
  }
  // Ctrl/Cmd + V: ペースト
  else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    pasteNode();
  }
  // Ctrl/Cmd + 7: メモ
  else if ((e.ctrlKey || e.metaKey) && e.key === '7') {
    e.preventDefault();
    addMemo();
  }
  // スペースまたはF2: 編集モードに入る
  else if (e.key === ' ' || e.key === 'F2') {
    e.preventDefault();
    enterEditMode();
  }
};

// ノードフォーカス処理
const onNodeFocus = (nodeId) => {
  handleFocusNode(nodeId);
  // TreeNode.vue内でfocus処理を行うため、ここでは何もしない
};

// 編集モードに入る
const enterEditMode = () => {
  if (focusedNodeId.value) {
    const event = new CustomEvent('enter-edit-mode', { detail: { nodeId: focusedNodeId.value } });
    window.dispatchEvent(event);
  }
};

// ファイル保存
const saveFile = async () => {
  if (window.electronAPI) {
    const data = JSON.stringify(treeData.value, null, 2);
    const result = await window.electronAPI.saveFile(data);
    if (result.success) {
      console.log('File saved successfully');
    }
  }
};

// ファイル別名保存
const saveFileAs = async () => {
  if (window.electronAPI) {
    const data = JSON.stringify(treeData.value, null, 2);
    const result = await window.electronAPI.saveFileAs(data);
    if (result.success) {
      console.log('File saved as successfully');
    }
  }
};

// ファイル読み込み
const loadFile = (data) => {
  try {
    const parsed = JSON.parse(data);
    treeData.value = parsed;
    focusedNodeId.value = treeData.value.children.length > 0 ? treeData.value.children[0].id : null;
  } catch (err) {
    console.error('Failed to parse file:', err);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  // 初期履歴を保存
  saveHistory();

  // Electron IPCリスナーを設定
  if (window.electronAPI) {
    window.electronAPI.onSaveFile(saveFile);
    window.electronAPI.onSaveFileAs(saveFileAs);
    window.electronAPI.onLoadFile(loadFile);
  }

  // 最初のノードにフォーカスを当てる
  nextTick(() => {
    if (focusedNodeId.value) {
      const focusedElement = document.querySelector(`[data-node-id="${focusedNodeId.value}"]`);
      if (focusedElement) {
        const input = focusedElement.querySelector('.node-input');
        input?.focus();
      }
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);

  // Electron IPCリスナーをクリーンアップ
  if (window.electronAPI) {
    window.electronAPI.removeAllListeners('save-file');
    window.electronAPI.removeAllListeners('save-file-as');
    window.electronAPI.removeAllListeners('load-file');
  }
});
</script>

<style scoped>
.logical-node-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: 0 !important;
}

/* ツールバー */
#toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 16px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  font-size: 14px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background-color: #d0d0d0;
}

.toolbar-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
}

.toolbar-btn {
  padding: 4px 12px;
  background-color: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  min-width: 32px;
  height: 28px;
}

.toolbar-btn:hover {
  background-color: #f0f0f0;
  border-color: #b0b0b0;
}

.toolbar-btn:active,
.toolbar-btn.active {
  background-color: #e0e0e0;
  border-color: #999;
}

.color-btn {
  width: 24px;
  height: 24px;
  border: 2px solid #d0d0d0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.color-btn:hover {
  border-color: #999;
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #333;
  border-width: 3px;
  transform: scale(1.15);
}

/* パンくずリスト */
#breadcrumb {
  padding: 8px 16px;
  background-color: #fafafa;
  border-bottom: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
  min-height: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  flex-shrink: 0;
}

.breadcrumb-item {
  color: #666;
  flex-shrink: 0;
}

.breadcrumb-separator {
  color: #bbb;
  flex-shrink: 0;
}

.breadcrumb-item:last-child {
  color: #333;
  font-weight: 500;
}

/* 検索バー */
#search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #fffacd;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
}

#search-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  font-size: 14px;
  outline: none;
}

#search-input:focus {
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.15);
}

#search-results {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.search-nav-btn {
  padding: 4px 8px;
  background-color: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
  min-width: 28px;
  height: 28px;
}

.search-nav-btn:hover {
  background-color: #f0f0f0;
  border-color: #b0b0b0;
}

.search-nav-btn:active {
  background-color: #e0e0e0;
}

#main-content {
  flex: 1;
  overflow: auto;
  padding: 2.5rem;
  background-color: #ffffff;
}

#tree-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  min-height: 100%;
}
</style>
