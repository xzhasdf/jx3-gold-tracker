// ─── 装备类型（久物主义小工具） ──────────────────────────────────────────
import iconWeapon from '../assets/icon/22442.png'
import iconArmor from '../assets/icon/22443.png'
import iconHidden from '../assets/icon/22440.png'
import iconNecklace from '../assets/icon/22444.png'
import iconPendant from '../assets/icon/22441.png'
import iconRing from '../assets/icon/22439.png'

export const EQUIP_TYPES = ['武器', '防具', '暗器', '项链', '腰坠', '戒指'] as const

export type EquipType = (typeof EQUIP_TYPES)[number]

export const EQUIP_ICONS: Record<EquipType, string> = {
  武器: iconWeapon,
  防具: iconArmor,
  暗器: iconHidden,
  项链: iconNecklace,
  腰坠: iconPendant,
  戒指: iconRing
}
