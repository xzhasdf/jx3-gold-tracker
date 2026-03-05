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
        <n-form-item label="副本">
          <n-cascader
            v-model:value="filters.dungeonId"
            clearable
            filterable
            :options="dungeonCascaderOptions"
            placeholder="全部副本"
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
          <n-button @click="resetFilters">重置</n-button>
        </n-form-item>
      </n-form>
      <div class="query-extra">
        <n-button type="primary" @click="openAddModal">新增收支记录</n-button>
      </div>
    </n-card>

    <n-grid cols="1 s:3" responsive="screen" :x-gap="12" :y-gap="12">
      <n-grid-item>
        <n-card>
          <div class="stat-label">总收入</div>
          <div class="stat-value"><MoneyValue :value="totals.income" /></div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card>
          <div class="stat-label">总支出</div>
          <div class="stat-value"><MoneyValue :value="totals.expense" /></div>
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card>
          <div class="stat-label">总计（收支）</div>
          <div class="stat-value"><MoneyValue :value="totals.net" /></div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card>
      <n-data-table
        remote
        :columns="columns"
        :data="displayRows"
        :pagination="{ pageSize: 20 }"
        :scroll-x="1100"
        @update:sorter="handleSorterChange"
      />
    </n-card>
  </n-space>

  <n-modal v-model:show="showAdd" preset="card" title="新增收支记录" style="max-width: 620px">
    <n-form label-placement="left" label-width="90">
      <n-form-item label="日期">
        <n-space align="center" :wrap-item="false">
          <n-date-picker v-model:value="addForm.date" type="date" clearable :shortcuts="dateShortcuts" :style="fieldStyle" />
          <n-button text type="primary" @click="showOcrModal = true">上传截图</n-button>
        </n-space>
      </n-form-item>
      <n-form-item label="角色">
        <n-space align="center" :wrap-item="false">
          <n-select
            v-model:value="addForm.roleId"
            :options="roleOptionsForAddRecordWithTemp"
            :render-label="renderRoleOption"
            filterable
            :style="fieldStyle"
          />
          <n-button v-if="showRoleFixButton" text type="primary" @click="openRoleFixModal">识别有误？去修改</n-button>
        </n-space>
      </n-form-item>
      <n-form-item label="副本">
        <n-cascader
          v-model:value="addForm.dungeonId"
          :options="dungeonCascaderOptions"
          clearable
          filterable
          placeholder="请选择人数/难度/副本"
          :style="fieldStyle"
        />
      </n-form-item>
      <n-form-item label="收入">
        <n-space align="center" :wrap-item="false">
          <n-input-number v-model:value="addForm.incomeGold" :min="0" :show-button="false" :style="fieldStyle" />
          <n-button v-if="showTempRatioButton" text type="primary" @click="openTempRatioDialog">临时比例</n-button>
        </n-space>
        <template #feedback>
          <span v-if="addIncomeFeedback" class="proxy-feedback">{{ addIncomeFeedback }}</span>
        </template>
      </n-form-item>
      <n-form-item label="支出">
        <n-input-number v-model:value="addForm.expenseGold" :min="0" :show-button="false" :style="fieldStyle" />
      </n-form-item>
      <template v-if="!isAddFixedDungeon">
        <n-form-item label="团牌" class="compact-group-item">
          <n-space vertical :size="6">
            <n-space>
              <n-input v-model:value="addForm.groupBrand" :style="fieldStyle" />
              <n-checkbox v-model:checked="addForm.blacklisted">拉黑</n-checkbox>
            </n-space>
            <div class="blacklist-hint" :class="{ visible: showAddBlacklistedHint }">该团牌已拉黑</div>
          </n-space>
        </n-form-item>
        <n-form-item label="团长ID">
          <n-input v-model:value="addForm.leaderId" :style="fieldStyle" />
        </n-form-item>
      </template>
      <n-form-item label="备注">
        <n-input v-model:value="addForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" :style="fieldStyle" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="closeAddModal">取消</n-button>
        <n-button type="primary" @click="createRecord">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showEdit" preset="card" title="编辑收支记录" style="max-width: 620px">
    <n-form label-placement="left" label-width="90">
      <n-form-item label="日期">
        <n-date-picker v-model:value="editForm.date" type="date" disabled :style="fieldStyle" />
      </n-form-item>
      <n-form-item label="角色">
        <n-select
          v-model:value="editForm.roleId"
          :options="roleOptionsForAddRecord"
          :render-label="renderRoleOption"
          disabled
          :style="fieldStyle"
        />
      </n-form-item>
      <n-form-item label="副本">
        <n-cascader v-model:value="editForm.dungeonId" :options="dungeonCascaderOptions" disabled :style="fieldStyle" />
      </n-form-item>
      <n-form-item label="收入">
        <n-input-number v-model:value="editForm.incomeGold" :min="0" :show-button="false" :style="fieldStyle" />
      </n-form-item>
      <n-form-item label="支出">
        <n-input-number v-model:value="editForm.expenseGold" :min="0" :show-button="false" :style="fieldStyle" />
      </n-form-item>
      <template v-if="!isEditFixedDungeon">
        <n-form-item label="团牌" class="compact-group-item">
          <n-space vertical :size="6">
            <n-space>
              <n-input v-model:value="editForm.groupBrand" :style="fieldStyle" />
              <n-checkbox v-model:checked="editForm.blacklisted">拉黑</n-checkbox>
            </n-space>
            <div class="blacklist-hint" :class="{ visible: showEditBlacklistedHint }">该团牌已拉黑</div>
          </n-space>
        </n-form-item>
        <n-form-item label="团长ID">
          <n-input v-model:value="editForm.leaderId" :style="fieldStyle" />
        </n-form-item>
      </template>
      <n-form-item label="备注">
        <n-input v-model:value="editForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" :style="fieldStyle" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showEdit = false">取消</n-button>
        <n-button type="primary" @click="saveEdit">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showRoleFix" preset="card" title="角色信息修正" style="max-width: 620px">
    <n-form label-placement="left" label-width="90">
      <n-form-item label="角色ID">
        <n-input v-model:value="roleFixForm.id" :style="fieldStyle" />
      </n-form-item>
      <n-form-item label="服务器">
        <n-select v-model:value="roleFixForm.server" :options="serverOptions" filterable :style="fieldStyle" />
      </n-form-item>
      <n-form-item label="门派">
        <n-select
          v-model:value="roleFixForm.school"
          :options="schoolOptions"
          :render-label="renderSchoolOption"
          filterable
          :style="fieldStyle"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showRoleFix = false">取消</n-button>
        <n-button type="primary" @click="saveRoleFix">确认</n-button>
      </n-space>
    </template>
  </n-modal>

  <RecordOcrModal
    v-model:show="showOcrModal"
    :roles="ocrRoles"
    :dungeons="ocrDungeons"
    @apply="applyOcrResult"
  />
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NSlider, NTag, type CascaderOption, type DataTableColumns, type DataTableSortState, useDialog } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import { FIXED_DUNGEON_OPTIONS } from '../../constants/game'
import { DATE_RANGE_SHORTCUTS } from '../../constants/dateShortcuts'
import { getTodayRange, getYesterdayRange } from '../../utils/date'
import { splitGold, toGold } from '../../utils/money'
import MoneyValue from '../shared/MoneyValue.vue'
import RecordOcrModal from './RecordOcrModal.vue'
import SchoolBadge from '../shared/SchoolBadge.vue'
import type { OcrFillResult } from './ocr'

