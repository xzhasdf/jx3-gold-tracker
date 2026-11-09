import { computed, ref } from 'vue'
import { DEFAULT_DUNGEONS, DEFAULT_SEASONS, DIFFICULTY_OPTIONS, FIXED_DUNGEON_LABEL, PLAYER_OPTIONS, SCHOOLS, SERVERS } from '../constants/game'
import { DEFAULT_DUNGEON_DROPS, DEFAULT_SPECIAL_DROPS } from '../utils/specialDrop'
import { BUFF_DEFS, BUFF_EXPANSIONS, DEFAULT_BUFF_EXPANSION, LEGACY_BUFF_EXPANSION, type BuffStat } from '../constants/buffCalc'
import { EQUIP_TYPES, LONG_USE_LINK_DEFAULT_MAX, LONG_USE_LINK_MIN, LONG_USE_LINK_STEP } from '../constants/equip'
import { loadState, saveState } from '../services/storage'
import { getCurrentMonthRange, getCurrentWeekRange, toYmd, WEEK_RESET_HOUR } from '../utils/date'
import { normalizePersonName } from '../utils/leader'
import type { BuffCalcState, Dungeon, GroupBrand, LongUseItem, LongUseLinkSettings, RecordItem, Role, Season, SpecialDrop, StoreState, WineBuryItem } from '../types'

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const roles = ref<Role[]>([])
const dungeons = ref<Dungeon[]>([])
const dungeonOrder = ref<string[]>([])
const defaultDungeonName = ref<string | undefined>(undefined)
const records = ref<RecordItem[]>([])
const columnConfig = ref<string[] | undefined>(undefined)
const wineBury = ref<WineBuryItem[]>([])
const specialDrops = ref<SpecialDrop[]>([])
const seasons = ref<Season[]>([])
const groupBrands = ref<GroupBrand[]>([])
const buffCalc = ref<BuffCalcState>(normalizeBuffCalc(undefined))
const longUse = ref<LongUseItem[]>([])
const longUseLink = ref<LongUseLinkSettings>(normalizeLongUseLink(undefined))
const seededDungeons = ref<string[]>([])
const seededSeasons = ref<string[]>([])
const seededDrops = ref<string[]>([])
// 分钟级时钟：依赖「当前时间」的计算（如每周 CD 是否已重置）读取它，跨过重置点后自动重算
const nowMinute = ref(Date.now())
if (typeof window !== 'undefined') window.setInterval(() => { nowMinute.value = Date.now() }, 60 * 1000)
const newlyAddedRoleIds = ref<Set<string>>(new Set())

function positiveInt(v: unknown): number {
  const n = Math.floor(Number(v))
  return n > 0 ? n : 0
}

// 与默认值合并：后续版本新增的 buff 自动补齐默认数值。
// 例外：130 级（lv130:）物品曾以 0 作为「数值未知」的占位默认值并被存下，补数据后存的 0 改用新默认值；
// 其余 buff 存的 0 视为用户有意设置，保留
function mergeBuffValues(saved?: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = Object.fromEntries(BUFF_DEFS.map((d) => [d.key, d.defaultValue]))
  Object.entries(saved ?? {}).forEach(([key, value]) => {
    if (key.startsWith('lv130:') && Number(value) === 0 && (merged[key] ?? 0) > 0) return
    merged[key] = value
  })
  return merged
}

function normalizeBuffCalc(input?: Partial<BuffCalcState> | null): BuffCalcState {
  const savedUnits = input?.units ?? {}
  const units: BuffCalcState['units'] = {}
  BUFF_EXPANSIONS.forEach((exp) => {
    const saved = savedUnits[exp.key]
    // 旧数据只有一组 unitSpirit/unitVitality，归属到暗影千机
    const legacy = exp.key === LEGACY_BUFF_EXPANSION ? { spirit: input?.unitSpirit, vitality: input?.unitVitality } : undefined
    units[exp.key] = {
      spirit: positiveInt(saved?.spirit) || positiveInt(legacy?.spirit) || (exp.unitDefaults.spirit ?? 0),
      vitality: positiveInt(saved?.vitality) || positiveInt(legacy?.vitality) || (exp.unitDefaults.vitality ?? 0)
    }
  })
  return {
    showPrevExpansion: Boolean(input?.showPrevExpansion),
    units,
    buffValues: mergeBuffValues(input?.buffValues),
    buffDefaults: { ...(input?.buffDefaults ?? {}) },
    roleBase: { ...(input?.roleBase ?? {}) },
    roleSelected: { ...(input?.roleSelected ?? {}) }
  }
}

