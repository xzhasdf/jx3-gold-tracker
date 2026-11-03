// ─── 增益计算（小工具） ────────────────────────────────────────────────
export type BuffStat = 'spirit' | 'vitality'

export interface BuffDef {
  key: string
  name: string
  /** 适用的主属性：根骨门派 / 体质门派角色只看到包含自己主属性的增益 */
  stats: BuffStat[]
  defaultValue: number
  color?: string
  /** 互斥组：同组 buff 同时只能启用一个（每个角色只有一种主属性，组名不区分根骨 / 体质） */
  group?: string
  /** 所属资料片（BUFF_EXPANSIONS 的 key） */
  expansion: string
}

// ─── 资料片 ─────────────────────────────────────────────────────────────
// 每个资料片一套小吃小药和「每层增益所需基础属性」。新资料片加在数组最前面并改 DEFAULT_BUFF_EXPANSION。
// 增益计算固定用 DEFAULT_BUFF_EXPANSION，紧随其后的一个资料片可通过开关附带显示。
export interface BuffExpansion {
  key: string
  name: string
  /** 界面上的简称（如「130级」），缺省用 name */
  label?: string
  /** 每层所需基础属性默认值；未知的留空，界面显示「未设置」由用户填写 */
  unitDefaults: Partial<Record<BuffStat, number>>
}

export const BUFF_EXPANSIONS: BuffExpansion[] = [
  // 10.29「苍生铸世」资料片武学调整公告：万花/七秀/长歌/五毒/药宗 每45点基础根骨一层，天策/少林/苍云/明教 每96点基础体质一层
  { key: 'cangsheng', name: '苍生铸世', unitDefaults: { spirit: 45, vitality: 96 } },
  // 暗影千机赛季沿用的是「风语·」系列小吃小药（key 沿用 fengyu，兼容已存数据）
  { key: 'fengyu', name: '暗影千机', label: '130级', unitDefaults: { spirit: 252, vitality: 3310 } }
]

export const DEFAULT_BUFF_EXPANSION = 'cangsheng'
// 老数据（没有按资料片区分的每层所需属性）归属的资料片（暗影千机）
export const LEGACY_BUFF_EXPANSION = 'fengyu'

// 紫 / 蓝 与埋酒目标用色保持一致
export const BUFF_ORANGE = '#ff9900'
export const BUFF_PURPLE = '#fe2dfe'
export const BUFF_BLUE = '#007eff'

export const BUFF_STAT_LABEL: Record<BuffStat, string> = { spirit: '根骨', vitality: '体质' }

// 根骨系门派 / 体质系门派
export const SPIRIT_SCHOOLS = ['万花', '七秀', '五毒', '长歌', '药宗']
export const VITALITY_SCHOOLS = ['天策', '少林', '明教', '苍云']

