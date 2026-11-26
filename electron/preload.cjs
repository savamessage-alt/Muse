// Preload-скрипт Electron (CommonJS): безопасный мост в рендер
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ymElectronAPI', {
  request: (url, init) => ipcRenderer.invoke('ym-request', url, init),
  safeEncrypt: (plaintext) => ipcRenderer.invoke('safe-encrypt', plaintext),
  safeDecrypt: (base64Cipher) => ipcRenderer.invoke('safe-decrypt', base64Cipher),
  safeAvailable: () => ipcRenderer.invoke('safe-available'),
})