const tracker = useTracker()
const dialog = useDialog()
const fieldStyle = { width: '340px', maxWidth: '100%' }

const filters = reactive<{ roleId: string | null; dungeonId: string | null; range: [number, number] | null }>({
  roleId: null,
  dungeonId: null,
  range: tracker.getCurrentWeekRange()
})

const showAdd = ref(false)
const showEdit = ref(false)
const showOcrModal = ref(false)
const showRoleFix = ref(false)
const editingId = ref('')
const tempRoleCandidateId = ref('')
const tempRoleCandidateServer = ref(tracker.servers[0])
const tempRoleCandidateSchool = ref(tracker.schools[0])
const roleFixForm = reactive({
  id: '',
  server: tracker.servers[0],
  school: tracker.schools[0]
})

const addForm = reactive({
  date: Date.now() as number | null,
  roleId: null as string | null,
  dungeonId: null as string | null,
  incomeGold: 0 as number | null,
  expenseGold: 0 as number | null,
  groupBrand: '',
  leaderId: '',
  remark: '',
  blacklisted: false
})

const editForm = reactive({
  date: null as number | null,
  roleId: null as string | null,
  dungeonId: null as string | null,
  incomeGold: 0 as number | null,
  expenseGold: 0 as number | null,
  groupBrand: '',
  leaderId: '',
  remark: '',
  blacklisted: false
})

