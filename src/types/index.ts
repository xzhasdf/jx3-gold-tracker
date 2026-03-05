export interface Role {
  id: string
  server: string
  school: string
  isProxyClear: boolean
  wageRatio: number
}

export interface Dungeon {
  id: string
  players: '10人' | '25人'
  difficulty: '普通' | '英雄' | '挑战'
  name: string
  followed: boolean
}

export interface RecordItem {
  id: string
  roleId: string
  dungeonId: string
  date: string
  income: number
  expense: number
  groupBrand?: string
  leaderId?: string
  remark?: string
  blacklisted?: boolean
}

export interface StoreState {
  roles: Role[]
  dungeons: Dungeon[]
  records: RecordItem[]
}
