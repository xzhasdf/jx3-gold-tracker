export const STORAGE_KEY = 'jx3-gold-tracker-v1'

export const SCHOOLS = ['万花', '纯阳', '天策', '七秀', '少林', '藏剑', '五毒', '唐门', '明教', '丐帮', '苍云', '长歌', '霸刀', '蓬莱', '凌雪', '衍天', '药宗', '刀宗', '万灵', '段氏']

export const SERVERS = ['梦江南', '龙争虎斗', '剑胆琴心', '斗转星移', '乾坤一掷', '绝代天骄', '幽月轮', '长安城', '唯我独尊', '九天', '蝶恋花', '天鹅坪', '破阵子', '飞龙在天', '眉间雪', '山海相逢']

export const PLAYER_OPTIONS = ['10人', '25人'] as const
export const DIFFICULTY_OPTIONS = ['普通', '英雄', '挑战'] as const

// 固定副本选项：选中时不需要填写团牌/团长等团队信息
export const FIXED_DUNGEON_OPTIONS = [
  { id: '__fixed_baizhang__', label: '百战' },
  { id: '__fixed_shilian__', label: '试炼之地' },
  { id: '__fixed_other__', label: '其他' }
] as const

export const FIXED_DUNGEON_LABEL: Record<string, string> = {
  __fixed_baizhang__: '百战',
  __fixed_shilian__: '试炼之地',
  __fixed_other__: '其他'
}

// 内置赛季（按资料片划分）：老用户只补一次（记入 seededSeasons），同名或与已有赛季时间重叠则跳过。
// 结束日期未公布时 end 写 null（显示「未知」），下个资料片定档后改成真实日期。日期为本地时间当天 0 点，与赛季设置里的日期选择器一致。
export const DEFAULT_SEASONS: ReadonlyArray<{ name: string; start: string; end: string | null }> = [
  { name: '暗影千机', start: '2026-04-24', end: '2026-10-28' },
  { name: '苍生铸世', start: '2026-10-29', end: null }
]

// 新资料片换团本 / 开放新难度只改这里：老用户会按「副本名|人数|难度」自动补齐缺的，见 useTracker.ts seedDefaultDungeons
export const DEFAULT_DUNGEONS = [
  { players: '10人', difficulty: '普通', name: '洛阳之战' },
  { players: '25人', difficulty: '普通', name: '洛阳之战' },
  { players: '25人', difficulty: '英雄', name: '洛阳之战' }
] as const
