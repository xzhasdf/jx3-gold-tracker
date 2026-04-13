import { computed, ref } from 'vue'
import { DEFAULT_DUNGEONS, DIFFICULTY_OPTIONS, FIXED_DUNGEON_LABEL, PLAYER_OPTIONS, SCHOOLS, SERVERS } from '../constants/game'
import { loadState, saveState } from '../services/storage'
import { getCurrentMonthRange, getCurrentWeekRange, toYmd } from '../utils/date'
import type { Dungeon, RecordItem, Role, StoreState, WineBuryItem } from '../types'

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const roles = ref<Role[]>([])
const dungeons = ref<Dungeon[]>([])
const records = ref<RecordItem[]>([])
const columnConfig = ref<string[] | undefined>(undefined)
const wineBury = ref<WineBuryItem[]>([])
const newlyAddedRoleIds = ref<Set<string>>(new Set())

const roleMap = computed(() => new Map(roles.value.map((r) => [r.id, r])))
const dungeonMap = computed(() => new Map(dungeons.value.map((d) => [d.id, d])))

const roleOptions = computed(() => roles.value.map((r) => ({ label: `${r.id}（${r.server}/${r.school}）`, value: r.id })))
const roleOptionsForAddRecord = computed(() => {
  const pinned: { label: string; value: string }[] = []
  const normal: { label: string; value: string }[] = []
  roles.value.forEach((r) => {
    const baseLabel = `${r.id}（${r.server}/${r.school}）`
    if (newlyAddedRoleIds.value.has(r.id)) {
      pinned.push({ label: `${baseLabel}【新增】`, value: r.id })
      return
    }
    normal.push({ label: baseLabel, value: r.id })
  })
  return [...pinned, ...normal]
})
const dungeonOptions = computed(() => dungeons.value.filter((d) => !d.hidden).map((d) => ({ label: `${d.players}${d.difficulty}${d.name}`, value: d.id })))

function normalizeRole(input: Role): Role {
  return {
    ...input,
    isProxyClear: Boolean((input as Partial<Role>).isProxyClear),
    wageRatio: Number.isFinite((input as Partial<Role>).wageRatio)
      ? Math.min(100, Math.max(0, Number((input as Partial<Role>).wageRatio)))
      : 100,
    ignoreCd: Boolean((input as Partial<Role>).ignoreCd)
  }
}

function init() {
  const state = loadState()
  roles.value = state.roles.map((role) => normalizeRole(role))
  dungeons.value = state.dungeons.map((dungeon) => ({
    ...dungeon,
    followed: Boolean((dungeon as Partial<Dungeon>).followed)
  }))
  records.value = state.records
  columnConfig.value = state.columnConfig

  // 藏酒数据：优先从主数据读取，回退从 localStorage 迁移
  if (state.wineBury && state.wineBury.length > 0) {
    wineBury.value = state.wineBury
  } else {
    try {
      const raw = localStorage.getItem('jx3_wine_bury')
      if (raw) {
        wineBury.value = JSON.parse(raw)
        persist()  // 迁移后立即写入主数据
      }
    } catch { /* ignore */ }
  }

  if (dungeons.value.length === 0) {
    dungeons.value = DEFAULT_DUNGEONS.map((item) => ({
      id: makeId('dungeon_default'),
      players: item.players,
      difficulty: item.difficulty,
      name: item.name,
      followed: false
    }))
    persist()
  }
}

function persist() {
  saveState({ roles: roles.value, dungeons: dungeons.value, records: records.value, columnConfig: columnConfig.value, wineBury: wineBury.value })
}

function addRole(payload: Role): { ok: boolean; message?: string } {
  const id = payload.id.trim()
  if (!id) return { ok: false, message: '角色ID不能为空' }
  if (roles.value.some((r) => r.id === id)) return { ok: false, message: '角色ID已存在' }
  roles.value.push(normalizeRole({ ...payload, id }))
  newlyAddedRoleIds.value.add(id)
  persist()
  return { ok: true }
}

