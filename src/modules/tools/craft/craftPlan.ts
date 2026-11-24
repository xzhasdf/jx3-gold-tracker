// 多配方「材料清单」：选定若干配方 + 各自制作次数，把中间件、自制精力药展开成基础材料后统一统计。
//
// 口径：
//   - 基础材料 = 不是中间件的材料；中间件 / 自制精力药只列出它们自己的制作次数和材料，最终合计只按基础材料
//   - 中间件、自制精力药的制作次数 = ceil(需要个数 / 单次产出)，产出口径可选「保底」（最少件数）或「期望」；
//     期望统一取配方里「单次期望」填写的数值（没改过就按概率 × (最少 + 最多) / 2）
//   - 精力 = 选定配方本体精力（可单独取消某个配方的精力）+ 中间件自制精力（可忽略）
//   - 精力药个数 = ceil(精力 / 每个恢复量)，只是告诉人要备多少药，不考虑「用药补精力」
//   - 自制精力药时，做药本身的精力计入总精力消耗，但不会反过来增加药的个数；
//     产出口径单独可选（保底 / 期望，默认期望）；做药次数向上取整，精力 = 次数 × 配方精力。
//     例：38 个转神餐、期望每次出 2.5 个 → 做 16 次，16 × 50 = 800
//     它用到的中间件的精力受「忽略中间件精力」控制（中间件按整数次数算）
//   - 自备材料不计成本：基础材料可选「自备」并填数量，小计 = (合计 − 自备) × 单价；NPC 有售的材料不支持自备
//   - 精力药和选定配方共用同一个中间件时，两边各自取整、各占一行，合计是上界
import { MID_IDS, PRODUCER, RECIPE_MAP, craftTimes, expectedCount, itemName, priceOf, type CraftRecipe, type PriceContext, type UnitPrice, type VigorFood } from './craftCalc'

export type PlanYieldMode = 'min' | 'expected'
export type PlanFoodSource = 'self' | 'buy'

export interface PlanOptions {
  /** 自制精力药的产出口径：决定做几次、做药精力；默认期望（大概值） */
  foodYieldMode: PlanYieldMode
  /** null = 不折算精力药 */
  food: VigorFood | null
  foodSource: PlanFoodSource
  /** 忽略中间件自制精力，只算配方本体 */
  ignoreMidVigor: boolean
  yieldMode: PlanYieldMode
  /** 自备材料：itemId → 自备数量；有记录 = 选了自备，这部分不计成本 */
  owned: Record<string, number>
}

export interface PlanEntry {
  recipeId: string
  /** false = 这个配方的精力不计入（比如咸骨粥不想算在精力药里） */
  countVigor: boolean
  /** 按次数制作：这次清单里临时指定的次数；缺省取配方设置里的制作次数 */
  times?: number
  /** 按数量制作：想要的产出件数；缺省按配方设置里的制作次数 */
  qty?: number
  /** 按数量制作时，单次产出按保底还是期望折算制作次数；缺省保底 */
  qtyYield?: PlanYieldMode
}

export interface PlanRecipeLine {
  recipe: CraftRecipe
  /** 实际制作次数（按数量时由件数折算） */
  times: number
  /** 按数量制作时想要的件数；按次数时为 undefined */
  qty?: number
  /** 按数量制作时的产出口径；按次数时为 undefined */
  qtyYield?: PlanYieldMode
  /** 按数量折算次数时每次产出的件数（保底 = 最少件数，期望 = 配方里的单次期望）；按次数时为 undefined */
  perCraft?: number
  /** times 次的产出件数（保底 / 期望，按所选口径） */
  produced: number
  /** 各产物 times 次的期望件数（折合展示用）：取配方里「单次期望」填写的数值，没填按概率 × (最少 + 最多) / 2；第一项是主产物，其余是【精】等小概率产物 */
  expectedOuts: Array<{ id: string; name: string; qty: number }>
  vigor: number
  countVigor: boolean
}

/** 中间件 / 自制精力药的制作行 */
export interface PlanCraftLine {
  key: string
  id: string
  name: string
  kind: 'mid' | 'food'
  recipe: CraftRecipe
  need: number
  crafts: number
  /** crafts × 单次产出（按所选口径） */
  produced: number
  /** crafts × 配方精力 */
  vigor: number
  mats: Array<{ id: string; name: string; qty: number }>
}

/** 配方里用户改过的单次期望产出：recipeId → 产物itemId → 件数 */
type YieldOverride = Record<string, Record<string, number>>

type Via = 'direct' | 'viaMid' | 'viaFood'
type BaseMap = Map<string, Record<Via, number>>

export interface PlanMaterial {
  id: string
  name: string
  total: number
  /** 选定配方直接用掉 */
  direct: number
  /** 中间件配方用掉 */
  viaMid: number
  /** 自制精力药（含它的中间件）用掉 */
  viaFood: number
  unit: UnitPrice
  /** 取价方式选了「自备」（NPC 有售的材料不支持自备） */
  isOwn: boolean
  /** 自备数量（已截到 0~合计）；不自备时为 0 */
  owned: number
  /** 小计 = (合计 − 自备) × 单价；缺价时为 null（不用买时为 0） */
  subtotal: number | null
}

