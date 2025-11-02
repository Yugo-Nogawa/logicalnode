// Tauri adapter - ファイルの最後に追加するコード

// 現在のファイル名とパスを保存
let currentFileName = null;
let currentFilePath = null;

// 最近使ったファイルを管理
function addToRecentFiles(filePath) {
  if (!filePath) return;

  const maxRecent = 5;
  let recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');

  // 既存のエントリを削除
  recentFiles = recentFiles.filter(f => f !== filePath);

  // 先頭に追加
  recentFiles.unshift(filePath);

  // 最大数を超えたら古いものを削除
  if (recentFiles.length > maxRecent) {
    recentFiles = recentFiles.slice(0, maxRecent);
  }

  localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
  updateRecentFilesMenu();
}

function updateRecentFilesMenu() {
  const recentFilesList = document.getElementById('recent-files-list');
  if (!recentFilesList) return;

  const recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');

  if (recentFiles.length === 0) {
    recentFilesList.innerHTML = '<div style="padding: 5px 10px; color: #666; font-size: 12px;">最近使ったファイルはありません</div>';
    return;
  }

  recentFilesList.innerHTML = recentFiles.map(filePath => {
    const fileName = extractFileName(filePath);
    return `<button class="menu-item recent-file-item" data-path="${filePath}" style="font-size: 12px; text-align: left;">${fileName}</button>`;
  }).join('');

  // イベントリスナーを追加
  document.querySelectorAll('.recent-file-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const path = btn.getAttribute('data-path');
      try {
        const content = await invoke('read_file', { filePath: path });
        currentFilePath = path;
        currentFileName = extractFileName(path);
        loadFile(content);
        await updateWindowTitle();

        // メニューを閉じる
        const menuModal = document.getElementById('menu-modal');
        if (menuModal) menuModal.style.display = 'none';
      } catch (err) {
        console.error('Failed to open recent file:', err);
        alert('ファイルを開けませんでした: ' + path);
      }
    });
  });
}

// ウィンドウタイトル更新関数
async function updateWindowTitle() {
  try {
    await invoke('update_window_title', {
      fileName: currentFileName,
      hasUnsavedChanges: window.hasUnsavedChanges || false
    });
  } catch (err) {
    console.error('Failed to update window title:', err);
  }
}

// checkUnsavedChanges関数を上書き
checkUnsavedChanges = function() {
  if (savedTreeData === null) {
    window.hasUnsavedChanges = false;
  } else {
    const currentData = JSON.stringify(treeData);
    const savedData = JSON.stringify(savedTreeData);
    window.hasUnsavedChanges = currentData !== savedData;
  }
  updateWindowTitle();
};

// ファイルパスからファイル名を抽出
function extractFileName(filePath) {
  if (!filePath) return null;
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

// saveFile関数を上書き（上書き保存）
saveFile = async function() {
  const data = JSON.stringify(treeData, null, 2);
  try {
    const filePath = await invoke('save_file', {
      content: data,
      defaultFilename: 'logicalnode.tree'
    });
    console.log('File saved to:', filePath);
    currentFilePath = filePath;
    currentFileName = extractFileName(filePath);
    addToRecentFiles(filePath);
    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    await updateWindowTitle();
  } catch (err) {
    if (err !== 'No file selected') {
      console.error('Failed to save file:', err);
    }
  }
};

// saveFileAs関数を上書き（別名保存）
saveFileAs = async function() {
  const data = JSON.stringify(treeData, null, 2);
  try {
    const filePath = await invoke('save_file_as', {
      content: data,
      defaultFilename: 'logicalnode.tree'
    });
    console.log('File saved as:', filePath);
    currentFilePath = filePath;
    currentFileName = extractFileName(filePath);
    addToRecentFiles(filePath);
    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    await updateWindowTitle();
  } catch (err) {
    if (err !== 'No file selected') {
      console.error('Failed to save file:', err);
    }
  }
};

// newFile関数を上書き（新しいウィンドウを開く）
newFile = async function() {
  try {
    // 未保存の変更チェックは不要（新しいウィンドウを開くだけ）
    await invoke('new_file');
    console.log('New window opened');
  } catch (err) {
    console.error('Failed to create new file:', err);
  }
};

// loadFile関数を上書き（ipcRenderer呼び出し部分のみ）
const originalLoadFile = loadFile;
loadFile = function(data) {
  try {
    const parsed = JSON.parse(data);
    treeData = parsed;
    focusedNodeId = treeData.children.length > 0 ? treeData.children[0].id : null;

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

    savedTreeData = JSON.parse(JSON.stringify(treeData));
    window.hasUnsavedChanges = false;
    updateWindowTitle();

    renderTree();
  } catch (err) {
    console.error('Failed to parse file:', err);
  }
};

// DOMContentLoadedで初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTauri);
} else {
  // 既にDOMが読み込まれている場合
  initializeTauri();
}

