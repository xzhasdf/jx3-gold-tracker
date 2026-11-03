import icon2588 from '../assets/icon/2588.png'
import icon2589 from '../assets/icon/2589.png'
import icon4433 from '../assets/icon/4433.png'
import icon7528 from '../assets/icon/7528.png'
import icon2330 from '../assets/icon/2330.png'
import icon11272 from '../assets/icon/11272.png'
import icon11273 from '../assets/icon/11273.png'
import icon10902 from '../assets/icon/10902.png'
import icon2265 from '../assets/icon/2265.png'
import icon2245 from '../assets/icon/2245.png'
import icon2273 from '../assets/icon/2273.png'
import icon2240 from '../assets/icon/2240.png'
import icon2264 from '../assets/icon/2264.png'
import icon2739 from '../assets/icon/2739.png'
import icon2241 from '../assets/icon/2241.png'
import icon2238 from '../assets/icon/2238.png'
import icon2256 from '../assets/icon/2256.png'
import icon2272 from '../assets/icon/2272.png'
import icon2250 from '../assets/icon/2250.png'
import icon2244 from '../assets/icon/2244.png'
import icon2260 from '../assets/icon/2260.png'
import icon22439 from '../assets/icon/22439.png'
import icon22440 from '../assets/icon/22440.png'
import icon22441 from '../assets/icon/22441.png'
import icon22442 from '../assets/icon/22442.png'
import icon22443 from '../assets/icon/22443.png'
import icon22444 from '../assets/icon/22444.png'
import icon26347 from '../assets/icon/26347.png'
import icon26348 from '../assets/icon/26348.png'
import icon26349 from '../assets/icon/26349.png'
import icon26350 from '../assets/icon/26350.png'
import icon2271 from '../assets/icon/2271.png'
import icon2263 from '../assets/icon/2263.png'
import icon28253 from '../assets/icon/28253.png'
import icon28254 from '../assets/icon/28254.png'
import icon28255 from '../assets/icon/28255.png'
import icon28291 from '../assets/icon/28291.png'
import icon28748 from '../assets/icon/28748.png'
import iconDefaultDrop from '../assets/icon/13.png'

export const DROP_PRESET_ICONS: Record<string, string> = {
  '2588': icon2588,
  '2589': icon2589,
  '4433': icon4433,
  '7528': icon7528,
  '2330': icon2330,
  '11272': icon11272,
  '11273': icon11273,
  '10902': icon10902,
  '2265': icon2265,
  '2245': icon2245,
  '2273': icon2273,
  '2240': icon2240,
  '2264': icon2264,
  '2739': icon2739,
  '2241': icon2241,
  '2238': icon2238,
  '2256': icon2256,
  '2272': icon2272,
  '2250': icon2250,
  '2244': icon2244,
  '2260': icon2260,
  '22439': icon22439,
  '22440': icon22440,
  '22441': icon22441,
  '22442': icon22442,
  '22443': icon22443,
  '22444': icon22444,
  '26347': icon26347,
  '26348': icon26348,
  '26349': icon26349,
  '26350': icon26350,
  '2271': icon2271,
  '2263': icon2263,
  '28253': icon28253,
  '28254': icon28254,
  '28255': icon28255,
  '28291': icon28291,
  '28748': icon28748,
}

// 「图片选择」面板暴露给用户的预设：装备位按 武器 / 防具 / 暗器 / 项链 / 腰坠 / 戒指 排列
export const DROP_PRESET_PICKER_KEYS = [
  '22442',
  '22443',
  '22440',
  '22444',
  '22441',
  '22439'
] as const

export const DROP_DEFAULT_ICON = iconDefaultDrop

export function resolveDropIcon(stored: string | undefined): string {
  if (!stored) return DROP_DEFAULT_ICON
  if (stored.startsWith('preset:')) return DROP_PRESET_ICONS[stored.slice(7)] ?? DROP_DEFAULT_ICON
  return stored
}

