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
}

// 「图片选择」面板暴露给用户的预设
export const DROP_PRESET_PICKER_KEYS = ['2589', '2588'] as const

export const DROP_DEFAULT_ICON = iconDefaultDrop

export function resolveDropIcon(stored: string | undefined): string {
  if (!stored) return DROP_DEFAULT_ICON
  if (stored.startsWith('preset:')) return DROP_PRESET_ICONS[stored.slice(7)] ?? DROP_DEFAULT_ICON
  return stored
}

// 首次进入时种入的默认通用掉落
export const DEFAULT_SPECIAL_DROPS: {
  itemName: string
  iconKey: string
  matchPlayers?: '10人' | '25人'
}[] = [
  { itemName: '卦预乾坤', iconKey: '11272', matchPlayers: '10人' },
  { itemName: '赐清平', iconKey: '10902', matchPlayers: '10人' },
  { itemName: '朝露昙华', iconKey: '11273', matchPlayers: '10人' },
  { itemName: '玄晶', iconKey: '2589' },
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
]