// 苍生铸世：各主属性的辅助小吃小药合并成「主属」综合药 / 综合食物，吃了加对应主属性；宴席三档互斥。
// 游戏内说明：按当前心法加对应主属性，体质 / 身法 / 元气 / 力道 / 根骨数值相同（云芝竹沥羹均为 126），所以根骨、体质共用一条（stats 两项）。
// 互斥组（group）不带资料片和主属性前缀：同类增益跨资料片也只能生效一个（如风语·静心丸与五气归元丹都是辅助类药品），
// 打开「显示上版本小吃小药」时新旧同类也互斥。
export const BUFF_DEFS: BuffDef[] = [
  { key: 'cangsheng:袖气', name: '袖气', stats: ['spirit', 'vitality'], defaultValue: 45, group: 'xiuqi', expansion: 'cangsheng' },
  { key: 'cangsheng:云中珍馐宴', name: '云中珍馐宴', stats: ['spirit', 'vitality'], defaultValue: 72, color: BUFF_BLUE, group: 'feast', expansion: 'cangsheng' },
  { key: 'cangsheng:巴渝珍馐宴', name: '巴渝珍馐宴', stats: ['spirit', 'vitality'], defaultValue: 143, color: BUFF_PURPLE, group: 'feast', expansion: 'cangsheng' },
  { key: 'cangsheng:长安珍馐宴', name: '长安珍馐宴', stats: ['spirit', 'vitality'], defaultValue: 179, color: BUFF_ORANGE, group: 'feast', expansion: 'cangsheng' },
  { key: 'cangsheng:五气培元丸', name: '五气培元丸', stats: ['spirit', 'vitality'], defaultValue: 81, color: BUFF_BLUE, group: 'pill', expansion: 'cangsheng' },
  { key: 'cangsheng:五气归元丹', name: '五气归元丹', stats: ['spirit', 'vitality'], defaultValue: 162, color: BUFF_PURPLE, group: 'pill', expansion: 'cangsheng' },
  { key: 'cangsheng:五气归元丹·精', name: '五气归元丹·精', stats: ['spirit', 'vitality'], defaultValue: 203, color: BUFF_ORANGE, group: 'pill', expansion: 'cangsheng' },
  { key: 'cangsheng:开锅豆腐', name: '开锅豆腐', stats: ['spirit', 'vitality'], defaultValue: 63, color: BUFF_BLUE, group: 'food', expansion: 'cangsheng' },
  { key: 'cangsheng:云芝竹沥羹', name: '云芝竹沥羹', stats: ['spirit', 'vitality'], defaultValue: 126, color: BUFF_PURPLE, group: 'food', expansion: 'cangsheng' },
  { key: 'cangsheng:云芝竹沥羹·精', name: '云芝竹沥羹·精', stats: ['spirit', 'vitality'], defaultValue: 158, color: BUFF_ORANGE, group: 'food', expansion: 'cangsheng' },
  // 家园酒只加根骨；今朝醉未实测，按高粱酒 1:2:3:4 的比例推算为 46
  { key: 'cangsheng:高粱酒', name: '高粱酒', stats: ['spirit'], defaultValue: 23, color: BUFF_BLUE, group: 'wine', expansion: 'cangsheng' },
  { key: 'cangsheng:高粱酒·今朝醉', name: '高粱酒·今朝醉', stats: ['spirit'], defaultValue: 46, color: BUFF_BLUE, group: 'wine', expansion: 'cangsheng' },
  { key: 'cangsheng:高粱酒·六日醉', name: '高粱酒·六日醉', stats: ['spirit'], defaultValue: 69, color: BUFF_BLUE, group: 'wine', expansion: 'cangsheng' },
  { key: 'cangsheng:高粱酒·旬又三', name: '高粱酒·旬又三', stats: ['spirit'], defaultValue: 92, color: BUFF_PURPLE, group: 'wine', expansion: 'cangsheng' },
  // 130级（暗影千机「风语·」系列）物品在苍生铸世仍可使用，数值随版本压缩。袖气、高粱酒与当前版本是同一个东西，不重复列出。
  // key 用 lv130 前缀，避免沿用老用户存的 130 级数值。数值取自苍生铸世游戏内物品说明（2026-11-03）。
  { key: 'lv130:spirit:水晶芙蓉宴', name: '水晶芙蓉宴', stats: ['spirit'], defaultValue: 77, color: BUFF_PURPLE, group: 'feast', expansion: 'fengyu' },
  { key: 'lv130:spirit:老火骨汤', name: '老火骨汤', stats: ['spirit'], defaultValue: 33, color: BUFF_BLUE, group: 'food', expansion: 'fengyu' },
  { key: 'lv130:spirit:咸骨粥', name: '咸骨粥', stats: ['spirit'], defaultValue: 67, color: BUFF_PURPLE, group: 'food', expansion: 'fengyu' },
  { key: 'lv130:spirit:中品静心丸', name: '中品静心丸', stats: ['spirit'], defaultValue: 43, color: BUFF_BLUE, group: 'pill', expansion: 'fengyu' },
  { key: 'lv130:spirit:上品静心丸', name: '上品静心丸', stats: ['spirit'], defaultValue: 87, color: BUFF_PURPLE, group: 'pill', expansion: 'fengyu' },
  { key: 'lv130:vitality:水晶芙蓉宴', name: '水晶芙蓉宴', stats: ['vitality'], defaultValue: 34, color: BUFF_PURPLE, group: 'feast', expansion: 'fengyu' },
  { key: 'lv130:vitality:贡丸汤', name: '贡丸汤', stats: ['vitality'], defaultValue: 15, color: BUFF_BLUE, group: 'food', expansion: 'fengyu' },
  { key: 'lv130:vitality:皮蛋瘦肉粥', name: '皮蛋瘦肉粥', stats: ['vitality'], defaultValue: 30, color: BUFF_PURPLE, group: 'food', expansion: 'fengyu' },
  { key: 'lv130:vitality:中品健体丸', name: '中品健体丸', stats: ['vitality'], defaultValue: 19, color: BUFF_BLUE, group: 'pill', expansion: 'fengyu' },
  { key: 'lv130:vitality:上品健体丸', name: '上品健体丸', stats: ['vitality'], defaultValue: 39, color: BUFF_PURPLE, group: 'pill', expansion: 'fengyu' },
]
