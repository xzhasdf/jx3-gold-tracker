<template>
  <n-card>
    <template #header>收支趋势（按角色）</template>
    <n-form inline class="query-form">
      <n-form-item label="副本筛选">
        <n-select
          v-model:value="selectedDungeonId"
          clearable
          :options="dungeonFilterOptions"
          placeholder="全部副本"
          :style="{ width: '340px', maxWidth: '100%' }"
        />
      </n-form-item>
      <n-form-item label="指标">
        <n-select v-model:value="metric" :options="metricOptions" :style="{ width: '220px', maxWidth: '100%' }" />
      </n-form-item>
    </n-form>

    <div style="height: 24px"></div>
    <div v-if="dateKeys.length === 0" class="empty-trend">当前筛选区间暂无数据</div>
    <div v-show="dateKeys.length > 0" ref="chartRef" class="trend-chart"></div>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { formatMoney } from '../../utils/money'

interface TrendRow {
  date: string
  roleId: string
  dungeonId: string
  income: number
  expense: number
  subtotal: number
}

interface RoleMeta {
  id: string
  label: string
}

interface DungeonMeta {
  id: string
  label: string
}

const props = defineProps<{
  rows: TrendRow[]
  roles: RoleMeta[]
  dungeons: DungeonMeta[]
  range: [number, number] | null
}>()

const selectedDungeonId = ref<string | null>(null)
const metric = ref<'subtotal' | 'income' | 'expense'>('subtotal')
const metricOptions = [
  { label: '总收支', value: 'subtotal' },
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' }
]

const colors = ['#2f6fd6', '#d44f6a', '#2a8f5b', '#de8a2c', '#7a52cc', '#0f8b8d', '#b43f3f', '#3f7c27']

const dungeonFilterOptions = computed(() => props.dungeons.map((d) => ({ label: d.label, value: d.id })))

const dateKeys = computed(() => {
  if (!props.range) {
    return Array.from(new Set(props.rows.map((row) => row.date))).sort()
  }
  const [start, end] = props.range
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

const filteredRows = computed(() =>
  props.rows.filter((row) => {
    if (selectedDungeonId.value && row.dungeonId !== selectedDungeonId.value) return false
    return true
  })
)

const lineData = computed(() => {
  const indexMap = new Map(dateKeys.value.map((date, index) => [date, index]))
  return props.roles.map((role) => {
    const values = Array(dateKeys.value.length).fill(0)
    filteredRows.value.forEach((row) => {
      if (row.roleId !== role.id) return
      const i = indexMap.get(row.date)
      if (i === undefined) return
      values[i] += row[metric.value]
    })
    return { roleId: role.id, label: role.label, values }
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
      const lines = sorted.map((p) => `<div style="margin-top:5px;"><span style="color:${p.color}">●</span> ${p.seriesName}: ${formatMoney(p.value)}</div>`)
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
    name: line.label,
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
}
</style>
