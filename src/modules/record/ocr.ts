import { SCHOOLS } from '../../constants/game'

export interface OcrRoleMeta {
  id: string
}

export interface OcrDungeonMeta {
  id: string
  name: string
  players: string
  difficulty: string
}

export interface OcrFillResult {
  dateTs?: number
  roleId?: string
  roleIdCandidate?: string
  schoolCandidate?: string
  dungeonId?: string
  incomeGold?: number
  expenseGold?: number
  groupBrand?: string
  leaderId?: string
  remark?: string
}

export interface OcrWordBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  /** Tesseract 字符级数据，用于检测宽度异常的图标字符 */
  symbols?: Array<{ text: string; x0: number; x1: number }>
}

export interface OcrRecognizedData {
  text: string
  words: OcrWordBox[]
}

// 表格表头关键字：出现这些词的行是列标题行，不含实际数据
const TABLE_HEADER_KEYWORDS = ['配对象', '分配对象', '消费', '底薪', '补贴', '个人结算']

function normalize(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[：﹕]/g, ':')
    .replace(/[，]/g, ',')
    .replace(/\u3000/g, ' ')
}

// 将 words 按 y0 分组成多行，并返回第一个非表头的数据行
function findDataLineWords(words: OcrWordBox[]): OcrWordBox[] {
  if (words.length === 0) return []
  const sorted = [...words].sort((a, b) => a.y0 - b.y0)
  // 行分组阈值随 word 高度自适应（放大图片时 y0 坐标同比增大，固定 10px 会把同行拆开）
  const avgWordHeight = sorted.reduce((s, w) => s + (w.y1 - w.y0), 0) / sorted.length
  const lineThreshold = Math.max(10, Math.round(avgWordHeight * 0.5))
  const lines: OcrWordBox[][] = []
  let currentLine: OcrWordBox[] = [sorted[0]]
  let baseY = sorted[0].y0
  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i]
    if (w.y0 - baseY > lineThreshold) {
      lines.push(currentLine)
      currentLine = [w]
      baseY = w.y0
    } else {
      currentLine.push(w)
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  // 跳过含表头关键字的行（用 substring 匹配，兼容 OCR 合并词）
  const dataLine = lines.find((line) => {
    const joined = line.map((w) => w.text.trim()).join('')
    if (TABLE_HEADER_KEYWORDS.some((kw) => joined.includes(kw))) return false
    return joined.length > 0
  })
  return dataLine ?? []
}

/**
 * OCR 前预处理：通过颜色检测找到金色（金币/金砖）像素区域并涂成背景色。
 * 不依赖模板文件，直接识别金/琥珀色像素（高R、中G、低B），
 * 合并为连通区域后按尺寸过滤，将图标区域填成背景色。
 */
