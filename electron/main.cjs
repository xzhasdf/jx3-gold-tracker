const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { randomUUID } = require('crypto')

const isDev = !app.isPackaged
const SETTINGS_FILE = 'settings.json'
const STATE_FILE = 'state.json'
let isForceQuitting = false

// ─── PythonOcrManager ────────────────────────────────────────────────────────

class PythonOcrManager {
  constructor() {
    this._proc = null
    this._ready = false
    this._pending = new Map()   // id → { resolve, reject, timer }
    this._restartCount = 0
    this._maxRestarts = 3
    this._buffer = ''
  }

  _getPythonExe() {
    if (isDev && process.platform === 'darwin') {
      return path.join(__dirname, '..', 'python-venv', 'bin', 'python3')
    }
    if (isDev) {
      // Windows 开发（保留兼容）
      return path.join(__dirname, '..', 'python-runtime', 'python.exe')
    }
    // Windows 生产包：相对于 exe 位置，便携 U 盘时路径也正确
    return path.join(path.dirname(app.getPath('exe')), 'resources', 'python-runtime', 'python.exe')
  }

  _getWorkerScript() {
    if (isDev) return path.join(__dirname, '..', 'python', 'ocr_worker.py')
    return path.join(path.dirname(app.getPath('exe')), 'resources', 'python-runtime', 'ocr_worker.py')
  }

  start() {
    const pythonExe = this._getPythonExe()
    const workerScript = this._getWorkerScript()

    console.log('[OCR] Starting Python worker:', pythonExe, workerScript)

    try {
      this._proc = spawn(pythonExe, ['-u', workerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
    } catch (err) {
      console.error('[OCR] Failed to spawn Python worker:', err)
      return
    }

    this._buffer = ''
    this._ready = false

    this._proc.stdout.on('data', (chunk) => {
      this._buffer += chunk.toString('utf8')
      let nl
      while ((nl = this._buffer.indexOf('\n')) !== -1) {
        const line = this._buffer.slice(0, nl).trim()
        this._buffer = this._buffer.slice(nl + 1)
        if (!line) continue
        this._handleLine(line)
      }
    })

    this._proc.stderr.on('data', (chunk) => {
      console.error('[OCR stderr]', chunk.toString('utf8').trim())
    })

    this._proc.on('exit', (code, signal) => {
      console.warn(`[OCR] Worker exited (code=${code}, signal=${signal})`)
      this._ready = false
      // Reject all pending requests
      for (const [, { reject, timer }] of this._pending) {
        clearTimeout(timer)
        reject(new Error(`OCR worker exited (code=${code})`))
      }
      this._pending.clear()

      if (!isForceQuitting && this._restartCount < this._maxRestarts) {
        this._restartCount++
        console.log(`[OCR] Restarting worker (attempt ${this._restartCount}/${this._maxRestarts})...`)
        setTimeout(() => this.start(), 1000)
      }
    })

    this._proc.on('error', (err) => {
      console.error('[OCR] Worker process error:', err)
    })
  }

  _handleLine(line) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      console.warn('[OCR] Non-JSON line from worker:', line)
      return
    }

    if (msg.ready) {
      console.log('[OCR] Python worker ready')
      this._ready = true
      this._restartCount = 0
      return
    }

    const id = msg.id
    if (id && this._pending.has(id)) {
      const { resolve, timer } = this._pending.get(id)
      clearTimeout(timer)
      this._pending.delete(id)
      resolve(msg)
    }
  }

  recognize(imageB64) {
    return new Promise((resolve, reject) => {
      if (!this._proc || !this._ready) {
        return reject(new Error('OCR worker not ready'))
      }
      const id = randomUUID()
      const TIMEOUT_MS = 30000
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error('OCR request timed out'))
      }, TIMEOUT_MS)

      this._pending.set(id, { resolve, reject, timer })

      const payload = JSON.stringify({ id, image_b64: imageB64 }) + '\n'
      this._proc.stdin.write(payload, 'utf8')
    })
  }

  stop() {
    if (!this._proc) return
    try {
      this._proc.stdin.end()
    } catch { /* ignore */ }
    const proc = this._proc
    this._proc = null
    this._ready = false
    setTimeout(() => {
      try { proc.kill('SIGTERM') } catch { /* ignore */ }
    }, 3000)
  }
}

const ocrManager = new PythonOcrManager()

// ─── App utilities ────────────────────────────────────────────────────────────