function updateRole(
  oldId: string,
  nextId: string,
  server: string,
  school: string,
  isProxyClear: boolean,
  wageRatio: number
): { ok: boolean; message?: string } {
  const target = roles.value.find((r) => r.id === oldId)
  if (!target) return { ok: false, message: '角色不存在' }
  const id = nextId.trim()
  if (!id) return { ok: false, message: '角色ID不能为空' }
  if (id !== oldId && roles.value.some((r) => r.id === id)) {
    return { ok: false, message: '角色ID已存在' }
  }

  target.id = id
  target.server = server
  target.school = school
  target.isProxyClear = Boolean(isProxyClear)
  target.wageRatio = target.isProxyClear ? Math.min(100, Math.max(0, Number(wageRatio) || 0)) : 100
  if (id !== oldId) {
    records.value.forEach((record) => {
      if (record.roleId === oldId) {
        record.roleId = id
      }
    })
    if (newlyAddedRoleIds.value.has(oldId)) {
      newlyAddedRoleIds.value.delete(oldId)
      newlyAddedRoleIds.value.add(id)
    }
  }
  persist()
  return { ok: true }
}

function deleteRole(id: string): { ok: boolean; message?: string } {
  if (records.value.some((r) => r.roleId === id)) {
    return { ok: false, message: '该角色已有关联收支记录，无法删除' }
  }
  roles.value = roles.value.filter((r) => r.id !== id)
  persist()
  return { ok: true }
}

function toggleRoleCdIgnore(id: string): { ok: boolean; message?: string } {
  const target = roles.value.find((r) => r.id === id)
  if (!target) return { ok: false, message: '角色不存在' }
  target.ignoreCd = !target.ignoreCd
  persist()
  return { ok: true }
}

function moveRole(id: string, direction: 'up' | 'down'): { ok: boolean } {
  const idx = roles.value.findIndex((r) => r.id === id)
  if (idx < 0) return { ok: false }
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= roles.value.length) return { ok: false }
  const temp = roles.value[idx]
  roles.value[idx] = roles.value[targetIdx]
  roles.value[targetIdx] = temp
  roles.value = [...roles.value]
  persist()
  return { ok: true }
}

function addDungeon(payload: Omit<Dungeon, 'id' | 'followed'>): { ok: boolean; message?: string } {
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '副本名称不能为空' }
  dungeons.value.push({ ...payload, name, id: makeId('dungeon'), followed: false })
  persist()
  return { ok: true }
}

function updateDungeon(id: string, payload: Omit<Dungeon, 'id' | 'followed'>): { ok: boolean; message?: string } {
  const target = dungeons.value.find((d) => d.id === id)
  if (!target) return { ok: false, message: '副本不存在' }
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '副本名称不能为空' }
  target.players = payload.players
  target.difficulty = payload.difficulty
  target.name = name
  persist()
  return { ok: true }
}

function deleteDungeon(id: string): { ok: boolean; message?: string } {
  if (records.value.some((r) => r.dungeonId === id)) {
    return { ok: false, message: '该副本已有关联收支记录，无法删除' }
  }
  dungeons.value = dungeons.value.filter((d) => d.id !== id)
  persist()
  return { ok: true }
}

function toggleDungeonFollow(id: string): { ok: boolean; message?: string } {
  const target = dungeons.value.find((d) => d.id === id)
  if (!target) return { ok: false, message: '副本不存在' }
  target.followed = !target.followed
  persist()
  return { ok: true }
}

function toggleDungeonHidden(name: string): { ok: boolean; message?: string } {
  const group = dungeons.value.filter((d) => d.name === name)
  if (group.length === 0) return { ok: false, message: '副本不存在' }
  const isHidden = group.every((d) => d.hidden)
  group.forEach((d) => { d.hidden = !isHidden })
  // 隐藏时取消置顶
  if (!isHidden) {
    group.forEach((d) => { d.pinned = false })
  }
  persist()
  return { ok: true }
}

function toggleDungeonPinned(name: string): { ok: boolean; message?: string } {
  const group = dungeons.value.filter((d) => d.name === name)
  if (group.length === 0) return { ok: false, message: '副本不存在' }
  const isPinned = group.some((d) => d.pinned)
  // 先取消所有置顶
  dungeons.value.forEach((d) => { d.pinned = false })
  // 如果之前没置顶，则置顶该组
  if (!isPinned) {
    group.forEach((d) => { d.pinned = true })
  }
  persist()
  return { ok: true }
}

