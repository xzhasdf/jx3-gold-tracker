import { computed, ref } from 'vue'
import { DEFAULT_DUNGEONS, DIFFICULTY_OPTIONS, FIXED_DUNGEON_LABEL, PLAYER_OPTIONS, SCHOOLS, SERVERS } from '../constants/game'
import { DEFAULT_SPECIAL_DROPS } from '../utils/specialDrop'
import { loadState, saveState } from '../services/storage'
import { getCurrentMonthRange, getCurrentWeekRange, toYmd } from '../utils/date'
import { normalizePersonName } from '../utils/leader'
import type { Dungeon, RecordItem, Role, Season, SpecialDrop, StoreState, WineBuryItem } from '../types'

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const roles = ref<Role[]>([])
const dungeons = ref<Dungeon[]>([])
const dungeonOrder = ref<string[]>([])
const records = ref<RecordItem[]>([])
const columnConfig = ref<string[] | undefined>(undefined)
const wineBury = ref<WineBuryItem[]>([])
const specialDrops = ref<SpecialDrop[]>([])
const seasons = ref<Season[]>([])
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
function getDungeonGroupNames(dungeonList: Dungeon[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  dungeonList.forEach((d) => {
    if (!seen.has(d.name)) {
      seen.add(d.name)
      result.push(d.name)
    }
  })
  return result
}

interface OrderedDungeonGroup {
  name: string
  dungeons: Dungeon[]
  allHidden: boolean
}

const orderedDungeonGroups = computed<OrderedDungeonGroup[]>(() => {
  const groupMap = new Map<string, Dungeon[]>()
  dungeons.value.forEach((d) => {
    const list = groupMap.get(d.name) ?? []
    list.push(d)
    groupMap.set(d.name, list)
  })
  const groups = Array.from(groupMap.entries()).map(([name, list]) => ({
    name,
    dungeons: list,
    allHidden: list.every((d) => d.hidden)
  }))

  const orderIdx = new Map(dungeonOrder.value.map((n, i) => [n, i]))
  const visible = groups.filter((g) => !g.allHidden).sort((a, b) => {
    const ai = orderIdx.has(a.name) ? orderIdx.get(a.name)! : Number.POSITIVE_INFINITY
    const bi = orderIdx.has(b.name) ? orderIdx.get(b.name)! : Number.POSITIVE_INFINITY
    if (ai !== bi) return ai - bi
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  const hidden = groups.filter((g) => g.allHidden).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  return [...visible, ...hidden]
})

const dungeonOptions = computed(() => {
  const result: { label: string; value: string }[] = []
  orderedDungeonGroups.value.forEach((group) => {
    if (group.allHidden) return
    group.dungeons.filter((d) => !d.hidden).forEach((d) => {
      result.push({ label: `${d.players}${d.difficulty}${d.name}`, value: d.id })
    })
  })
  return result
})

function reconcileDungeonOrder() {
  const visibleNames: string[] = []
  const seen = new Set<string>()
  const groupHiddenMap = new Map<string, boolean>()
  dungeons.value.forEach((d) => {
    const groupAllHidden = groupHiddenMap.has(d.name)
      ? groupHiddenMap.get(d.name)!
      : (() => {
          const allHidden = dungeons.value.filter((x) => x.name === d.name).every((x) => x.hidden)
          groupHiddenMap.set(d.name, allHidden)
          return allHidden
        })()
    if (!seen.has(d.name)) {
      seen.add(d.name)
      if (!groupAllHidden) visibleNames.push(d.name)
    }
  })
  const visibleSet = new Set(visibleNames)
  const kept = dungeonOrder.value.filter((n) => visibleSet.has(n))
  const keptSet = new Set(kept)
  const appended = visibleNames.filter((n) => !keptSet.has(n))
  dungeonOrder.value = [...kept, ...appended]
}

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

  specialDrops.value = Array.isArray(state.specialDrops) ? state.specialDrops : []
  seasons.value = Array.isArray(state.seasons) ? state.seasons : []

  // 清理已从 DEFAULT_SPECIAL_DROPS 移除的旧默认条目
  const validDefaultNames = new Set(DEFAULT_SPECIAL_DROPS.map((d) => d.itemName))
  let dropsTouched = false
  const before = specialDrops.value.length
  specialDrops.value = specialDrops.value.filter((d) => !d.matchAll || validDefaultNames.has(d.itemName))
  if (specialDrops.value.length !== before) dropsTouched = true

  // 补齐缺失的默认通用掉落（按 itemName 匹配，置于列表前部）
  const missingDefaults = DEFAULT_SPECIAL_DROPS.filter(
    (d) => !specialDrops.value.some((existing) => existing.matchAll && existing.itemName === d.itemName)
  )
  if (missingDefaults.length > 0) {
    const seeded: SpecialDrop[] = missingDefaults.map((d) => ({
      id: makeId('drop_default'),
      dungeonPlayers: '10人',
      dungeonDifficulty: '普通',
      dungeonName: '通用',
      itemName: d.itemName,
      iconBase64: `preset:${d.iconKey}`,
      matchAll: true,
      ...(d.matchPlayers ? { matchPlayers: d.matchPlayers } : {}),
    }))
    specialDrops.value = [...seeded, ...specialDrops.value]
    dropsTouched = true
  }
  // 已存在的默认掉落，按最新配置补齐 matchPlayers 限制
  DEFAULT_SPECIAL_DROPS.forEach((def) => {
    if (!def.matchPlayers) return
    const existing = specialDrops.value.find((d) => d.matchAll && d.itemName === def.itemName)
    if (existing && existing.matchPlayers !== def.matchPlayers) {
      existing.matchPlayers = def.matchPlayers
      dropsTouched = true
    }
  })
  if (dropsTouched) persist()

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

  // 副本顺序：优先读持久化数据；缺失时根据现有 pinned + 字母序生成初始顺序（一次性迁移）
  if (Array.isArray(state.dungeonOrder)) {
    dungeonOrder.value = state.dungeonOrder.slice()
  } else {
    const groupNames = getDungeonGroupNames(dungeons.value)
    const visible = groupNames.filter((n) => !dungeons.value.filter((d) => d.name === n).every((d) => d.hidden))
    const pinnedNames = visible.filter((n) => dungeons.value.some((d) => d.name === n && d.pinned))
    const others = visible.filter((n) => !pinnedNames.includes(n)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
    dungeonOrder.value = [...pinnedNames, ...others]
    persist()
  }
  reconcileDungeonOrder()
}

function persist() {
  saveState({ roles: roles.value, dungeons: dungeons.value, records: records.value, columnConfig: columnConfig.value, wineBury: wineBury.value, dungeonOrder: dungeonOrder.value, specialDrops: specialDrops.value, seasons: seasons.value })
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

function setRoleOrder(orderedIds: string[]): { ok: boolean } {
  const idSet = new Set(orderedIds)
  const ordered = orderedIds.map((id) => roles.value.find((r) => r.id === id)).filter(Boolean) as Role[]
  const rest = roles.value.filter((r) => !idSet.has(r.id))
  roles.value = [...ordered, ...rest]
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
  reconcileDungeonOrder()
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
  reconcileDungeonOrder()
  persist()
  return { ok: true }
}

function deleteDungeon(id: string): { ok: boolean; message?: string } {
  dungeons.value = dungeons.value.filter((d) => d.id !== id)
  reconcileDungeonOrder()
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
  reconcileDungeonOrder()
  persist()
  return { ok: true }
}

function hideDungeon(id: string): { ok: boolean; message?: string } {
  const target = dungeons.value.find((d) => d.id === id)
  if (!target) return { ok: false, message: '副本不存在' }
  target.hidden = true
  reconcileDungeonOrder()
  persist()
  return { ok: true }
}

function unhideDungeon(id: string): { ok: boolean; message?: string } {
  const target = dungeons.value.find((d) => d.id === id)
  if (!target) return { ok: false, message: '副本不存在' }
  target.hidden = false
  reconcileDungeonOrder()
  persist()
  return { ok: true }
}

function setDungeonOrder(orderedNames: string[]): { ok: boolean } {
  const visibleSet = new Set(
    dungeonOrder.value
  )
  // 仅接受当前可见组中的名称，过滤掉非法项
  dungeonOrder.value = orderedNames.filter((n) => visibleSet.has(n))
  reconcileDungeonOrder()
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
  specialDropIds?: string[]
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
    leaderId: normalizePersonName(payload.leaderId) || undefined,
    remark: payload.remark?.trim() || undefined,
    blacklisted: Boolean(payload.blacklisted),
    blackPerson: normalizePersonName(payload.blackPerson) || undefined,
    specialDropIds: payload.specialDropIds && payload.specialDropIds.length > 0 ? payload.specialDropIds.slice() : undefined
  })
  persist()
}

function updateRecord(
  id: string,
  payload: { date?: string; roleId?: string; dungeonId?: string; income: number; expense: number; groupBrand?: string; leaderId?: string; remark?: string; blacklisted?: boolean; blackPerson?: string; specialDropIds?: string[] }
) {
  const target = records.value.find((r) => r.id === id)
  if (!target) return
  if (payload.date) target.date = payload.date
  if (payload.roleId) target.roleId = payload.roleId
  if (payload.dungeonId) target.dungeonId = payload.dungeonId
  target.income = payload.income
  target.expense = payload.expense
  target.groupBrand = payload.groupBrand?.trim() || undefined
  target.leaderId = normalizePersonName(payload.leaderId) || undefined
  target.remark = payload.remark?.trim() || undefined
  target.blacklisted = Boolean(payload.blacklisted)
  target.blackPerson = normalizePersonName(payload.blackPerson) || undefined
  target.specialDropIds = payload.specialDropIds && payload.specialDropIds.length > 0 ? payload.specialDropIds.slice() : undefined
  persist()
}

function deleteRecord(id: string) {
  records.value = records.value.filter((r) => r.id !== id)
  persist()
}

function addSpecialDrop(payload: Omit<SpecialDrop, 'id'>): { ok: boolean; message?: string } {
  const itemName = payload.itemName.trim()
  const dungeonName = payload.dungeonName.trim()
  if (!dungeonName) return { ok: false, message: '副本名称不能为空' }
  if (!itemName) return { ok: false, message: '掉落名称不能为空' }
  specialDrops.value.push({
    id: makeId('drop'),
    dungeonPlayers: payload.dungeonPlayers,
    dungeonDifficulty: payload.dungeonDifficulty,
    dungeonName,
    itemName,
    iconBase64: payload.iconBase64
  })
  persist()
  return { ok: true }
}

function deleteSpecialDrop(id: string): { ok: boolean; message?: string } {
  const target = specialDrops.value.find((d) => d.id === id)
  if (!target) return { ok: false }
  if (target.matchAll) return { ok: false, message: '默认掉落不可删除' }
  specialDrops.value = specialDrops.value.filter((d) => d.id !== id)
  persist()
  return { ok: true }
}

function updateSpecialDrop(id: string, payload: Omit<SpecialDrop, 'id'>): { ok: boolean; message?: string } {
  const target = specialDrops.value.find((d) => d.id === id)
  if (!target) return { ok: false, message: '掉落不存在' }
  if (target.matchAll) return { ok: false, message: '默认掉落不可编辑' }
  const itemName = payload.itemName.trim()
  const dungeonName = payload.dungeonName.trim()
  if (!dungeonName) return { ok: false, message: '副本名称不能为空' }
  if (!itemName) return { ok: false, message: '掉落名称不能为空' }
  target.dungeonPlayers = payload.dungeonPlayers
  target.dungeonDifficulty = payload.dungeonDifficulty
  target.dungeonName = dungeonName
  target.itemName = itemName
  target.iconBase64 = payload.iconBase64
  persist()
  return { ok: true }
}

function setColumnConfig(keys: string[]) {
  columnConfig.value = keys
  persist()
}

function addSeason(payload: { name: string; startTs: number; endTs: number }): { ok: boolean; message?: string } {
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '赛季名称不能为空' }
  if (seasons.value.some((s) => s.name === name)) return { ok: false, message: '赛季名称已存在' }
  if (!Number.isFinite(payload.startTs) || !Number.isFinite(payload.endTs)) return { ok: false, message: '请选择起止时间' }
  if (payload.startTs > payload.endTs) return { ok: false, message: '开始时间不能晚于结束时间' }
  seasons.value.push({ id: makeId('season'), name, startTs: payload.startTs, endTs: payload.endTs })
  persist()
  return { ok: true }
}

function updateSeason(id: string, payload: { name: string; startTs: number; endTs: number }): { ok: boolean; message?: string } {
  const target = seasons.value.find((s) => s.id === id)
  if (!target) return { ok: false, message: '赛季不存在' }
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '赛季名称不能为空' }
  if (seasons.value.some((s) => s.name === name && s.id !== id)) return { ok: false, message: '赛季名称已存在' }
  if (!Number.isFinite(payload.startTs) || !Number.isFinite(payload.endTs)) return { ok: false, message: '请选择起止时间' }
  if (payload.startTs > payload.endTs) return { ok: false, message: '开始时间不能晚于结束时间' }
  target.name = name
  target.startTs = payload.startTs
  target.endTs = payload.endTs
  persist()
  return { ok: true }
}

