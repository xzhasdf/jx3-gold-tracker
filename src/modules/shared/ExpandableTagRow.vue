<template>
  <div class="quick-tag-row">
    <span class="quick-tag-label">{{ label }}：</span>
    <div
      ref="contentRef"
      class="quick-tag-chips"
      :class="{ collapsed: !expanded }"
      :style="!expanded ? { maxHeight: collapsedMaxHeight + 'px' } : undefined"
    >
      <n-tag
        v-for="item in props.items"
        :key="item"
        size="small"
        round
        type="info"
        class="quick-tag"
        @click="emit('select', item)"
      >{{ item }}</n-tag>
    </div>
    <n-button v-if="overflow" text size="tiny" type="primary" class="quick-tag-toggle" @click="expanded = !expanded">
      {{ expanded ? '收起' : '展开' }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{ label: string; items: string[]; maxLines?: number }>(),
  { maxLines: 2 }
)
const emit = defineEmits<{ (e: 'select', value: string): void }>()

const contentRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const overflow = ref(false)

const ROW_HEIGHT = 22
const ROW_GAP = 6
const collapsedMaxHeight = computed(
  () => ROW_HEIGHT * props.maxLines + ROW_GAP * Math.max(0, props.maxLines - 1)
)

let ro: ResizeObserver | null = null

function measure() {
  const el = contentRef.value
  if (!el) return
  // 仅在折叠状态测量是否溢出；展开后保持按钮可见以便收起。
  if (expanded.value) return
  overflow.value = el.scrollHeight > el.clientHeight + 1
}

onMounted(() => {
  if (!contentRef.value) return
  ro = new ResizeObserver(() => measure())
  ro.observe(contentRef.value)
  measure()
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
})
</script>

<style scoped>
.quick-tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  padding-top: 2px;
}
.quick-tag-label {
  font-size: 12px;
  color: #909399;
  user-select: none;
  line-height: 22px;
  flex: 0 0 auto;
}
.quick-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 0;
  min-width: 0;
}
.quick-tag-chips.collapsed {
  overflow: hidden;
}
.quick-tag {
  cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
}
.quick-tag:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}
.quick-tag-toggle {
  flex: 0 0 auto;
  align-self: flex-start;
  line-height: 22px;
}
</style>
