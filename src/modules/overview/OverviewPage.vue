<template>
  <n-space vertical :size="16">
    <n-card size="small">
      <div class="ov-filters">
        <div class="ov-filter-group ov-filter-time">
          <n-select
            v-if="seasonOptions.length > 0"
            v-model:value="filters.seasonId"
            clearable
            :options="seasonOptions"
            placeholder="全部赛季"
            style="width: 140px; flex: none"
            @update:value="onSeasonChange"
          />
          <span v-if="seasonOptions.length > 0" class="ov-or">或</span>
          <n-date-picker
            v-model:value="filters.range"
            type="daterange"
            clearable
            :shortcuts="dateRangeShortcuts"
            :start-placeholder="seasonPlaceholder.start"
            :end-placeholder="seasonPlaceholder.end"
            style="width: 330px; flex: none"
            @update:value="onFilterRangeUpdate"
          />
        </div>
        <span class="ov-filter-divider" />
        <div class="ov-filter-group ov-filter-scope">
          <n-select
            v-model:value="filters.roleIds"
            multiple
            clearable
            filterable
            max-tag-count="responsive"
            :render-tag="renderRoleTag"
            :options="roleOptions"
            :render-label="renderRoleOption"
            placeholder="全部角色" :consistent-menu-width="false"
            class="ov-f-role"
          />
          <n-select v-model:value="filters.server" clearable :options="serverOptions" placeholder="全部服务器" :consistent-menu-width="false" class="ov-f-sm" />
          <n-select
            v-model:value="filters.school"
            clearable
            :options="schoolOptions"
            :render-label="renderSchoolOption"
            placeholder="全部门派" :consistent-menu-width="false"
            class="ov-f-sm"
          />
          <n-select
            v-model:value="filters.groupBrand"
            clearable
            filterable
            :options="groupBrandFilterOptions"
            :render-label="renderBrandOption"
            placeholder="全部团牌" :consistent-menu-width="false"
            class="ov-f-sm"
          />
        </div>
        <n-button class="ov-reset" :type="activeFilterCount ? 'primary' : 'default'" :ghost="activeFilterCount > 0" @click="resetFilters">
          重置
        </n-button>
      </div>
    </n-card>

    <div class="ov-stats">
      <div class="ov-stat">
        <div class="stat-label">收入</div>
        <div class="ov-stat-value"><MoneyValue :value="summary.income" /></div>
      </div>
      <div class="ov-stat">
        <div class="stat-label">支出</div>
        <div class="ov-stat-value"><MoneyValue :value="summary.expense" /></div>
      </div>
      <div class="ov-stat">
        <div class="stat-label">净收支</div>
        <div class="ov-stat-value" :class="summary.net > 0 ? 'pos' : summary.net < 0 ? 'neg' : ''"><MoneyValue :value="summary.net" /></div>
      </div>
      <div class="ov-stat">
        <div class="stat-label">记录</div>
        <div class="ov-stat-value">{{ allRows.length }}<span class="ov-stat-unit">条</span></div>
      </div>
    </div>

    <div class="ov-grid">
      <div ref="mainColRef" class="ov-col">
        <OverviewTrend :rows="allRows" :roles="roleMetas" :dungeons="dungeonMetas" :range="effectiveRange" />
        <n-card size="small" class="ov-tab-card">
          <n-tabs v-model:value="detailTab" type="line" size="small" display-directive="show:lazy">
            <n-tab-pane name="roles" tab="角色收支明细">
              <n-data-table :columns="columns" :data="rows" :pagination="{ pageSize: 20 }" size="small" />
            </n-tab-pane>
            <n-tab-pane name="black" tab="黑本收益">
              <BlackPersonTrendPage />
            </n-tab-pane>
          </n-tabs>
        </n-card>
      </div>

      <div class="ov-col">
        <n-card ref="rankCardRef" size="small" title="角色收益排行">
          <template #header-extra>
            <n-button v-if="ranking.length && filters.roleIds.length" size="tiny" type="primary" ghost @click="filters.roleIds = []">
              清空选择（{{ filters.roleIds.length }}）
            </n-button>
            <span v-else-if="ranking.length" class="ov-hint">点击角色筛选整页，可多选</span>
          </template>
          <div ref="rankBodyRef" class="ov-scroll" :style="sideMax.rank ? { maxHeight: sideMax.rank + 'px' } : undefined">
            <div v-if="ranking.length === 0" class="ov-empty">暂无数据</div>
            <div
              v-for="(item, i) in ranking"
              :key="item.roleId"
              class="ov-rank"
              :class="{ active: filters.roleIds.includes(item.roleId) }"
              @click="toggleRoleFilter(item.roleId)"
            >
              <span class="ov-rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <div class="ov-rank-body">
                <div class="ov-rank-head">
                  <span class="ov-rank-name">{{ item.roleId }}<span class="ov-rank-server">@{{ item.server }}</span></span>
                  <span class="ov-rank-value" :class="item.subtotal < 0 ? 'neg' : ''"><MoneyValue :value="item.subtotal" /></span>
                </div>
                <div class="ov-rank-bar"><i :class="item.subtotal < 0 ? 'neg' : ''" :style="{ width: item.ratio + '%' }"></i></div>
              </div>
            </div>
          </div>
        </n-card>

        <n-card ref="dropCardRef" size="small" title="特殊掉落">
          <template #header-extra><span class="ov-hint">共 {{ dropTotal }} 件</span></template>
          <div ref="dropBodyRef" class="ov-scroll" :style="sideMax.drop ? { maxHeight: sideMax.drop + 'px' } : undefined">
            <div v-if="dropStats.length === 0" class="ov-empty">暂无掉落记录</div>
            <div v-for="d in dropStats" :key="d.key" class="ov-drop">
              <div class="ov-drop-row" @click="expandedDrop = expandedDrop === d.key ? null : d.key">
                <img :src="resolveDropIcon(d.iconBase64)" class="ov-drop-icon" />
                <div class="ov-drop-info">
                  <span class="ov-drop-name" :style="dropNameColor(d.itemName) ? { color: dropNameColor(d.itemName) } : undefined">{{ d.itemName }}</span>
                  <span class="ov-drop-scope">{{ d.scopeLabel }}</span>
                </div>
                <span class="ov-drop-count">× {{ d.totalCount }}</span>
                <span class="ov-drop-arrow">{{ expandedDrop === d.key ? '▾' : '▸' }}</span>
              </div>
              <div v-if="expandedDrop === d.key" class="ov-drop-roles">
                <div v-for="r in d.byRole" :key="r.roleId" class="ov-drop-role">
                  <span v-if="roleMap.get(r.roleId)" class="ov-drop-role-name">
                    {{ r.roleId }}@{{ roleMap.get(r.roleId)!.server }}
                    <SchoolBadge :school="roleMap.get(r.roleId)!.school" />
                  </span>
                  <span v-else class="ov-drop-role-name muted">{{ r.roleId }}</span>
                  <span class="ov-drop-role-count">× {{ r.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </n-card>
      </div>
    </div>

  </n-space>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { NTag, type DataTableColumns } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import OverviewTrend from './OverviewTrend.vue'
import BlackPersonTrendPage from './BlackPersonTrendPage.vue'
import { DATE_RANGE_SHORTCUTS } from '../../constants/dateShortcuts'
import { toYmd } from '../../utils/date'
import MoneyValue from '../shared/MoneyValue.vue'
import SchoolBadge from '../shared/SchoolBadge.vue'
import { dropNameColor, resolveDropIcon } from '../../utils/specialDrop'

interface OverviewRow {
  key: string
  name: string
  roleId?: string
  roleServer?: string
  roleSchool?: string
  income: number
  expense: number
  subtotal: number
  children?: OverviewRow[]
}

const tracker = useTracker()

const filters = reactive<{ roleIds: string[]; server: string | null; school: string | null; range: [number, number] | null; seasonId: string | null; groupBrand: string | null }>({
  roleIds: [],
  server: null,
  school: null,
  range: null,
  seasonId: null,
  groupBrand: null
})

// 时间倒序：新赛季在前
const seasonOptions = computed(() => tracker.sortedSeasons.value.map((s) => ({ label: s.name, value: s.id })))

// 赛季与日期二选一：选赛季时日期框清空、按赛季起止筛选；手动选日期时清空赛季；都不填看全部
function onSeasonChange(seasonId: string | null) {
  if (seasonId) filters.range = null
}

function onFilterRangeUpdate(value: [number, number] | null) {
  if (value) filters.seasonId = null
}

// 选了赛季时，日期框用灰色占位文字显示该赛季的起止；结束时间未知时显示估算的结束日（筛选仍截止到今天）
const seasonPlaceholder = computed(() => {
  const season = filters.seasonId ? tracker.seasons.value.find((s) => s.id === filters.seasonId) : null
  if (!season) return { start: '开始日期', end: '结束日期' }
  const end = season.endTs === null ? `预计 ${toYmd(tracker.estimateSeasonEndTs(season.startTs))}` : toYmd(season.endTs)
  return { start: toYmd(season.startTs), end }
})

const effectiveRange = computed<[number, number] | null>(() => {
  if (filters.seasonId) {
    const season = tracker.seasons.value.find((s) => s.id === filters.seasonId)
    if (season) return tracker.getSeasonRange(season)
  }
  return filters.range
})

const dateRangeShortcuts = DATE_RANGE_SHORTCUTS
const roleOptions = computed(() => tracker.roleOptions.value)
const serverOptions = tracker.servers.map((v) => ({ label: v, value: v }))
const schoolOptions = tracker.schools.map((v) => ({ label: v, value: v }))
const roleMap = computed(() => new Map(tracker.roles.value.map((r) => [r.id, r])))

function renderSchoolOption(option: { label?: string | number }) {
  return h(SchoolBadge, { school: String(option.label ?? '') })
}

// 多选时输入框里的标签只显示角色名，避免一个标签就占满输入框、全部折叠成「+N」
function renderRoleTag({ option, handleClose }: { option: { value?: string | number }; handleClose: () => void }) {
  return h(NTag, { size: 'medium', closable: true, onClose: (e: MouseEvent) => { e.stopPropagation(); handleClose() } }, { default: () => String(option.value ?? '') })
}

function renderRoleOption(option: { value?: string | number }) {
  const roleId = String(option.value ?? '')
  const role = roleMap.value.get(roleId)
  if (!role) return roleId
  return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
    h('span', `${role.id}（${role.server}/`),
    h(SchoolBadge, { school: role.school }),
    h('span', '）'),
    role.isProxyClear ? h(NTag, { type: 'success', size: 'small' }, { default: () => '代清' }) : null
  ])
}