function deleteSeason(id: string): { ok: boolean } {
  seasons.value = seasons.value.filter((s) => s.id !== id)
  persist()
  return { ok: true }
}

const FREQUENT_GROUP_BRAND_THRESHOLD = 5

const frequentGroupBrands = computed(() => {
  const counter = new Map<string, number>()
  records.value.forEach((r) => {
    const brand = r.groupBrand?.trim()
    if (!brand) return
    counter.set(brand, (counter.get(brand) ?? 0) + 1)
  })
  return Array.from(counter.entries())
    .filter(([, count]) => count >= FREQUENT_GROUP_BRAND_THRESHOLD)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .map(([brand]) => brand)
})

function getLeadersForBrand(brand: string): string[] {
  const trimmed = brand.trim()
  if (!trimmed) return []
  const set = new Set<string>()
  records.value.forEach((r) => {
    if (r.groupBrand?.trim() === trimmed) {
      const lid = normalizePersonName(r.leaderId)
      if (lid) set.add(lid)
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
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
  specialDrops.value = Array.isArray(state.specialDrops) ? state.specialDrops : []
  seasons.value = Array.isArray(state.seasons) ? state.seasons : []
  dungeonOrder.value = Array.isArray(state.dungeonOrder) ? state.dungeonOrder.slice() : []
  reconcileDungeonOrder()
  persist()
}

function getGroupBrandRoster() {
  const map = new Map<string, { blacklisted: boolean; leaders: Set<string> }>()
  records.value.forEach((record) => {
    const groupBrand = record.groupBrand?.trim()
    if (!groupBrand) return
    const leaderId = normalizePersonName(record.leaderId) || '-'
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
      if (kw) {
        const brand = (r.groupBrand ?? '').toLowerCase()
        const leader = normalizePersonName(r.leaderId).toLowerCase()
        const black = normalizePersonName(r.blackPerson).toLowerCase()
        if (!brand.includes(kw) && !leader.includes(kw) && !black.includes(kw)) return false
      }
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => {
      const role = roleMap.value.get(r.roleId)
      const dungeon = dungeonMap.value.get(r.dungeonId)
      return {
        ...r,
        leaderId: normalizePersonName(r.leaderId) || undefined,
        blackPerson: normalizePersonName(r.blackPerson) || undefined,
        roleText: role ? `${role.id}（${role.server}/${role.school}）` : '已删除角色',
        dungeonText: FIXED_DUNGEON_LABEL[r.dungeonId] ?? (dungeon ? `${dungeon.players}${dungeon.difficulty}${dungeon.name}` : '副本已删除'),
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
    specialDrops,
    addSpecialDrop,
    deleteSpecialDrop,
    updateSpecialDrop,
    seasons,
    addSeason,
    updateSeason,
    deleteSeason,
    frequentGroupBrands,
    getLeadersForBrand,
    persist,
    addRole,
    updateRole,
    deleteRole,
    toggleRoleCdIgnore,
    moveRole,
    setRoleOrder,
    addDungeon,
    updateDungeon,
    deleteDungeon,
    toggleDungeonFollow,
    toggleDungeonHidden,
    hideDungeon,
    unhideDungeon,
    setDungeonOrder,
    orderedDungeonGroups,
    dungeonOrder,
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