function addRecord(payload: {
  roleId: string
  dungeonId: string
  dateTs: number
  income: number
  expense: number
  groupBrand?: string
  leaderId?: string
  remark?: string
  blacklisted?: boolean
  blackPerson?: string
}) {
  records.value.push({
    id: makeId('record'),
    roleId: payload.roleId,
    dungeonId: payload.dungeonId,
    date: toYmd(payload.dateTs),
    createdAt: Date.now(),
    income: payload.income,
    expense: payload.expense,
    groupBrand: payload.groupBrand?.trim() || undefined,
    leaderId: payload.leaderId?.trim() || undefined,
    remark: payload.remark?.trim() || undefined,
    blacklisted: Boolean(payload.blacklisted),
    blackPerson: payload.blackPerson?.trim() || undefined
  })
  persist()
}

function updateRecord(
  id: string,
  payload: { date?: string; roleId?: string; dungeonId?: string; income: number; expense: number; groupBrand?: string; leaderId?: string; remark?: string; blacklisted?: boolean; blackPerson?: string }
) {
  const target = records.value.find((r) => r.id === id)
  if (!target) return
  if (payload.date) target.date = payload.date
  if (payload.roleId) target.roleId = payload.roleId
  if (payload.dungeonId) target.dungeonId = payload.dungeonId
  target.income = payload.income
  target.expense = payload.expense
  target.groupBrand = payload.groupBrand?.trim() || undefined
  target.leaderId = payload.leaderId?.trim() || undefined
  target.remark = payload.remark?.trim() || undefined
  target.blacklisted = Boolean(payload.blacklisted)
  target.blackPerson = payload.blackPerson?.trim() || undefined
  persist()
}

function deleteRecord(id: string) {
  records.value = records.value.filter((r) => r.id !== id)
  persist()
}

function setColumnConfig(keys: string[]) {
  columnConfig.value = keys
  persist()
}

function importState(state: StoreState) {
  roles.value = (Array.isArray(state.roles) ? state.roles : []).map(normalizeRole)
  dungeons.value = (Array.isArray(state.dungeons) ? state.dungeons : []).map((dungeon: Dungeon) => ({
    ...dungeon,
    followed: Boolean((dungeon as Partial<Dungeon>).followed)
  }))
  records.value = Array.isArray(state.records) ? state.records : []
  columnConfig.value = Array.isArray(state.columnConfig) ? state.columnConfig : undefined
  wineBury.value = Array.isArray(state.wineBury) ? state.wineBury : []
  persist()
}

function getGroupBrandRoster() {
  const map = new Map<string, { blacklisted: boolean; leaders: Set<string> }>()
  records.value.forEach((record) => {
    const groupBrand = record.groupBrand?.trim()
    if (!groupBrand) return
    const leaderId = record.leaderId?.trim() || '-'
    const entry = map.get(groupBrand) ?? { blacklisted: false, leaders: new Set<string>() }
    entry.leaders.add(leaderId)
    if (record.blacklisted) entry.blacklisted = true
    map.set(groupBrand, entry)
  })
  const result: { groupBrand: string; leaderId: string; blacklisted: boolean }[] = []
  Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .forEach(([groupBrand, { blacklisted, leaders }]) => {
      Array.from(leaders).sort().forEach((leaderId) => {
        result.push({ groupBrand, leaderId, blacklisted })
      })
    })
  return result
}

