export const STORAGE_KEY = 'jx3-gold-tracker-v1'

export const SCHOOLS = ['万花', '纯阳', '天策', '七秀', '少林', '藏剑', '五毒', '唐门', '明教', '丐帮', '苍云', '长歌', '霸刀', '蓬莱', '凌雪', '衍天', '药宗', '刀宗', '万灵', '段氏']

export const SERVERS = ['梦江南', '龙争虎斗', '剑胆琴心', '斗转星移', '乾坤一掷', '绝代天骄', '幽月轮', '长安城', '唯我独尊', '蝶恋花', '天鹅坪', '破阵子', '飞龙在天', '眉间雪', '山海相逢']

export const PLAYER_OPTIONS = ['10人', '25人'] as const
export const DIFFICULTY_OPTIONS = ['普通', '英雄', '挑战'] as const

// 固定副本选项：选中时不需要填写团牌/团长等团队信息
export const FIXED_DUNGEON_OPTIONS = [
  { id: '__fixed_baizhang__', label: '百战' },
  { id: '__fixed_shilian__', label: '试炼之地' }
] as const

export const FIXED_DUNGEON_LABEL: Record<string, string> = {
  __fixed_baizhang__: '百战',
  __fixed_shilian__: '试炼之地'
}

export const DEFAULT_DUNGEONS = [
  { players: '10人', difficulty: '普通', name: '弓月城' },
  { players: '25人', difficulty: '普通', name: '弓月城' },
  { players: '25人', difficulty: '英雄', name: '弓月城' },
  { players: '25人', difficulty: '挑战', name: '缚罪之渊' }
] as const
