<template>
  <div class="tree-node" :class="nodeClasses" :data-node-id="node.id">
    <div class="node-wrapper">
      <div class="node-content" draggable="true" @dragstart="handleDragStart" @dragend="handleDragEnd">
        <!-- 折りたたみボタン -->
        <button
          class="collapse-btn"
          :style="{ visibility: node.children.length > 0 ? 'visible' : 'hidden' }"
          @click="toggleCollapse"
        >
          {{ node.collapsed ? '▶' : '▼' }}
        </button>

        <!-- ノードテキスト入力 -->
        <textarea
          ref="inputRef"
          class="node-input"
          v-model="node.text"
          :readonly="isReadonly"
          :placeholder="'ノードを入力...'"
          :rows="1"
          :style="nodeStyle"
          :tabindex="0"
          @click="handleClick"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="handleInput"
          @keydown="handleKeydown"
        ></textarea>
      </div>

      <!-- メモ入力 -->
      <textarea
        v-if="showMemo"
        ref="memoRef"
        class="node-memo-input"
        v-model="node.memo"
        :readonly="isMemoReadonly"
        placeholder="メモ (Ctrl+7)..."
        :rows="1"
        @click="handleMemoClick"
        @blur="handleMemoBlur"
        @input="handleMemoInput"
        @keydown="handleMemoKeydown"
      ></textarea>
    </div>

    <!-- 子ノード -->
    <div v-if="node.children.length > 0 && !node.collapsed" class="node-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :focusedNodeId="focusedNodeId"
        :selectedNodeIds="selectedNodeIds"
        @focus-node="$emit('focus-node', $event)"
        @update-node="$emit('update-node')"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  focusedNodeId: {
    type: String,
    default: null,
  },
  selectedNodeIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['focus-node', 'update-node']);

const inputRef = ref(null);
const memoRef = ref(null);
const isReadonly = ref(true);
const isMemoReadonly = ref(true);

const nodeClasses = computed(() => ({
  focused: props.node.id === props.focusedNodeId && isReadonly.value,
  selected: props.selectedNodeIds.includes(props.node.id) && props.node.id !== props.focusedNodeId,
  'has-children': props.node.children.length > 0,
}));

const nodeStyle = computed(() => ({
  fontWeight: props.node.bold ? 'bold' : 'normal',
  color: props.node.color || '#333',
}));

const showMemo = computed(() => {
  return props.node.memo && props.node.memo.trim() !== '';
});

// 折りたたみ切り替え
const toggleCollapse = () => {
  props.node.collapsed = !props.node.collapsed;
  emit('update-node');
};

// クリックハンドラ
const handleClick = (e) => {
  // プログラム的なフォーカスでは編集モードに入らない（実際のマウスクリックのみ）
  // e.detail > 0 はマウスクリック、e.detail === 0 はプログラム的なクリック
  if (!(e instanceof MouseEvent) || e.detail === 0) {
    return;
  }

  // クリック時のみ編集モードに入る（元のElectron版の挙動）
  if (isReadonly.value) {
    // 選択モード時のクリック：編集モードに入る
    emit('focus-node', props.node.id);
    isReadonly.value = false;
    nextTick(() => {
      inputRef.value?.focus();
      const len = inputRef.value?.value.length || 0;
      inputRef.value?.setSelectionRange(len, len);
    });
  }
  // 編集モード時のクリック：何もしない
};

// フォーカスハンドラ
const handleFocus = () => {
  // フォーカス時は選択モードのまま（編集モードには入らない）
  if (isReadonly.value) {
    emit('focus-node', props.node.id);
  }
  // 編集モード時はfocusedクラスを削除（自動的にnodeClassesで管理される）
  // readOnly時のみfocusedクラスを表示
};

// ブラーハンドラ
const handleBlur = () => {
  isReadonly.value = true;
  autoResize();
  emit('update-node');
};

// 入力ハンドラ
const handleInput = () => {
  autoResize();
};

// 自動リサイズ
const autoResize = () => {
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
    inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
  }
};

// キーダウンハンドラ
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    inputRef.value?.blur();
  }
};

// メモクリックハンドラ
const handleMemoClick = (e) => {
  e.stopPropagation();
  emit('focus-node', props.node.id);
  isMemoReadonly.value = false;
  nextTick(() => {
    memoRef.value?.focus();
  });
};

// メモブラーハンドラ
const handleMemoBlur = () => {
  isMemoReadonly.value = true;
  autoResizeMemo();
  emit('update-node');
};

// メモ入力ハンドラ
const handleMemoInput = () => {
  autoResizeMemo();
};

// メモ自動リサイズ
const autoResizeMemo = () => {
  if (memoRef.value) {
    memoRef.value.style.height = 'auto';
    memoRef.value.style.height = memoRef.value.scrollHeight + 'px';
  }
};

// メモキーダウンハンドラ
const handleMemoKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    memoRef.value?.blur();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    memoRef.value?.blur();
  }
};

// ドラッグアンドドロップハンドラ
const handleDragStart = (e) => {
  e.stopPropagation();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', props.node.id);
};

