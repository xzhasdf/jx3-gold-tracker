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
  hidden?: boolean
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
}

export interface StoreState {
  roles: Role[]
  dungeons: Dungeon[]
  records: RecordItem[]
}
