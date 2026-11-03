<template>
  <!-- 无卡片外壳：由总览页「角色收支明细 / 黑本收益」标签卡片承载 -->
  <div class="bp-wrap">
    <div class="bp-filters">
      <n-select
        v-model:value="selectedDungeonId"
        clearable
        filterable
        size="small"
        :options="dungeonSelectOptions"
        placeholder="全部副本"
        :consistent-menu-width="false"
        style="width: 180px"
      />
      <n-select
        v-if="seasonOptions.length > 0"
        v-model:value="selectedSeasonId"
        clearable
        size="small"
        :options="seasonOptions"
        placeholder="选择赛季"
        style="width: 130px"
        @update:value="onSeasonChange"
      />
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        clearable
        size="small"
        :shortcuts="dateRangeShortcuts"
        style="width: 260px; flex: none"
        @update:value="onRangeUpdate"
      />
      <n-button size="small" @click="resetFilters">重置</n-button>
    </div>
    <div v-if="dateKeys.length === 0 || personNames.length === 0" class="empty-trend">
      当前筛选区间暂无黑本人数据
    </div>
    <div v-show="dateKeys.length > 0 && personNames.length > 0" ref="chartRef" class="trend-chart"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LIGHT_LINE_DEFAULTS, LIGHT_SERIES_DEFAULTS, useLineChart } from '../../composables/useLineChart'
import { useTracker } from '../../composables/useTracker'
import { FIXED_DUNGEON_OPTIONS, FIXED_DUNGEON_LABEL } from '../../constants/game'
import { DATE_RANGE_SHORTCUTS } from '../../constants/dateShortcuts'
import { formatMoney } from '../../utils/money'
import { normalizePersonName } from '../../utils/leader'
import iconGold from '../../assets/金币.png'
import iconBrick from '../../assets/金砖.png'

function formatMoneyHtml(value: number): string {
  return formatMoney(value)
    .replace(/砖/g, `<img src="${iconBrick}" style="width:13px;height:13px;vertical-align:middle;margin:0 1px;">`)
    .replace(/金/g, `<img src="${iconGold}" style="width:13px;height:13px;vertical-align:middle;margin:0 1px;">`)
}

const tracker = useTracker()

const selectedDungeonId = ref<string | null>(null)
const dateRange = ref<[number, number] | null>(tracker.getCurrentWeekRange())
const selectedSeasonId = ref<string | null>(null)
const dateRangeShortcuts = DATE_RANGE_SHORTCUTS

// 时间倒序：新赛季在前
const seasonOptions = computed(() => tracker.sortedSeasons.value.map((s) => ({ label: s.name, value: s.id })))

function onSeasonChange(seasonId: string | null) {
  if (!seasonId) return
  const season = tracker.seasons.value.find((s) => s.id === seasonId)
  if (season) dateRange.value = tracker.getSeasonRange(season)
}

function onRangeUpdate(value: [number, number] | null) {
  if (!selectedSeasonId.value) return
  const season = tracker.seasons.value.find((s) => s.id === selectedSeasonId.value)
  const seasonRange = season ? tracker.getSeasonRange(season) : null
  if (!seasonRange || !value || value[0] !== seasonRange[0] || value[1] !== seasonRange[1]) {
    selectedSeasonId.value = null
  }
}

function resetFilters() {
  selectedDungeonId.value = null
  dateRange.value = tracker.getCurrentWeekRange()
  selectedSeasonId.value = null
}

const dungeonSelectOptions = computed(() => {
  const fixed = FIXED_DUNGEON_OPTIONS.map((d) => ({ label: d.label, value: d.id }))
  const user = tracker.dungeons.value.filter((d) => !d.hidden).map((d) => ({
    label: `${d.players}${d.difficulty}${d.name}`,
    value: d.id
  }))
  return [...user, ...fixed]
})

const roleMap = computed(() => new Map(tracker.roles.value.map((r) => [r.id, r])))

// Compute effective (pre-ratio) income for a record
function effectiveIncome(record: { income: number; roleId: string }): number {
  const role = roleMap.value.get(record.roleId)
  if (!role?.isProxyClear) return record.income
  const ratio = role.wageRatio
  if (!ratio) return record.income
  return Math.round((record.income * 100) / ratio)
}