export interface PlanFood {
  food: VigorFood
  count: number
  source: PlanFoodSource
  /** 自制时的制作次数；购买为 0 */
  crafts: number
  /** 购买时的单价 / 总价 */
  unit: UnitPrice | null
  cost: number | null
}

export interface PlanResult {
  recipes: PlanRecipeLine[]
  crafts: PlanCraftLine[]
  materials: PlanMaterial[]
  /** 配方本体精力（已排除取消计入的配方） */
  vigorBody: number
  /** 计入的中间件自制精力；忽略时为 0 */
  vigorMid: number
  /** 被忽略的中间件精力（仅用于提示） */
  vigorMidIgnored: number
  /** 折算精力药个数用的精力需求 = 本体 + 计入的中间件 */
  vigorTotal: number
  /** 自制精力药的制作精力（含它用到的中间件，忽略中间件精力时不含后者）；买药或不折算时为 0 */
  vigorFood: number
  /** 总精力消耗 = vigorTotal + vigorFood */
  vigorAll: number
  food: PlanFood | null
  /** 基础材料 + 购买的精力药；有缺价时为 null */
  cost: number | null
  missing: string[]
}

const isExpandable = (id: string) => MID_IDS.has(id) && PRODUCER.has(id)

/**
 * 单次制作的主产物件数（【精】等小概率产物不算）。
 * 保底 = 主产物最少件数；期望 = 主产物的期望件数 = 概率 × (最少 + 最多) / 2。
 * 中间件、精力药概率 100%，期望就是 (最少 + 最多) / 2
 */
export function yieldPerCraft(r: CraftRecipe, mode: PlanYieldMode, ov: YieldOverride): number {
  // 期望：优先取配方里「单次期望」填写过的数值，没填才按概率 × (最少 + 最多) / 2 算
  return mode === 'min' ? r.outs[0][1] : ov[r.id]?.[r.outs[0][0]] ?? expectedCount(r.outs[0])
}
const perCraft = yieldPerCraft

function craftsFor(need: number, r: CraftRecipe, mode: PlanYieldMode, ov: YieldOverride): number {
  // 1e-9 防浮点把整数算成 x.0000001 再进位
  return Math.ceil(need / Math.max(perCraft(r, mode, ov), 1e-9) - 1e-9)
}

/** 把一份需求展开成基础材料 + 中间件制作行。固定点迭代，防中间件套中间件 */
function expand(need: Map<string, number>, direct: Via, mode: PlanYieldMode, keyPrefix: string, ov: YieldOverride): { base: BaseMap; lines: PlanCraftLine[] } {
  let midNeed = new Map<string, number>()
  let base: BaseMap = new Map()
  let lines: PlanCraftLine[] = []
  for (let i = 0; i < 6; i++) {
    base = new Map()
    lines = []
    const next = new Map<string, number>()
    const sink = (id: string, q: number, via: Via) => {
      if (isExpandable(id)) {
        next.set(id, (next.get(id) ?? 0) + q)
        return
      }
      const cur = base.get(id) ?? { direct: 0, viaMid: 0, viaFood: 0 }
      cur[via] += q
      base.set(id, cur)
    }
    for (const [id, q] of need) sink(id, q, direct)
    for (const [id, q] of midNeed) {
      const r = PRODUCER.get(id)!
      const crafts = craftsFor(q, r, mode, ov)
      lines.push({
        key: `${keyPrefix}${id}`,
        id,
        name: itemName(id),
        kind: 'mid',
        recipe: r,
        need: q,
        crafts,
        produced: crafts * perCraft(r, mode, ov),
        vigor: crafts * r.vigor,
        mats: r.mats.map(([m, n]) => ({ id: m, name: itemName(m), qty: n * crafts }))
      })
      // 中间件的材料：属于「食物」就记 viaFood，否则记 viaMid
      for (const [m, n] of r.mats) sink(m, n * crafts, direct === 'viaFood' ? 'viaFood' : 'viaMid')
    }
    const same = next.size === midNeed.size && [...next].every(([k, v]) => midNeed.get(k) === v)
    midNeed = next
    if (same) break
  }
  return { base, lines }
}

