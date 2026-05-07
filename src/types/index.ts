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
  dungeonPlayers: '10人' | '25人'
  dungeonDifficulty: '普通' | '英雄' | '挑战'
  dungeonName: string
  itemName: string
  iconBase64?: string
  matchAll?: boolean
  matchPlayers?: '10人' | '25人'
}

export interface Season {
  id: string
  name: string
  startTs: number
  endTs: number
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
}
