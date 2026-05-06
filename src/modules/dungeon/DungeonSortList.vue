<template>
  <div class="dungeon-sort">
    <div class="dungeon-sort-tip">提示：可拖拽调整顺序，或使用右侧按钮快速置顶/置底</div>
    <n-scrollbar style="max-height: 480px; padding-right: 12px">
      <draggable
        :list="sorted"
        item-key="value"
        tag="div"
        ghost-class="ghost"
        :animation="200"
        :component-data="{ class: 'dungeon-sort-list' }"
        @end="emitChange"
      >
        <template #item="{ element, index }">
          <div class="dungeon-sort-item">
            <div class="dungeon-sort-seq" :class="seqClass(index)">{{ index + 1 }}</div>
            <div class="dungeon-sort-label">{{ element.label }}</div>
            <div class="dungeon-sort-actions">
              <button
                type="button"
                class="icon-btn"
                :disabled="index === 0"
                title="置顶"
                @click="setTop(element.value)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 4h16v2H4V4zm8 4l-6 6h4v6h4v-6h4l-6-6z"/></svg>
              </button>
              <button
                type="button"
                class="icon-btn"
                :disabled="index === sorted.length - 1"
                title="置底"
                @click="setBottom(element.value)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 20h16v-2H4v2zm8-4l6-6h-4V4h-4v6H6l6 6z"/></svg>
              </button>
            </div>
          </div>
        </template>
      </draggable>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import draggable from 'vuedraggable'

interface Item {
  label: string
  value: string
}

const props = defineProps<{ options: Item[] }>()
const emit = defineEmits<{ (e: 'change', values: string[]): void }>()

const sorted = ref<Item[]>(props.options.slice())

watch(() => props.options, (next) => {
  // 仅当外部传入的内容与当前显示不同（如新增/删除/隐藏）时才重置
  const a = sorted.value.map((i) => i.value).join('|')
  const b = next.map((i) => i.value).join('|')
  if (a !== b) sorted.value = next.slice()
})

function emitChange() {
  emit('change', sorted.value.map((i) => i.value))
}

function setTop(value: string) {
  const idx = sorted.value.findIndex((i) => i.value === value)
  if (idx <= 0) return
  const next = sorted.value.slice()
  const [target] = next.splice(idx, 1)
  next.unshift(target)
  sorted.value = next
  emitChange()
}

function setBottom(value: string) {
  const idx = sorted.value.findIndex((i) => i.value === value)
  if (idx === -1 || idx === sorted.value.length - 1) return
  const next = sorted.value.slice()
  const [target] = next.splice(idx, 1)
  next.push(target)
  sorted.value = next
  emitChange()
}

function seqClass(index: number): string {
  if (index === 0) return 'seq-1'
  if (index === 1) return 'seq-2'
  if (index === 2) return 'seq-3'
  return 'seq-n'
}
</script>

<style scoped>
.dungeon-sort-tip {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}
.dungeon-sort-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dungeon-sort-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #efeff5;
  border-radius: 3px;
  cursor: grab;
  transition: 0.2s;
}
.dungeon-sort-item:hover {
  border-color: #18a058;
}
.dungeon-sort-item:active {
  cursor: grabbing;
}
.dungeon-sort-seq {
  min-width: 18px;
  height: 18px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  flex-shrink: 0;
}
.seq-1 { background: #ffe5e5; color: #f40000; }
.seq-2 { background: #ffeeda; color: #f56a2c; }
.seq-3 { background: #dfffe0; color: #23af0f; }
.seq-n { background: #f6f6f6; color: #000; }
.dungeon-sort-label {
  flex: 1;
  font-size: 13px;
  word-break: break-all;
}
.dungeon-sort-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  background: #fff;
  color: #666;
  cursor: pointer;
  transition: 0.15s;
}
.icon-btn:hover:not(:disabled) {
  color: #18a058;
  border-color: #18a058;
}
.icon-btn:disabled {
  color: #d9d9d9;
  cursor: not-allowed;
}
.ghost {
  opacity: 0.5;
}
</style>
