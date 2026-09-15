<template>
  <span class="money-value">
    <template v-if="isNegative">-</template>
    <template v-if="parsed.brick > 0">
      {{ parsed.brick }}<img :src="iconBrick" class="money-icon" />
    </template>
    <template v-if="parsed.gold > 0 || parsed.brick === 0">
      {{ goldText }}<img :src="iconGold" class="money-icon coin" />
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { splitGold } from '../../utils/money'

import iconGold from '../../assets/金币.png'
import iconBrick from '../../assets/金砖.png'

const props = defineProps<{
  value: number
  /** 金位保留的小数位；不传按整数显示（记账金额都是整数，只有摊销这类算出来的值需要小数） */
  precision?: number
}>()

const isNegative = computed(() => props.value < 0)

const parsed = computed(() => {
  const abs = Math.abs(props.value)
  const precision = props.precision ?? 0
  if (precision <= 0) return splitGold(abs)

  let brick = Math.floor(abs / 10000)
  let gold = Number((abs - brick * 10000).toFixed(precision))
  // 9999.996 这类值四舍五入后会顶成 10000，进位到砖才不会显示成「0砖10000金」
  if (gold >= 10000) {
    brick += 1
    gold = 0
  }
  return { brick, gold }
})

const goldText = computed(() => {
  const precision = props.precision ?? 0
  return precision > 0 ? parsed.value.gold.toFixed(precision) : String(parsed.value.gold)
})
</script>

<style scoped>
.money-value {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.money-icon {
  height: 1.1em;
  width: auto;
  vertical-align: middle;
}
.money-icon.coin {
  height: 0.8em;
}
</style>
