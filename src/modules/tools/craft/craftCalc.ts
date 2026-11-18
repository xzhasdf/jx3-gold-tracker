// 技艺成本收益计算。金额单位一律为铜（1 金 = 100 银 = 10000 铜），与 JX3Box 物价接口一致。
//
// 制作 N 次（N 默认 1）：
//   成本 = Σ 材料（单次数量 × N − 自备数量）× 材料单价        自备是 N 次合计备了多少，不计成本
//   收益 = Σ 产物 期望数量 × N × 单价 × (1 − 5% 手续费)       期望数量 = 概率 × (最少 + 最多) / 2
//   单件成本 = 成本 / 全部产物期望件数                         按出货期望摊，而不是按最少件数
//   补精力食物 = 买的个数 × 交易行单价 + 自制个数 × 自制单价（材料费 / 每次产出个数）
//   每点精力利润 = (收益 − 成本) / (配方精力 × N + 配方取价的中间件自制精力)
//
// 取价：NPC 商店有售的材料固定用 NPC 价（没有别的选项）；其余材料和产物默认交易行，可改成自定义单价；中间件材料还可选「配方」，按配方材料费折算。
import rawData from './craftData.json'
import { NPC_PRICES } from './npcPrices'
import type { CraftSettings } from '../../../types'

export interface CraftRecipe {
  id: string
  prof: string
  name: string
  vigor: number
  dlc: number
  /** [物品ID, 数量] */
  mats: [string, number][]
  /** [物品ID, 最少, 最多, 概率 0~1] */
  outs: [string, number, number, number][]
}

export interface CraftItem {
  name: string
  q: number
  /** 产物效果说明（生成脚本从 JX3Box 解析附魔 / 增益模板得到；梓匠家具没有） */
  fx?: string
}

const data = rawData as unknown as { recipes: CraftRecipe[]; items: Record<string, CraftItem>; mids: Record<string, string[]> }

export const RECIPES = data.recipes
export const ITEMS = data.items
export const RECIPE_MAP = new Map(RECIPES.map((r) => [r.id, r]))
/** 各技艺的中间件（锭/布/酱料/药引等）：技艺名 → 物品ID */
export const MIDS = data.mids
/** 全部中间件物品ID */
export const MID_IDS = new Set(Object.values(MIDS).flat())
export const CURRENT_DLC = Math.max(...RECIPES.map((r) => r.dlc))
export const PROFESSIONS = ['烹饪', '缝纫', '铸造', '医术', '梓匠']
/** 交易行寄售手续费，游戏内固定 5% */
export const AUCTION_FEE_PERCENT = 5

/** 补精力的食物：每个回复的精力；买的个数默认按需要的精力向上取整 */
export const VIGOR_FOODS = [
  { key: 'zhuanshen', id: '5_31013', name: '转神餐', vigor: 20, q: 3 },
  { key: 'fotiaoqiang', id: '5_31012', name: '佛跳墙', vigor: 38, q: 4 }
] as const
export type VigorFood = (typeof VIGOR_FOODS)[number]

// 食物名 / 品质要能被 itemName、qualityColor 查到，配方数据里没有就补上
for (const f of VIGOR_FOODS) ITEMS[f.id] ??= { name: f.name, q: f.q }

/** 资料片号 → 名称（JX3Box 的 nDlc）。打包脚本只收这些资料片的配方 */
export const DLC_NAMES: Record<number, string> = { 8: '丝路风语', 9: '苍生铸世' }

/**
 * 是否算「当前版本」配方：最新资料片的，以及没标资料片的（漏标的新配方、中间件、补精力食物、梓匠）。
 * 其余就是上个资料片（丝路风语）的配方，在页面上单独切换查看
 */
export function isCurrentRecipe(r: CraftRecipe): boolean {
  return !r.dlc || r.dlc === CURRENT_DLC
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id
}

export function npcPrice(id: string): number | null {
  return NPC_PRICES[itemName(id)] ?? null
}

export function expectedCount(out: CraftRecipe['outs'][number]): number {
  return (out[3] * (out[1] + out[2])) / 2
}

export interface PriceContext {
  settings: CraftSettings
  auction: Record<string, AuctionPrice | null | undefined>
}

export type PriceVia = 'npc' | 'auction' | 'manual' | 'craft'

export interface UnitPrice {
  /** 单价（铜）；null = 拿不到价格 */
  price: number | null
  via: PriceVia
  updatedAt?: number
}

/**
 * @param asMaterial NPC 价只用于材料：NPC 价表按物品名匹配，产物可能和 NPC 材料重名
 *   （梓匠家具「青菜」10_417 vs 烹饪材料「青菜」5_31983），产物一律走交易行 / 自定义
 */