const roleOptions = computed(() => tracker.roleOptions.value)
const roleOptionsForAddRecord = computed(() => tracker.roleOptionsForAddRecord.value)
const serverOptions = tracker.servers.map((server) => ({ label: server, value: server }))
const schoolOptions = tracker.schools.map((school) => ({ label: school, value: school }))
const roleOptionsForAddRecordWithTemp = computed(() => {
  if (!tempRoleCandidateId.value) return roleOptionsForAddRecord.value
  const exists = tracker.roles.value.some((role) => role.id === tempRoleCandidateId.value)
  if (exists) return roleOptionsForAddRecord.value
  return [
    {
      label: `${tempRoleCandidateId.value}（${tempRoleCandidateServer.value}/${tempRoleCandidateSchool.value}）`,
      value: tempRoleCandidateId.value
    },
    ...roleOptionsForAddRecord.value
  ]
})
const roleMap = computed(() => new Map(tracker.roles.value.map((r) => [r.id, r])))
const showRoleFixButton = computed(
  () => Boolean(addForm.roleId) && addForm.roleId === tempRoleCandidateId.value && !roleMap.value.has(String(addForm.roleId))
)
const tempProxyRatio = ref<number | null>(null)
const selectedAddRole = computed(() => {
  const roleId = addForm.roleId ? String(addForm.roleId) : ''
  if (!roleId) return undefined
  return roleMap.value.get(roleId)
})
const effectiveAddProxyRatio = computed(() => {
  const role = selectedAddRole.value
  if (!role?.isProxyClear) return undefined
  const raw = tempProxyRatio.value ?? role.wageRatio
  return Math.max(0, Math.min(100, Math.round(Number(raw) || 0)))
})
const showTempRatioButton = computed(() => Boolean(selectedAddRole.value?.isProxyClear))
const addIncomeFeedback = computed(() => {
  const ratio = effectiveAddProxyRatio.value
  if (ratio == null) return ''
  return `代清角色，工资比例${ratio}%`
})
const ocrRoles = computed(() => tracker.roles.value.map((role) => ({ id: role.id })))
const ocrDungeons = computed(() =>
  tracker.dungeons.value.map((dungeon) => ({
    id: dungeon.id,
    name: dungeon.name,
    players: dungeon.players,
    difficulty: dungeon.difficulty
  }))
)
const dateRangeShortcuts = DATE_RANGE_SHORTCUTS
const dateShortcuts = {
  昨日: () => getYesterdayRange()[0],
  今日: () => getTodayRange()[0]
}

const FIXED_DUNGEON_ID_SET = new Set<string>(FIXED_DUNGEON_OPTIONS.map((d) => d.id))

const isAddFixedDungeon = computed(() => FIXED_DUNGEON_ID_SET.has(addForm.dungeonId ?? ''))
const isEditFixedDungeon = computed(() => FIXED_DUNGEON_ID_SET.has(editForm.dungeonId ?? ''))

