// ─── 增益计算（小工具） ────────────────────────────────────────────────
export type BuffStat = 'spirit' | 'vitality'

export interface BuffDef {
  key: string
  name: string
  stat: BuffStat
  defaultValue: number
  color?: string
  /** 互斥组：同组 buff 同时只能启用一个 */
  group?: string
}

// 紫 / 蓝 与埋酒目标用色保持一致
export const BUFF_PURPLE = '#fe2dfe'
export const BUFF_BLUE = '#007eff'

export const BUFF_STAT_LABEL: Record<BuffStat, string> = { spirit: '根骨', vitality: '体质' }

// 每层增益所需基础属性默认值
export const BUFF_UNIT_DEFAULTS: Record<BuffStat, number> = { spirit: 252, vitality: 3310 }

// 根骨系门派 / 体质系门派
export const SPIRIT_SCHOOLS = ['万花', '七秀', '五毒', '长歌', '药宗']
export const VITALITY_SCHOOLS = ['天策', '少林', '明教', '苍云']

export const BUFF_DEFS: BuffDef[] = [
  { key: 'spirit:袖气', name: '袖气', stat: 'spirit', defaultValue: 317 },
  { key: 'spirit:水晶芙蓉宴', name: '水晶芙蓉宴', stat: 'spirit', defaultValue: 841, color: BUFF_PURPLE },
  { key: 'spirit:咸骨粥', name: '咸骨粥', stat: 'spirit', defaultValue: 736, color: BUFF_PURPLE, group: 'spirit:food' },
  { key: 'spirit:老火骨汤', name: '老火骨汤', stat: 'spirit', defaultValue: 368, color: BUFF_BLUE, group: 'spirit:food' },
  { key: 'spirit:上品静心丸', name: '上品静心丸', stat: 'spirit', defaultValue: 946, color: BUFF_PURPLE, group: 'spirit:pill' },
  { key: 'spirit:中品静心丸', name: '中品静心丸', stat: 'spirit', defaultValue: 473, color: BUFF_BLUE, group: 'spirit:pill' },
  { key: 'spirit:高粱酒', name: '高粱酒', stat: 'spirit', defaultValue: 136, color: BUFF_BLUE, group: 'spirit:wine' },
  { key: 'spirit:高粱酒·今朝醉', name: '高粱酒·今朝醉', stat: 'spirit', defaultValue: 272, color: BUFF_BLUE, group: 'spirit:wine' },
  { key: 'spirit:高粱酒·六日醉', name: '高粱酒·六日醉', stat: 'spirit', defaultValue: 408, color: BUFF_BLUE, group: 'spirit:wine' },
  { key: 'spirit:高粱酒·旬又三', name: '高粱酒·旬又三', stat: 'spirit', defaultValue: 544, color: BUFF_PURPLE, group: 'spirit:wine' },
  { key: 'vitality:袖气', name: '袖气', stat: 'vitality', defaultValue: 317 },
  { key: 'vitality:水晶芙蓉宴', name: '水晶芙蓉宴', stat: 'vitality', defaultValue: 2429, color: BUFF_PURPLE },
  { key: 'vitality:皮蛋瘦肉粥', name: '皮蛋瘦肉粥', stat: 'vitality', defaultValue: 2126, color: BUFF_PURPLE, group: 'vitality:food' },
  { key: 'vitality:贡丸汤', name: '贡丸汤', stat: 'vitality', defaultValue: 1063, color: BUFF_BLUE, group: 'vitality:food' },
  { key: 'vitality:上品健体丸', name: '上品健体丸', stat: 'vitality', defaultValue: 2733, color: BUFF_PURPLE, group: 'vitality:pill' },
  { key: 'vitality:中品健体丸', name: '中品健体丸', stat: 'vitality', defaultValue: 1366, color: BUFF_BLUE, group: 'vitality:pill' },
]
