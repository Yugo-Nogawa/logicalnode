import pkg from 'electron';
const { app, BrowserWindow, Menu, dialog, ipcMain } = pkg;
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow;
let fileToOpen = null;
let currentFilePath = null; // 現在開いているファイルのパス
let recentFiles = []; // 最近開いたファイルのリスト
const MAX_RECENT_FILES = 10;

// 最近開いたファイルに追加
function addToRecentFiles(filePath) {
  // 既存のエントリを削除
  recentFiles = recentFiles.filter((f) => f !== filePath);
  // 先頭に追加
  recentFiles.unshift(filePath);
  // 最大数を超えたら削除
  if (recentFiles.length > MAX_RECENT_FILES) {
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
  }
  // Electronの最近使ったファイルに追加
  app.addRecentDocument(filePath);
}

async function createWindow(filePath = null) {
  /**
   * Initial window options
   */
  const newWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1200,
    height: 800,
    useContentSize: true,
    backgroundColor: '#ffffff',
    titleBarStyle: 'default',
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(
          process.env.QUASAR_ELECTRON_PRELOAD_FOLDER,
          'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION
        )
      ),
    },
  });

  if (process.env.DEV) {
    await newWindow.loadURL(process.env.APP_URL);
  } else {
    await newWindow.loadFile('index.html');
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    newWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    newWindow.webContents.on('devtools-opened', () => {
      newWindow.webContents.closeDevTools();
    });
  }

  // ウィンドウの読み込みが完了したら、開くべきファイルがあればロードする
  newWindow.webContents.on('did-finish-load', async () => {
    const fileToLoad = filePath || fileToOpen;
    if (fileToLoad) {
      try {
        const data = await fs.readFile(fileToLoad, 'utf8');
        currentFilePath = fileToLoad; // ファイルパスを記憶
        addToRecentFiles(fileToLoad); // 最近開いたファイルに追加
        newWindow.webContents.send('load-file', data);
        if (!filePath) {
          fileToOpen = null;
        }
      } catch (err) {
        dialog.showErrorBox('Error', 'Failed to open file: ' + err.message);
      }
    }
  });

  // ウィンドウを閉じる前に未保存の変更を確認
  newWindow.on('close', async (e) => {
    e.preventDefault();

    // レンダラープロセスに未保存の変更があるか問い合わせ
    const hasUnsavedChanges = await newWindow.webContents.executeJavaScript(
      'window.hasUnsavedChanges || false'
    );

    if (hasUnsavedChanges) {
      const result = await dialog.showMessageBox(newWindow, {
        type: 'question',
        buttons: ['保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
        title: '未保存の変更',
        message: '閉じる前に変更を保存しますか？',
        detail: '保存しない場合、変更内容は失われます。',
      });

      if (result.response === 0) {
        // Save
        newWindow.webContents.send('save-file');
        // 保存完了後に閉じる処理は save-file-success イベントで処理
        newWindow.once('save-file-success', () => {
          newWindow.destroy();
        });
      } else if (result.response === 1) {
        // Don't Save
        newWindow.destroy();
      }
      // Cancel の場合は何もしない
    } else {
      // 未保存の変更がない場合は即座に閉じる
      newWindow.destroy();
    }
  });

  newWindow.on('closed', () => {
    if (newWindow === mainWindow) {
      mainWindow = null;
    }
  });

  // メインウィンドウの参照を保持
  if (!mainWindow) {
    mainWindow = newWindow;
  }

  // メニューバーの設定
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          },
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Logic Tree Files', extensions: ['tree'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              try {
                const data = await fs.readFile(result.filePaths[0], 'utf8');
                currentFilePath = result.filePaths[0]; // ファイルパスを記憶
                addToRecentFiles(result.filePaths[0]); // 最近開いたファイルに追加
                mainWindow.webContents.send('load-file', data);
              } catch (err) {
                dialog.showErrorBox('Error', 'Failed to open file: ' + err.message);
              }
            }
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('save-file');
            }
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('save-file-as');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Markdown...',
              click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  focusedWindow.webContents.send('export-markdown');
                }
              },
            },
            {
              label: 'Export as Text...',
              click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  focusedWindow.webContents.send('export-text');
                }
              },
            },
            {
              label: 'Export as PNG...',
              click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  focusedWindow.webContents.send('export-png');
                }
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.close();
            }
          },
        },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  return newWindow;
}

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
  if (mainWindow) {
    const fileName = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
    const unsavedMark = hasUnsavedChanges ? '* ' : '';
    mainWindow.setTitle(`${unsavedMark}${fileName} - Logic Tree`);
  }
});

// 上書き保存の処理
ipcMain.handle('save-file', async (event, data) => {
  // 現在のファイルパスがある場合は上書き保存
  if (currentFilePath) {
    try {
      await fs.writeFile(currentFilePath, data, 'utf8');
      return { success: true, filePath: currentFilePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ファイルパスがない場合は別名保存と同じ動作
  return await saveFileAs(data);
});

// 別名保存の処理
ipcMain.handle('save-file-as', async (event, data) => {
  return await saveFileAs(data);
});

// 別名保存のヘルパー関数
async function saveFileAs(data) {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Logic Tree Files', extensions: ['tree'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: currentFilePath || 'logic-tree.tree',
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, data, 'utf8');
      currentFilePath = result.filePath; // ファイルパスを更新
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
}

// Markdownエクスポート
ipcMain.handle('export-markdown', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: 'logic-tree.md',
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, data, 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
});

// テキストエクスポート
ipcMain.handle('export-text', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: 'logic-tree.txt',
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, data, 'utf8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
});

// PNG画像エクスポート
ipcMain.handle('export-png', async (event, dataURL) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'PNG Images', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    defaultPath: 'logic-tree.png',
  });

  if (!result.canceled && result.filePath) {
    try {
      // Data URLからBase64部分を抽出
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(result.filePath, buffer);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, canceled: true };
});

// コマンドライン引数からファイルパスを取得（Windows/Linux）
// 開発時は引数が多いので、.treeファイルのみを対象にする
if (process.argv.length >= 2) {
  const argFile = process.argv.find((arg) => arg.endsWith('.tree'));
  if (argFile) {
    fileToOpen = argFile;
  }
}

// macOS用: ファイルをダブルクリックして開いたとき
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;

  // すでにウィンドウが開いている場合は即座にロード
  if (mainWindow && mainWindow.webContents) {
    fs.readFile(filePath, 'utf8')
      .then((data) => {
        currentFilePath = filePath; // ファイルパスを記憶
        mainWindow.webContents.send('load-file', data);
      })
      .catch((err) => {
        dialog.showErrorBox('Error', 'Failed to open file: ' + err.message);
      });
  }
});

// Windows用: タスクバーのピン留めアイコンを正しく表示するためにAppUserModelIDを設定
if (process.platform === 'win32') {
  app.setAppUserModelId('com.logicalnode3.app');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
