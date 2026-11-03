<template>
  <div class="dp-root">
    <SpecialDropGroupRow
      v-for="group in groups"
      :key="group.title"
      :label="group.title"
      :items="group.items"
      :selected-ids="selectedIds"
      @toggle="(id: string, checked: boolean) => emit('toggle', id, checked)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecialDrop } from '../../types'
import { dropCategory, DROP_CATEGORY_ORDER } from '../../utils/specialDrop'
import SpecialDropGroupRow from './SpecialDropGroupRow.vue'

const props = defineProps<{ drops: SpecialDrop[]; selectedIds: string[] }>()
const emit = defineEmits<{ (e: 'toggle', id: string, checked: boolean): void }>()

// 按类别分组，组内保持原有顺序；空组不显示
const groups = computed(() =>
  DROP_CATEGORY_ORDER.map((title) => ({ title, items: props.drops.filter((d) => dropCategory(d) === title) })).filter(
    (g) => g.items.length > 0
  )
)
</script>

<style scoped>
.dp-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
</style>