async function initializeTauri() {
  console.log('Initializing Tauri version...');

  // 待機中のファイルデータがあるかチェック
  try {
    const pendingData = await invoke('get_pending_file_data');
    if (pendingData) {
      const [content, fileName] = pendingData;
      console.log('Loading pending file data:', fileName);
      currentFileName = fileName;
      // ファイルパスも取得
      try {
        currentFilePath = await invoke('get_file_path');
        if (currentFilePath) {
          addToRecentFiles(currentFilePath);
        }
      } catch (err) {
        console.error('Failed to get file path:', err);
      }
      loadFile(content);
      await updateWindowTitle();
    }
  } catch (err) {
    console.error('Failed to get pending file data:', err);
  }

  // 最近使ったファイルメニューを初期化
  updateRecentFilesMenu();

  // New ボタン（新しいウィンドウを開く）
  const newBtn = document.getElementById('new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      newFile();
    });
  }

  // Save ボタン
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveFile);
  }

  // Load ボタン（新しいウィンドウで開く）
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      try {
        // open_fileは新しいウィンドウを開くので、contentは使わない
        await invoke('open_file');
        console.log('File opened in new window');
      } catch (err) {
        if (err !== 'No file selected') {
          console.error('Failed to open file:', err);
        }
      }
    });
  }

  // Menu ボタン
  const menuBtn = document.getElementById('menu-btn');
  const menuModal = document.getElementById('menu-modal');
  const closeMenuBtn = document.getElementById('close-menu-btn');

  if (menuBtn && menuModal) {
    menuBtn.addEventListener('click', () => {
      updateRecentFilesMenu(); // メニューを開く時に最近使ったファイルを更新
      menuModal.style.display = 'block';
    });
  }

  if (closeMenuBtn && menuModal) {
    closeMenuBtn.addEventListener('click', () => {
      menuModal.style.display = 'none';
    });
  }

  // エクスポートボタン
  const exportMarkdownBtn = document.getElementById('export-markdown-btn');
  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener('click', () => {
      exportAsMarkdown();
      if (menuModal) menuModal.style.display = 'none';
    });
  }

  const exportTextBtn = document.getElementById('export-text-btn');
  if (exportTextBtn) {
    exportTextBtn.addEventListener('click', () => {
      exportAsText();
      if (menuModal) menuModal.style.display = 'none';
    });
  }

  const exportJsonBtn = document.getElementById('export-json-btn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      exportAsJSON();
      if (menuModal) menuModal.style.display = 'none';
    });
  }

  // 初期レンダリング
  console.log('Rendering initial tree...');
  renderTree();

  // キーボードショートカット（Ctrl+S、Ctrl+Shift+S）
  document.addEventListener('keydown', (e) => {
    // Ctrl+S または Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        // Ctrl+Shift+S: 別名保存
        saveFileAs();
      } else {
        // Ctrl+S: 上書き保存
        saveFile();
      }
    }
    // Ctrl+O または Cmd+O（新しいウィンドウで開く）
    else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      (async () => {
        try {
          await invoke('open_file');
          console.log('File opened in new window');
        } catch (err) {
          if (err !== 'No file selected') {
            console.error('Failed to open file:', err);
          }
        }
      })();
    }
    // Ctrl+N または Cmd+N（新しいウィンドウを開く）
    else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      newFile();
    }
    // Ctrl+W または Cmd+W（ウィンドウを閉じる）
    else if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      (async () => {
        try {
          await invoke('close_window');
        } catch (err) {
          console.error('Failed to close window:', err);
        }
      })();
    }
  });

  // ファイルドラッグ&ドロップ - 複数のイベントをリッスン
  if (window.__TAURI_INTERNALS__) {
    const { event } = window.__TAURI_INTERNALS__;

    // すべてのドラッグ関連イベントをリッスン
    const dragEvents = [
      'tauri://file-drop',
      'tauri://file-drop-hover',
      'tauri://file-drop-cancelled',
      'tauri://drag-drop',
      'tauri://drag',
      'drag-drop',
      'file-drop'
    ];

    dragEvents.forEach(eventName => {
      event.listen(eventName, (e) => {
        console.log(`Event "${eventName}" received:`, e);
      });
    });

    // メインのファイルドロップハンドラー
    event.listen('tauri://file-drop', async (e) => {
      console.log('File drop event received:', e);
      const files = e.payload;

      // ペイロードの構造を確認
      console.log('Payload type:', typeof files);
      console.log('Payload value:', files);

      let filePath = null;

      // 異なるペイロード構造に対応
      if (Array.isArray(files)) {
        filePath = files[0];
      } else if (files && files.paths && Array.isArray(files.paths)) {
        filePath = files.paths[0];
      } else if (typeof files === 'string') {
        filePath = files;
      }

      if (filePath) {
        console.log('Processing file:', filePath);

        // .treeまたは.jsonファイルのみ受け入れる
        if (filePath.endsWith('.tree') || filePath.endsWith('.json')) {
          try {
            const content = await invoke('read_file', { filePath });
            currentFilePath = filePath;
            currentFileName = extractFileName(filePath);
            addToRecentFiles(filePath);
            loadFile(content);
            await updateWindowTitle();
          } catch (err) {
            console.error('Failed to open dropped file:', err);
            alert('ファイルを開けませんでした: ' + filePath);
          }
        } else {
          alert('対応していないファイル形式です。.tree または .json ファイルをドロップしてください。');
        }
      } else {
        console.error('Could not extract file path from payload');
      }
    });
  }

  // 初期タイトル設定
  await updateWindowTitle();

  console.log('Tauri version initialized successfully');
}