const dungeonCascaderOptions = computed<CascaderOption[]>(() => {
  const fixed: CascaderOption[] = FIXED_DUNGEON_OPTIONS.map((d) => ({ label: d.label, value: d.id }))

  const playerMap = new Map<string, Map<string, { label: string; value: string }[]>>()
  tracker.dungeons.value.forEach((dungeon) => {
    const difficultyMap = playerMap.get(dungeon.players) ?? new Map<string, { label: string; value: string }[]>()
    const names = difficultyMap.get(dungeon.difficulty) ?? []
    names.push({ label: dungeon.name, value: dungeon.id })
    difficultyMap.set(dungeon.difficulty, names)
    playerMap.set(dungeon.players, difficultyMap)
  })

  const userOptions = Array.from(playerMap.entries()).map(([players, difficultyMap]) => ({
    label: players,
    value: players,
    children: Array.from(difficultyMap.entries()).map(([difficulty, names]) => ({
      label: difficulty,
      value: `${players}-${difficulty}`,
      children: names
    }))
  }))

  return [...userOptions, ...fixed]
})

const rows = computed(() => tracker.queryRecords(filters))
const activeSorter = ref<{ columnKey: 'income' | 'expense' | 'subtotal' | null; order: false | 'ascend' | 'descend' }>({
  columnKey: null,
  order: false
})

const displayRows = computed(() => {
  const { columnKey, order } = activeSorter.value
  if (!columnKey || order === false) return rows.value

  const factor = order === 'ascend' ? 1 : -1
  return [...rows.value].sort((a, b) => (a[columnKey] - b[columnKey]) * factor)
})

const totals = computed(() =>
  rows.value.reduce(
    (acc, row) => {
      acc.income += row.income
      acc.expense += row.expense
      acc.net += row.subtotal
      return acc
    },
    { income: 0, expense: 0, net: 0 }
  )
)

const blacklistedBrandSet = computed(() => {
  const set = new Set<string>()
  tracker.getGroupBrandRoster().forEach((item) => {
    if (item.blacklisted) set.add(item.groupBrand.trim())
  })
  return set
})

const showAddBlacklistedHint = computed(() => {
  const brand = addForm.groupBrand.trim()
  return Boolean(brand) && blacklistedBrandSet.value.has(brand)
})

const showEditBlacklistedHint = computed(() => {
  const brand = editForm.groupBrand.trim()
  return Boolean(brand) && blacklistedBrandSet.value.has(brand)
})

watch(
  () => addForm.groupBrand,
  (value) => {
    const brand = value.trim()
    if (brand && blacklistedBrandSet.value.has(brand)) addForm.blacklisted = true
  }
)

watch(showAdd, (value) => {
  if (value) return
  showOcrModal.value = false
  showRoleFix.value = false
  tempRoleCandidateId.value = ''
  tempRoleCandidateServer.value = tracker.servers[0]
  tempRoleCandidateSchool.value = tracker.schools[0]
  addForm.date = Date.now()
  addForm.roleId = null
  addForm.dungeonId = null
  addForm.incomeGold = 0
  addForm.expenseGold = 0
  addForm.groupBrand = ''
  addForm.leaderId = ''
  addForm.remark = ''
  addForm.blacklisted = false
  tempProxyRatio.value = null
})

watch(
  () => addForm.roleId,
  () => {
    tempProxyRatio.value = null
  }
)

watch(
  () => addForm.dungeonId,
  (id) => {
    if (FIXED_DUNGEON_ID_SET.has(id ?? '')) {
      addForm.groupBrand = ''
      addForm.leaderId = ''
      addForm.blacklisted = false
    }
  }
)

watch(
  () => editForm.groupBrand,
  (value) => {
    const brand = value.trim()
    if (brand && blacklistedBrandSet.value.has(brand)) editForm.blacklisted = true
  }
)

