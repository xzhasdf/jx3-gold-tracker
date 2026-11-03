export function getCurrentMonthRange(): [number, number] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
  return [start, end]
}

export function getPreviousMonthRange(): [number, number] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime()
  return [start, end]
}

// 周的切换点是周一 7:00（周 CD 重置），不是周一 0:00：周一 7:00 前「本周」仍指上一周
export const WEEK_RESET_HOUR = 7

export function getCurrentWeekRange(): [number, number] {
  const now = new Date()
  if (now.getDay() === 1 && now.getHours() < WEEK_RESET_HOUR) now.setDate(now.getDate() - 1)
  const day = now.getDay()
  const deltaToMonday = day === 0 ? -6 : 1 - day
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + deltaToMonday)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  endDate.setHours(23, 59, 59, 999)
  return [startDate.getTime(), endDate.getTime()]
}

export function getPreviousWeekRange(): [number, number] {
  const [currentWeekStart] = getCurrentWeekRange()
  const startDate = new Date(currentWeekStart - 7 * 24 * 60 * 60 * 1000)
  const endDate = new Date(currentWeekStart - 1)
  return [startDate.getTime(), endDate.getTime()]
}

export function getTodayRange(): [number, number] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  return [start, end]
}

export function getYesterdayRange(): [number, number] {
  const now = new Date()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).getTime()
  return [start, end]
}

export function toYmd(ts: number): string {
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseYmd(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).getTime()
}

/** 含头含尾的天数差，至少 1 天：当天买当天算已用 1 天 */
export function daysInclusive(startYmd: string, endYmd: string): number {
  const diff = parseYmd(endYmd) - parseYmd(startYmd)
  return Math.max(1, Math.round(diff / 86400000) + 1)
}
