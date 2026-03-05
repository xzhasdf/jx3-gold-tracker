
const iconModules = import.meta.glob('../../assets/xf/*.png', { eager: true, import: 'default' }) as Record<string, string>

interface IconTemplate {
  school: string
  data: Float32Array
  size: number
}

let templatesPromise: Promise<IconTemplate[]> | null = null

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`图标加载失败: ${src}`))
    img.src = src
  })
}

function toGrayData(source: CanvasImageSource, width: number, height: number, size: number): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Float32Array(size * size)
  ctx.drawImage(source, 0, 0, width, height, 0, 0, size, size)
  const raw = ctx.getImageData(0, 0, size, size).data
  const out = new Float32Array(size * size)
  for (let i = 0; i < size * size; i += 1) {
    const idx = i * 4
    out[i] = (raw[idx] * 0.299 + raw[idx + 1] * 0.587 + raw[idx + 2] * 0.114) / 255
  }
  return out
}

function parseSchool(path: string) {
  const fileName = path.split('/').pop() ?? ''
  const base = fileName.replace(/\.png$/i, '')
  return base.slice(0, 2)
}

function mse(a: Float32Array, b: Float32Array) {
  const n = Math.min(a.length, b.length)
  if (n === 0) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < n; i += 1) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return sum / n
}

async function getTemplates() {
  if (templatesPromise) return templatesPromise
  templatesPromise = (async () => {
    const size = 24
    const entries = Object.entries(iconModules)
    const list = await Promise.all(
      entries.map(async ([path, url]) => {
        const school = parseSchool(path)
        const image = await loadImage(url)
        const data = toGrayData(image, image.width, image.height, size)
        return { school, data, size } as IconTemplate
      })
    )
    return list
  })()
  return templatesPromise
}

async function fileToImage(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function detectIconWidth(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const rightPixel = ctx.getImageData(width - 2, Math.floor(height / 2), 1, 1).data
  const bgR = rightPixel[0]
  const bgG = rightPixel[1]
  const bgB = rightPixel[2]
  const TOLERANCE = 30
  // 仅扫描第一个图标范围（≈行高），避免多图标时把第二个图标也纳入模板匹配
  const scanTo = Math.min(Math.round(height * 1.1), Math.floor(width * 0.25))
  const pixelData = ctx.getImageData(0, 0, scanTo, height).data

  let iconRight = -1
  for (let x = 0; x < scanTo; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * scanTo + x) * 4
      const r = pixelData[i], g = pixelData[i + 1], b = pixelData[i + 2]
      if (Math.abs(r - bgR) <= TOLERANCE && Math.abs(g - bgG) <= TOLERANCE && Math.abs(b - bgB) <= TOLERANCE) continue
      if (r > 210 && g > 210 && b > 210) continue // 白色文字
      iconRight = x
      break
    }
  }
  return iconRight >= 0 ? iconRight + 1 : Math.round(height * 0.45) // fallback
}

function cropIconPatch(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  // 动态检测图标实际宽度（心法图标近似正方形，固定比例会裁剪不全）
  const size = detectIconWidth(ctx, image.width, image.height)
  if (size <= 8) return null
  const patch = document.createElement('canvas')
  patch.width = size
  patch.height = size
  const patchCtx = patch.getContext('2d')
  if (!patchCtx) return null
  const y = Math.max(0, Math.round((image.height - size) / 2))
  patchCtx.drawImage(canvas, 0, y, size, size, 0, 0, size, size)
  return patch
}

/**
 * 检测截图中的心法图标，返回识别到的门派名，同时将图标区域擦除后返回处理后的 Blob。
 * 若未能识别则返回原始文件，不做任何修改。
 */
export async function processSchoolIcon(file: File): Promise<{ school: string | undefined; cleanedFile: File | Blob }> {
  const templates = await getTemplates()
  if (templates.length === 0) return { school: undefined, cleanedFile: file }

  const image = await fileToImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { school: undefined, cleanedFile: file }
  ctx.drawImage(image, 0, 0)

  // 检测图标宽度（心法图标在行左侧，紧贴角色名前）
  const iconWidth = detectIconWidth(ctx, image.width, image.height)
  const patch = cropIconPatch(image)
  if (!patch || iconWidth <= 8) return { school: undefined, cleanedFile: file }

  // MSE 匹配门派
  const target = toGrayData(patch, patch.width, patch.height, 24)
  let bestScore = Number.POSITIVE_INFINITY
  let secondScore = Number.POSITIVE_INFINITY
  let bestSchool: string | undefined
  templates.forEach((tpl) => {
    const score = mse(target, tpl.data)
    if (score < bestScore) { secondScore = bestScore; bestScore = score; bestSchool = tpl.school }
    else if (score < secondScore) { secondScore = score }
  })

  if (bestScore > 0.06 || secondScore - bestScore < 0.008) {
    // 未能可信地匹配到门派，返回原图
    return { school: undefined, cleanedFile: file }
  }

  // 匹配成功：将图标区域填成背景色（取右侧中心像素为背景参考）
  const bgPixel = ctx.getImageData(image.width - 2, Math.floor(image.height / 2), 1, 1).data
  ctx.fillStyle = `rgb(${bgPixel[0]},${bgPixel[1]},${bgPixel[2]})`
  ctx.fillRect(0, 0, iconWidth + 2, image.height)

  const cleanedFile = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))))
  )
  return { school: bestSchool, cleanedFile }
}

export async function detectSchoolFromIcon(file: File): Promise<string | undefined> {
  const templates = await getTemplates()
  if (templates.length === 0) return undefined
  const image = await fileToImage(file)
  const patch = cropIconPatch(image)
  if (!patch) return undefined

  const target = toGrayData(patch, patch.width, patch.height, 24)
  let bestScore = Number.POSITIVE_INFINITY
  let secondScore = Number.POSITIVE_INFINITY
  let bestSchool: string | undefined
  templates.forEach((tpl) => {
    const score = mse(target, tpl.data)
    if (score < bestScore) {
      secondScore = bestScore
      bestScore = score
      bestSchool = tpl.school
      return
    }
    if (score < secondScore) {
      secondScore = score
    }
  })
  // Prefer no result over wrong result when template similarity is ambiguous.
  if (bestScore > 0.06) return undefined
  if (secondScore - bestScore < 0.008) return undefined
  return bestSchool
}
