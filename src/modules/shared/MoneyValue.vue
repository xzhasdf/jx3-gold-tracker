<template>
  <span class="money-value">
    <template v-if="isNegative">-</template>
    <template v-if="parsed.brick > 0">
      {{ parsed.brick }}<img src="/金砖.png" class="money-icon" />
    </template>
    <template v-if="parsed.gold > 0 || parsed.brick === 0">
      {{ parsed.gold }}<img src="/金币.png" class="money-icon coin" />
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { splitGold } from '../../utils/money'

const props = defineProps<{ value: number }>()

const isNegative = computed(() => props.value < 0)
const parsed = computed(() => splitGold(Math.abs(props.value)))
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
