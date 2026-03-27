import { ref } from 'vue'

export interface WineBuryItem {
  id: string
  wineType: string
  target: string
  roleId?: string
  startTime: number  // timestamp ms
  endTime: number    // timestamp ms
}

const STORAGE_KEY = 'jx3_wine_bury'
const DISMISS_KEY = 'jx3_wine_bury_dismiss'

const TARGET_HOURS: Record<string, number> = {
  '今朝醉': 24,
  '六日醉': 144,
  '旬又三': 312,
  '醉月香': 720,
  '藏百日': 2160,
}

const items = ref<WineBuryItem[]>([])
let loaded = false

function load() {
  if (loaded) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) items.value = JSON.parse(raw)
  } catch { /* ignore */ }
  loaded = true
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
}

export function useWineBury() {
  load()

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
    persist()
  }

  function removeWine(id: string) {
    items.value = items.value.filter((w) => w.id !== id)
    persist()
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
      const remaining = w.endTime - now
      return remaining > 0 && remaining <= threshold
    })
  }

  function isDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (!raw) return false
      const dismissUntil = Number(raw)
      return Date.now() < dismissUntil
    } catch {
      return false
    }
  }

  function dismiss24h() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 3600 * 1000))
  }

  return {
    items,
    addWine,
    removeWine,
    getProgress,
    getRemainingText,
    hasUpcomingWine,
    getUpcomingWines,
    isDismissed,
    dismiss24h,
    TARGET_HOURS,
  }
}