// エクスポート関数をTauri用にオーバーライド
exportAsMarkdown = async function() {
  let markdown = '';

  function nodeToMarkdown(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const nodeText = node.text || '(空)';
    const boldPrefix = node.bold ? '**' : '';
    const boldSuffix = node.bold ? '**' : '';
    markdown += `${indent}- ${boldPrefix}${nodeText}${boldSuffix}\n`;

    if (node.memo && node.memo.trim()) {
      markdown += `${indent}  > ${node.memo.trim()}\n`;
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => nodeToMarkdown(child, depth + 1));
    }
  }

  treeData.children.forEach(child => nodeToMarkdown(child, 0));

  try {
    const filePath = await invoke('save_file', {
      content: markdown,
      defaultFilename: 'export.md'
    });
    console.log('Markdown exported to:', filePath);
  } catch (err) {
    if (err !== 'No file selected') {
      console.error('Failed to export markdown:', err);
    }
  }
};

exportAsText = async function() {
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

  try {
    const filePath = await invoke('save_file', {
      content: text,
      defaultFilename: 'export.txt'
    });
    console.log('Text exported to:', filePath);
  } catch (err) {
    if (err !== 'No file selected') {
      console.error('Failed to export text:', err);
    }
  }
};

exportAsJSON = async function() {
  const data = JSON.stringify(treeData, null, 2);

  try {
    const filePath = await invoke('save_file', {
      content: data,
      defaultFilename: 'export.json'
    });
    console.log('JSON exported to:', filePath);
  } catch (err) {
    if (err !== 'No file selected') {
      console.error('Failed to export JSON:', err);
    }
  }
};