const groupBrandFilterOptions = computed(() =>
  tracker.groupBrands.value
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map((b) => ({ label: b.name, value: b.name, blacklisted: Boolean(b.blacklisted) }))
)

function renderBrandOption(option: { label?: string | number; blacklisted?: boolean }) {
  const label = String(option.label ?? '')
  if (!option.blacklisted) return label
  return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
    h('span', label),
    h(NTag, {
      type: 'error',
      size: 'small',
      style: 'transform: scale(0.9); transform-origin: left center;'
    }, { default: () => '黑名单' })
  ])
}

// 除「角色」外的筛选结果（收益排行用它，选中某角色后排行里仍列出所有角色）
const rowsAllRoles = computed(() => {
  const roleMap = new Map(tracker.roles.value.map((r) => [r.id, r]))
  return tracker.queryRecords({ roleId: null, dungeonId: null, range: effectiveRange.value, groupBrand: filters.groupBrand }).filter((row) => {
    const role = roleMap.get(row.roleId)
    if (!role) return false
    if (filters.server && role.server !== filters.server) return false
    if (filters.school && role.school !== filters.school) return false
    return true
  })
})

const allRows = computed(() =>
  filters.roleIds.length ? rowsAllRoles.value.filter((row) => filters.roleIds.includes(row.roleId)) : rowsAllRoles.value
)

