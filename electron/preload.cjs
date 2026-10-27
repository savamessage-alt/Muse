// Preload-скрипт Electron (CommonJS): безопасный мост в рендер
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ymElectronAPI', {
  request: (url, init) => ipcRenderer.invoke('ym-request', url, init),
})