const { app, BrowserWindow, Menu, dialog, ipcMain, net, shell } = require('electron')
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
    this._readyWaiters = []     // waitReady() promise resolvers
    this._statusListeners = []  // status message listeners
    this._lastStatus = ''       // 缓存最新状态，前端连接时立即推送
    this._restartCount = 0
    this._maxRestarts = 3
    this._buffer = ''
    this._disabled = false
  }

  waitReady() {
    return new Promise((resolve) => {
      if (this._ready || this._disabled) return resolve()
      this._readyWaiters.push(resolve)
    })
  }

  _broadcastStatus(status) {
    this._lastStatus = status
    this._statusListeners.forEach((cb) => cb(status))
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

  _getModelDir() {
    if (isDev) return path.join(__dirname, '..', 'models')
    return path.join(path.dirname(app.getPath('exe')), 'resources', 'ocr-models')
  }

  isAvailable() {
    const pythonExe = this._getPythonExe()
    return fs.existsSync(pythonExe)
  }

  start() {
    if (process.env.DISABLE_OCR === '1') {
      console.log('[OCR] Disabled via DISABLE_OCR env var')
      this._disabled = true
      return
    }
    if (!this.isAvailable()) {
      console.log('[OCR] Python runtime not found, OCR disabled')
      this._disabled = true
      return
    }

    const pythonExe = this._getPythonExe()
    const workerScript = this._getWorkerScript()
    const modelDir = this._getModelDir()

    console.log('[OCR] Starting Python worker:', pythonExe, workerScript)
    console.log('[OCR] Model dir:', modelDir)

    try {
      this._proc = spawn(pythonExe, ['-u', workerScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, OCR_MODEL_DIR: modelDir }
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
      const text = chunk.toString('utf8')
      console.error('[OCR stderr]', text.trim())
      // 解析 tqdm 进度: "Fetching 6 files:  83%|████"
      const match = text.match(/Fetching \d+ files:\s+(\d+)%/)
      if (match) {
        const pct = parseInt(match[1], 10)
        this._broadcastStatus(`正在下载模型... ${pct}%`)
      }
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

    if (msg.status) {
      console.log('[OCR] Status:', msg.status)
      this._broadcastStatus(msg.status)
      return
    }

    if (msg.ready) {
      console.log('[OCR] Python worker ready')
      this._ready = true
      this._restartCount = 0
      const waiters = this._readyWaiters.splice(0)
      waiters.forEach((resolve) => resolve())
      this._statusListeners = []
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

// ─── 万宝楼金价查询 ──────────────────────────────────────────────────────────
// 万宝楼买家端接口（trade-api.seasunwbl.com）无需登录，GET 直接返回 JSON。
// 金币商品的 single_count_price 是「每元多少金」，值越大金价越便宜，
// 所以「最低金价」= 按 single_count_price 倒序的第一条。

const WBL_API = 'https://trade-api.seasunwbl.com'
const WBL_TIMEOUT = 8000
const DEFAULT_GOLD_SERVER = { zoneId: 'z05', zoneName: '电信区', serverId: 'gate0502', serverName: '梦江南' }

function wblRequest(apiPath, params) {
  const query = new URLSearchParams({
    req_id: randomUUID().replace(/-/g, ''),
    game_id: 'jx3',
    ...params
  }).toString()

  return new Promise((resolve, reject) => {
    const request = net.request(`${WBL_API}${apiPath}?${query}`)
    const timer = setTimeout(() => {
      try { request.abort() } catch { /* ignore */ }
      reject(new Error('请求超时'))
    }, WBL_TIMEOUT)

    request.setHeader('Referer', 'https://jx3.seasunwbl.com/')
    request.on('response', (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk.toString('utf8') })
      response.on('end', () => {
        clearTimeout(timer)
        try {
          const parsed = JSON.parse(body)
          if (parsed.code !== 1) return reject(new Error(parsed.msg || '接口返回异常'))
          resolve(parsed.data)
        } catch (error) {
          reject(new Error('返回内容解析失败'))
        }
      })
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.end()
  })
}

function readGoldServer() {
  const saved = readSettings().goldServer
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_GOLD_SERVER }
  const merged = { ...DEFAULT_GOLD_SERVER, ...saved }
  return merged.zoneId && merged.serverId ? merged : { ...DEFAULT_GOLD_SERVER }
}

function writeGoldServer(server) {
  const settings = readSettings()
  settings.goldServer = {
    zoneId: String(server.zoneId || ''),
    zoneName: String(server.zoneName || ''),
    serverId: String(server.serverId || ''),
    serverName: String(server.serverName || '')
  }
  writeSettings(settings)
  return settings.goldServer
}

async function fetchGoldPrice(server) {
  const target = server && server.zoneId && server.serverId ? server : readGoldServer()
  const data = await wblRequest('/api/buyer/goods/list', {
    goods_type: '1',
    zone_id: target.zoneId,
    server_id: target.serverId,
    page: '1',
    size: '10',
    'sort[single_count_price]': 'desc'
  })
  const lowest = Array.isArray(data.list) ? data.list[0] : null
  if (!lowest) throw new Error('该服当前没有在售金币')
  return {
    price: lowest.single_count_price,      // 每元多少金
    goldAmount: lowest.single_unit_size,   // 该条商品单份金数
    unitPrice: lowest.single_unit_price / 100, // 单份价格（元）
    remainCount: lowest.remain_unit_count,
    zoneName: lowest.zone_name || target.zoneName,
    serverName: lowest.server_name || target.serverName,
    updatedAt: Date.now()
  }
}

// ─── JX3Box 交易行物价 ────────────────────────────────────────────────────────
// 数据来自玩家插件上传，不是官方接口；热门物品几分钟一更，冷门物品可能很久没人传。
// 用 POST /api/auction/ 的小时聚合（物品页「价格走势」同款）：每条是该小时的最低单价 + 在售数量。
// 不用 GET /api/item-price/<id>/detail：它只给按价格倒序的前 15 条挂单，真正的最低价常被截掉。
// 价格单位：铜（1 金 = 100 银 = 10000 铜）。

const JX3BOX_AUCTION_API = 'https://next2.jx3box.com/api/auction/'
const AUCTION_TIMEOUT = 10000
const AUCTION_CACHE_TTL = 5 * 60 * 1000
const AUCTION_CONCURRENCY = 6
const auctionCache = new Map() // `${server}|${itemId}` → { at, value }

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'POST', url })
    const timer = setTimeout(() => {
      try { request.abort() } catch { /* ignore */ }
      reject(new Error('请求超时'))
    }, AUCTION_TIMEOUT)
    request.setHeader('Content-Type', 'application/json')
    request.on('response', (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        clearTimeout(timer)
        reject(new Error(`接口返回 ${response.statusCode}`))
        return
      }
      let body = ''
      response.on('data', (chunk) => { body += chunk.toString('utf8') })
      response.on('end', () => {
        clearTimeout(timer)
        try { resolve(JSON.parse(body)) } catch { reject(new Error('返回内容解析失败')) }
      })
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.write(JSON.stringify(payload))
    request.end()
  })
}

