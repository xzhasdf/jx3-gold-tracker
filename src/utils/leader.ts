// 去除人名两侧的方括号（OCR 抓取游戏内 [名字] 形式时常见），同时去除两端空白。
export function normalizePersonName(name: string | undefined | null): string {
  if (!name) return ''
  return String(name).replace(/^[\s\[【]+|[\s\]】]+$/g, '').trim()
}