const handleDragEnd = () => {
  // ドラッグ終了処理
};

// メモオープンイベントのリスナー
onMounted(() => {
  const handleOpenMemo = (e) => {
    if (e.detail.nodeId === props.node.id) {
      if (!props.node.memo) {
        props.node.memo = '';
      }
      isMemoReadonly.value = false;
      nextTick(() => {
        if (memoRef.value) {
          memoRef.value.style.display = 'block';
          memoRef.value.focus();
        }
      });
    }
  };

  const handleEnterEditMode = (e) => {
    if (e.detail.nodeId === props.node.id) {
      isReadonly.value = false;
      nextTick(() => {
        inputRef.value?.focus();
        const len = inputRef.value?.value.length || 0;
        inputRef.value?.setSelectionRange(len, len);
      });
    }
  };

  window.addEventListener('open-memo', handleOpenMemo);
  window.addEventListener('enter-edit-mode', handleEnterEditMode);

  // 初期リサイズ
  nextTick(() => {
    autoResize();
    if (showMemo.value) {
      autoResizeMemo();
    }
  });
});

// フォーカスが外れたら選択モードに戻す（Electron版の挙動）
watch(() => props.focusedNodeId, (newVal, oldVal) => {
  const wasFocused = oldVal === props.node.id;
  const isFocused = newVal === props.node.id;

  if (wasFocused && !isFocused) {
    // このノードがフォーカスを失ったら選択モードに戻す
    isReadonly.value = true;
  }
});

// ノードが更新されたときにリサイズ
watch(() => props.node.text, () => {
  nextTick(() => autoResize());
});

watch(() => props.node.memo, () => {
  nextTick(() => autoResizeMemo());
});
</script>

<style scoped>
/* Tree2風の横方向レイアウト */
.tree-node {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  position: relative;
  min-height: auto;
}

.node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-right: 1.25rem;
  position: relative;
}

/* 折りたたみボタン */
.collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.625rem;
  color: #888;
  padding: 0.125rem 0.25rem;
  min-width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: background-color 0.15s;
}

.collapse-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.collapse-btn:active {
  background-color: #d0d0d0;
}

.node-input {
  border: 1px solid transparent;
  background-color: #ffffff;
  font-size: 0.75rem;
  font-family: inherit;
  color: #333;
  padding: 0.125rem 0;
  border-radius: 3px;
  transition: all 0.2s ease;
  outline: none;
  min-width: 11.25rem;
  max-width: 18.75rem;
  min-height: auto;
  cursor: pointer;
  resize: none;
  overflow-y: hidden;
  line-height: 1.4;
  word-wrap: break-word;
}

.node-input[readonly] {
  cursor: pointer;
  background-color: #ffffff;
}

.node-input[readonly]:hover {
  background-color: #f5f5f5;
  border-color: #e0e0e0;
}

.node-input:not([readonly]) {
  cursor: text;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
  border: 1px solid #4299e1;
}

.node-input:focus {
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
  border: 1px solid #4299e1;
}

.node-input::placeholder {
  color: #bbb;
}

/* 子ノードコンテナ - 横方向に配置 */
.node-children {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-left: 2.5rem;
  position: relative;
}

/* フォーカス時のスタイル（選択モード時のみ） */
/* 直接の子要素のみにスタイルを適用（ネストした子ノードには影響しない） */
.tree-node.focused > .node-wrapper > .node-content > .node-input[readonly] {
  background-color: #e0f2fe;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
}

/* 複数選択時のスタイル */
.tree-node.selected > .node-wrapper > .node-content > .node-input[readonly] {
  background-color: #bfdbfe;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* メモ入力欄 */
.node-memo-input {
  border: 1px solid transparent;
  background-color: #f5f5f5;
  border-left: 3px solid #999;
  font-size: 0.625rem;
  font-family: inherit;
  color: #666;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  transition: all 0.2s ease;
  outline: none;
  min-width: 11.25rem;
  max-width: 18.75rem;
  min-height: 1.5rem;
  cursor: pointer;
  resize: none;
  overflow-y: hidden;
  line-height: 1.4;
  word-wrap: break-word;
  margin-top: 0.25rem;
  margin-left: 1.25rem;
  margin-bottom: 0.25rem;
}

.node-memo-input[readonly] {
  cursor: pointer;
  background-color: #f5f5f5;
}

.node-memo-input[readonly]:hover {
  background-color: #ebebeb;
  border-color: #999;
}

.node-memo-input:not([readonly]) {
  cursor: text;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(153, 153, 153, 0.15);
  border: 1px solid #999;
  border-left: 3px solid #999;
}

.node-memo-input:focus {
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(153, 153, 153, 0.15);
  border: 1px solid #999;
  border-left: 3px solid #999;
}

.node-memo-input::placeholder {
  color: #bbb;
  font-size: 11px;
}

/* ドラッグ&ドロップ */
.dragging {
  opacity: 0.5;
}

.drag-over .node-content {
  background-color: #e3f2fd;
  border-radius: 3px;
  padding: 2px;
}
</style>
