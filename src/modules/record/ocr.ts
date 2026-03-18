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
  confidence?: number
}

export interface OcrIconBox {
  type: '金币' | '金砖'
  x0: number
  y0: number
  x1: number
  y1: number
  cx: number
  cy: number
}

export interface OcrRecognizedData {
  text: string
  words: OcrWordBox[]
  icons: OcrIconBox[]
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

  const dataLine = lines.find((line) => {
    const joined = line.map((w) => w.text.trim()).join('')
    if (TABLE_HEADER_KEYWORDS.some((kw) => joined.includes(kw))) return false
    return joined.length > 0
  })
  return dataLine ?? []
}

/**
 * 将图标信息与 OCR 文字按 x 坐标合并，生成带单位标注的 token 序列。
 * 例如: [{text:"3500"}, {icon:"金币"}] 或 [{text:"2"}, {icon:"金砖"}, {text:"7000"}, {icon:"金币"}]
 */
type Token = { kind: 'text'; text: string; x0: number; x1: number } | { kind: 'icon'; type: string; x0: number; x1: number }

function mergeWordsAndIcons(words: OcrWordBox[], icons: OcrIconBox[]): Token[] {
  const tokens: Token[] = []
  for (const w of words) {
    tokens.push({ kind: 'text', text: w.text, x0: w.x0, x1: w.x1 })
  }
  for (const ic of icons) {
    tokens.push({ kind: 'icon', type: ic.type, x0: ic.x0, x1: ic.x1 })
  }
  tokens.sort((a, b) => a.x0 - b.x0)
  return tokens
}

/**
 * 从 token 序列中解析金额。
 * 模式: 数字[金砖]数字[金币] → brick*10000 + gold
 * 或: 数字[金币] → gold
 */
function parseAmountFromTokens(tokens: Token[]): number | undefined {
  let brick = 0
  let gold = 0
  let hasBrick = false
  let hasGold = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind !== 'text') continue
    const nums = t.text.match(/\d+/g)
    if (!nums) continue

    for (const numStr of nums) {
      const num = Number(numStr)
      // 看这个文字块后面紧跟的图标是什么类型
      const nextIcon = tokens.find(
        (tk) => tk.kind === 'icon' && tk.x0 >= t.x0 && tk.x0 <= t.x1 + (t.x1 - t.x0) * 1.5
      )
      if (nextIcon && nextIcon.kind === 'icon' && nextIcon.type === '金砖') {
        brick += num
        hasBrick = true
      } else {
        gold = num
        hasGold = true
      }
    }
  }

  if (!hasBrick && !hasGold) return undefined
  return brick * 10000 + gold
}

function parseAmountFromNumbers(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  if (nums.length === 1) return nums[0]
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
    .filter((id) => id.length >= 2)
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
  for (const word of dataLineWords) {
    if (/^\d/.test(word.text.trim())) break
    const cleaned = sanitizeRoleIdCandidate(word.text || '')
    if (cleaned.length >= 2) return cleaned
  }
  return undefined
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

/**
 * 利用图标位置信息，按列解析金额。
 * 图标信息来自 Python 端的模板匹配，比颜色检测更可靠。
 */
function parseTableMoneyByColumns(words: OcrWordBox[], icons: OcrIconBox[]): { expenseGold?: number; incomeGold?: number } {
  const dataLineWords = findDataLineWords(words)
  if (dataLineWords.length === 0) return {}

  const imageWidth = Math.max(...words.map((item) => item.x1))
  const gapThreshold = Math.max(imageWidth * 0.05, 20)
  const sortedWords = [...dataLineWords].sort((a, b) => a.x0 - b.x0)
    .filter((item) => {
      const text = item.text.trim()
      if (text === '0') return true
      return /\d/.test(text) || text.length >= 2
    })
  if (sortedWords.length === 0) return {}

  // 分列
  const columns: { words: OcrWordBox[]; icons: OcrIconBox[] }[] = []
  sortedWords.forEach((word) => {
    const prevColumn = columns[columns.length - 1]
    if (!prevColumn) {
      columns.push({ words: [word], icons: [] })
      return
    }
    const prevRight = Math.max(...prevColumn.words.map((item) => item.x1))
    const gap = word.x0 - prevRight
    if (gap > gapThreshold) {
      columns.push({ words: [word], icons: [] })
      return
    }
    prevColumn.words.push(word)
  })

  // 将图标按 x 坐标分配到最近的列
  for (const icon of icons) {
    let bestCol = -1
    let bestDist = Infinity
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]
      const colX0 = Math.min(...col.words.map((w) => w.x0))
      const colX1 = Math.max(...col.words.map((w) => w.x1))
      const dist = icon.cx < colX0 ? colX0 - icon.cx : icon.cx > colX1 ? icon.cx - colX1 : 0
      if (dist < bestDist) {
        bestDist = dist
        bestCol = ci
      }
    }
    if (bestCol >= 0 && bestDist < gapThreshold * 2) {
      columns[bestCol].icons.push(icon)
    }
  }

  // 解析每列金额
  const columnAmounts = columns.map((col) => {
    const colTokens = mergeWordsAndIcons(col.words, col.icons)
    const byIcons = parseAmountFromTokens(colTokens)
    if (byIcons !== undefined) return byIcons
    // 回退：无图标信息时用纯数字解析
    const nums = col.words.flatMap((w) => (w.text.match(/\d+/g) ?? []).map(Number))
    return parseAmountFromNumbers(nums)
  })

  const columnTexts = columns.map((col) => col.words.map((w) => w.text).join(' '))
  console.log('[OCR] columns:', JSON.stringify(columnTexts), 'amounts:', JSON.stringify(columnAmounts))

  if (columns.length < 3) return {}

  const incomeVal = columnAmounts[columnAmounts.length - 1]
  const firstColIsRoleName = /[^\d\s]/.test(columnTexts[0] ?? '')

  if (firstColIsRoleName) {
    // 有角色名列时：5列=角色|消費|底薪|补贴|结算，4列及以下=角色|底薪|补贴|结算(无消費)
    const expenseVal = columns.length >= 5 ? columnAmounts[1] : 0
    return { expenseGold: expenseVal, incomeGold: incomeVal }
  } else {
    return { expenseGold: columnAmounts[0], incomeGold: incomeVal }
  }
}

