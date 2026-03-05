<template>
  <n-space vertical :size="16">
    <n-card>
      <n-form inline class="query-form">
        <n-form-item label="角色">
          <n-select
            v-model:value="filters.roleId"
            clearable
            filterable
            :options="roleOptions"
            :render-label="renderRoleOption"
            placeholder="全部角色"
            :style="fieldStyle"
          />
        </n-form-item>
        <n-form-item label="服务器">
          <n-select v-model:value="filters.server" clearable :options="serverOptions" placeholder="全部服务器" :style="fieldStyle" />
        </n-form-item>
        <n-form-item label="门派">
          <n-select
            v-model:value="filters.school"
            clearable
            :options="schoolOptions"
            :render-label="renderSchoolOption"
            placeholder="全部门派"
            :style="fieldStyle"
          />
        </n-form-item>
        <n-form-item label="日期">
          <n-date-picker
            v-model:value="filters.range"
            type="daterange"
            clearable
            :shortcuts="dateRangeShortcuts"
            :style="fieldStyle"
          />
        </n-form-item>
        <n-form-item>
          <n-button @click="resetWeek">重置</n-button>
        </n-form-item>
      </n-form>
    </n-card>

    <n-grid cols="1 s:3" responsive="screen" :x-gap="12" :y-gap="12">
      <n-grid-item>
        <n-card>
          <div class="stat-label">全部收入</div>
          <div class="stat-value"><MoneyValue :value="summary.income" /></div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card>
          <div class="stat-label">全部支出</div>
          <div class="stat-value"><MoneyValue :value="summary.expense" /></div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card>
          <div class="stat-label">全部净收支</div>
          <div class="stat-value"><MoneyValue :value="summary.net" /></div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-tabs type="segment" animated>
      <n-tab-pane name="summary" tab="汇总明细">
        <n-card>
          <n-data-table :columns="columns" :data="rows" :pagination="{ pageSize: 20 }" />
        </n-card>
      </n-tab-pane>
      <n-tab-pane name="trend" tab="折线图">
        <OverviewTrend :rows="allRows" :roles="roleMetas" :dungeons="dungeonMetas" :range="filters.range" />
      </n-tab-pane>
    </n-tabs>
  </n-space>
</template>

<script setup lang="ts">
import { computed, h, reactive } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import OverviewTrend from './OverviewTrend.vue'
import { DATE_RANGE_SHORTCUTS } from '../../constants/dateShortcuts'
import { formatMoney } from '../../utils/money'
import MoneyValue from '../shared/MoneyValue.vue'
import SchoolBadge from '../shared/SchoolBadge.vue'

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
const fieldStyle = { width: '340px', maxWidth: '100%' }

const filters = reactive<{ roleId: string | null; server: string | null; school: string | null; range: [number, number] | null }>({
  roleId: null,
  server: null,
  school: null,
  range: tracker.getCurrentWeekRange()
})

const dateRangeShortcuts = DATE_RANGE_SHORTCUTS
const roleOptions = computed(() => tracker.roleOptions.value)
const serverOptions = tracker.servers.map((v) => ({ label: v, value: v }))
const schoolOptions = tracker.schools.map((v) => ({ label: v, value: v }))
const roleMap = computed(() => new Map(tracker.roles.value.map((r) => [r.id, r])))

function renderSchoolOption(option: { label?: string | number }) {
  return h(SchoolBadge, { school: String(option.label ?? '') })
}

function renderRoleOption(option: { value?: string | number }) {
  const roleId = String(option.value ?? '')
  const role = roleMap.value.get(roleId)
  if (!role) return roleId
  return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
    h('span', `${role.id}（${role.server}/`),
    h(SchoolBadge, { school: role.school }),
    h('span', '）')
  ])
}

const allRows = computed(() => {
  const roleMap = new Map(tracker.roles.value.map((r) => [r.id, r]))
  return tracker.queryRecords({ roleId: null, dungeonId: null, range: filters.range }).filter((row) => {
    if (filters.roleId && row.roleId !== filters.roleId) return false
    const role = roleMap.get(row.roleId)
    if (!role) return false
    if (filters.server && role.server !== filters.server) return false
    if (filters.school && role.school !== filters.school) return false
    return true
  })
})

const roleMetas = computed(() =>
  tracker.roles.value.map((role) => ({ id: role.id, label: `${role.id}（${role.server}/${role.school}）` }))
)

const dungeonMetas = computed(() => tracker.dungeons.value.map((d) => ({ id: d.id, label: `${d.players}${d.difficulty}${d.name}` })))

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

const rows = computed<OverviewRow[]>(() => {
  return tracker.roles.value.map((role) => {
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

function resetWeek() {
  filters.roleId = null
  filters.server = null
  filters.school = null
  filters.range = tracker.getCurrentWeekRange()
}

const columns: DataTableColumns<OverviewRow> = [
  {
    title: '角色 / 副本',
    key: 'name',
    render: (row) => {
      const isRoleRow = row.key.startsWith('role-')
      if (isRoleRow && row.roleId && row.roleServer && row.roleSchool) {
        return h('span', { style: 'font-weight: 600; display:inline-flex; align-items:center; gap:4px;' }, [
          h('span', `${row.roleId}（${row.roleServer}/`),
          h(SchoolBadge, { school: row.roleSchool }),
          h('span', '）')
        ])
      }
      return h('span', { style: isRoleRow ? 'font-weight: 600;' : '' }, row.name)
    }
  },
  {
    title: '收入',
    key: 'income',
    sorter: (a, b) => a.income - b.income,
    render: (row) => formatMoney(row.income)
  },
  {
    title: '支出',
    key: 'expense',
    sorter: (a, b) => a.expense - b.expense,
    render: (row) => formatMoney(row.expense)
  },
  {
    title: '收支小计',
    key: 'subtotal',
    sorter: (a, b) => a.subtotal - b.subtotal,
    render: (row) => formatMoney(row.subtotal)
  }
]
</script>