export function priceOf(id: string, ctx: PriceContext, asMaterial = true): UnitPrice {
  const npc = asMaterial ? npcPrice(id) : null
  if (npc !== null) return { price: npc, via: 'npc' }
  // 中间件可选「配方」：按自己做的材料费折算（只用于材料；中间件的材料都不是中间件，不会递归）
  if (asMaterial && ctx.settings.source[id] === 'craft' && MID_IDS.has(id)) {
    const made = midCraftUnit(id, ctx)
    if (made) return { price: made.price, via: 'craft' }
  }
  if (ctx.settings.source[id] === 'manual') return { price: ctx.settings.manual[id] ?? null, via: 'manual' }
  const a = ctx.auction[id]
  return a ? { price: a.price, via: 'auction', updatedAt: a.updatedAt } : { price: null, via: 'auction' }
}

/** 中间件按配方自制的单价 = 一次制作的材料费 / 一次期望产出个数；没有配方或材料缺价时 price 为 null */
export function midCraftUnit(id: string, ctx: PriceContext): { recipe: CraftRecipe; perCraft: number; price: number | null } | null {
  const recipe = PRODUCER.get(id)
  if (!recipe) return null
  let total = 0
  for (const [mid, n] of recipe.mats) {
    const p = priceOf(mid, ctx).price
    if (p === null) return { recipe, perCraft: expectedCount(recipe.outs[0]), price: null }
    total += p * n
  }
  const perCraft = expectedCount(recipe.outs[0])
  return { recipe, perCraft, price: perCraft > 0 ? total / perCraft : null }
}

export function craftTimes(recipeId: string, settings: CraftSettings): number {
  return Math.max(1, Math.floor(settings.times[recipeId] ?? 1))
}

export interface MaterialLine {
  id: string
  name: string
  /** N 次合计需要 */
  need: number
  owned: number
  buy: number
  unit: UnitPrice
  /** 「配方」取价时，需要买的 buy 件里自己做几件（其余按交易行价买）；其他取价方式为 0 */
  craftCount: number
  /** 「配方」取价时，其余部分按交易行价买的单价 */
  marketUnit: UnitPrice | null
  /** 小计：buy × 单价（配方取价时 = 自制件数 × 自制单价 + 其余 × 交易行价）；缺价时为 null */
  subtotal: number | null
  /** 按「配方」取价时，自己做要多花的精力 = 自制件数 / 单次期望产出 × 中间件配方精力；其余为 0 */
  craftVigor: number
}

export interface OutputLine {
  id: string
  name: string
  /** 单次制作的期望件数（用户改过就用改过的） */
  perCraft: number
  /** 是否是用户改过的期望值 */
  custom: boolean
  /** N 次合计期望件数 */
  expected: number
  unit: UnitPrice
  /** 扣手续费后的期望收益；缺价时为 null */
  value: number | null
}

export interface VigorFoodPart {
  /** 个数（整数） */
  count: number
  /** 每个的单价；自制 = 一次制作的材料费 / 一次期望产出个数 */
  unit: UnitPrice
  cost: number | null
}

export interface VigorFoodLine {
  food: VigorFood
  /** 买的个数是否自动折算（用户没填过买 / 自制个数） */
  auto: boolean
  /** 交易行买（或自定义单价）的部分 */
  buy: VigorFoodPart
  /** 自己做的部分；没填自制个数时为 null */
  self: (VigorFoodPart & { recipe: CraftRecipe; perCraft: number }) | null
  /** 买 + 自制合计；任一部分缺价时 null */
  cost: number | null
}

/** 主产物 → 配方（目前只用来找补精力食物的配方） */
const PRODUCER = new Map<string, CraftRecipe>()
for (const r of RECIPES) if (r.outs.length && !PRODUCER.has(r.outs[0][0])) PRODUCER.set(r.outs[0][0], r)

/** 自制食物每个的成本 = 一次制作的材料费 / 一次期望产出个数（自制的可能是以前做好的，不再扣本次精力） */
export function selfMadeUnit(food: VigorFood, ctx: PriceContext): { recipe: CraftRecipe; perCraft: number; price: number | null } | null {
  const fr = PRODUCER.get(food.id)
  if (!fr) return null
  const prices = fr.mats.map(([id, n]) => {
    const p = priceOf(id, ctx).price
    return p === null ? null : p * n
  })
  const perCraft = expectedCount(fr.outs[0])
  const matCost = prices.includes(null) ? null : (prices as number[]).reduce((s, p) => s + p, 0)
  return { recipe: fr, perCraft, price: matCost === null || perCraft <= 0 ? null : matCost / perCraft }
}