async function fetchAuctionPrice(server, itemId) {
  const key = `${server}|${itemId}`
  const cached = auctionCache.get(key)
  if (cached && Date.now() - cached.at < AUCTION_CACHE_TTL) return cached.value
  const rows = await postJson(JX3BOX_AUCTION_API, { item_id: itemId, server, aggregate_type: 'hourly' })
  // 不是数组说明接口出错了：抛出去让调用方记进 failed（可重试），不能当「无报价」缓存
  if (!Array.isArray(rows)) throw new Error('返回格式异常')
  const last = rows.length ? rows[rows.length - 1] : null
  // 没有记录也缓存，避免冷门物品每次打开都重查
  const value = last && last.price > 0
    ? { price: Number(last.price), count: Number(last.sample) || 0, updatedAt: Number(last.timestamp) * 1000 }
    : null
  auctionCache.set(key, { at: Date.now(), value })
  return value
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    const timer = setTimeout(() => {
      try { request.abort() } catch { /* ignore */ }
      reject(new Error('请求超时'))
    }, AUCTION_TIMEOUT)
    request.on('response', (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk.toString('utf8') })
      response.on('end', () => {
        clearTimeout(timer)
        try { resolve(JSON.parse(body)) } catch { reject(new Error('返回内容解析失败')) }
      })
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.end()
  })
}

// 按名字搜物品：JX3Box node 接口 item_merged/name/<关键字>。
// BindType 3 = 拾取绑定、不能上交易行，直接过滤；名字完全相同的排最前，其次按名字长度（越短越接近）。
async function searchAuctionItems(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  const data = await getJson(`https://node.jx3box.com/item_merged/name/${encodeURIComponent(kw)}?client=std&per=50`)
  const list = Array.isArray(data && data.list) ? data.list : []
  return list
    .filter((x) => x && x.id && x.Name && x.BindType !== 3)
    .map((x) => ({ id: String(x.id), name: String(x.Name), quality: Number(x.Quality) || 1, iconId: Number(x.IconID) || 0 }))
    .sort((a, b) => (b.name === kw) - (a.name === kw) || a.name.length - b.name.length)
    .slice(0, 30)
}

// 价格走势：同一个 /api/auction/ 接口的按天聚合，每天一条最低价
const trendCache = new Map() // `${server}|${itemId}` → { at, value }
const TREND_CACHE_TTL = 30 * 60 * 1000