const roleMetas = computed(() =>
  visibleRoles.value.map((role) => ({ id: role.id, label: `${role.id}（${role.server}/${role.school}）` }))
)

const dungeonMetas = computed(() => tracker.dungeons.value.filter((d) => !d.hidden).map((d) => ({ id: d.id, label: `${d.players}${d.difficulty}${d.name}` })))

const summary = computed(() =>
  allRows.value.reduce(
    (acc, row) => {
      acc.income += row.income
      acc.expense += row.expense
      acc.net += row.subtotal
      return acc
    },
    { income: 0, expense: 0, net: 0 }
  )
)

// 选了角色时只列选中的角色，否则列全部
const visibleRoles = computed(() =>
  filters.roleIds.length ? tracker.roles.value.filter((r) => filters.roleIds.includes(r.id)) : tracker.roles.value
)

const rows = computed<OverviewRow[]>(() => {
  return visibleRoles.value.map((role) => {
    const roleRows = allRows.value.filter((row) => row.roleId === role.id)
    const dungeonAgg = new Map<string, { name: string; income: number; expense: number; subtotal: number }>()

    roleRows.forEach((row) => {
      const prev = dungeonAgg.get(row.dungeonId)
      if (prev) {
        prev.income += row.income
        prev.expense += row.expense
        prev.subtotal += row.subtotal
        return
      }
      dungeonAgg.set(row.dungeonId, {
        name: row.dungeonText,
        income: row.income,
        expense: row.expense,
        subtotal: row.subtotal
      })
    })

    const children = Array.from(dungeonAgg.entries())
      .map(([dungeonId, val]) => ({
        key: `dungeon-${role.id}-${dungeonId}`,
        name: val.name,
        income: val.income,
        expense: val.expense,
        subtotal: val.subtotal
      }))
      .sort((a, b) => b.subtotal - a.subtotal)

    const totals = roleRows.reduce(
      (acc, row) => {
        acc.income += row.income
        acc.expense += row.expense
        acc.subtotal += row.subtotal
        return acc
      },
      { income: 0, expense: 0, subtotal: 0 }
    )

    return {
      key: `role-${role.id}`,
      name: `${role.id}（${role.server}/${role.school}）`,
      roleId: role.id,
      roleServer: role.server,
      roleSchool: role.school,
      income: totals.income,
      expense: totals.expense,
      subtotal: totals.subtotal,
      children
    }
  })
})