function queryRecords(filters: { roleId: string | null; dungeonId: string | null; range: [number, number] | null; keyword?: string }) {
  const [start, end] = filters.range ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  const kw = filters.keyword?.trim().toLowerCase() ?? ''
  return records.value
    .filter((r) => {
      const t = new Date(`${r.date}T00:00:00`).getTime()
      if (filters.roleId && r.roleId !== filters.roleId) return false
      if (filters.dungeonId && r.dungeonId !== filters.dungeonId) return false
      if (t < start || t > end) return false
      if (kw && !(r.groupBrand ?? '').toLowerCase().includes(kw) && !(r.leaderId ?? '').toLowerCase().includes(kw) && !(r.blackPerson ?? '').toLowerCase().includes(kw)) return false
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => {
      const role = roleMap.value.get(r.roleId)
      const dungeon = dungeonMap.value.get(r.dungeonId)
      return {
        ...r,
        roleText: role ? `${role.id}（${role.server}/${role.school}）` : '已删除角色',
        dungeonText: FIXED_DUNGEON_LABEL[r.dungeonId] ?? (dungeon ? `${dungeon.players}${dungeon.difficulty}${dungeon.name}` : '已删除副本'),
        subtotal: r.income - r.expense
      }
    })
}

function getWeeklyCdStatusByRole() {
  const [weekMondayStart] = getCurrentWeekRange()
  const now = new Date()
  const nowTs = now.getTime()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  let mondayResetAt = weekMondayStart + 7 * 60 * 60 * 1000
  if (nowTs < mondayResetAt) {
    mondayResetAt -= 7 * dayMs
  }

  const fridayResetAt = mondayResetAt + 4 * dayMs
  const tenPlayerStart = nowTs >= fridayResetAt ? fridayResetAt : mondayResetAt
  const allDungeons = dungeons.value
  const allIdSet = new Set(allDungeons.map((d) => d.id))
  const cdStartByDungeon = new Map<string, number>(
    allDungeons.map((dungeon) => [dungeon.id, dungeon.players === '10人' ? tenPlayerStart : mondayResetAt])
  )
  const clearedByRole = new Map<string, Set<string>>()

  records.value.forEach((record) => {
    if (!allIdSet.has(record.dungeonId)) return
    const cdStart = cdStartByDungeon.get(record.dungeonId) ?? mondayResetAt
    // 有精确时间戳用精确比较，历史数据回退到日期级别比较
    if (record.createdAt) {
      if (record.createdAt > nowTs) return
      if (record.createdAt < cdStart) return
    } else {
      const recordDay = new Date(`${record.date}T00:00:00`).getTime()
      const cdStartD = new Date(cdStart)
      const cdStartDay = new Date(cdStartD.getFullYear(), cdStartD.getMonth(), cdStartD.getDate()).getTime()
      if (recordDay > todayEnd) return
      if (recordDay < cdStartDay) return
    }
    const dungeonSet = clearedByRole.get(record.roleId) ?? new Set<string>()
    dungeonSet.add(record.dungeonId)
    clearedByRole.set(record.roleId, dungeonSet)
  })

  return roles.value.filter((role) => !role.ignoreCd).map((role) => {
    const clearedSet = clearedByRole.get(role.id) ?? new Set<string>()
    const dungeons = allDungeons.map((dungeon) => ({
      dungeonId: dungeon.id,
      dungeonName: `${dungeon.players}${dungeon.difficulty}${dungeon.name}`,
      cleared: clearedSet.has(dungeon.id)
    }))
    return {
      roleId: role.id,
      roleServer: role.server,
      roleSchool: role.school,
      total: dungeons.length,
      cleared: dungeons.filter((item) => item.cleared).length,
      dungeons
    }
  })
}

export function useTracker() {
  if (roles.value.length === 0 && dungeons.value.length === 0 && records.value.length === 0) {
    init()
  }

  return {
    schools: SCHOOLS,
    servers: SERVERS,
    playerTypes: PLAYER_OPTIONS,
    difficultyTypes: DIFFICULTY_OPTIONS,
    roles,
    dungeons,
    records,
    roleOptions,
    roleOptionsForAddRecord,
    dungeonOptions,
    columnConfig,
    setColumnConfig,
    wineBury,
    persist,
    addRole,
    updateRole,
    deleteRole,
    toggleRoleCdIgnore,
    moveRole,
    addDungeon,
    updateDungeon,
    deleteDungeon,
    toggleDungeonFollow,
    toggleDungeonHidden,
    toggleDungeonPinned,
    addRecord,
    updateRecord,
    deleteRecord,
    importState,
    getGroupBrandRoster,
    queryRecords,
    getWeeklyCdStatusByRole,
    getCurrentMonthRange,
    getCurrentWeekRange
  }
}