/**
 * 补精力食物 = 买的 + 自制的，分开计价。
 * - 两个个数都没填：买的按 need / 每个恢复量 向上取整，自制 0
 * - 只填了自制：买的自动补足剩下的精力
 * - 填了买的：按填的整数算
 */
function vigorFoodLine(food: VigorFood, need: number, recipeId: string, ctx: PriceContext): VigorFoodLine {
  const buyCustom = ctx.settings.foodCount[recipeId]
  const selfCount = ctx.settings.foodSelf[recipeId] ?? 0
  const auto = buyCustom === undefined && selfCount === 0
  // 食物只能整个吃，自动折算时向上取整（1e-9 防浮点把 3.0 算成 3.0000001 再进位）
  const buyCount = buyCustom ?? Math.max(0, Math.ceil(need / food.vigor - selfCount - 1e-9))

  const buyUnit = priceOf(food.id, ctx)
  const buy = { count: buyCount, unit: buyUnit, cost: buyCount === 0 ? 0 : buyUnit.price === null ? null : buyUnit.price * buyCount }

  let self: VigorFoodLine['self'] = null
  if (selfCount > 0) {
    const made = selfMadeUnit(food, ctx)
    const price = made?.price ?? null
    self = {
      count: selfCount,
      unit: { price, via: 'craft' },
      cost: price === null ? null : price * selfCount,
      recipe: made?.recipe as CraftRecipe,
      perCraft: made?.perCraft ?? 0
    }
  }
  const cost = buy.cost === null || (self && self.cost === null) ? null : buy.cost + (self?.cost ?? 0)
  return { food, auto, buy, self, cost }
}

export interface RecipeResult {
  recipe: CraftRecipe
  /** 选了补精力食物时的成本行 */
  vigorFood: VigorFoodLine | null
  /** 制作次数 */
  times: number
  /** 全部产物的期望件数合计（N 次） */
  expectedItems: number
  /** 单件成本 = 成本 / 期望件数 */
  unitCost: number | null
  lines: MaterialLine[]
  outputs: OutputLine[]
  cost: number | null
  revenue: number | null
  /** 保底收益：只算主产物（扣手续费）；只有一种产物、或缺价时为 null */
  baseRevenue: number | null
  profit: number | null
  /**
   * 保底利润：只算主产物（概率最高的那件）的收益 − 成本。
   * 只有一种产物、或算不出利润时为 null
   */
  baseProfit: number | null
  /** 单件收益 = 收益 / 期望件数（多种产物时是按件数平均） */
  unitRevenue: number | null
  /** 单件利润 = 利润 / 期望件数 */
  unitProfit: number | null
  /** 保底单件收益 / 利润：假设只出主产物，按主产物件数摊 */
  baseUnitRevenue: number | null
  baseUnitProfit: number | null
  vigor: number
  perVigor: number | null
  /** 保底每点精力利润 = 保底利润 / 精力；没有保底利润时为 null */
  basePerVigor: number | null
  /** 缺价的材料名 */
  missingMats: string[]
  /** 次要产物（小概率出的精品等）没有报价，按 0 计 */
  partialOutputs: boolean
}

