import { useTracker } from './useTracker'
import type { WineBuryItem } from '../types'

const TARGET_HOURS: Record<string, number> = {
  '今朝醉': 24,
  '六日醉': 144,
  '旬又三': 312,
  '醉月香': 720,
  '藏百日': 2160,
}

export function useWineBury() {
  const tracker = useTracker()
  const items = tracker.wineBury

  function persistData() {
    tracker.persist()
  }

  function addWine(wineType: string, target: string, roleId?: string) {
    const hours = TARGET_HOURS[target]
    if (!hours) return
    const now = Date.now()
    items.value.push({
      id: `wine_${now}_${Math.random().toString(36).slice(2, 8)}`,
      wineType,
      target,
      roleId: roleId || undefined,
      startTime: now,
      endTime: now + hours * 3600 * 1000,
    })
    persistData()
  }

  function removeWine(id: string) {
    items.value = items.value.filter((w) => w.id !== id)
    persistData()
  }

  function getProgress(item: WineBuryItem): number {
    const now = Date.now()
    if (now >= item.endTime) return 100
    const total = item.endTime - item.startTime
    const elapsed = now - item.startTime
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  function getRemainingText(item: WineBuryItem): string {
    const now = Date.now()
    const remaining = item.endTime - now
    if (remaining <= 0) return '已完成'
    const hours = Math.floor(remaining / (3600 * 1000))
    const minutes = Math.floor((remaining % (3600 * 1000)) / (60 * 1000))
    if (hours > 0) return `剩余 ${hours}小时${minutes}分钟`
    return `剩余 ${minutes}分钟`
  }

  function hasUpcomingWine(): boolean {
    return getUpcomingWines().length > 0
  }

  function getUpcomingWines(): WineBuryItem[] {
    const now = Date.now()
    const threshold = 24 * 3600 * 1000
    return items.value.filter((w) => {
      if (w.dismissed) return false
      const remaining = w.endTime - now
      // 即将到期（24小时内）或已经到期（仅在用户未手动清理时持续提醒）
      return remaining <= threshold
    })
  }

  function dismissWines(ids: string[]) {
    const idSet = new Set(ids)
    items.value.forEach((w) => {
      if (idSet.has(w.id)) w.dismissed = true
    })
    persistData()
  }

  return {
    items,
    addWine,
    removeWine,
    getProgress,
    getRemainingText,
    hasUpcomingWine,
    getUpcomingWines,
    dismissWines,
    TARGET_HOURS,
  }
}
