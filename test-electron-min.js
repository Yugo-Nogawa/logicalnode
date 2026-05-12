const electron = require('electron');
console.log('Type:', typeof electron);
if (typeof electron === 'string') {
  console.log('FAIL: electron is a string (npm package, not runtime API)');
  process.exit(1);
}
console.log('Has app:', !!electron.app);
console.log('Has BrowserWindow:', !!electron.BrowserWindow);
console.log('Has ipcMain:', !!electron.ipcMain);
if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('App ready!');
    electron.app.quit();
  });
} else {
  process.exit(1);
}
