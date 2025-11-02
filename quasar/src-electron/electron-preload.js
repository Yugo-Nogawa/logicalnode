/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 */

import { contextBridge, ipcRenderer } from 'electron';

// IPCブリッジを設定
contextBridge.exposeInMainWorld('electronAPI', {
  // ファイル保存・読み込み
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  saveFileAs: (data) => ipcRenderer.invoke('save-file-as', data),
  updateWindowTitle: (hasUnsavedChanges) =>
    ipcRenderer.invoke('update-window-title', hasUnsavedChanges),
  openFileInNewWindow: (filePath) => ipcRenderer.invoke('open-file-in-new-window', filePath),

  // エクスポート
  exportMarkdown: (data) => ipcRenderer.invoke('export-markdown', data),
  exportText: (data) => ipcRenderer.invoke('export-text', data),
  exportPng: (dataURL) => ipcRenderer.invoke('export-png', dataURL),

  // メインプロセスからのイベントリスナー
  onSaveFile: (callback) => {
    ipcRenderer.on('save-file', () => callback());
  },
  onSaveFileAs: (callback) => {
    ipcRenderer.on('save-file-as', () => callback());
  },
  onLoadFile: (callback) => {
    ipcRenderer.on('load-file', (event, data) => callback(data));
  },
  onNewFile: (callback) => {
    ipcRenderer.on('new-file', () => callback());
  },
  onExportMarkdown: (callback) => {
    ipcRenderer.on('export-markdown', () => callback());
  },
  onExportText: (callback) => {
    ipcRenderer.on('export-text', () => callback());
  },
  onExportPng: (callback) => {
    ipcRenderer.on('export-png', () => callback());
  },

  // イベントリスナーのクリーンアップ
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
