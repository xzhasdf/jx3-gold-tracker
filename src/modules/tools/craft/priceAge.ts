// 交易行价格的「多久前更新」显示。JX3Box 价格靠玩家上传，冷门物品可能很久没人传。

/** 超过这个时长没更新的价格标灰 */
export const STALE_MS = 6 * 60 * 60 * 1000

export function ageText(ts?: number): string {
  if (!ts) return ''
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (min < 60) return `${min} 分钟前`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} 小时前` : `${Math.round(h / 24)} 天前`
}

export function isStale(ts?: number): boolean {
  return Boolean(ts) && Date.now() - (ts as number) > STALE_MS
}
