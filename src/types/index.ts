import type { EquipType } from '../constants/equip'

export interface Role {
  id: string
  server: string
  school: string
  isProxyClear: boolean
  wageRatio: number
  ignoreCd?: boolean
}

export interface Dungeon {
  id: string
  players: '10人' | '25人'
  difficulty: '普通' | '英雄' | '挑战'
  name: string
  followed: boolean
  hidden?: boolean
  pinned?: boolean
}

export interface GroupBrand {
  id: string
  name: string
  blacklisted?: boolean
}

export interface RecordItem {
  id: string
  roleId: string
  dungeonId: string
  date: string
  createdAt?: number  // 记录保存时刻的时间戳（ms），用于 CD 判定
  income: number
  expense: number
  groupBrand?: string
  leaderId?: string
  remark?: string
  blacklisted?: boolean
  blackPerson?: string
  specialDropIds?: string[]
}

export interface WineBuryItem {
  id: string
  wineType: string
  target: string
  roleId?: string
  startTime: number
  endTime: number
  dismissed?: boolean
}

export interface SpecialDrop {
  id: string
  /** @deprecated 掉落不再区分人数，仅为兼容历史数据保留 */
  dungeonPlayers?: '10人' | '25人'
  /** @deprecated 掉落不再区分难度，仅为兼容历史数据保留 */
  dungeonDifficulty?: '普通' | '英雄' | '挑战'
  dungeonName: string
  itemName: string
  iconBase64?: string
  matchAll?: boolean
  matchPlayers?: '10人' | '25人'
}

export interface BuffCalcState {
  /** 是否同时显示上一个资料片（130级）的小吃小药 */
  showPrevExpansion: boolean
  /** 每层增益所需基础属性，按资料片分别保存；缺省为 0 表示「未设置」 */
  units: Record<string, { spirit: number; vitality: number }>
  /** @deprecated 旧版单一数值，读取时迁移到 units[LEGACY_BUFF_EXPANSION] */
  unitSpirit?: number
  /** @deprecated 同上 */
  unitVitality?: number
  buffValues: Record<string, number>
  /** 用户自定义默认值（每赛季数值不同），「恢复默认值」优先恢复到这里 */
  buffDefaults: Record<string, number>
  roleBase: Record<string, number>
  roleSelected: Record<string, string[]>
}

export interface LongUseItem {
  id: string
  name: string
  type: EquipType
  /** 购入价格，单位：金 */
  price: number
  /** 购入日期 YYYY-MM-DD */
  startDate: string
  /** 停用日期 YYYY-MM-DD；为空表示仍在使用，摊销天数算到今天 */
  endDate?: string
  roleId?: string
  remark?: string
}

export interface Season {
  id: string
  name: string
  startTs: number
  /** 结束时间；null 表示未知（赛季进行中），按今天截止计算 */
  endTs: number | null
}

export interface StoreState {
  roles: Role[]
  dungeons: Dungeon[]
  records: RecordItem[]
  columnConfig?: string[]
  wineBury?: WineBuryItem[]
  dungeonOrder?: string[]
  specialDrops?: SpecialDrop[]
  seasons?: Season[]
  groupBrands?: GroupBrand[]
  buffCalc?: BuffCalcState
  longUse?: LongUseItem[]
  /** 已补齐过的默认副本（`副本名|人数|难度`）：每个组合只给老用户补一次，之后用户删掉的不再补回 */
  seededDungeons?: string[]
  /** 已补齐过的默认赛季名：每个只补一次，之后用户删掉的不再补回 */
  seededSeasons?: string[]
  /** 已补齐过的内置副本掉落（`副本名|物品名`）：每项只补一次，之后用户删掉的不再补回 */
  seededDrops?: string[]
}
