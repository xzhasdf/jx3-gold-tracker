<template>
  <n-space vertical :size="16">
    <n-card>
      <n-form inline class="query-form">
        <n-form-item label="副本">
          <n-select
            v-model:value="selectedDungeonId"
            clearable
            filterable
            :options="dungeonSelectOptions"
            placeholder="全部副本"
            :style="{ width: '340px', maxWidth: '100%' }"
          />
        </n-form-item>
        <n-form-item v-if="seasonOptions.length > 0" label="赛季">
          <n-select
            v-model:value="selectedSeasonId"
            clearable
            :options="seasonOptions"
            placeholder="选择赛季"
            :style="{ width: '340px', maxWidth: '100%' }"
            @update:value="onSeasonChange"
          />
        </n-form-item>
        <n-form-item label="日期">
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            clearable
            :shortcuts="dateRangeShortcuts"
            :style="{ width: '340px', maxWidth: '100%' }"
            @update:value="onRangeUpdate"
          />
        </n-form-item>
        <n-form-item>
          <n-button @click="resetFilters">重置</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-card>
      <template #header>黑本收益统计</template>
      <div v-if="dateKeys.length === 0 || personNames.length === 0" class="empty-trend">
        当前筛选区间暂无黑本人数据
      </div>
      <div v-show="dateKeys.length > 0 && personNames.length > 0" ref="chartRef" class="trend-chart"></div>
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
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

const seasonOptions = computed(() => tracker.seasons.value.map((s) => ({ label: s.name, value: s.id })))

function onSeasonChange(seasonId: string | null) {
  if (!seasonId) return
  const season = tracker.seasons.value.find((s) => s.id === seasonId)
  if (season) dateRange.value = [season.startTs, season.endTs]
}

function onRangeUpdate(value: [number, number] | null) {
  if (!selectedSeasonId.value) return
  const season = tracker.seasons.value.find((s) => s.id === selectedSeasonId.value)
  if (!season || !value || value[0] !== season.startTs || value[1] !== season.endTs) {
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
    const t = new Date(`${r.date}T00:00:00`).getTime()
    if (t < start || t > end) return false
    return true
  })
})

const colors = ['#2f6fd6', '#d44f6a', '#2a8f5b', '#de8a2c', '#7a52cc', '#0f8b8d', '#b43f3f', '#3f7c27', '#a05030', '#c4b522']

const dateKeys = computed(() => {
  if (!dateRange.value) {
    return Array.from(new Set(filteredRecords.value.map((r) => r.date))).sort()
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
      const i = indexMap.get(r.date)
      if (i === undefined) return
      values[i] += effectiveIncome(r)
    })
    return { name, values }
  })
})

const chartOption = computed(() => ({
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
    symbol: 'circle',
    symbolSize: 5,
    emphasis: { focus: 'series' as const }
  }))
}))

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(chartOption.value)
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(chartRef.value)
})

watch(chartOption, (opt) => {
  chart?.setOption(opt, true)
})

onUnmounted(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.trend-chart {
  width: 100%;
  height: 360px;
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