function renderRoleOption(option: { value?: string | number; label?: string | number }) {
  const roleId = String(option.value ?? '')
  const role = roleMap.value.get(roleId)
  if (!role) {
    if (roleId === tempRoleCandidateId.value) {
      return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
        h('span', `${tempRoleCandidateId.value}（${tempRoleCandidateServer.value}/`),
        h(SchoolBadge, { school: tempRoleCandidateSchool.value }),
        h('span', '）')
      ])
    }
    return String(option.label ?? roleId)
  }
  return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
    h('span', `${role.id}（${role.server}/`),
    h(SchoolBadge, { school: role.school }),
    h('span', '）')
  ])
}

function renderSchoolOption(option: { label?: string | number }) {
  return h(SchoolBadge, { school: String(option.label ?? '') })
}

function resetFilters() {
  filters.roleId = null
  filters.dungeonId = null
  filters.range = null
}

function showTip(content: string) {
  dialog.warning({
    title: '提示',
    content,
    positiveText: '知道了'
  })
}

function openAddModal() {
  if (tracker.roles.value.length === 0) {
    showTip('请先添加角色，再录入收支记录')
    return
  }
  if (tracker.dungeons.value.length === 0) {
    showTip('请先添加副本，再录入收支记录')
    return
  }
  addForm.date = Date.now()
  addForm.roleId = roleOptionsForAddRecord.value[0]?.value ?? tracker.roles.value[0].id
  addForm.dungeonId = tracker.dungeons.value[0].id
  addForm.incomeGold = 0
  addForm.expenseGold = 0
  addForm.groupBrand = ''
  addForm.leaderId = ''
  addForm.remark = ''
  addForm.blacklisted = false
  tempRoleCandidateId.value = ''
  tempRoleCandidateServer.value = tracker.servers[0]
  tempRoleCandidateSchool.value = tracker.schools[0]
  showAdd.value = true
}

function closeAddModal() {
  showAdd.value = false
}

function openRoleFixModal() {
  roleFixForm.id = tempRoleCandidateId.value
  roleFixForm.server = tempRoleCandidateServer.value
  roleFixForm.school = tempRoleCandidateSchool.value
  showRoleFix.value = true
}

function saveRoleFix() {
  const nextId = roleFixForm.id.trim()
  if (!nextId) {
    showTip('角色ID不能为空')
    return
  }
  tempRoleCandidateId.value = nextId
  tempRoleCandidateServer.value = roleFixForm.server
  tempRoleCandidateSchool.value = roleFixForm.school
  addForm.roleId = nextId
  showRoleFix.value = false
}

function createRecord() {
  if (!addForm.date || !addForm.dungeonId) {
    showTip('请完整填写日期、角色、副本')
    return
  }

  let roleId = addForm.roleId
  if (roleId && roleMap.value.has(roleId) === false && roleId === tempRoleCandidateId.value) {
    const createResult = tracker.addRole({
      id: roleId,
      server: tempRoleCandidateServer.value,
      school: tempRoleCandidateSchool.value,
      isProxyClear: false,
      wageRatio: 100
    })
    if (!createResult.ok) {
      showTip(createResult.message ?? '角色创建失败')
      return
    }
  }
  if (!roleId) {
    showTip('请完整填写日期、角色、副本')
    return
  }

  const selectedRole = roleMap.value.get(roleId)
  const rawIncome = toGold(0, addForm.incomeGold)
  const proxyRatio = effectiveAddProxyRatio.value
  const adjustedIncome = selectedRole?.isProxyClear ? Math.round((rawIncome * (proxyRatio ?? 100)) / 100) : rawIncome

  tracker.addRecord({
    roleId,
    dungeonId: addForm.dungeonId,
    dateTs: addForm.date,
    income: adjustedIncome,
    expense: toGold(0, addForm.expenseGold),
    groupBrand: addForm.groupBrand,
    leaderId: addForm.leaderId,
    remark: addForm.remark,
    blacklisted: addForm.blacklisted
  })
  closeAddModal()
}

