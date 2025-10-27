const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let fileToOpen = null;

function createWindow(filePath = null) {
  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#ffffff',
    titleBarStyle: 'default'
  });

  newWindow.loadFile('index.html');

  // ウィンドウの読み込みが完了したら、開くべきファイルがあればロードする
  newWindow.webContents.on('did-finish-load', async () => {
    const fileToLoad = filePath || fileToOpen;
    if (fileToLoad) {
      try {
        const data = await fs.readFile(fileToLoad, 'utf8');
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
    const hasUnsavedChanges = await newWindow.webContents.executeJavaScript('window.hasUnsavedChanges || false');

    if (hasUnsavedChanges) {
      const result = await dialog.showMessageBox(newWindow, {
        type: 'question',
        buttons: ['保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
        title: '未保存の変更',
        message: '閉じる前に変更を保存しますか？',
        detail: '保存しない場合、変更内容は失われます。'
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
          }
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
                { name: 'All Files', extensions: ['*'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              try {
                const data = await fs.readFile(result.filePaths[0], 'utf8');
                mainWindow.webContents.send('load-file', data);
              } catch (err) {
                dialog.showErrorBox('Error', 'Failed to open file: ' + err.message);
              }
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('save-file');
            }
          }
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
          }
        },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
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

// ファイル保存の処理
ipcMain.handle('save-file-dialog', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Logic Tree Files', extensions: ['tree'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'logic-tree.tree'
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

// コマンドライン引数からファイルパスを取得（Windows/Linux）
// 開発時は引数が多いので、.treeファイルのみを対象にする
if (process.argv.length >= 2) {
  const argFile = process.argv.find(arg => arg.endsWith('.tree'));
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
      .then(data => {
        mainWindow.webContents.send('load-file', data);
      })
      .catch(err => {
        dialog.showErrorBox('Error', 'Failed to open file: ' + err.message);
      });
  }
});

// Windows用: タスクバーのピン留めアイコンを正しく表示するためにAppUserModelIDを設定
if (process.platform === 'win32') {
  app.setAppUserModelId('com.logicalnode3.app');
}

app.whenReady().then(() => {
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
