<template>
  <span class="craft-money" :class="{ negative: isNegative }">
    <template v-if="isNegative">-</template>
    <template v-for="part in parts" :key="part.unit">
      {{ part.amount }}<img v-if="ICONS[part.unit]" :src="ICONS[part.unit]" class="craft-money-icon" :class="part.unit" /><span v-else class="craft-money-unit">{{ part.unit }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 金额单位：铜。1 砖 = 10000 金，1 金 = 100 银，1 银 = 100 铜。
// 只显示最高的两级，够看出量级又不啰嗦：≥1砖 显示砖金，≥1金 显示金银，否则银铜。
const props = defineProps<{ value: number }>()

// 银币 / 铜币 图标是可选的：src/assets 里没有对应图片时显示文字
const assetModules = import.meta.glob('../../../assets/{金砖,金币,银币,铜币}.png', { eager: true, import: 'default' }) as Record<string, string>
const ICONS: Record<string, string | undefined> = {
  砖: assetModules['../../../assets/金砖.png'],
  金: assetModules['../../../assets/金币.png'],
  银: assetModules['../../../assets/银币.png'],
  铜: assetModules['../../../assets/铜币.png']
}

const UNITS = [
  { unit: '砖', size: 100000000 },
  { unit: '金', size: 10000 },
  { unit: '银', size: 100 },
  { unit: '铜', size: 1 }
]

/** 拆成「高一级 + 低一级」两段；低一级四舍五入后可能进位成整个高一级，所以要再往上挪一级重算 */
function split(abs: number, start: number) {
  const hi = UNITS[start]
  const lo = UNITS[Math.min(start + 1, UNITS.length - 1)]
  const total = Math.round(abs / lo.size)
  const ratio = hi.size / lo.size
  return { hi, lo, total, hiAmount: Math.floor(total / ratio), loAmount: hi === lo ? 0 : total % ratio }
}

const parts = computed(() => {
  const abs = Math.abs(props.value)
  let start = UNITS.findIndex((u) => abs >= u.size)
  if (start < 0) start = UNITS.length - 1
  let r = split(abs, start)
  // 例：99,999,960 铜 → 9999 金 99.996 银，四舍五入成「10000 金」，应进位成「1 砖」
  while (start > 0 && r.hiAmount * r.hi.size >= UNITS[start - 1].size) {
    start -= 1
    r = split(abs, start)
  }
  const out: Array<{ unit: string; amount: number }> = []
  if (r.hiAmount > 0) out.push({ unit: r.hi.unit, amount: r.hiAmount })
  if (r.loAmount > 0) out.push({ unit: r.lo.unit, amount: r.loAmount })
  // 四舍五入后为 0（含不足半铜的值）统一显示「0 金」
  if (!out.length) out.push({ unit: '金', amount: 0 })
  return out
})

/** 四舍五入后为 0 的负数（如 -0.3 铜）不显示负号、不标红 */
const isNegative = computed(() => props.value < 0 && Math.round(Math.abs(props.value)) > 0)
</script>

<style scoped>
.craft-money {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.craft-money-icon {
  height: 0.8em;
  width: auto;
  margin-right: 2px;
}
.craft-money-icon.砖 {
  height: 1.1em;
}
/* 银/铜图片四周留白比金币多，同样高度看起来偏小，放大到视觉上和金币一致 */
.craft-money-icon.银,
.craft-money-icon.铜 {
  height: 1.4em;
  margin: -0.15em 0 -0.15em -2px;
}
.craft-money-unit {
  font-size: 0.85em;
  opacity: 0.75;
  margin-right: 2px;
}
</style>