const roleMap = computed(() => new Map(roles.value.map((r) => [r.id, r])))
const dungeonMap = computed(() => new Map(dungeons.value.map((d) => [d.id, d])))
const groupBrandMap = computed(() => new Map(groupBrands.value.map((b) => [b.name, b])))

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
  seededSeasons.value = Array.isArray(state.seededSeasons) ? state.seededSeasons.slice() : []
  const seasonsTouched = seedDefaultSeasons()
  buffCalc.value = normalizeBuffCalc(state.buffCalc)
  longUse.value = Array.isArray(state.longUse) ? state.longUse : []
  longUseLink.value = normalizeLongUseLink(state.longUseLink)

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

  seededDrops.value = Array.isArray(state.seededDrops) ? state.seededDrops.slice() : []
  if (seedDefaultDungeonDrops()) dropsTouched = true

  if (dedupeSpecialDropsAndRemapRecords()) dropsTouched = true

  seededDungeons.value = Array.isArray(state.seededDungeons) ? state.seededDungeons.slice() : []
  const dungeonsTouched = seedDefaultDungeons()
  defaultDungeonName.value = state.defaultDungeonName

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

  // 团牌数据：优先读持久化数据；缺失时从历史记录中提取（一次性迁移）
  // 注意：必须放在 dungeonOrder 加载之后，避免迁移时把未加载完的状态写回磁盘
  let brandsTouched = false
  if (Array.isArray(state.groupBrands)) {
    groupBrands.value = state.groupBrands
  } else {
    groupBrands.value = seedGroupBrandsFromRecords(records.value)
    brandsTouched = true
  }

  // 各类迁移统一在状态全部加载完成后落盘
  if (dropsTouched || brandsTouched || dungeonsTouched || seasonsTouched) persist()
}

// 补齐默认副本：每个「副本名|人数|难度」组合只补一次（记入 seededDungeons）。
// 用户已自建的组合跳过，只补缺的；补过之后用户再删掉也不会补回。
// 新资料片只需改 DEFAULT_DUNGEONS；给已有副本追加难度（如后续开放挑战）同样会自动补给老用户。
function dungeonSeedKey(item: { name: string; players: string; difficulty: string }): string {
  return `${item.name}|${item.players}|${item.difficulty}`
}

// 补齐内置副本掉落：作为普通掉落（可编辑删除）加入，每项只补一次；已有同名掉落就跳过只记标记
function seedDefaultDungeonDrops(): boolean {
  const done = new Set(seededDrops.value)
  const keyOf = (d: { dungeonName: string; itemName: string }) => `${d.dungeonName}|${d.itemName}`
  const pending = DEFAULT_DUNGEON_DROPS.filter((d) => !done.has(keyOf(d)))
  if (pending.length === 0) return false
  pending.forEach((d) => {
    const exists = specialDrops.value.some((x) => !x.matchAll && x.dungeonName === d.dungeonName && x.itemName === d.itemName)
    if (!exists) {
      specialDrops.value.push({ id: makeId('drop_dungeon'), dungeonName: d.dungeonName, itemName: d.itemName, iconBase64: `preset:${d.iconKey}` })
    }
  })
  seededDrops.value = [...seededDrops.value, ...pending.map(keyOf)]
  return true
}

function localDayTs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