function openTempRatioDialog() {
  if (!selectedAddRole.value?.isProxyClear) return
  const draft = ref<number>(effectiveAddProxyRatio.value ?? 100)
  dialog.success({
    title: '临时比例',
    content: () =>
      h('div', { style: 'display:flex;align-items:center;gap:12px;min-width:360px;' }, [
        h(NSlider, {
          value: draft.value,
          min: 0,
          max: 100,
          step: 10,
          style: { width: '280px' },
          'onUpdate:value': (value: number) => {
            draft.value = value
          }
        }),
        h('span', { style: 'font-size:14px;color:#606266;min-width:44px;' }, `${draft.value}%`)
      ]),
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      tempProxyRatio.value = draft.value
    }
  })
}

function applyOcrResult(result: OcrFillResult) {
  if (result.dateTs) addForm.date = result.dateTs
  const resolvedRoleId = (result.roleId ?? result.roleIdCandidate ?? '')
    .replace(/^[0-9Il|l１]+(?=[A-Za-z\u4e00-\u9fa5@])/, '')
    .trim()
  if (resolvedRoleId) {
    const exists = tracker.roles.value.some((role) => role.id === resolvedRoleId)
    if (exists) {
      addForm.roleId = resolvedRoleId
      tempRoleCandidateId.value = ''
    } else {
      tempRoleCandidateId.value = resolvedRoleId
      tempRoleCandidateServer.value = tracker.servers[0]
      tempRoleCandidateSchool.value =
        result.schoolCandidate && tracker.schools.includes(result.schoolCandidate) ? result.schoolCandidate : tracker.schools[0]
      addForm.roleId = resolvedRoleId
    }
  }
  if (result.dungeonId) addForm.dungeonId = result.dungeonId
  if (typeof result.incomeGold === 'number') addForm.incomeGold = result.incomeGold
  if (typeof result.expenseGold === 'number') addForm.expenseGold = result.expenseGold
  if (typeof result.groupBrand === 'string') addForm.groupBrand = result.groupBrand
  if (typeof result.leaderId === 'string') addForm.leaderId = result.leaderId
  if (typeof result.remark === 'string') addForm.remark = result.remark
}

function openEdit(row: (typeof rows.value)[number]) {
  editingId.value = row.id
  const income = splitGold(row.income)
  const expense = splitGold(row.expense)
  editForm.date = new Date(`${row.date}T00:00:00`).getTime()
  editForm.roleId = row.roleId
  editForm.dungeonId = row.dungeonId
  editForm.incomeGold = income.brick * 10000 + income.gold
  editForm.expenseGold = expense.brick * 10000 + expense.gold
  editForm.groupBrand = row.groupBrand || ''
  editForm.leaderId = row.leaderId || ''
  editForm.remark = row.remark || ''
  editForm.blacklisted = Boolean(row.blacklisted)
  showEdit.value = true
}

function saveEdit() {
  tracker.updateRecord(editingId.value, {
    income: toGold(0, editForm.incomeGold),
    expense: toGold(0, editForm.expenseGold),
    groupBrand: editForm.groupBrand,
    leaderId: editForm.leaderId,
    remark: editForm.remark,
    blacklisted: editForm.blacklisted
  })
  showEdit.value = false
}

function removeRecord(id: string) {
  dialog.warning({
    title: '删除确认',
    content: '确认删除该收支记录吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      tracker.deleteRecord(id)
    }
  })
}