interface DropStat {
  key: string
  itemName: string
  iconBase64?: string
  scopeLabel: string
  totalCount: number
  byRole: { roleId: string; count: number }[]
}

const dropStats = computed<DropStat[]>(() => {
  const dropDefMap = new Map(tracker.specialDrops.value.map((d) => [d.id, d]))
  const counter = new Map<string, { total: number; byRole: Map<string, number> }>()
  allRows.value.forEach((row) => {
    const ids = row.specialDropIds
    if (!ids || ids.length === 0) return
    ids.forEach((id) => {
      const entry = counter.get(id) ?? { total: 0, byRole: new Map<string, number>() }
      entry.total++
      entry.byRole.set(row.roleId, (entry.byRole.get(row.roleId) ?? 0) + 1)
      counter.set(id, entry)
    })
  })
  // 掉落定义已被删除的不再统计
  return Array.from(counter.entries())
    .filter(([id]) => dropDefMap.has(id))
    .map(([id, entry]) => {
      const drop = dropDefMap.get(id)!
      const scopeLabel = drop.matchAll
        ? (drop.matchPlayers ? `通用（${drop.matchPlayers}）` : '通用')
        : drop.dungeonName
      return {
        key: id,
        itemName: drop.itemName,
        iconBase64: drop.iconBase64,
        scopeLabel,
        totalCount: entry.total,
        byRole: Array.from(entry.byRole.entries())
          .map(([roleId, count]) => ({ roleId, count }))
          .sort((a, b) => b.count - a.count)
      }
    })
    .sort((a, b) => b.totalCount - a.totalCount)
})


// 与默认值（当前赛季）不同的筛选条件数；赛季与它带出的日期算作一项
const activeFilterCount = computed(() => {
  const defaultSeasonId = currentSeason()?.id ?? null
  const timeChanged = filters.seasonId !== defaultSeasonId || filters.range !== null
  return [filters.roleIds.length > 0, filters.server, filters.school, filters.groupBrand].filter(Boolean).length + (timeChanged ? 1 : 0)
})

// 默认看当前赛季：今天所在的赛季，没有则取开始时间最新的赛季；一个赛季都没有则看全部记录
function currentSeason() {
  const now = Date.now()
  const list = tracker.sortedSeasons.value
  return list.find((s) => s.startTs <= now && now <= (s.endTs ?? Number.POSITIVE_INFINITY) + 24 * 60 * 60 * 1000 - 1) ?? list[0] ?? null
}

function resetFilters() {
  filters.roleIds = []
  filters.server = null
  filters.school = null
  filters.groupBrand = null
  const season = currentSeason()
  filters.seasonId = season?.id ?? null
  filters.range = null
}

resetFilters()

// 角色收益排行：只列有记录的角色，按净收支降序；比例条按绝对值相对最大值
// 收益排行：不受「角色」筛选影响，其余筛选生效；只列有记录的角色，按净收支降序
const ranking = computed(() => {
  const totals = new Map<string, number>()
  rowsAllRoles.value.forEach((row) => totals.set(row.roleId, (totals.get(row.roleId) ?? 0) + row.subtotal))
  const list = Array.from(totals.entries())
    .map(([roleId, subtotal]) => ({ roleId, server: roleMap.value.get(roleId)?.server ?? '', subtotal }))
    .sort((a, b) => b.subtotal - a.subtotal)
  const max = Math.max(1, ...list.map((r) => Math.abs(r.subtotal)))
  return list.map((r) => ({ ...r, ratio: Math.max(2, Math.round((Math.abs(r.subtotal) / max) * 100)) }))
})