// 补齐内置赛季：每个只补一次；同名或时间与已有赛季重叠（用户自己建过）就跳过，只记标记
function seedDefaultSeasons(): boolean {
  const done = new Set(seededSeasons.value)
  const pending = DEFAULT_SEASONS.filter((item) => !done.has(item.name))
  if (pending.length === 0) return false
  pending.forEach((item) => {
    const startTs = localDayTs(item.start)
    const endTs = item.end ? localDayTs(item.end) : null
    const exists = seasons.value.some((s) => s.name === item.name) || findSeasonOverlap(startTs, endTs)
    if (!exists) seasons.value.push({ id: makeId('season_default'), name: item.name, startTs, endTs })
  })
  seededSeasons.value = [...seededSeasons.value, ...pending.map((item) => item.name)]
  return true
}

function seedDefaultDungeons(): boolean {
  const done = new Set(seededDungeons.value)
  const pending = DEFAULT_DUNGEONS.filter((item) => !done.has(dungeonSeedKey(item)))
  if (pending.length === 0) return false
  const missing = pending.filter(
    (item) => !dungeons.value.some((d) => dungeonSeedKey(d) === dungeonSeedKey(item))
  )
  dungeons.value = [
    ...dungeons.value,
    ...missing.map((item) => ({
      id: makeId('dungeon_default'),
      players: item.players,
      difficulty: item.difficulty,
      name: item.name,
      followed: false
    }))
  ]
  seededDungeons.value = [...seededDungeons.value, ...pending.map(dungeonSeedKey)]
  return true
}

// 完整的持久化快照：写盘与导出共用，新增字段只需在这里加一处
function buildState(): StoreState {
  return { roles: roles.value, dungeons: dungeons.value, records: records.value, columnConfig: columnConfig.value, wineBury: wineBury.value, dungeonOrder: dungeonOrder.value, specialDrops: specialDrops.value, seasons: seasons.value, groupBrands: groupBrands.value, buffCalc: buffCalc.value, longUse: longUse.value, longUseLink: longUseLink.value, defaultDungeonName: defaultDungeonName.value, seededDungeons: seededDungeons.value, seededSeasons: seededSeasons.value, seededDrops: seededDrops.value }
}

function persist() {
  saveState(buildState())
}

// 导出用：剥离响应式代理后的纯数据
function exportState(): StoreState {
  return JSON.parse(JSON.stringify(buildState())) as StoreState
}

// 特殊掉落与人数/难度解绑：同副本名称下的同名掉落视为同一条，
// 去重（保留第一条）并把收支记录里指向被合并掉落的 specialDropIds 重定向到保留的那条。
// 幂等，可在初始化与导入数据时重复执行。
function dedupeSpecialDropsAndRemapRecords(): boolean {
  const dropIdRemap = new Map<string, string>()
  const dropKeyToId = new Map<string, string>()
  const dedupedDrops: SpecialDrop[] = []
  specialDrops.value.forEach((d) => {
    if (d.matchAll) { dedupedDrops.push(d); return }
    const key = `${d.dungeonName}|${d.itemName}`
    const keptId = dropKeyToId.get(key)
    if (keptId) {
      dropIdRemap.set(d.id, keptId)
    } else {
      dropKeyToId.set(key, d.id)
      dedupedDrops.push(d)
    }
  })
  if (dropIdRemap.size === 0) return false
  specialDrops.value = dedupedDrops
  records.value.forEach((r) => {
    if (!r.specialDropIds || r.specialDropIds.length === 0) return
    r.specialDropIds = Array.from(new Set(r.specialDropIds.map((id) => dropIdRemap.get(id) ?? id)))
  })
  return true
}

