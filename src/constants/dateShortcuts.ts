import {
  getCurrentMonthRange,
  getCurrentWeekRange,
  getPreviousMonthRange,
  getPreviousWeekRange,
  getTodayRange,
  getYesterdayRange
} from '../utils/date'

export const DATE_RANGE_SHORTCUTS = {
  昨日: () => getYesterdayRange(),
  今日: () => getTodayRange(),
  上周: () => getPreviousWeekRange(),
  本周: () => getCurrentWeekRange(),
  上月: () => getPreviousMonthRange(),
  本月: () => getCurrentMonthRange()
}