function toggleRoleFilter(roleId: string) {
  filters.roleIds = filters.roleIds.includes(roleId)
    ? filters.roleIds.filter((id) => id !== roleId)
    : [...filters.roleIds, roleId]
}

const expandedDrop = ref<string | null>(null)
const detailTab = ref<'roles' | 'black'>('roles')

// ─── 右栏高度：默认不限高；两张卡片加起来超过左栏时，总高压到与左栏一致，
// 按数据条数比例分配两块各自的最大高度（某块按比例分到的比它实际需要的多，就只给需要的，余量让给另一块）
const mainColRef = ref<HTMLElement | null>(null)
const rankCardRef = ref<{ $el: HTMLElement } | null>(null)
const dropCardRef = ref<{ $el: HTMLElement } | null>(null)
const rankBodyRef = ref<HTMLElement | null>(null)
const dropBodyRef = ref<HTMLElement | null>(null)
const sideMax = reactive<{ rank: number | null; drop: number | null }>({ rank: null, drop: null })
const SIDE_GAP = 16
const SINGLE_COLUMN_QUERY = '(max-width: 1100px)'
const SINGLE_COLUMN_MAX = 360

function layoutSide() {
  const main = mainColRef.value
  const rankCard = rankCardRef.value?.$el
  const dropCard = dropCardRef.value?.$el
  const rankBody = rankBodyRef.value
  const dropBody = dropBodyRef.value
  if (!main || !rankCard || !dropCard || !rankBody || !dropBody) return

  // 单栏布局时不对齐左栏，各自限高
  if (window.matchMedia(SINGLE_COLUMN_QUERY).matches) {
    sideMax.rank = SINGLE_COLUMN_MAX
    sideMax.drop = SINGLE_COLUMN_MAX
    return
  }
  // 卡片除内容区外的高度（标题栏、内边距）
  const rankChrome = rankCard.offsetHeight - rankBody.offsetHeight
  const dropChrome = dropCard.offsetHeight - dropBody.offsetHeight
  const rankNeed = rankBody.scrollHeight
  const dropNeed = dropBody.scrollHeight
  const avail = main.offsetHeight - SIDE_GAP - rankChrome - dropChrome
  if (rankNeed + dropNeed <= avail) {
    sideMax.rank = null
    sideMax.drop = null
    return
  }
  const wRank = Math.max(1, ranking.value.length)
  const wDrop = Math.max(1, dropStats.value.length)
  let rankH = Math.floor((avail * wRank) / (wRank + wDrop))
  let dropH = avail - rankH
  if (rankNeed < rankH) {
    rankH = rankNeed
    dropH = avail - rankH
  } else if (dropNeed < dropH) {
    dropH = dropNeed
    rankH = avail - dropH
  }
  sideMax.rank = Math.max(80, rankH)
  sideMax.drop = Math.max(80, dropH)
}

let sideFrame = 0
function scheduleLayout() {
  if (sideFrame) return
  sideFrame = requestAnimationFrame(() => {
    sideFrame = 0
    layoutSide()
  })
}

let sideRo: ResizeObserver | null = null
onMounted(() => {
  sideRo = new ResizeObserver(scheduleLayout)
  if (mainColRef.value) sideRo.observe(mainColRef.value)
  window.addEventListener('resize', scheduleLayout)
  scheduleLayout()
})
onUnmounted(() => {
  if (sideFrame) cancelAnimationFrame(sideFrame)
  sideRo?.disconnect()
  window.removeEventListener('resize', scheduleLayout)
})
// 内容变化（筛选、展开掉落明细）后重新分配
watch([ranking, dropStats, expandedDrop], async () => {
  await nextTick()
  scheduleLayout()
})
const dropTotal = computed(() => dropStats.value.reduce((acc, d) => acc + d.totalCount, 0))