async function eraseIconsBeforeOcr(file: File | Blob): Promise<Blob | File> {
  let imgBitmap: ImageBitmap
  try {
    imgBitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const W = imgBitmap.width
  const H = imgBitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(imgBitmap, 0, 0)
  imgBitmap.close()

  // 取左上角 3×3 均值估算背景色
  const cornerData = ctx.getImageData(0, 0, 3, 3).data
  let bgR = 0, bgG = 0, bgB = 0
  for (let i = 0; i < 9; i++) { bgR += cornerData[i * 4]; bgG += cornerData[i * 4 + 1]; bgB += cornerData[i * 4 + 2] }
  bgR = Math.round(bgR / 9); bgG = Math.round(bgG / 9); bgB = Math.round(bgB / 9)

  const { data: pixels } = ctx.getImageData(0, 0, W, H)

  // 放宽的金色/琥珀色像素阈值（覆盖金币从中心到边缘的所有色阶）
  function isGold(idx: number): boolean {
    const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]
    return r > 120 && g > 80 && b < 140 && r - b > 55 && r > g * 0.75
  }

  // 按行扫描找金色像素连续段，合并为连通 blob
  type PixelBlob = { x0: number; y0: number; x1: number; y1: number }
  const blobs: PixelBlob[] = []

  for (let y = 0; y < H; y++) {
    let start = -1
    const segs: Array<[number, number]> = []
    for (let x = 0; x < W; x++) {
      const gold = isGold((y * W + x) * 4)
      if (gold && start < 0) start = x
      else if (!gold && start >= 0) { segs.push([start, x - 1]); start = -1 }
    }
    if (start >= 0) segs.push([start, W - 1])

    for (const [sx, ex] of segs) {
      let found = -1
      for (let bi = blobs.length - 1; bi >= 0; bi--) {
        if (blobs[bi].y1 < y - 2) break
        if (blobs[bi].x1 >= sx - 1 && blobs[bi].x0 <= ex + 1) { found = bi; break }
      }
      if (found >= 0) {
        blobs[found].x0 = Math.min(blobs[found].x0, sx)
        blobs[found].x1 = Math.max(blobs[found].x1, ex)
        blobs[found].y1 = y
      } else {
        blobs.push({ x0: sx, y0: y, x1: ex, y1: y })
      }
    }
  }

  // 金砖（🔶）由多个相邻金色 blob 组成，相邻 blob 水平距离 < 80px；
  // 金币（🪙）是单独的紧凑 blob。只擦除金币，保留金砖（金砖连接 N砖M金 需要保持位置）。
  const BRICK_NEARBY = 80
  const isBrick = blobs.map((bi, i) => {
    const cyi = (bi.y0 + bi.y1) / 2
    return blobs.some((bj, j) => {
      if (i === j) return false
      if (Math.abs(cyi - (bj.y0 + bj.y1) / 2) > 12) return false
      const gap = Math.max(bi.x0 - bj.x1, bj.x0 - bi.x1)
      return gap > 0 && gap < BRICK_NEARBY
    })
  })

  let anyMatch = false
  ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`
  for (let i = 0; i < blobs.length; i++) {
    if (isBrick[i]) continue // 金砖保留
    const b = blobs[i]
    const bw = b.x1 - b.x0 + 1
    const bh = b.y1 - b.y0 + 1
    if (bw >= 4 && bh >= 2) {
      ctx.fillRect(b.x0 - 1, b.y0 - 1, bw + 2, bh + 2)
      anyMatch = true
    }
  }

  // 矮图（单行截图通常 < 80px）在 Tesseract 识别前放大 3×，避免低分辨率下字形误判（如 "3"→"9"）
  const UPSCALE_HEIGHT = 80
  const upscale = H < UPSCALE_HEIGHT ? 3 : 1

  if (!anyMatch && upscale === 1) return file

  const outCanvas = upscale > 1 ? document.createElement('canvas') : canvas
  if (upscale > 1) {
    outCanvas.width = W * upscale
    outCanvas.height = H * upscale
    const outCtx = outCanvas.getContext('2d')!
    outCtx.imageSmoothingEnabled = true
    outCtx.imageSmoothingQuality = 'high'
    outCtx.drawImage(canvas, 0, 0, W * upscale, H * upscale)
  }

  return new Promise<Blob>((resolve, reject) =>
    outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))))
  )
}

function parseAmountFromNumbers(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  if (nums.length === 1) return nums[0]
  // 砖+金格式：第一个数是砖数，通常极小（单次副本单人不超过百砖）
  // 若第一个数 >= 100，说明这是两个相邻列被合并进来的，取最后一个数（即目标列的值）
  if (nums[0] < 100 && nums[1] < 10000) {
    return nums[0] * 10000 + nums[1]
  }
  return nums[nums.length - 1]
}

function parseMoney(text: string): number | undefined {
  const cleaned = text.replace(/[,\s]/g, '')
  const brick = cleaned.match(/(\d+)\s*砖/)?.[1]
  const gold = cleaned.match(/(\d+)\s*金/)?.[1]
  if (brick || gold) {
    return Number(brick ?? 0) * 10000 + Number(gold ?? 0)
  }
  const plain = cleaned.match(/(\d+)/)?.[1]
  if (!plain) return undefined
  return Number(plain)
}

function pickByLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const matched = text.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`))
    if (matched?.[1]) return matched[1].trim()
  }
  return undefined
}

function parseDateTs(text: string): number | undefined {
  const yyyy = text.match(/(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})/)
  if (yyyy) {
    const y = Number(yyyy[1])
    const m = Number(yyyy[2]) - 1
    const d = Number(yyyy[3])
    return new Date(y, m, d).getTime()
  }
  const md = text.match(/(?:日期|时间)?\s*:?\s*(\d{1,2})[\/\-.](\d{1,2})/)
  if (md) {
    const now = new Date()
    return new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2])).getTime()
  }
  return undefined
}

