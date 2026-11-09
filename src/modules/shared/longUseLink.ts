import type { EquipType } from '../../constants/equip'

// 收支表单「联动入账」的草稿物品；单独放一个文件，组件只留 <script setup>，热更新才不会失效

export interface LinkDraftItem {
  /** 列表渲染用的本地 key */
  key: string
  /** 编辑时对应已有的久物物品 ID；新加的为空 */
  id?: string
  name: string
  type: EquipType
  /** 单位：金；手动填，不预填——一笔支出可能不止买了这些，也有的部分不用记 */
  price: number | null
}

let seq = 0

export function newLinkDraftItem(): LinkDraftItem {
  seq += 1
  return { key: `draft_${Date.now()}_${seq}`, name: '', type: '武器', price: null }
}