const columns = computed<DataTableColumns<(typeof rows.value)[number]>>(() => [
  { title: '日期', key: 'date', minWidth: 88, titleColSpan: 1, render: (row) => h('span', { style: 'white-space:nowrap;' }, row.date) },
  {
    title: '角色信息',
    key: 'roleText',
    minWidth: 180,
    render: (row) => {
      const role = roleMap.value.get(row.roleId)
      if (!role) return row.roleText
      return h('div', { style: 'display:flex;flex-direction:column;gap:2px;' }, [
        h('div', { style: 'display:inline-flex;align-items:center;gap:4px;flex-wrap:nowrap;' }, [
          h('span', { style: 'white-space:nowrap;' }, role.id),
          role.isProxyClear ? h(NTag, { type: 'success', size: 'small', style: 'flex-shrink:0;' }, { default: () => '代清' }) : null
        ]),
        h('div', { style: 'display:inline-flex;align-items:center;gap:4px;flex-wrap:nowrap;font-size:12px;color:#8a8f99;' }, [
          h('span', { style: 'white-space:nowrap;' }, `${role.server}/`),
          h(SchoolBadge, { school: role.school })
        ])
      ])
    }
  },
  { title: '副本名称', key: 'dungeonText', minWidth: 180, render: (row) => h('span', { style: 'white-space:nowrap;' }, row.dungeonText) },
  {
    title: '收入',
    key: 'income',
    minWidth: 90,
    sorter: 'default',
    sortOrder: activeSorter.value.columnKey === 'income' ? activeSorter.value.order : false,
    render: (row) => h(MoneyValue, { value: row.income })
  },
  {
    title: '支出',
    key: 'expense',
    minWidth: 90,
    sorter: 'default',
    sortOrder: activeSorter.value.columnKey === 'expense' ? activeSorter.value.order : false,
    render: (row) => h(MoneyValue, { value: row.expense })
  },
  {
    title: '收支小计',
    key: 'subtotal',
    minWidth: 100,
    sorter: 'default',
    sortOrder: activeSorter.value.columnKey === 'subtotal' ? activeSorter.value.order : false,
    render: (row) => h(MoneyValue, { value: row.subtotal })
  },
  {
    title: '团牌',
    key: 'groupBrand',
    minWidth: 80,
    render: (row) => {
      if (!row.groupBrand) return '-'
      if (!row.blacklisted) return row.groupBrand
      return h('div', { style: 'display:flex;flex-direction:column;gap:2px;' }, [
        h('span', { style: 'white-space:nowrap;' }, row.groupBrand),
        h(NTag, { type: 'error', size: 'small', style: 'flex-shrink:0;align-self:flex-start;' }, { default: () => '黑名单' })
      ])
    }
  },
  {
    title: '团长ID',
    key: 'leaderId',
    minWidth: 80,
    render: (row) => row.leaderId || '-'
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 80,
    render: (row) => row.remark || '-'
  },
  {
    title: '操作',
    key: 'actions',
    minWidth: 90,
    render: (row) =>
      h('div', { class: 'action-group', style: 'white-space:nowrap;' }, [
        h('button', { class: 'mini-btn', onClick: () => openEdit(row) }, '编辑'),
        h('button', { class: 'mini-btn danger', onClick: () => removeRecord(row.id) }, '删除')
      ])
  }
])

function handleSorterChange(sorter: DataTableSortState | DataTableSortState[] | null) {
  const target = Array.isArray(sorter) ? sorter[0] : sorter
  if (!target || !target.columnKey || !target.order) {
    activeSorter.value = { columnKey: null, order: false }
    return
  }
  if (target.columnKey === 'income' || target.columnKey === 'expense' || target.columnKey === 'subtotal') {
    activeSorter.value = {
      columnKey: target.columnKey,
      order: target.order
    }
  }
}
</script>

<style scoped>
/* 防止列标题在小屏下折行 */
:deep(.n-data-table-th__title) {
  white-space: nowrap;
}

.query-extra {
  margin-top: 8px;
}

.action-group {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  align-items: center;
}

.mini-btn {
  padding: 2px 10px;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
  color: inherit;
  transition: color 0.2s, border-color 0.2s;
}

.mini-btn:hover {
  border-color: #18a058;
  color: #18a058;
}

.mini-btn.danger {
  color: #d03050;
  border-color: #d03050;
}

.mini-btn.danger:hover {
  background: #fff1f0;
}

.compact-group-item :deep(.n-form-item-feedback-wrapper) {
  display: none !important;
}

.blacklist-hint {
  min-height: 24px;
  font-size: 12px;
  line-height: 24px;
  color: transparent;
  user-select: none;
}

.blacklist-hint.visible {
  color: #d03050;
}

.proxy-feedback {
  font-size: 12px;
  color: #d03050;
}
</style>