export function evaluateRecipe(r: CraftRecipe, ctx: PriceContext): RecipeResult {
  const times = craftTimes(r.id, ctx.settings)
  const owned = ctx.settings.owned[r.id] ?? {}
  const lines: MaterialLine[] = r.mats.map(([id, per]) => {
    const need = per * times
    // NPC 商店有售的材料只能买，不支持自备（以前存下的自备数量忽略）
    const own = npcPrice(id) !== null ? 0 : Math.min(need, Math.max(0, owned[id] ?? 0))
    const buy = need - own
    const unit = priceOf(id, ctx)
    const mid = unit.via === 'craft' ? midCraftUnit(id, ctx) : null
    // 配方取价：自制件数默认 = 需要买的全部；用户填了就按填的（不超过需要买的），其余按交易行价买
    const craftCount = mid ? Math.min(buy, Math.max(0, ctx.settings.midSelf[r.id]?.[id] ?? buy)) : 0
    const rest = buy - craftCount
    const a = mid ? ctx.auction[id] : null
    const marketUnit: UnitPrice | null = mid ? (a ? { price: a.price, via: 'auction', updatedAt: a.updatedAt } : { price: null, via: 'auction' }) : null
    // 全部自备时不需要价格
    let subtotal: number | null
    if (buy === 0) subtotal = 0
    else if (mid) {
      const craftPart = craftCount === 0 ? 0 : unit.price === null ? null : unit.price * craftCount
      const restPart = rest === 0 ? 0 : marketUnit!.price === null ? null : marketUnit!.price * rest
      subtotal = craftPart === null || restPart === null ? null : craftPart + restPart
    } else subtotal = unit.price === null ? null : unit.price * buy
    const craftVigor = mid && mid.perCraft > 0 ? (craftCount / mid.perCraft) * mid.recipe.vigor : 0
    return { id, name: itemName(id), need, owned: own, buy, unit, craftCount, marketUnit, subtotal, craftVigor }
  })
  // 配方取价的中间件要自己做，精力一并计入（也会影响补精力食物的需求）
  const vigor = r.vigor * times + lines.reduce((s, l) => s + l.craftVigor, 0)
  const food = VIGOR_FOODS.find((f) => f.key === ctx.settings.vigorFood[r.id])
  const vigorFood = food ? vigorFoodLine(food, vigor, r.id, ctx) : null
  const missing: string[] = lines.filter((l) => l.subtotal === null).map((l) => l.name)
  if (vigorFood && vigorFood.cost === null) missing.push(vigorFood.food.name)
  const cost = missing.length
    ? null
    : lines.reduce((s, l) => s + (l.subtotal ?? 0), 0) + (vigorFood?.cost ?? 0)

  const keep = 1 - AUCTION_FEE_PERCENT / 100
  const yields = ctx.settings.yield[r.id] ?? {}
  const outputs: OutputLine[] = r.outs.map((o) => {
    const unit = priceOf(o[0], ctx, false)
    const custom = yields[o[0]] !== undefined
    const perCraft = custom ? yields[o[0]] : expectedCount(o)
    const expected = perCraft * times
    return { id: o[0], name: itemName(o[0]), perCraft, custom, expected, unit, value: unit.price === null ? null : unit.price * expected * keep }
  })
  const primaryMissing = outputs.length === 0 || outputs[0].value === null
  const revenue = primaryMissing ? null : outputs.reduce((s, o) => s + (o.value ?? 0), 0)
  const profit = revenue === null || cost === null ? null : revenue - cost
  const expectedItems = outputs.reduce((s, o) => s + o.expected, 0)
  // 有小概率产物（·精、高价变体）就给保底利润，即只出主产物时的利润
  const baseProfit = profit === null || cost === null || outputs.length < 2 ? null : outputs[0].value! - cost
  const baseRevenue = outputs.length < 2 || outputs[0].value === null ? null : outputs[0].value
  const perItem = (v: number | null, n: number) => (v === null || n <= 0 ? null : v / n)
  const mainCount = outputs[0]?.expected ?? 0

  return {
    recipe: r,
    vigorFood,
    times,
    expectedItems,
    unitCost: cost === null || expectedItems <= 0 ? null : cost / expectedItems,
    lines,
    outputs,
    cost,
    revenue,
    baseRevenue,
    profit,
    baseProfit,
    unitRevenue: perItem(revenue, expectedItems),
    unitProfit: perItem(profit, expectedItems),
    baseUnitRevenue: perItem(baseRevenue, mainCount),
    baseUnitProfit: perItem(baseProfit, mainCount),
    vigor,
    perVigor: profit === null || vigor <= 0 ? null : profit / vigor,
    basePerVigor: baseProfit === null || vigor <= 0 ? null : baseProfit / vigor,
    missingMats: missing,
    partialOutputs: !primaryMissing && outputs.some((o) => o.value === null)
  }
}

/** 这些配方需要查交易行价格的物品：材料（NPC 有售的除外）+ 全部产物 */
export function collectPriceIds(recipeIds: string[]): string[] {
  const ids = new Set<string>()
  const products = new Set<string>()
  for (const rid of recipeIds) {
    const r = RECIPE_MAP.get(rid)
    if (!r) continue
    r.mats.forEach(([id]) => ids.add(id))
    r.outs.forEach(([id]) => products.add(id))
  }
  // 补精力食物随时可能被选上，一并查价（含自制用的材料）
  VIGOR_FOODS.forEach((f) => {
    ids.add(f.id)
    PRODUCER.get(f.id)?.mats.forEach(([id]) => ids.add(id))
  })
  // 中间件可能选「配方」取价，其配方材料也要查价
  for (const id of [...ids]) if (MID_IDS.has(id)) PRODUCER.get(id)?.mats.forEach(([m]) => ids.add(m))
  // NPC 有售的材料不用查；产物不走 NPC 价，全部要查
  return [...[...ids].filter((id) => npcPrice(id) === null), ...products]
}