// Filter records: must have blackPerson, match selected dungeon and date range
const filteredRecords = computed(() => {
  const [start, end] = dateRange.value ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  return tracker.records.value.filter((r) => {
    const person = normalizePersonName(r.blackPerson)
    if (!person) return false
    if (selectedDungeonId.value && r.dungeonId !== selectedDungeonId.value) return false
    const t = new Date(`${tracker.recordStatDate(r)}T00:00:00`).getTime()
    if (t < start || t > end) return false
    return true
  })
})

const colors = ['#2f6fd6', '#d44f6a', '#2a8f5b', '#de8a2c', '#7a52cc', '#0f8b8d', '#b43f3f', '#3f7c27', '#a05030', '#c4b522']

const dateKeys = computed(() => {
  if (!dateRange.value) {
    return Array.from(new Set(filteredRecords.value.map((r) => tracker.recordStatDate(r)))).sort()
  }
  const [start, end] = dateRange.value
  const days: string[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)
  while (current.getTime() <= endDate.getTime()) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 1)
  }
  return days
})

// Unique black person names (case-sensitive, trimmed, brackets stripped)
const personNames = computed(() => {
  const names = new Set<string>()
  filteredRecords.value.forEach((r) => {
    const p = normalizePersonName(r.blackPerson)
    if (p) names.add(p)
  })
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const lineData = computed(() => {
  const indexMap = new Map(dateKeys.value.map((date, i) => [date, i]))
  return personNames.value.map((name) => {
    const values = Array(dateKeys.value.length).fill(0)
    filteredRecords.value.forEach((r) => {
      if (normalizePersonName(r.blackPerson) !== name) return
      const i = indexMap.get(tracker.recordStatDate(r))
      if (i === undefined) return
      values[i] += effectiveIncome(r)
    })
    return { name, values }
  })
})

const chartOption = computed(() => ({
  ...LIGHT_LINE_DEFAULTS,
  color: colors,
  grid: { top: 20, right: 18, bottom: 50, left: 96 },
  tooltip: {
    trigger: 'axis' as const,
    enterable: true,
    formatter: (params: Array<{ axisValue: string; seriesName: string; value: number; color: string }>) => {
      if (!params.length) return ''
      const sorted = [...params].sort((a, b) => b.value - a.value)
      const lines = sorted.map(
        (p) => `<div style="margin-top:5px;"><span style="color:${p.color}">●</span> ${p.seriesName}: ${formatMoneyHtml(p.value)}</div>`
      )
      return `${params[0].axisValue}<div style="max-height:320px;overflow-y:auto;">${lines.join('')}</div>`
    }
  },
  legend: { bottom: 0, type: 'scroll' as const },
  xAxis: {
    type: 'category' as const,
    data: dateKeys.value.map((d) => d.slice(5)),
    axisLine: { lineStyle: { color: '#8ea0bf' } },
    axisTick: { lineStyle: { color: '#8ea0bf' } },
    axisLabel: { color: '#5f6e86', fontSize: 11 }
  },
  yAxis: {
    type: 'value' as const,
    axisLabel: {
      formatter: (v: number) => formatMoney(v),
      color: '#5f6e86',
      fontSize: 11
    },
    splitLine: { lineStyle: { color: '#e2e8f4', type: 'dashed' as const } }
  },
  series: lineData.value.map((line) => ({
    name: line.name,
    type: 'line' as const,
    data: line.values,
    smooth: true,
    lineStyle: { width: 2.2 },
    ...LIGHT_SERIES_DEFAULTS,
    emphasis: { focus: 'series' as const }
  }))
}))

const chartRef = ref<HTMLElement | null>(null)
useLineChart(chartRef, chartOption)
</script>

<style scoped>
.bp-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 10px;
}
.trend-chart {
  width: 100%;
  height: 300px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef3ff 100%);
  border-radius: 10px;
  border: 1px solid #d9e1ef;
}

.empty-trend {
  color: #667;
  padding: 40px 0;
  text-align: center;
}
</style>