function seedGroupBrandsFromRecords(recordList: RecordItem[]): GroupBrand[] {
  const map = new Map<string, boolean>()
  recordList.forEach((r) => {
    const name = r.groupBrand?.trim()
    if (!name) return
    map.set(name, (map.get(name) ?? false) || Boolean(r.blacklisted))
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .map(([name, blacklisted]) => ({ id: makeId('brand'), name, blacklisted }))
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

// 整组改名（含已隐藏的难度）：顺序原地替换；新名已存在时合并到该组，但有相同「人数+难度」则拒绝
function renameDungeonGroup(oldName: string, nextName: string): { ok: boolean; message?: string } {
  const name = nextName.trim()
  if (!name) return { ok: false, message: '副本名称不能为空' }
  if (name === oldName) return { ok: true }
  const targets = dungeons.value.filter((d) => d.name === oldName)
  if (targets.length === 0) return { ok: false, message: '副本不存在' }
  const existing = dungeons.value.filter((d) => d.name === name)
  const clash = targets.find((t) => existing.some((e) => e.players === t.players && e.difficulty === t.difficulty))
  if (clash) return { ok: false, message: `「${name}」已有 ${clash.players}${clash.difficulty}，不能合并` }
  targets.forEach((d) => { d.name = name })
  if (defaultDungeonName.value === oldName) defaultDungeonName.value = name
  dungeonOrder.value = existing.length
    ? dungeonOrder.value.filter((n) => n !== oldName)
    : dungeonOrder.value.map((n) => (n === oldName ? name : n))
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

// 新增收支时的默认副本：用户设的副本（有可见难度）优先；否则取内置默认副本（DEFAULT_DUNGEONS，当前资料片的新副本），
// 再否则在全部可见副本里挑；选定副本后，难度按 10人普通 → 25人普通 → 25人英雄 → 25人挑战 的顺序挑
const DEFAULT_DUNGEON_PRIORITY: { players: Dungeon['players']; difficulty: Dungeon['difficulty'] }[] = [
  { players: '10人', difficulty: '普通' },
  { players: '25人', difficulty: '普通' },
  { players: '25人', difficulty: '英雄' },
  { players: '25人', difficulty: '挑战' }
]

function pickByPriority(list: Dungeon[]): Dungeon | undefined {
  for (const p of DEFAULT_DUNGEON_PRIORITY) {
    const hit = list.find((d) => d.players === p.players && d.difficulty === p.difficulty)
    if (hit) return hit
  }
  return list[0]
}

/** 当前实际生效的默认副本名（含回退） */
function resolveDefaultDungeonName(): string | undefined {
  const visible = dungeons.value.filter((d) => !d.hidden)
  const candidates = [defaultDungeonName.value, DEFAULT_DUNGEONS[0]?.name]
  return candidates.find((n) => n && visible.some((d) => d.name === n)) ?? visible[0]?.name ?? dungeons.value[0]?.name
}

function resolveDefaultDungeonId(): string | undefined {
  const name = resolveDefaultDungeonName()
  const visible = dungeons.value.filter((d) => !d.hidden && d.name === name)
  return (pickByPriority(visible) ?? dungeons.value.find((d) => d.name === name))?.id
}

function setDefaultDungeon(name: string) {
  defaultDungeonName.value = name
  persist()
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

function addGroupBrand(name: string): { ok: boolean; message?: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, message: '团牌名称不能为空' }
  if (groupBrandMap.value.has(trimmed)) return { ok: false, message: '团牌已存在' }
  groupBrands.value.push({ id: makeId('brand'), name: trimmed, blacklisted: false })
  persist()
  return { ok: true }
}

function setGroupBrandBlacklisted(id: string, blacklisted: boolean): { ok: boolean; message?: string } {
  const target = groupBrands.value.find((b) => b.id === id)
  if (!target) return { ok: false, message: '团牌不存在' }
  target.blacklisted = blacklisted
  persist()
  return { ok: true }
}

function deleteGroupBrand(id: string): { ok: boolean; message?: string } {
  const target = groupBrands.value.find((b) => b.id === id)
  if (!target) return { ok: false, message: '团牌不存在' }
  groupBrands.value = groupBrands.value.filter((b) => b.id !== id)
  persist()
  return { ok: true }
}

// 录入/编辑收支记录时同步团牌库：新团牌自动创建，拉黑状态以记录表单为准
function syncGroupBrandFromRecord(groupBrand?: string, blacklisted?: boolean) {
  const name = groupBrand?.trim()
  if (!name) return
  const existing = groupBrandMap.value.get(name)
  if (existing) {
    existing.blacklisted = Boolean(blacklisted)
  } else {
    groupBrands.value.push({ id: makeId('brand'), name, blacklisted: Boolean(blacklisted) })
  }
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
}): string {
  const id = makeId('record')
  records.value.push({
    id,
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
  syncGroupBrandFromRecord(payload.groupBrand, payload.blacklisted)
  persist()
  return id
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
  syncGroupBrandFromRecord(payload.groupBrand, payload.blacklisted)
  persist()
}

function deleteRecord(id: string) {
  records.value = records.value.filter((r) => r.id !== id)
  persist()
}

function hasDuplicateSpecialDrop(dungeonName: string, itemName: string, excludeId?: string): boolean {
  return specialDrops.value.some((d) =>
    !d.matchAll &&
    d.id !== excludeId &&
    d.dungeonName === dungeonName &&
    d.itemName === itemName
  )
}

function addSpecialDrop(payload: Omit<SpecialDrop, 'id'>): { ok: boolean; message?: string } {
  const itemName = payload.itemName.trim()
  const dungeonName = payload.dungeonName.trim()
  if (!dungeonName) return { ok: false, message: '副本名称不能为空' }
  if (!itemName) return { ok: false, message: '掉落名称不能为空' }
  if (hasDuplicateSpecialDrop(dungeonName, itemName)) {
    return { ok: false, message: '该副本已存在同名掉落' }
  }
  specialDrops.value.push({
    id: makeId('drop'),
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
  if (hasDuplicateSpecialDrop(dungeonName, itemName, id)) {
    return { ok: false, message: '该副本已存在同名掉落' }
  }
  target.dungeonPlayers = undefined
  target.dungeonDifficulty = undefined
  target.dungeonName = dungeonName
  target.itemName = itemName
  target.iconBase64 = payload.iconBase64
  persist()
  return { ok: true }
}

type LongUsePayload = Omit<LongUseItem, 'id'>

function validateLongUse(payload: LongUsePayload): { ok: boolean; message?: string } {
  if (!payload.name.trim()) return { ok: false, message: '物品名称不能为空' }
  if (!EQUIP_TYPES.includes(payload.type)) return { ok: false, message: '请选择装备类型' }
  if (!Number.isFinite(payload.price) || payload.price <= 0) return { ok: false, message: '购入价格需大于 0' }
  if (!payload.startDate) return { ok: false, message: '请选择购入日期' }
  if (payload.endDate && payload.endDate < payload.startDate) {
    return { ok: false, message: '停用日期不能早于购入日期' }
  }
  return { ok: true }
}

function normalizeLongUse(payload: LongUsePayload): LongUsePayload {
  return {
    name: payload.name.trim(),
    type: payload.type,
    price: Math.max(0, Math.floor(payload.price)),
    startDate: payload.startDate,
    endDate: payload.endDate || undefined,
    roleId: payload.roleId || undefined,
    remark: payload.remark?.trim() || undefined,
    recordId: payload.recordId || undefined
  }
}

function addLongUseItem(payload: LongUsePayload): { ok: boolean; message?: string } {
  const valid = validateLongUse(payload)
  if (!valid.ok) return valid
  longUse.value.push({ id: makeId('longuse'), ...normalizeLongUse(payload) })
  persist()
  return { ok: true }
}

function updateLongUseItem(id: string, payload: LongUsePayload): { ok: boolean; message?: string } {
  const target = longUse.value.find((i) => i.id === id)
  if (!target) return { ok: false, message: '物品不存在' }
  const valid = validateLongUse(payload)
  if (!valid.ok) return valid
  // 抽屉里编辑物品不带 recordId，保留原有的联动关系
  Object.assign(target, normalizeLongUse({ ...payload, recordId: payload.recordId ?? target.recordId }))
  persist()
  return { ok: true }
}

function deleteLongUseItem(id: string) {
  longUse.value = longUse.value.filter((i) => i.id !== id)
  persist()
}

function normalizeLongUseLink(input?: Partial<LongUseLinkSettings> | null): LongUseLinkSettings {
  const snap = (v: number) => Math.round(v / LONG_USE_LINK_STEP) * LONG_USE_LINK_STEP
  // 上限至少比最低值高一档，滑条才拖得动
  const rawMax = Math.floor(Number(input?.sliderMax) || LONG_USE_LINK_DEFAULT_MAX)
  const sliderMax = Math.max(LONG_USE_LINK_MIN + LONG_USE_LINK_STEP, snap(rawMax))
  // 阈值对齐到步进，夹在 [1 砖, 上限] 之间；调低上限时阈值跟着压下来
  const threshold = Math.floor(Number(input?.threshold) || 0)
  return {
    enabled: Boolean(input?.enabled),
    threshold: Math.min(sliderMax, Math.max(LONG_USE_LINK_MIN, snap(threshold))),
    sliderMax
  }
}

function setLongUseLink(patch: Partial<LongUseLinkSettings>) {
  longUseLink.value = normalizeLongUseLink({ ...longUseLink.value, ...patch })
  persist()
}

function setColumnConfig(keys: string[]) {
  columnConfig.value = keys
  persist()
}

// 结束时间未知的赛季视为一直延续
function findSeasonOverlap(startTs: number, endTs: number | null, excludeId?: string) {
  const end = endTs ?? Number.POSITIVE_INFINITY
  return seasons.value.find((s) => {
    if (excludeId && s.id === excludeId) return false
    return startTs <= (s.endTs ?? Number.POSITIVE_INFINITY) && s.startTs <= end
  })
}

// 估算结束时间未知的赛季何时结束（只用于展示，不写入数据）：
// 通常一个赛季约 6 个月，新资料片一般周四更新 → 开始日 + 6 个月，取离该日最近的周四（往前往后都算）
// 作为下赛季开始，前一天为本赛季结束
function estimateSeasonEndTs(startTs: number): number {
  const start = new Date(startTs)
  const target = new Date(start.getFullYear(), start.getMonth() + 6, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(start.getDate(), lastDay))
  const forward = (4 - target.getDay() + 7) % 7 // 到下一个周四的天数 0~6
  const backward = 7 - forward // 到上一个周四的天数
  // 取更近的一边；前后一样近时按推后处理（7 天周期下实际不会相等）
  target.setDate(target.getDate() + (forward <= backward ? forward : -backward))
  target.setDate(target.getDate() - 1)
  return target.getTime()
}

// 按开始时间倒序（新赛季在前），用于各处下拉和赛季设置列表
const sortedSeasons = computed(() => [...seasons.value].sort((a, b) => b.startTs - a.startTs))

// 赛季用于筛选的日期区间：结束时间未知时截止到今天（今天早于开始日则用开始日）
function getSeasonRange(season: Season): [number, number] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return [season.startTs, season.endTs ?? Math.max(today, season.startTs)]
}

function addSeason(payload: { name: string; startTs: number; endTs: number | null }): { ok: boolean; message?: string } {
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '赛季名称不能为空' }
  if (seasons.value.some((s) => s.name === name)) return { ok: false, message: '赛季名称已存在' }
  if (!Number.isFinite(payload.startTs)) return { ok: false, message: '请选择开始时间' }
  if (payload.endTs !== null && !Number.isFinite(payload.endTs)) return { ok: false, message: '请选择结束时间' }
  if (payload.endTs !== null && payload.startTs > payload.endTs) return { ok: false, message: '开始时间不能晚于结束时间' }
  const overlap = findSeasonOverlap(payload.startTs, payload.endTs)
  if (overlap) return { ok: false, message: `时间区间与赛季「${overlap.name}」重叠` }
  seasons.value.push({ id: makeId('season'), name, startTs: payload.startTs, endTs: payload.endTs })
  persist()
  return { ok: true }
}

function updateSeason(id: string, payload: { name: string; startTs: number; endTs: number | null }): { ok: boolean; message?: string } {
  const target = seasons.value.find((s) => s.id === id)
  if (!target) return { ok: false, message: '赛季不存在' }
  const name = payload.name.trim()
  if (!name) return { ok: false, message: '赛季名称不能为空' }
  if (seasons.value.some((s) => s.name === name && s.id !== id)) return { ok: false, message: '赛季名称已存在' }
  if (!Number.isFinite(payload.startTs)) return { ok: false, message: '请选择开始时间' }
  if (payload.endTs !== null && !Number.isFinite(payload.endTs)) return { ok: false, message: '请选择结束时间' }
  if (payload.endTs !== null && payload.startTs > payload.endTs) return { ok: false, message: '开始时间不能晚于结束时间' }
  const overlap = findSeasonOverlap(payload.startTs, payload.endTs, id)
  if (overlap) return { ok: false, message: `时间区间与赛季「${overlap.name}」重叠` }
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

function setBuffCalcUnit(stat: BuffStat, value: number) {
  const v = Math.max(1, Math.floor(Number(value) || 0))
  const exp = DEFAULT_BUFF_EXPANSION
  buffCalc.value.units[exp] = { ...(buffCalc.value.units[exp] ?? { spirit: 0, vitality: 0 }), [stat]: v }
  persist()
}

function setBuffCalcShowPrev(value: boolean) {
  buffCalc.value.showPrevExpansion = value
  persist()
}


function setBuffCalcValue(key: string, value: number) {
  buffCalc.value.buffValues[key] = Math.max(0, Math.floor(Number(value) || 0))
  persist()
}

function resetBuffCalcValues() {
  // 优先恢复到用户自定义默认值，未设置过的 buff 回退内置默认
  buffCalc.value.buffValues = {
    ...Object.fromEntries(BUFF_DEFS.map((d) => [d.key, d.defaultValue])),
    ...buffCalc.value.buffDefaults
  }
  persist()
}

function saveBuffCalcDefaults() {
  buffCalc.value.buffDefaults = { ...buffCalc.value.buffValues }
  persist()
}

function setBuffCalcRoleBase(roleId: string, value: number) {
  buffCalc.value.roleBase[roleId] = Math.max(0, Math.floor(Number(value) || 0))
  persist()
}

const buffDefMap = new Map(BUFF_DEFS.map((d) => [d.key, d]))

function toggleBuffCalcRoleBuff(roleId: string, key: string) {
  const list = buffCalc.value.roleSelected[roleId] ?? []
  if (list.includes(key)) {
    buffCalc.value.roleSelected[roleId] = list.filter((k) => k !== key)
  } else {
    // 互斥组内同时只能启用一个：选中时自动取消同组其他 buff
    const group = buffDefMap.get(key)?.group
    const kept = group ? list.filter((k) => buffDefMap.get(k)?.group !== group) : list
    buffCalc.value.roleSelected[roleId] = [...kept, key]
  }
  persist()
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
  seededSeasons.value = Array.isArray(state.seededSeasons) ? state.seededSeasons.slice() : []
  seedDefaultSeasons()
  seededDrops.value = Array.isArray(state.seededDrops) ? state.seededDrops.slice() : []
  seedDefaultDungeonDrops()
  groupBrands.value = Array.isArray(state.groupBrands) ? state.groupBrands : seedGroupBrandsFromRecords(records.value)
  buffCalc.value = normalizeBuffCalc(state.buffCalc)
  longUse.value = Array.isArray(state.longUse) ? state.longUse : []
  longUseLink.value = normalizeLongUseLink(state.longUseLink)
  dungeonOrder.value = Array.isArray(state.dungeonOrder) ? state.dungeonOrder.slice() : []
  seededDungeons.value = Array.isArray(state.seededDungeons) ? state.seededDungeons.slice() : []
  seedDefaultDungeons()
  defaultDungeonName.value = state.defaultDungeonName
  dedupeSpecialDropsAndRemapRecords()
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
      // 拉黑状态以团牌库为准，记录级标记仅作为团牌已删除时的兜底
      const entity = groupBrandMap.value.get(groupBrand)
      const resolved = entity ? Boolean(entity.blacklisted) : blacklisted
      Array.from(leaders).sort().forEach((leaderId) => {
        result.push({ groupBrand, leaderId, blacklisted: resolved })
      })
    })
  return result
}

// 记录的统计归属日：周一 7:00（周 CD 重置）前保存、且日期就是当天周一的记录，归到前一天（周日），
// 从而算进上一周；手动改过日期的记录（日期与保存时刻不是同一天）不处理
function recordStatDate(r: { date: string; createdAt?: number }): string {
  if (!r.createdAt) return r.date
  const saved = new Date(r.createdAt)
  if (saved.getDay() !== 1 || saved.getHours() >= WEEK_RESET_HOUR || toYmd(r.createdAt) !== r.date) return r.date
  return toYmd(new Date(saved.getFullYear(), saved.getMonth(), saved.getDate() - 1).getTime())
}

// roleIds 为多选角色（非空时只保留这些角色），与 roleId 单选可同时存在
function queryRecords(filters: { roleId: string | null; roleIds?: string[]; dungeonId: string | null; range: [number, number] | null; keyword?: string; groupBrand?: string | null }) {
  const roleIdSet = filters.roleIds?.length ? new Set(filters.roleIds) : null
  const [start, end] = filters.range ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  const kw = filters.keyword?.trim().toLowerCase() ?? ''
  return records.value
    .filter((r) => {
      const t = new Date(`${recordStatDate(r)}T00:00:00`).getTime()
      if (filters.roleId && r.roleId !== filters.roleId) return false
      if (roleIdSet && !roleIdSet.has(r.roleId)) return false
      if (filters.dungeonId && r.dungeonId !== filters.dungeonId) return false
      if (filters.groupBrand && (r.groupBrand?.trim() ?? '') !== filters.groupBrand) return false
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
      const brandEntity = r.groupBrand ? groupBrandMap.value.get(r.groupBrand.trim()) : undefined
      return {
        ...r,
        statDate: recordStatDate(r),
        blacklisted: brandEntity ? Boolean(brandEntity.blacklisted) : Boolean(r.blacklisted),
        leaderId: normalizePersonName(r.leaderId) || undefined,
        blackPerson: normalizePersonName(r.blackPerson) || undefined,
        roleText: role ? `${role.id}（${role.server}/${role.school}）` : '已删除角色',
        dungeonText: FIXED_DUNGEON_LABEL[r.dungeonId] ?? (dungeon ? `${dungeon.players}${dungeon.difficulty}${dungeon.name}` : '副本已删除'),
        subtotal: r.income - r.expense
      }
    })
}

function getWeeklyCdStatusByRole() {
  void nowMinute.value // 建立对时间的响应式依赖
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
    getSeasonRange,
    recordStatDate,
    exportState,
    estimateSeasonEndTs,
    sortedSeasons,
    frequentGroupBrands,
    getLeadersForBrand,
    groupBrands,
    addGroupBrand,
    setGroupBrandBlacklisted,
    deleteGroupBrand,
    longUse,
    addLongUseItem,
    updateLongUseItem,
    deleteLongUseItem,
    longUseLink,
    setLongUseLink,
    buffCalc,
    setBuffCalcUnit,
    setBuffCalcShowPrev,
    setBuffCalcValue,
    resetBuffCalcValues,
    saveBuffCalcDefaults,
    setBuffCalcRoleBase,
    toggleBuffCalcRoleBuff,
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
    renameDungeonGroup,
    toggleDungeonFollow,
    toggleDungeonHidden,
    hideDungeon,
    defaultDungeonName,
    resolveDefaultDungeonName,
    resolveDefaultDungeonId,
    setDefaultDungeon,
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
