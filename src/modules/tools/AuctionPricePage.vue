<template>
  <div class="ap-page">
    <div class="ap-head">
      <n-button size="small" quaternary @click="emit('back')">‹ 返回</n-button>
      <span class="ap-title">交易行物价</span>
    </div>

    <div class="ap-bar">
      <div class="ap-bar-info">
        <span>区服 <b>{{ serverName || '—' }}</b></span>
        <span class="ap-muted">跟随顶栏金价的区服设置 · 价格来自 JX3Box 玩家上传，非官方</span>
      </div>
      <n-button size="small" :loading="loading" :disabled="!watchList.length" @click="loadPrices(true)">刷新价格</n-button>
    </div>
    <div v-if="error" class="ap-error">{{ error }}</div>

    <n-select
      :value="null"
      filterable
      remote
      clearable
      :options="searchOptions"
      :loading="searching"
      :render-label="renderOption"
      placeholder="输入物品名搜索，例如：五行石、珠贝母"
      class="ap-search"
      @search="onSearch"
      @update:value="onPick"
    />

    <div v-if="!watchList.length" class="ap-empty">搜索物品后会加入下面的常查列表，下次打开自动刷新价格。</div>

    <div v-else class="ap-body">
      <table class="ap-table">
        <thead>
          <tr>
            <th>物品</th>
            <th class="ap-num">最低单价</th>
            <th class="ap-num">在售数量</th>
            <th>更新时间</th>
            <th class="ap-op"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in watchList"
            :key="item.id"
            class="ap-row"
            :class="{ active: activeId === item.id }"
            @click="activeId = item.id"
          >
            <td :style="{ color: qualityColor(item.quality) }">{{ item.name }}</td>
            <td class="ap-num">
              <CraftMoney v-if="prices[item.id]" :value="prices[item.id]!.price" />
              <span v-else class="ap-missing">{{ item.id in prices ? '无报价' : '加载中' }}</span>
            </td>
            <td class="ap-num">{{ prices[item.id]?.count ?? '' }}</td>
            <td :class="isStale(prices[item.id]?.updatedAt) ? 'ap-stale' : 'ap-muted'">{{ ageText(prices[item.id]?.updatedAt) }}</td>
            <td class="ap-op">
              <n-button text size="tiny" @click.stop="removeItem(item.id)">删除</n-button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="activeItem" class="ap-trend">
        <div class="ap-trend-head">
          <span class="ap-trend-title" :style="{ color: qualityColor(activeItem.quality) }">{{ activeItem.name }}</span>
          <span class="ap-muted">每日最低价走势</span>
          <span v-if="trendStats" class="ap-trend-stats">
            <span>最低 <CraftMoney :value="trendStats.min" /></span>
            <span>平均 <CraftMoney :value="trendStats.avg" /></span>
            <span>最高 <CraftMoney :value="trendStats.max" /></span>
          </span>
        </div>
        <div v-show="trend.length" ref="chartEl" class="ap-chart" />
        <div v-if="!trend.length" class="ap-empty">{{ trendLoading ? '加载中…' : '暂无走势数据' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import type { SelectOption } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import { LIGHT_LINE_DEFAULTS, LIGHT_SERIES_DEFAULTS, useLineChart } from '../../composables/useLineChart'
import type { AuctionWatchItem } from '../../types'
import CraftMoney from './craft/CraftMoney.vue'
import { ageText, isStale } from './craft/priceAge'

const emit = defineEmits<{ (e: 'back'): void }>()
const tracker = useTracker()
const watchList = computed(() => tracker.auctionWatch.value)

const COPPER_PER_GOLD = 10000
const QUALITY_COLORS: Record<number, string> = { 2: '#2e9d4f', 3: '#2b7bd6', 4: '#a33fd1', 5: '#e08a00' }
const qualityColor = (q?: number) => (q ? QUALITY_COLORS[q] : undefined)

// ─── 搜索 ────────────────────────────────────────────────
const searchResults = ref<AuctionItem[]>([])
const searching = ref(false)
let searchTimer = 0
let searchSeq = 0

const searchOptions = computed<SelectOption[]>(() =>
  searchResults.value.map((x) => ({ label: x.name, value: x.id, quality: x.quality }))
)

function renderOption(option: SelectOption) {
  return h('span', { style: { color: qualityColor(option.quality as number) } }, option.label as string)
}

function onSearch(keyword: string) {
  window.clearTimeout(searchTimer)
  const kw = keyword.trim()
  if (!kw) {
    searchResults.value = []
    return
  }
  // 停止输入 300ms 后再查，避免每敲一个字发一次请求
  // 主进程接口是新加的：开发模式下热更新不会重载主进程，得重启应用才有
  if (!window.electronAPI?.searchAuctionItems) {
    error.value = '搜索接口未加载，请重启应用后再试'
    return
  }
  searchTimer = window.setTimeout(async () => {
    const seq = ++searchSeq
    searching.value = true
    try {
      const result = await window.electronAPI?.searchAuctionItems(kw)
      if (seq !== searchSeq) return
      searchResults.value = result?.ok && result.data ? result.data : []
      error.value = result && !result.ok ? result.message || '搜索失败' : ''
    } finally {
      if (seq === searchSeq) searching.value = false
    }
  }, 300)
}

function onPick(id: string | null) {
  const picked = searchResults.value.find((x) => x.id === id)
  if (!picked) return
  const item: AuctionWatchItem = { id: picked.id, name: picked.name, quality: picked.quality }
  // 新查的放最前；已在列表里的挪到最前
  tracker.setAuctionWatch([item, ...watchList.value.filter((x) => x.id !== item.id)])
  activeId.value = item.id
  void loadPrices()
}

function removeItem(id: string) {
  tracker.setAuctionWatch(watchList.value.filter((x) => x.id !== id))
  if (activeId.value === id) activeId.value = watchList.value[0]?.id ?? null
}

// ─── 当前价 ────────────────────────────────────────────────
const prices = ref<Record<string, AuctionPrice | null>>({})
const loading = ref(false)
const error = ref('')
const serverName = ref('')

async function loadPrices(force = false) {
  const api = window.electronAPI
  if (!api) {
    error.value = '仅桌面端可查询交易行价格'
    return
  }
  const ids = watchList.value.map((x) => x.id).filter((id) => force || !(id in prices.value))
  if (!ids.length) return
  loading.value = true
  try {
    const result = await api.getAuctionPrices(ids, force)
    if (!result.ok || !result.data) {
      error.value = result.message || '查询失败'
      return
    }
    serverName.value = result.data.server
    prices.value = { ...prices.value, ...result.data.prices }
    error.value = result.data.failed.length ? `${result.data.failed.length} 个物品价格查询失败，可稍后点「刷新价格」重试` : ''
    if (force && activeId.value) void loadTrend(activeId.value)
  } finally {
    loading.value = false
  }
}

// ─── 走势 ────────────────────────────────────────────────
const activeId = ref<string | null>(watchList.value[0]?.id ?? null)
const activeItem = computed(() => watchList.value.find((x) => x.id === activeId.value) ?? null)
const trend = ref<AuctionTrendPoint[]>([])
const trendLoading = ref(false)
let trendSeq = 0

async function loadTrend(id: string) {
  const seq = ++trendSeq
  trendLoading.value = true
  trend.value = []
  try {
    const result = await window.electronAPI?.getAuctionTrend(id)
    if (seq === trendSeq) trend.value = result?.ok && result.data ? result.data : []
  } finally {
    if (seq === trendSeq) trendLoading.value = false
  }
}

watch(activeId, (id) => {
  if (id) void loadTrend(id)
  else trend.value = []
}, { immediate: true })

const trendStats = computed(() => {
  if (!trend.value.length) return null
  const ps = trend.value.map((t) => t.price)
  return { min: Math.min(...ps), max: Math.max(...ps), avg: ps.reduce((s, p) => s + p, 0) / ps.length }
})

const chartEl = ref<HTMLElement | null>(null)
const chartOption = computed<Record<string, unknown>>(() => ({
  ...LIGHT_LINE_DEFAULTS,
  grid: { left: 60, right: 20, top: 16, bottom: 28 },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (v: number) => `${v.toLocaleString()} 金`
  },
  xAxis: {
    type: 'category',
    data: trend.value.map((t) => {
      const d = new Date(t.ts)
      return `${d.getMonth() + 1}-${d.getDate()}`
    })
  },
  yAxis: { type: 'value', scale: true, axisLabel: { formatter: '{value} 金' } },
  series: [
    {
      ...LIGHT_SERIES_DEFAULTS,
      type: 'line',
      name: '最低价',
      smooth: true,
      // 默认只在悬停时画点；点少时（尤其只有 1 天数据）连不成线，得常显圆点，单点再标上数值
      showSymbol: trend.value.length <= 10,
      label: { show: trend.value.length === 1, position: 'top', formatter: '{c} 金' },
      data: trend.value.map((t) => Math.round((t.price / COPPER_PER_GOLD) * 100) / 100),
      lineStyle: { color: '#18a058' },
      itemStyle: { color: '#18a058' },
      areaStyle: { color: 'rgba(24, 160, 88, 0.08)' }
    }
  ]
}))
useLineChart(chartEl, chartOption)

// ─── 初始化 ────────────────────────────────────────────────
void (async () => {
  const server = await window.electronAPI?.getGoldServer()
  if (server) serverName.value = server.serverName
  void loadPrices()
})()
</script>

<style scoped>
.ap-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.ap-title {
  font-size: 16px;
  font-weight: 600;
}
.ap-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f7f3ea 0%, #eef5fb 100%);
}
.ap-bar-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ap-muted {
  font-size: 12px;
  color: #8a96a3;
}
.ap-stale {
  font-size: 12px;
  color: #c0c4cc;
}
.ap-error {
  margin-top: 8px;
  font-size: 12px;
  color: #d03050;
}
.ap-search {
  margin: 14px 0;
  max-width: 420px;
}
.ap-empty {
  padding: 40px 0;
  text-align: center;
  color: #8a96a3;
  font-size: 13px;
}
.ap-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 20px;
  align-items: start;
}
@media (max-width: 1100px) {
  .ap-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
.ap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ap-table th {
  font-weight: 500;
  color: #6b7785;
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #eceff3;
  white-space: nowrap;
}
.ap-table td {
  padding: 8px;
  border-bottom: 1px solid #f2f4f7;
}
.ap-num {
  text-align: right !important;
  white-space: nowrap;
}
.ap-op {
  width: 44px;
  text-align: right;
}
.ap-row {
  cursor: pointer;
}
.ap-row:hover {
  background: #f7f9fc;
}
.ap-row.active {
  background: #eef7f1;
}
.ap-missing {
  font-size: 12px;
  color: #c0874f;
}
.ap-trend {
  border: 1px solid #dfe5ec;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fff;
}
.ap-trend-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}
.ap-trend-title {
  font-weight: 600;
}
.ap-trend-stats {
  display: inline-flex;
  gap: 14px;
  margin-left: auto;
  font-size: 12px;
  color: #6b7785;
}
.ap-chart {
  width: 100%;
  height: 280px;
}
</style>