function parseTableMoneyByTextFallback(text: string, icons: OcrIconBox[]): { expenseGold?: number; incomeGold?: number } {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return {}
  const numbers = (firstLine.match(/\d+/g) ?? []).map((item) => Number(item))
  if (numbers.length === 0) return {}
  if (numbers.length === 1) return { expenseGold: numbers[0], incomeGold: numbers[0] }

  const hasBrick = icons.some((ic) => ic.type === '金砖')

  let expense = numbers[0]
  if (numbers.length >= 2) {
    if (hasBrick && numbers[0] < 100 && numbers[1] < 10000) {
      expense = numbers[0] * 10000 + numbers[1]
    } else if (numbers[1] < 10000 && numbers[0] < 1000) {
      expense = expense * 10000 + numbers[1]
    } else if (expense <= 9) {
      expense = numbers[1]
    }
  }

  const last = numbers[numbers.length - 1]
  const secondLast = numbers[numbers.length - 2]
  const incomeGold =
    typeof secondLast === 'number' && secondLast > 0 && secondLast < 100 && last < 10000
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
  onProgress?.(0.1, '发送识别请求')

  // 直接发送原图给 Python 端，所有预处理和图标检测在 Python 端完成
  const base64 = await blobToBase64(file)

  onProgress?.(0.3, '正在识别')
  const result = await window.electronAPI!.recognizeImage(base64)
  if (!result.ok) throw new Error(result.error ?? 'OCR failed')

  onProgress?.(1.0, '完成')
  const words: OcrWordBox[] = result.words ?? []
  const icons = (result.icons ?? []) as OcrIconBox[]
  return { text: result.text ?? '', words, icons }
}

export function parseOcrText(recognized: OcrRecognizedData, roles: OcrRoleMeta[], dungeons: OcrDungeonMeta[]): OcrFillResult {
  console.log('[OCR] raw words:', JSON.stringify(recognized.words.map(w => ({ text: w.text, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1, conf: w.confidence }))))
  console.log('[OCR] icons:', JSON.stringify(recognized.icons))
  console.log('[OCR] raw text:', JSON.stringify(recognized.text))

  const headerPattern = TABLE_HEADER_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const headerRegex = new RegExp(headerPattern)
  const filteredText = recognized.text
    .split('\n')
    .filter((line) => !headerRegex.test(line))
    .join('\n')
  const normalized = normalize(filteredText)
  const roleIdCandidate = parseRoleIdByColumns(recognized.words) ?? parseRoleIdCandidate(normalized)

  // 使用图标位置信息辅助金额解析
  const tableMoneyByWords = parseTableMoneyByColumns(recognized.words, recognized.icons)
  const tableMoneyByText = parseTableMoneyByTextFallback(normalized, recognized.icons)

  const incomeRaw = pickByLabel(normalized, ['收入', '收益', '进账'])
  const expenseRaw = pickByLabel(normalized, ['支出', '消耗'])
  const groupBrand = pickByLabel(normalized, ['团牌'])
  const leaderId = pickByLabel(normalized, ['团长ID', '团长', '指挥'])
  const remark = pickByLabel(normalized, ['备注'])
  const matchedRoleId = roleIdCandidate
    ? findRoleIdFuzzy(roleIdCandidate, roles) ?? findRoleId(normalized, roles)
    : findRoleId(normalized, roles)

  function pickBestAmount(wordsVal: number | undefined, textVal: number | undefined): number | undefined {
    if (wordsVal === undefined) return textVal
    if (textVal === undefined) return wordsVal
    const diff = textVal - wordsVal
    if (diff > 0 && diff % 10000 === 0 && diff / 10000 < 100) return textVal
    return wordsVal
  }

  return {
    dateTs: parseDateTs(normalized),
    roleId: matchedRoleId,
    roleIdCandidate,
    dungeonId: findDungeonId(normalized, dungeons),
    incomeGold: incomeRaw ? parseMoney(incomeRaw) : pickBestAmount(tableMoneyByWords.incomeGold, tableMoneyByText.incomeGold),
    expenseGold: expenseRaw ? parseMoney(expenseRaw) : pickBestAmount(tableMoneyByWords.expenseGold, tableMoneyByText.expenseGold),
    groupBrand: groupBrand || undefined,
    leaderId: leaderId || undefined,
    remark: remark || undefined
  }
}
