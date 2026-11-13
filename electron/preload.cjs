/**
 * Smart Jozveh - Electron Secure Preload Script
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  selectSaveDirectory: () => ipcRenderer.invoke('select-save-directory'),
});
