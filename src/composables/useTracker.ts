import { computed, ref } from 'vue'
import { DEFAULT_DUNGEONS, DIFFICULTY_OPTIONS, FIXED_DUNGEON_LABEL, PLAYER_OPTIONS, SCHOOLS, SERVERS } from '../constants/game'
import { loadState, saveState } from '../services/storage'
import { getCurrentMonthRange, getCurrentWeekRange, toYmd } from '../utils/date'
import type { Dungeon, RecordItem, Role, StoreState } from '../types'

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const roles = ref<Role[]>([])
const dungeons = ref<Dungeon[]>([])
const records = ref<RecordItem[]>([])
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
const dungeonOptions = computed(() => dungeons.value.map((d) => ({ label: `${d.players}${d.difficulty}${d.name}`, value: d.id })))

function normalizeRole(input: Role): Role {
  return {
    ...input,
    isProxyClear: Boolean((input as Partial<Role>).isProxyClear),
    wageRatio: Number.isFinite((input as Partial<Role>).wageRatio)
      ? Math.min(100, Math.max(0, Number((input as Partial<Role>).wageRatio)))
      : 100
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
  saveState({ roles: roles.value, dungeons: dungeons.value, records: records.value })
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
}) {
  records.value.push({
    id: makeId('record'),
    roleId: payload.roleId,
    dungeonId: payload.dungeonId,
    date: toYmd(payload.dateTs),
    income: payload.income,
    expense: payload.expense,
    groupBrand: payload.groupBrand?.trim() || undefined,
    leaderId: payload.leaderId?.trim() || undefined,
    remark: payload.remark?.trim() || undefined,
    blacklisted: Boolean(payload.blacklisted)
  })
  persist()
}

function updateRecord(
  id: string,
  payload: { income: number; expense: number; groupBrand?: string; leaderId?: string; remark?: string; blacklisted?: boolean }
) {
  const target = records.value.find((r) => r.id === id)
  if (!target) return
  target.income = payload.income
  target.expense = payload.expense
  target.groupBrand = payload.groupBrand?.trim() || undefined
  target.leaderId = payload.leaderId?.trim() || undefined
  target.remark = payload.remark?.trim() || undefined
  target.blacklisted = Boolean(payload.blacklisted)
  persist()
}

function deleteRecord(id: string) {
  records.value = records.value.filter((r) => r.id !== id)
  persist()
}

function importState(state: StoreState) {
  roles.value = (Array.isArray(state.roles) ? state.roles : []).map(normalizeRole)
  dungeons.value = (Array.isArray(state.dungeons) ? state.dungeons : []).map((dungeon: Dungeon) => ({
    ...dungeon,
    followed: Boolean((dungeon as Partial<Dungeon>).followed)
  }))
  records.value = Array.isArray(state.records) ? state.records : []
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

function queryRecords(filters: { roleId: string | null; dungeonId: string | null; range: [number, number] | null }) {
  const [start, end] = filters.range ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  return records.value
    .filter((r) => {
      const t = new Date(`${r.date}T00:00:00`).getTime()
      if (filters.roleId && r.roleId !== filters.roleId) return false
      if (filters.dungeonId && r.dungeonId !== filters.dungeonId) return false
      if (t < start || t > end) return false
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
  const focusedDungeons = dungeons.value.filter((d) => d.followed)
  const focusedIdSet = new Set(focusedDungeons.map((d) => d.id))
  const cdStartByDungeon = new Map<string, number>(
    focusedDungeons.map((dungeon) => [dungeon.id, dungeon.players === '10人' ? tenPlayerStart : mondayResetAt])
  )
  const clearedByRole = new Map<string, Set<string>>()

  records.value.forEach((record) => {
    if (!focusedIdSet.has(record.dungeonId)) return
    const ts = new Date(`${record.date}T00:00:00`).getTime()
    if (ts > todayEnd) return
    const cdStart = cdStartByDungeon.get(record.dungeonId) ?? mondayResetAt
    if (ts < cdStart) return
    const dungeonSet = clearedByRole.get(record.roleId) ?? new Set<string>()
    dungeonSet.add(record.dungeonId)
    clearedByRole.set(record.roleId, dungeonSet)
  })

  return roles.value.map((role) => {
    const clearedSet = clearedByRole.get(role.id) ?? new Set<string>()
    const dungeons = focusedDungeons.map((dungeon) => ({
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
    addRole,
    updateRole,
    deleteRole,
    addDungeon,
    updateDungeon,
    deleteDungeon,
    toggleDungeonFollow,
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