function forceQuitApp() {
  if (isForceQuitting) return
  isForceQuitting = true
  ocrManager.stop()
  BrowserWindow.getAllWindows().forEach((win) => {
    try {
      win.removeAllListeners('close')
      win.destroy()
    } catch {
      // ignore
    }
  })
  app.exit(0)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// 便携模式：开发环境用 userData，生产环境所有文件都存放在 exe 同级根目录。
function getAppRootDir() {
  if (isDev) return app.getPath('userData')
  return path.dirname(app.getPath('exe'))
}

function getSettingsPath() {
  return path.join(getAppRootDir(), SETTINGS_FILE)
}

function readSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeSettings(next) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), 'utf-8')
}

function getDefaultDataDir() {
  return path.join(getAppRootDir(), 'data')
}

function resolveDataDir() {
  const settings = readSettings()
  const candidate = typeof settings.dataDir === 'string' ? settings.dataDir.trim() : ''
  return candidate || getDefaultDataDir()
}

function ensureDataDir() {
  const target = resolveDataDir()
  try {
    return ensureDir(target)
  } catch {
    // 无法写入目标目录（如 Program Files 权限不足），临时回退到 userData，
    // 不写入 settings 以便下次仍然尝试默认路径。
    return ensureDir(path.join(app.getPath('userData'), 'data'))
  }
}

function getStateFilePath() {
  return path.join(ensureDataDir(), STATE_FILE)
}

async function pickDataDirWithMigration(win) {
  const oldDir = resolveDataDir()
  const result = await dialog.showOpenDialog(win, {
    title: '选择数据目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const newDir = result.filePaths[0]
  if (newDir === oldDir) return null

  const oldStateFile = path.join(oldDir, STATE_FILE)
  const hasData = fs.existsSync(oldStateFile)

  if (hasData) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: '迁移数据',
      message: '检测到原目录存在数据，是否迁移到新目录？',
      detail: `原目录：${oldDir}\n新目录：${newDir}`,
      buttons: ['迁移并删除原目录', '仅切换路径', '取消'],
      defaultId: 0,
      cancelId: 2
    })
    if (response === 2) return null
    if (response === 0) {
      ensureDir(newDir)
      fs.copyFileSync(oldStateFile, path.join(newDir, STATE_FILE))
      try { fs.rmSync(oldDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }

  ensureDir(newDir)
  const settings = readSettings()
  settings.dataDir = newDir
  writeSettings(settings)
  return newDir
}

function readState() {
  try {
    const file = getStateFilePath()
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeState(state) {
  const file = getStateFilePath()
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // User expects closing window to fully quit all app processes.
  win.on('close', () => {
    forceQuitApp()
  })
}

function setupMenu() {
  const template = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开数据目录',
          click: async () => {
            const dir = ensureDataDir()
            await shell.openPath(dir)
          }
        },
        {
          label: '修改数据路径',
          click: async () => {
            const win = BrowserWindow.getFocusedWindow()
            const newDir = await pickDataDirWithMigration(win)
            if (newDir) await shell.openPath(newDir)
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // 预热 OCR worker
  ocrManager.start()

  ipcMain.handle('app:ocr', async (_, b64) => {
    return ocrManager.recognize(b64)
  })

  ipcMain.handle('app:getDataDir', () => ensureDataDir())
  ipcMain.handle('app:openDataDir', async () => {
    const dir = ensureDataDir()
    await shell.openPath(dir)
    return dir
  })
  ipcMain.handle('app:pickDataDir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return await pickDataDirWithMigration(win)
  })
  ipcMain.on('app:readStateSync', (event) => {
    event.returnValue = readState()
  })
  ipcMain.on('app:writeStateSync', (event, state) => {
    try {
      writeState(state)
      event.returnValue = { ok: true }
    } catch (error) {
      event.returnValue = { ok: false, message: error instanceof Error ? error.message : '写入失败' }
    }
  })
  ipcMain.handle('app:exportData', async (event, state) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    win?.focus()
    const date = new Date().toISOString().slice(0, 10)
    try {
      const result = await dialog.showSaveDialog(win ?? undefined, {
        title: '导出数据',
        defaultPath: `jx3-backup-${date}.json`,
        filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) return { ok: false }
      fs.writeFileSync(result.filePath, JSON.stringify(state, null, 2), 'utf-8')
      return { ok: true, filePath: result.filePath }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '写入失败' }
    }
  })
  ipcMain.handle('app:importData', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    win?.focus()
    try {
      const result = await dialog.showOpenDialog(win ?? undefined, {
        title: '导入数据',
        filters: [{ name: 'JSON 备份文件', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false }
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '文件读取失败' }
    }
  })

  setupMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  ocrManager.stop()
})

app.on('window-all-closed', () => {
  forceQuitApp()
})