function findRoleId(text: string, roles: OcrRoleMeta[]): string | undefined {
  return roles
    .map((role) => role.id)
    .sort((a, b) => b.length - a.length)
    .find((id) => text.includes(id))
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

// OCR 对形似汉字（如"塘"→"壤"）容易误读，对候选角色名做模糊匹配
// 相似度阈值 80%，但对短名字（2-4字）始终容忍 1 个字符误读
function findRoleIdFuzzy(candidate: string, roles: OcrRoleMeta[]): string | undefined {
  const best = roles
    .map((r) => {
      const maxLen = Math.max(candidate.length, r.id.length)
      const maxDist = Math.max(1, Math.floor(maxLen * 0.2))
      const dist = levenshtein(candidate, r.id)
      const similarity = 1 - dist / maxLen
      return { id: r.id, dist, similarity, maxDist }
    })
    .filter((r) => r.dist <= r.maxDist)
    .sort((a, b) => b.similarity - a.similarity || a.dist - b.dist)[0]
  return best?.id
}

function parseRoleIdCandidate(text: string): string | undefined {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return undefined

  const matched = firstLine.match(/^(.+?)(?=\s*\d)/)
  const raw = (matched?.[1] ?? firstLine).trim()
  const cleaned = sanitizeRoleIdCandidate(raw)
  if (!cleaned) return undefined
  return cleaned.slice(0, 24)
}

function sanitizeRoleIdCandidate(raw: string): string {
  return raw
    .replace(/^[^0-9A-Za-z\u4e00-\u9fa5@]+/, '')
    .replace(/^[0-9Il|l１]+(?=[A-Za-z\u4e00-\u9fa5@])/, '')
    .replace(/^\d+(?=[A-Za-z\u4e00-\u9fa5@])/, '')
    .replace(/\s+/g, '')
    .trim()
}

function parseRoleIdByColumns(words: OcrWordBox[]): string | undefined {
  const dataLineWords = findDataLineWords(words).sort((a, b) => a.x0 - b.x0)
  // 从最左词开始，跳过明显图标噪声（清洗后长度 < 2 的词），找到第一个合理角色名
  for (const word of dataLineWords) {
    if (/^\d/.test(word.text.trim())) break // 遇到数字列说明角色名区域已过
    const cleaned = sanitizeRoleIdCandidate(word.text || '')
    if (cleaned.length >= 2) return cleaned
  }
  return undefined
}

/**
 * 利用 Tesseract 字符级宽度数据，将词首/词尾被误读为字符的图标剥除。
 * 图标宽度通常远大于普通数字字符宽度，以 1.3 倍最小数字宽度为阈值。
 */
function stripIconFromWord(word: OcrWordBox): OcrWordBox {
  const symbols = word.symbols
  if (!symbols || symbols.length <= 1) return word
  const digitWidths = symbols.filter((s) => /^\d$/.test(s.text)).map((s) => s.x1 - s.x0)
  if (digitWidths.length === 0) return word
  const minDigitWidth = Math.min(...digitWidths)
  const threshold = minDigitWidth * 1.3
  let start = 0
  let end = symbols.length - 1
  while (start < end && !/\d/.test(symbols[start].text) && symbols[start].x1 - symbols[start].x0 > threshold) start++
  while (end > start && !/\d/.test(symbols[end].text) && symbols[end].x1 - symbols[end].x0 > threshold) end--
  if (start === 0 && end === symbols.length - 1) return word
  const kept = symbols.slice(start, end + 1)
  return { ...word, text: kept.map((s) => s.text).join(''), x0: kept[0].x0, x1: kept[kept.length - 1].x1, symbols: kept }
}

function parseTableMoneyByWordColumns(words: OcrWordBox[]): { expenseGold?: number; incomeGold?: number } {
  // 跳过表头行，只处理数据行
  const dataLineWords = findDataLineWords(words)
  if (dataLineWords.length === 0) return {}

  const imageWidth = Math.max(...words.map((item) => item.x1))
  // 阈值设为图像宽度的 5%（最小 20px）
  // 砖图标宽约占图像宽的 1%，远小于此阈值，不会将同列的 N 和 M 拆开；
  // UI 列间距远大于此阈值，可正常分列。
  const gapThreshold = Math.max(imageWidth * 0.05, 20)
  // PaddleOCR 会把"2砖7000"中砖图标两侧的数字拆成独立 word（"2" 和 "7000"）。
  // 需要先排序，再过滤：单个数字若与下一个 word 的间距小于列分割阈值，保留（砖数）；
  // 否则视为图标噪声（如金币图标被误识别成单个数字）。
  const firstLineWords = dataLineWords
    .map(stripIconFromWord)
    .sort((a, b) => a.x0 - b.x0)
    .filter((item, idx, arr) => {
      const text = item.text.trim()
      if (text === '0') return true
      if (/^\d\W*$/.test(text)) {
        // 单个数字：与紧邻的下一词间距小于列阈值时视为砖数（如 "2砖7000" 中的 "2"）
        const next = arr[idx + 1]
        return next != null && (next.x0 - item.x1) < gapThreshold
      }
      return /\d/.test(text) || text.length >= 2
    })
  if (firstLineWords.length === 0) return {}

  const columns: OcrWordBox[][] = []
  const columnGaps: number[] = [] // gap[i] = distance between col[i] and col[i+1]
  firstLineWords.forEach((word) => {
    const prevColumn = columns[columns.length - 1]
    if (!prevColumn) {
      columns.push([word])
      return
    }
    const prevRight = Math.max(...prevColumn.map((item) => item.x1))
    const gap = word.x0 - prevRight
    if (gap > gapThreshold) {
      columnGaps.push(gap)
      columns.push([word])
      return
    }
    prevColumn.push(word)
  })

  const columnTexts = columns.map((column) => column.map((item) => item.text).join(' '))
  const columnNumbers = columnTexts.map((cell) => (cell.match(/\d+/g) ?? []).map((v) => Number(v)))
  const incomeNums = columnNumbers[columnNumbers.length - 1] ?? []

  // 界面固定结构：角色 | [消費/支出] | 底薪 | 补贴 | 个人结算
  // income 始终取最后一列；支出列规则见下。
  if (columns.length < 3) return {}

  const incomeVal = parseAmountFromNumbers(incomeNums)
  const col1Nums = columnNumbers[1] ?? []
  const col1Val = parseAmountFromNumbers(col1Nums)

  if (columns.length <= 4) {
    // 4 列以下：col[1] 若为砖金格式（两个数字且第一个为小整数），认定为消費/支出列；
    // 否则认为是底薪列（无支出），支出=0。
    // 此逻辑处理 PaddleOCR 未检测到某列 0 值导致列数少于预期的情况。
    if (col1Nums.length >= 2 && col1Nums[0] < 100 && col1Nums[1] < 10000) {
      return { expenseGold: col1Val, incomeGold: incomeVal }
    }
    return { expenseGold: 0, incomeGold: incomeVal }
  }

  // 5 列：角色 | 消費/支出 | 底薪 | 补贴 | 个人结算
  // 注意：消費可以合理地大于个人结算（如购买了团队消耗品），不再强制清零。
  const expenseVal = col1Val
  // 若角色列与第一个数字列之间的间隔远大于其他列间距，说明支出为空（列被跳过）
  if (columnGaps.length >= 2) {
    const otherGaps = columnGaps.slice(1)
    const avgOtherGap = otherGaps.reduce((s, v) => s + v, 0) / otherGaps.length
    if (columnGaps[0] > avgOtherGap * 1.8) {
      return { expenseGold: 0, incomeGold: incomeVal }
    }
  }
  return {
    expenseGold: expenseVal,
    incomeGold: incomeVal
  }
}

function parseTableMoneyByTextFallback(text: string): { expenseGold?: number; incomeGold?: number } {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return {}
  const numbers = (firstLine.match(/\d+/g) ?? []).map((item) => Number(item))
  if (numbers.length === 0) return {}
  if (numbers.length === 1) return { expenseGold: numbers[0], incomeGold: numbers[0] }

  let expense = numbers[0]
  if (numbers.length >= 2) {
    if (numbers[1] < 10000 && numbers[0] < 1000) {
      // 砖+金格式：N砖M金，M < 10000，且砖数 N 合理（单次副本不超过千砖）
      expense = expense * 10000 + numbers[1]
    } else if (expense <= 9) {
      // 前导小数字是噪声，取下一个数字
      expense = numbers[1]
    }
  }

  // 收入取最后两个数，若符合砖+金格式则合并
  const last = numbers[numbers.length - 1]
  const secondLast = numbers[numbers.length - 2]
  const incomeGold =
    typeof secondLast === 'number' && secondLast > 0 && secondLast < 10000 && last < 10000
      ? secondLast * 10000 + last
      : last

  return { expenseGold: expense, incomeGold }
}

function findDungeonId(text: string, dungeons: OcrDungeonMeta[]): string | undefined {
  const byFull = dungeons.find((dungeon) => text.includes(`${dungeon.players}${dungeon.difficulty}${dungeon.name}`))
  if (byFull) return byFull.id

  const bySpace = dungeons.find((dungeon) => text.includes(`${dungeon.players} ${dungeon.difficulty} ${dungeon.name}`))
  if (bySpace) return bySpace.id

  const byName = dungeons.filter((dungeon) => text.includes(dungeon.name))
  if (byName.length === 1) return byName[0].id
  return undefined
}

function detectSchoolFromText(text: string): string | undefined {
  return SCHOOLS.find((school) => text.includes(school))
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function recognizeImageText(
  file: File | Blob,
  onProgress?: (progress: number, status: string) => void
): Promise<OcrRecognizedData> {
  onProgress?.(0.1, 'preprocessing')
  const cleanedImage = await eraseIconsBeforeOcr(file)

  onProgress?.(0.4, 'recognizing')
  const base64 = await blobToBase64(cleanedImage)
  const result = await window.electronAPI!.recognizeImage(base64)
  if (!result.ok) throw new Error(result.error ?? 'OCR failed')

  onProgress?.(1.0, 'done')
  const words: OcrWordBox[] = (result.words ?? []).map((w) => ({ ...w, symbols: undefined }))
  return { text: result.text ?? '', words }
}

export function parseOcrText(recognized: OcrRecognizedData, roles: OcrRoleMeta[], dungeons: OcrDungeonMeta[]): OcrFillResult {
  // 过滤掉表头行（如"配对象|消费|底薪|补贴|个人结算"），避免干扰文本解析
  const headerPattern = TABLE_HEADER_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const headerRegex = new RegExp(headerPattern)
  const filteredText = recognized.text
    .split('\n')
    .filter((line) => !headerRegex.test(line))
    .join('\n')
  const normalized = normalize(filteredText)
  const roleIdCandidate = parseRoleIdByColumns(recognized.words) ?? parseRoleIdCandidate(normalized)
  const tableMoneyByWords = parseTableMoneyByWordColumns(recognized.words)
  const tableMoneyByText = parseTableMoneyByTextFallback(normalized)
  const incomeRaw = pickByLabel(normalized, ['收入', '收益', '进账'])
  const expenseRaw = pickByLabel(normalized, ['支出', '消耗'])
  const groupBrand = pickByLabel(normalized, ['团牌'])
  const leaderId = pickByLabel(normalized, ['团长ID', '团长', '指挥'])
  const remark = pickByLabel(normalized, ['备注'])
  const matchedRoleId = roleIdCandidate
    ? findRoleIdFuzzy(roleIdCandidate, roles) ?? findRoleId(normalized, roles)
    : findRoleId(normalized, roles)

  return {
    dateTs: parseDateTs(normalized),
    roleId: matchedRoleId,
    roleIdCandidate,
    dungeonId: findDungeonId(normalized, dungeons),
    incomeGold: incomeRaw ? parseMoney(incomeRaw) : tableMoneyByWords.incomeGold ?? tableMoneyByText.incomeGold,
    expenseGold: expenseRaw ? parseMoney(expenseRaw) : tableMoneyByWords.expenseGold ?? tableMoneyByText.expenseGold,
    groupBrand: groupBrand || undefined,
    leaderId: leaderId || undefined,
    remark: remark || undefined,
    schoolCandidate: detectSchoolFromText(normalized)
  }
}
