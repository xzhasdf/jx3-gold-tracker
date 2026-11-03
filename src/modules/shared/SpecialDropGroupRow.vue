<template>
  <!-- 交互与 ExpandableTagRow（历史团长）一致：默认折叠 maxLines 行，溢出时显示「展开」 -->
  <div class="dg-row">
    <span class="dg-label">{{ label }}：</span>
    <div
      ref="contentRef"
      class="dg-chips"
      :class="{ collapsed: !expanded }"
      :style="!expanded ? { maxHeight: collapsedMaxHeight + 'px' } : undefined"
    >
      <span
        v-for="d in items"
        :key="d.id"
        class="dg-chip"
        :class="{ selected: selectedSet.has(d.id) }"
        @click="emit('toggle', d.id, !selectedSet.has(d.id))"
      >
        <img :src="resolveDropIcon(d.iconBase64)" class="dg-icon" />
        <span :style="{ color: dropNameColor(d.itemName) }">{{ d.itemName }}</span>
      </span>
    </div>
    <n-button v-if="overflow" text size="tiny" type="primary" class="dg-toggle" @click="expanded = !expanded">
      {{ expanded ? '收起' : '展开' }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpecialDrop } from '../../types'
import { dropNameColor, resolveDropIcon } from '../../utils/specialDrop'

const props = withDefaults(
  defineProps<{ label: string; items: SpecialDrop[]; selectedIds: string[]; maxLines?: number }>(),
  { maxLines: 1 }
)
const emit = defineEmits<{ (e: 'toggle', id: string, checked: boolean): void }>()

const selectedSet = computed(() => new Set(props.selectedIds))

const contentRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const overflow = ref(false)

const ROW_HEIGHT = 24
const ROW_GAP = 6
const collapsedMaxHeight = computed(() => ROW_HEIGHT * props.maxLines + ROW_GAP * Math.max(0, props.maxLines - 1))

let ro: ResizeObserver | null = null

function measure() {
  const el = contentRef.value
  if (!el || expanded.value) return
  overflow.value = el.scrollHeight > el.clientHeight + 1
}

onMounted(() => {
  if (!contentRef.value) return
  ro = new ResizeObserver(() => measure())
  ro.observe(contentRef.value)
  measure()
})

watch(
  () => props.items.length,
  async () => {
    await nextTick()
    measure()
  }
)

onUnmounted(() => {
  ro?.disconnect()
  ro = null
})
</script>

<style scoped>
.dg-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.dg-label {
  flex: 0 0 auto;
  min-width: 64px;
  white-space: nowrap;
  font-size: 12px;
  line-height: 24px;
  color: #909399;
  user-select: none;
}
.dg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 0;
  min-width: 0;
}
.dg-chips.collapsed {
  overflow: hidden;
}
.dg-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  box-sizing: border-box;
  padding: 0 8px 0 3px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.dg-chip:hover {
  border-color: #3f83f8;
}
.dg-chip.selected {
  border-color: #18a058;
  background: #18a05814;
}
.dg-icon {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 4px;
}
.dg-toggle {
  flex: 0 0 auto;
  line-height: 24px;
}
</style>