async function fetchAuctionTrend(itemId, server) {
  const target = server || readGoldServer().serverName
  const key = `${target}|${itemId}`
  const cached = trendCache.get(key)
  if (cached && Date.now() - cached.at < TREND_CACHE_TTL) return cached.value
  const rows = await postJson(JX3BOX_AUCTION_API, { item_id: itemId, server: target, aggregate_type: 'daily' })
  const value = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.price > 0)
    .map((r) => ({ price: Number(r.price), count: Number(r.sample) || 0, ts: Number(r.timestamp) * 1000 }))
  trendCache.set(key, { at: Date.now(), value })
  return value
}

async function fetchAuctionPrices(itemIds, server, force) {
  const target = server || readGoldServer().serverName
  const ids = [...new Set((Array.isArray(itemIds) ? itemIds : []).filter((x) => typeof x === 'string' && x))]
  if (force) ids.forEach((id) => auctionCache.delete(`${target}|${id}`))
  const prices = {}
  const failed = []
  let cursor = 0
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++]
      try {
        prices[id] = await fetchAuctionPrice(target, id)
      } catch {
        failed.push(id)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AUCTION_CONCURRENCY, ids.length) }, worker))
  return { server: target, prices, failed }
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
    icon: path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
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

// Windows：AppUserModelID 与安装程序创建的快捷方式（electron-builder 用 appId）一致，
// 任务栏才会把运行中的窗口与快捷方式归为同一程序并使用同一图标；否则可能沿用缓存里的旧图标（早期长方形图标只显示一半）
if (process.platform === 'win32') {
  app.setAppUserModelId('com.xiatian.jx3.tracker')
}

app.whenReady().then(() => {
  // 预热 OCR worker
  ocrManager.start()

  ipcMain.handle('app:ocr', async (_, b64) => {
    return ocrManager.recognize(b64)
  })
  ipcMain.handle('app:waitOcrReady', () => ocrManager.waitReady())
  ipcMain.handle('app:isOcrReady', () => ({ ready: ocrManager._ready, disabled: ocrManager._disabled }))
  ipcMain.handle('app:startOcr', () => {
    if (ocrManager._ready) return { ok: true, message: 'already_ready' }
    if (ocrManager._proc) return { ok: true, message: 'already_running' }
    ocrManager.start()
    return { ok: true, message: 'started' }
  })
  ipcMain.on('app:onOcrStatus', (event) => {
    // 立即推送缓存的最新状态（前端可能在下载过程中才连接）
    if (ocrManager._lastStatus) {
      try { event.sender.send('app:ocrStatus', ocrManager._lastStatus) } catch { /* ignore */ }
    }
    ocrManager._statusListeners.push((status) => {
      try { event.sender.send('app:ocrStatus', status) } catch { /* window may be closed */ }
    })
  })

  ipcMain.handle('app:getGoldPrice', async (_event, server) => {
    try {
      return { ok: true, data: await fetchGoldPrice(server) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '查询失败' }
    }
  })
  ipcMain.handle('app:getGoldGateways', async () => {
    try {
      const data = await wblRequest('/api/platform/setting/gateways', {})
      return { ok: true, data: Array.isArray(data.list) ? data.list : [] }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '查询失败' }
    }
  })
  ipcMain.handle('app:getGoldServer', () => readGoldServer())
  ipcMain.handle('app:searchAuctionItems', async (_event, keyword) => {
    try {
      return { ok: true, data: await searchAuctionItems(keyword) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '搜索失败' }
    }
  })
  ipcMain.handle('app:getAuctionTrend', async (_event, itemId) => {
    try {
      return { ok: true, data: await fetchAuctionTrend(String(itemId || ''), null) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '查询失败' }
    }
  })
  ipcMain.handle('app:getAuctionPrices', async (_event, itemIds, force) => {
    try {
      return { ok: true, data: await fetchAuctionPrices(itemIds, null, Boolean(force)) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '查询失败' }
    }
  })
  ipcMain.handle('app:setGoldServer', (_event, server) => {
    try {
      return { ok: true, data: writeGoldServer(server || {}) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '保存失败' }
    }
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
  // 把渲染进程生成的文件（base64）存到用户选的位置，目前给技艺材料清单导出 Excel 用
  ipcMain.handle('app:saveFile', async (event, defaultName, base64, filterName, extension) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow()
    win?.focus()
    try {
      const result = await dialog.showSaveDialog(win ?? undefined, {
        title: '导出',
        defaultPath: String(defaultName || `export.${extension}`),
        filters: [{ name: String(filterName || '文件'), extensions: [String(extension || '*')] }]
      })
      if (result.canceled || !result.filePath) return { ok: false }
      fs.writeFileSync(result.filePath, Buffer.from(String(base64), 'base64'))
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