// 玄晶名称统一用橙色（装备品质色）展示
export const XUANJING_COLOR = '#ff8000'

export function dropNameColor(itemName: string | undefined): string | undefined {
  return itemName?.includes('玄晶') ? XUANJING_COLOR : undefined
}

// 录入记录时特殊掉落的分组（按此顺序展示）
export const DROP_CATEGORY_ORDER = ['当前副本', '周常挂件', '侠客秘籍', '材料'] as const
export type DropCategory = (typeof DROP_CATEGORY_ORDER)[number]

export function dropCategory(drop: { matchAll?: boolean; matchPlayers?: string; itemName: string }): DropCategory {
  if (!drop.matchAll) return '当前副本'
  if (/秘卷|残卷|纵横之剑/.test(drop.itemName)) return '侠客秘籍'
  // 通用掉落里限定 10 人的是周常挂件
  if (drop.matchPlayers === '10人') return '周常挂件'
  return '材料'
}

// 首次进入时种入的默认通用掉落
export const DEFAULT_SPECIAL_DROPS: {
  itemName: string
  iconKey: string
  matchPlayers?: '10人' | '25人'
}[] = [
  // 苍生铸世周常腰挂（10 人）
  { itemName: '小鹿仙', iconKey: '26347', matchPlayers: '10人' },
  { itemName: '兔每每', iconKey: '26348', matchPlayers: '10人' },
  { itemName: '礼吉小灵机', iconKey: '26349', matchPlayers: '10人' },
  { itemName: '咩椰', iconKey: '26350', matchPlayers: '10人' },
  { itemName: '卦预乾坤', iconKey: '11272', matchPlayers: '10人' },
  { itemName: '赐清平', iconKey: '10902', matchPlayers: '10人' },
  { itemName: '朝露昙华', iconKey: '11273', matchPlayers: '10人' },
  { itemName: '玄晶', iconKey: '2589' },
  { itemName: '小铁', iconKey: '2588' },
  { itemName: '纵横之剑·捭', iconKey: '2260' },
  { itemName: '纵横之剑·阖', iconKey: '2244' },
  { itemName: '寸险律·残卷', iconKey: '2265' },
  { itemName: '月朔实录·残卷', iconKey: '2245' },
  { itemName: '惊羽诀·秘卷', iconKey: '2273' },
  { itemName: '纯阳别册·残卷', iconKey: '2240' },
  { itemName: '气经·残卷', iconKey: '2264' },
  { itemName: '相知剑意·残卷', iconKey: '2739' },
  { itemName: '蜀山剑诀·秘卷', iconKey: '2241' },
  { itemName: '圣灵心法·秘卷', iconKey: '2238' },
  { itemName: '易筋经·秘卷', iconKey: '2256' },
  { itemName: '离经易道·秘卷', iconKey: '2272' },
  { itemName: '冰心诀·秘卷', iconKey: '2250' },
  { itemName: '铁骨衣·秘卷', iconKey: '2263' },
  { itemName: '调鼎道·秘卷', iconKey: '2271' },
]

// 内置的副本专属掉落：作为普通掉落补给用户（可改名、换图标、删除，和用户自己加的一样）。
// 按「副本名|物品名」每项只补一次（记入 seededDrops）；用户已有同名掉落则跳过，删掉的不再补回。
export const DEFAULT_DUNGEON_DROPS: { dungeonName: string; itemName: string; iconKey: string }[] = [
  { dungeonName: '洛阳之战', itemName: '白狼啸月', iconKey: '28253' },
  { dungeonName: '洛阳之战', itemName: '天骸', iconKey: '28254' },
  { dungeonName: '洛阳之战', itemName: '众相无我', iconKey: '28255' },
  { dungeonName: '洛阳之战', itemName: '炽虎', iconKey: '28291' },
  { dungeonName: '洛阳之战', itemName: '帝煞玄甲', iconKey: '28748' }
]
