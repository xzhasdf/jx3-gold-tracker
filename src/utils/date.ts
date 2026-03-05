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

export function getCurrentWeekRange(): [number, number] {
  const now = new Date()
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
