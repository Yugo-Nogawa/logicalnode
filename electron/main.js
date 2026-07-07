const { app, BrowserWindow, Menu, dialog, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const isTest = process.env.NODE_ENV === 'test';

let mainWindow;
let fileToOpen = null;
let currentFilePath = null; // 現在開いているファイルのパス
let recentFiles = []; // 最近開いたファイルのリスト
const MAX_RECENT_FILES = 10;

// ---- userData 上の永続ファイルのパス ----
function userDataFile(name) {
  return path.join(app.getPath('userData'), name);
}

// ---- 原子的書き込み（一時ファイル→rename） ----
// 書き込み途中でクラッシュ/失敗しても原本を壊さない（チェックリスト §0 / §17）
async function atomicWriteFile(destPath, data, encoding) {
  const tmp = path.join(
    path.dirname(destPath),
    `.${path.basename(destPath)}.tmp-${process.pid}-${Date.now()}`
  );
  try {
    await fs.writeFile(tmp, data, encoding);
    await fs.rename(tmp, destPath);
  } catch (err) {
    // 後始末: 残った一時ファイルを削除
    try { await fs.unlink(tmp); } catch (_) { /* ignore */ }
    throw err;
  }
}

// ---- 最近使ったファイル（永続化 + メニュー再構築） ----
async function loadRecentFiles() {
  try {
    const raw = await fs.readFile(userDataFile('recent-files.json'), 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      recentFiles = arr.filter(f => typeof f === 'string').slice(0, MAX_RECENT_FILES);
    }
  } catch (_) { /* 無ければ空のまま */ }
}

function persistRecentFiles() {
  atomicWriteFile(userDataFile('recent-files.json'), JSON.stringify(recentFiles, null, 2), 'utf8')
    .catch(() => { /* 永続化失敗は致命的でないので無視 */ });
}

function addToRecentFiles(filePath) {
  recentFiles = recentFiles.filter(f => f !== filePath);
  recentFiles.unshift(filePath);
  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  }
  app.addRecentDocument(filePath);
  persistRecentFiles();
  buildMenu();
}

function clearRecentFiles() {
  recentFiles = [];
  app.clearRecentDocuments();
  persistRecentFiles();
  buildMenu();
}

// ---- 未保存の変更がある場合の確認（保存/保存しない/キャンセル） ----
// 続行してよければ true、キャンセル/保存失敗なら false を返す。
async function confirmDiscardChanges(win) {
  let dirty = false;
  try {
    dirty = await win.webContents.executeJavaScript('window.hasUnsavedChanges || false');
  } catch (_) { /* 取得できなければ変更なし扱い */ }

  if (!dirty) return true;

  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['保存', '保存しない', 'キャンセル'],
    defaultId: 0,
    cancelId: 2,
    title: '未保存の変更',
    message: '現在の変更を保存しますか？',
    detail: '保存しない場合、変更内容は失われます。'
  });

  if (result.response === 2) return false; // キャンセル
  if (result.response === 1) return true;  // 保存しない → 続行

  // 保存 → レンダラーの保存関数を呼び、成功時のみ続行
  let saveResult = null;
  try {
    saveResult = await win.webContents.executeJavaScript(
      'window.saveCurrentFile ? window.saveCurrentFile() : { success: false }'
    );
  } catch (_) { /* ignore */ }
  return !!(saveResult && saveResult.success);
}

// 指定パスのファイルを読み込んでウィンドウへ送る
async function openFileInWindow(targetWindow, filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    currentFilePath = filePath;
    addToRecentFiles(filePath);
    targetWindow.webContents.send('load-file', data);
  } catch (err) {
    dialog.showErrorBox('ファイルを開けませんでした', `${filePath}\n\n${err.message}`);
  }
}

