// ============================================================
// Electron main-процесс (Windows .exe) — CommonJS
// - грузит dev-сервер или собранный dist/
// - проксирует API-запросы через net.fetch (нет CORS)
// ============================================================

const { app, BrowserWindow, ipcMain, net } = require('electron')
const path = require('node:path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    title: 'YM Player',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// Запросы из рендера → net.fetch в main-процессе (обход CORS)
ipcMain.handle('ym-request', async (_event, url, init) => {
  try {
    const res = await net.fetch(url, {
      method: init && init.method ? init.method : 'GET',
      headers: init && init.headers ? init.headers : {},
      body: init && init.body !== undefined ? init.body : undefined,
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: 0, body: JSON.stringify({ error: String(err) }) }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})