export function planMaterials(entries: PlanEntry[], opt: PlanOptions, ctx: PriceContext): PlanResult {
  const ov: YieldOverride = ctx.settings.yield ?? {}
  const recipes: PlanRecipeLine[] = []
  for (const e of entries) {
    const recipe = RECIPE_MAP.get(e.recipeId)
    if (!recipe) continue
    const qty = e.qty !== undefined && e.qty > 0 ? Math.floor(e.qty) : undefined
    const qtyYield = qty !== undefined ? e.qtyYield ?? 'min' : undefined
    const times = qty !== undefined ? Math.max(1, craftsFor(qty, recipe, qtyYield!, ov)) : (e.times !== undefined && e.times > 0 ? Math.floor(e.times) : craftTimes(e.recipeId, ctx.settings))
    const produced = times * yieldPerCraft(recipe, qtyYield ?? 'min', ov)
    const expectedOuts = recipe.outs.map((o) => ({ id: o[0], name: itemName(o[0]), qty: times * (ov[recipe.id]?.[o[0]] ?? expectedCount(o)) }))
    const perCraftUsed = qty !== undefined ? yieldPerCraft(recipe, qtyYield!, ov) : undefined
    recipes.push({ recipe, times, qty, qtyYield, perCraft: perCraftUsed, produced, expectedOuts, vigor: recipe.vigor * times, countVigor: e.countVigor })
  }
  const vigorBody = recipes.reduce((s, r) => s + (r.countVigor ? r.vigor : 0), 0)

  const need = new Map<string, number>()
  for (const r of recipes) for (const [id, n] of r.recipe.mats) need.set(id, (need.get(id) ?? 0) + n * r.times)
  const main = expand(need, 'direct', opt.yieldMode, 'mid:', ov)
  const vigorMidAll = main.lines.reduce((s, l) => s + l.vigor, 0)
  const vigorMid = opt.ignoreMidVigor ? 0 : vigorMidAll
  const vigorTotal = vigorBody + vigorMid

  const baseAll: BaseMap = new Map()
  const merge = (m: BaseMap) => {
    for (const [id, v] of m) {
      const cur = baseAll.get(id) ?? { direct: 0, viaMid: 0, viaFood: 0 }
      cur.direct += v.direct
      cur.viaMid += v.viaMid
      cur.viaFood += v.viaFood
      baseAll.set(id, cur)
    }
  }
  merge(main.base)
  const crafts = [...main.lines]

  let food: PlanFood | null = null
  let vigorFood = 0
  if (opt.food && vigorTotal > 0) {
    const count = Math.ceil(vigorTotal / opt.food.vigor - 1e-9)
    const fr = PRODUCER.get(opt.food.id)
    if (opt.foodSource === 'self' && fr) {
      const n = craftsFor(count, fr, opt.foodYieldMode, ov)
      const foodNeed = new Map<string, number>()
      for (const [m, q] of fr.mats) foodNeed.set(m, q * n)
      const sub = expand(foodNeed, 'viaFood', opt.yieldMode, 'foodmid:', ov)
      merge(sub.base)
      vigorFood = n * fr.vigor + (opt.ignoreMidVigor ? 0 : sub.lines.reduce((s, l) => s + l.vigor, 0))
      crafts.push({
        key: 'food',
        id: opt.food.id,
        name: opt.food.name,
        kind: 'food',
        recipe: fr,
        need: count,
        crafts: n,
        produced: n * perCraft(fr, opt.foodYieldMode, ov),
        vigor: n * fr.vigor,
        mats: fr.mats.map(([m, q]) => ({ id: m, name: itemName(m), qty: q * n }))
      })
      crafts.push(...sub.lines.map((l) => ({ ...l, name: `${l.name}（精力药用）` })))
      food = { food: opt.food, count, source: 'self', crafts: n, unit: null, cost: null }
    } else {
      const unit = priceOf(opt.food.id, ctx)
      food = { food: opt.food, count, source: 'buy', crafts: 0, unit, cost: unit.price === null ? null : unit.price * count }
    }
  }

  const materials: PlanMaterial[] = [...baseAll].map(([id, v]) => {
    const unit = priceOf(id, ctx)
    const total = v.direct + v.viaMid + v.viaFood
    const isOwn = unit.via !== 'npc' && Object.prototype.hasOwnProperty.call(opt.owned, id)
    const owned = isOwn ? Math.min(total, Math.max(0, Math.floor(opt.owned[id] ?? 0))) : 0
    const buy = total - owned
    const subtotal = buy === 0 ? 0 : unit.price === null ? null : unit.price * buy
    return { id, name: itemName(id), total, ...v, unit, isOwn, owned, subtotal }
  })
  // 按「总价」（不扣自备）排序：改自备数量不会让行跳来跳去
  const gross = (m: PlanMaterial) => (m.unit.price === null ? Infinity : m.unit.price * m.total)
  materials.sort((a, b) => gross(b) - gross(a) || a.name.localeCompare(b.name, 'zh'))

  const missing = materials.filter((m) => m.subtotal === null).map((m) => m.name)
  if (food?.source === 'buy' && food.cost === null) missing.push(food.food.name)
  const cost = missing.length ? null : materials.reduce((s, m) => s + (m.subtotal ?? 0), 0) + (food?.cost ?? 0)

  return { recipes, crafts, materials, vigorBody, vigorMid, vigorMidIgnored: opt.ignoreMidVigor ? vigorMidAll : 0, vigorTotal, vigorFood, vigorAll: vigorTotal + vigorFood, food, cost, missing }
}