// ---- ウィンドウ状態（位置・サイズ・最大化）の記憶/復元 ----
function loadWindowState() {
  try {
    const raw = fsSync.readFileSync(userDataFile('window-state.json'), 'utf8');
    const s = JSON.parse(raw);
    if (s && typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch (_) { /* 無ければ null */ }
  return null;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
    const state = {
      ...bounds,
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen()
    };
    fsSync.writeFileSync(userDataFile('window-state.json'), JSON.stringify(state, null, 2), 'utf8');
  } catch (_) { /* ignore */ }
}

// 保存された矩形がいずれかのディスプレイと十分重なるか（画面外に開かないための補正）
function isBoundsVisible(bounds) {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false;
  return screen.getAllDisplays().some(d => {
    const wa = d.workArea;
    return (
      bounds.x < wa.x + wa.width &&
      bounds.x + bounds.width > wa.x &&
      bounds.y < wa.y + wa.height &&
      bounds.y + bounds.height > wa.y
    );
  });
}

function createWindow(filePath = null) {
  // 最初のウィンドウのみ前回状態を復元（追加ウィンドウは既定サイズ）
  const saved = !mainWindow ? loadWindowState() : null;
  const useSaved = saved && isBoundsVisible(saved);

  const newWindow = new BrowserWindow({
    width: useSaved ? saved.width : 1200,
    height: useSaved ? saved.height : 800,
    x: useSaved ? saved.x : undefined,
    y: useSaved ? saved.y : undefined,
    minWidth: 640,
    minHeight: 400,
    icon: path.join(__dirname, 'assets/icons/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#ffffff',
    titleBarStyle: 'default'
  });

  if (useSaved && saved.isMaximized) newWindow.maximize();
  if (useSaved && saved.isFullScreen) newWindow.setFullScreen(true);

  newWindow.loadFile('index.html');

  // ウィンドウ状態の保存（移動・リサイズ・最大化変化時）
  const persistState = () => saveWindowState(newWindow);
  newWindow.on('resize', persistState);
  newWindow.on('move', persistState);
  newWindow.on('maximize', persistState);
  newWindow.on('unmaximize', persistState);
  newWindow.on('enter-full-screen', persistState);
  newWindow.on('leave-full-screen', persistState);

  // 外部リンクは既定ブラウザで開く / アプリ内での外部遷移を禁止（§1.6）
  newWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  newWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // ウィンドウの読み込みが完了したら、開くべきファイルがあればロードする
  newWindow.webContents.on('did-finish-load', async () => {
    const fileToLoad = filePath || fileToOpen;
    if (fileToLoad) {
      await openFileInWindow(newWindow, fileToLoad);
      if (!filePath) fileToOpen = null;
    }
  });

  // ウィンドウを閉じる前に未保存の変更を確認
  newWindow.on('close', async (e) => {
    e.preventDefault();
    saveWindowState(newWindow); // 破棄前に状態を保存

    let hasUnsavedChanges = false;
    try {
      hasUnsavedChanges = await newWindow.webContents.executeJavaScript('window.hasUnsavedChanges || false');
    } catch (_) { /* ignore */ }

    if (!hasUnsavedChanges) {
      newWindow.destroy();
      return;
    }

    const result = await dialog.showMessageBox(newWindow, {
      type: 'question',
      buttons: ['保存', '保存しない', 'キャンセル'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存の変更',
      message: '閉じる前に変更を保存しますか？',
      detail: '保存しない場合、変更内容は失われます。'
    });

    if (result.response === 1) {
      // 保存しない
      newWindow.destroy();
    } else if (result.response === 0) {
      // 保存 → 成功時のみ閉じる（キャンセル/失敗時は閉じずにデータを守る）
      let saveResult = null;
      try {
        saveResult = await newWindow.webContents.executeJavaScript(
          'window.saveCurrentFile ? window.saveCurrentFile() : { success: false }'
        );
      } catch (_) { /* ignore */ }
      if (saveResult && saveResult.success) newWindow.destroy();
    }
    // キャンセルの場合は何もしない
  });

  // メインウィンドウの参照を保持
  if (!mainWindow) {
    mainWindow = newWindow;
  }

  buildMenu();
  return newWindow;
}

// ---- アプリケーションメニューの構築（最近使ったファイル等を反映して再構築可能） ----
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const recentSubmenu = recentFiles.length > 0
    ? recentFiles.map(fp => ({
        label: path.basename(fp),
        toolTip: fp,
        click: async () => {
          const win = BrowserWindow.getFocusedWindow() || mainWindow;
          if (win && await confirmDiscardChanges(win)) {
            await openFileInWindow(win, fp);
          }
        }
      })).concat([
        { type: 'separator' },
        { label: '履歴をクリア', click: () => clearRecentFiles() }
      ])
    : [{ label: '（履歴なし）', enabled: false }];

  const showAbout = () => {
    dialog.showMessageBox(BrowserWindow.getFocusedWindow() || mainWindow, {
      type: 'info',
      title: 'Logical Node 3 について',
      message: 'Logical Node 3',
      detail: `バージョン ${app.getVersion()}\nロジックツリー思考ツール（MIT License）`
    });
  };

  const template = [];

  // macOS: アプリ名メニュー（About / Preferences(⌘,) / Hide / Quit）
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'Cmd+,',
          click: () => dialog.showMessageBox(BrowserWindow.getFocusedWindow() || mainWindow, {
            type: 'info', title: '設定', message: '設定', detail: '設定項目は今後追加予定です。'
          })
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  template.push({
    label: 'File',
    submenu: [
      { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
      {
        label: 'Open…',
        accelerator: 'CmdOrCtrl+O',
        click: async () => {
          const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;
          if (!focusedWindow) return;
          // 現在の未保存変更を確認してから開く（§0）
          if (!(await confirmDiscardChanges(focusedWindow))) return;
          const result = await dialog.showOpenDialog(focusedWindow, {
            properties: ['openFile'],
            filters: [
              { name: 'Logic Tree Files', extensions: ['tree'] },
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          });
          if (!result.canceled && result.filePaths.length > 0) {
            await openFileInWindow(focusedWindow, result.filePaths[0]);
          }
        }
      },
      { label: 'Open Recent', submenu: recentSubmenu },
      { type: 'separator' },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (w) w.webContents.send('save-file');
        }
      },
      {
        label: 'Save As…',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (w) w.webContents.send('save-file-as');
        }
      },
      { type: 'separator' },
      {
        label: 'Export',
        submenu: [
          { label: 'Export as Markdown…', click: () => sendToFocused('export-markdown') },
          { label: 'Export as Text…', click: () => sendToFocused('export-text') },
          { label: 'Export as PNG…', click: () => sendToFocused('export-png') }
        ]
      },
      { type: 'separator' },
      {
        label: 'Close Window',
        accelerator: 'CmdOrCtrl+W',
        click: () => {
          const w = BrowserWindow.getFocusedWindow();
          if (w) w.close();
        }
      },
      ...(isMac ? [] : [{ label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }])
    ]
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  });

  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  });

  template.push({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  });

  template.push({
    role: 'help',
    submenu: [
      { label: 'Logical Node 3 について', click: showAbout }
    ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendToFocused(channel) {
  const w = BrowserWindow.getFocusedWindow();
  if (w) w.webContents.send(channel);
}

// ---- IPC ----

// 新規ウィンドウでファイルを開く
ipcMain.handle('open-file-in-new-window', async (event, filePath) => {
  try {
    createWindow(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ウィンドウタイトルを更新
ipcMain.handle('update-window-title', async (event, hasUnsavedChanges) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win) {
    const fileName = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
    const unsavedMark = hasUnsavedChanges ? '● ' : '';
    win.setTitle(`${unsavedMark}${fileName} - Logic Tree`);
  }
});

// レンダラーからのエラーダイアログ表示（破損ファイル等の明示エラー用・§13）
ipcMain.handle('show-error-dialog', async (event, { title, message } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  await dialog.showMessageBox(win, {
    type: 'error',
    title: title || 'エラー',
    message: title || 'エラー',
    detail: message || ''
  });
});

// 上書き保存（原子的書き込み）
ipcMain.handle('save-file', async (event, data) => {
  if (currentFilePath) {
    try {
      await atomicWriteFile(currentFilePath, data, 'utf8');
      return { success: true, filePath: currentFilePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return await saveFileAs(data);
});

// 別名保存
ipcMain.handle('save-file-as', async (event, data) => {
  return await saveFileAs(data);
});

async function saveFileAs(data) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showSaveDialog(win, {
    filters: [
      { name: 'Logic Tree Files', extensions: ['tree'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: currentFilePath || 'logic-tree.tree'
  });

  if (!result.canceled && result.filePath) {
    try {
      await atomicWriteFile(result.filePath, data, 'utf8');
      currentFilePath = result.filePath;
      addToRecentFiles(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
}

// エクスポート（Markdown / Text）
async function exportText(data, { name, ext, defaultName }) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showSaveDialog(win, {
    filters: [
      { name, extensions: [ext] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: defaultName
  });
  if (!result.canceled && result.filePath) {
    try {
      await atomicWriteFile(result.filePath, data, 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
}

ipcMain.handle('export-markdown', async (event, data) =>
  exportText(data, { name: 'Markdown Files', ext: 'md', defaultName: 'logic-tree.md' }));

ipcMain.handle('export-text', async (event, data) =>
  exportText(data, { name: 'Text Files', ext: 'txt', defaultName: 'logic-tree.txt' }));

// PNG画像エクスポート
ipcMain.handle('export-png', async (event, dataURL) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showSaveDialog(win, {
    filters: [
      { name: 'PNG Images', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'logic-tree.png'
  });
  if (!result.canceled && result.filePath) {
    try {
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await atomicWriteFile(result.filePath, buffer);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
});

// ---- 起動処理 ----

// コマンドライン引数から .tree ファイルを取得（Windows/Linux）
function pickTreeArg(argv) {
  return argv.find(arg => arg.endsWith('.tree'));
}
{
  const argFile = pickTreeArg(process.argv);
  if (argFile) fileToOpen = argFile;
}

// macOS: ファイルをダブルクリックして開いたとき
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;
  if (mainWindow && mainWindow.webContents) {
    openFileInWindow(mainWindow, filePath);
  }
});

// Windows: タスクバーのピン留めアイコン用 AppUserModelID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.logicalnode3.app');
}

// ---- シングルインスタンス（多重起動時は既存へ集約）----
// テスト時は各テストが独立プロセスを起動するため無効化
if (!isTest) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, argv) => {
      const argFile = pickTreeArg(argv);
      if (argFile) {
        // 別ファイルは新規ウィンドウで開く
        createWindow(argFile);
      } else if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

app.whenReady().then(async () => {
  await loadRecentFiles();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
