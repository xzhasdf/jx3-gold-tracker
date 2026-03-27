<template>
  <n-space vertical :size="8">
    <n-input-number :value="brick" :min="0" style="width: 340px; max-width: 100%" @update:value="onBrickUpdate">
      <template #prefix>
        <img :src="iconBrick" style="height: 16px; width: auto;" />
      </template>
    </n-input-number>
    <n-input-number :value="gold" :min="0" style="width: 340px; max-width: 100%" @update:value="onGoldUpdate">
      <template #prefix>
        <img :src="iconGold" style="height: 16px; width: auto;" />
      </template>
    </n-input-number>
  </n-space>
</template>

<script setup lang="ts">
import iconGold from '../../assets/金币.png'
import iconBrick from '../../assets/金砖.png'

defineProps<{ brick: number | null; gold: number | null }>()

const emit = defineEmits<{
  (e: 'update:brick', value: number | null): void
  (e: 'update:gold', value: number | null): void
}>()

function onBrickUpdate(value: number | null) {
  emit('update:brick', value)
}

function onGoldUpdate(value: number | null) {
  emit('update:gold', value)
}
</script>