const columns: DataTableColumns<OverviewRow> = [
  {
    title: '角色 / 副本',
    key: 'name',
    render: (row) => {
      const isRoleRow = row.key.startsWith('role-')
      if (isRoleRow && row.roleId && row.roleServer && row.roleSchool) {
        const role = roleMap.value.get(row.roleId)
        return h('span', { style: 'font-weight: 600; display:inline-flex; align-items:center; gap:4px;' }, [
          h('span', `${row.roleId}（${row.roleServer}/`),
          h(SchoolBadge, { school: row.roleSchool }),
          h('span', '）'),
          role?.isProxyClear ? h(NTag, { type: 'success', size: 'small' }, { default: () => '代清' }) : null
        ])
      }
      return h('span', { style: isRoleRow ? 'font-weight: 600;' : '' }, row.name)
    }
  },
  {
    title: '收入',
    key: 'income',
    sorter: (a, b) => a.income - b.income,
    render: (row) => h(MoneyValue, { value: row.income })
  },
  {
    title: '支出',
    key: 'expense',
    sorter: (a, b) => a.expense - b.expense,
    render: (row) => h(MoneyValue, { value: row.expense })
  },
  {
    title: '收支小计',
    key: 'subtotal',
    sorter: (a, b) => a.subtotal - b.subtotal,
    render: (row) => h(MoneyValue, { value: row.subtotal })
  }
]
</script>

<style scoped>
.ov-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 1100px) {
  .ov-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.ov-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.ov-tab-card :deep(.n-card__content) {
  padding-top: 4px;
}
.ov-hint {
  font-size: 12px;
  color: #999;
}
.ov-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}
.ov-scroll {
  overflow-y: auto;
  margin-right: -6px;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
.ov-scroll::-webkit-scrollbar {
  width: 6px;
}
.ov-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}
.ov-rank {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.ov-rank:hover {
  background: #f5f7fa;
}
.ov-rank.active {
  background: #18a05814;
}
.ov-rank-no {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
  background: #f0f2f5;
}
.ov-rank-no.top {
  color: #fff;
  background: #f0a020;
}
.ov-rank-body {
  flex: 1;
  min-width: 0;
}
.ov-rank-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.ov-rank-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333;
}
.ov-rank-server {
  color: #909399;
  font-size: 12px;
}
.ov-rank-value {
  flex: 0 0 auto;
  font-weight: 600;
  color: #18a058;
}
.ov-rank-value.neg {
  color: #d03050;
}
.ov-rank-bar {
  height: 4px;
  margin-top: 4px;
  background: #f0f2f5;
  border-radius: 2px;
  overflow: hidden;
}
.ov-rank-bar i {
  display: block;
  height: 100%;
  background: #18a058;
  border-radius: 2px;
}
.ov-rank-bar i.neg {
  background: #d03050;
}
.ov-drop + .ov-drop {
  border-top: 1px solid #f2f2f5;
}
.ov-drop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  cursor: pointer;
  border-radius: 6px;
}
.ov-drop-row:hover {
  background: #f5f7fa;
}
.ov-drop-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}
.ov-drop-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ov-drop-name {
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-drop-scope {
  font-size: 11px;
  color: #999;
}
.ov-drop-count {
  font-weight: 600;
  color: #18a058;
  font-size: 13px;
}
.ov-drop-arrow {
  color: #c0c4cc;
  font-size: 12px;
}
.ov-drop-roles {
  padding: 2px 4px 8px 42px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ov-drop-role {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
}
.ov-drop-role-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ov-drop-role-name.muted {
  color: #999;
}
.ov-drop-role-count {
  color: #18a058;
}
.ov-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}
.ov-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
/* 时间组按内容定宽；范围组吃掉剩余宽度，组内控件各有最小 / 最大宽度 */
.ov-filter-time {
  flex: 0 0 auto;
}
.ov-filter-scope {
  flex: 1 1 560px;
}
/* 赛季、日期框宽度直接写在组件 style 上（固定不伸缩），日期框需放得下「预计 yyyy-mm-dd」 */
.ov-f-role {
  flex: 1.6 1 180px;
  min-width: 160px;
  max-width: 320px;
}
.ov-f-sm {
  flex: 1 1 120px;
  min-width: 110px;
  max-width: 220px;
}
.ov-or {
  font-size: 12px;
  color: #909399;
}
.ov-filter-divider {
  width: 1px;
  height: 20px;
  background: #e0e0e6;
}
.ov-reset {
  margin-left: auto;
}
.ov-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  background: #fff;
  border: 1px solid #efeff5;
  border-radius: 6px;
}
.ov-stat {
  padding: 12px 20px;
}
.ov-stat + .ov-stat {
  border-left: 1px solid #efeff5;
}
.ov-stat-value {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2a44;
}
.ov-stat-value.pos {
  color: #18a058;
}
.ov-stat-value.neg {
  color: #d03050;
}
.ov-stat-unit {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}
@media (max-width: 720px) {
  .ov-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ov-stat:nth-child(3) {
    border-left: none;
  }
}
</style>
