<template>
  <n-space vertical :size="8" class="lul">
    <n-checkbox
      :checked="checked"
      title="按本次支出、日期、角色同时记入久物主义"
      @update:checked="(v: boolean) => emit('update:checked', v)"
    >久物主义</n-checkbox>
    <template v-if="checked">
      <!-- 多件物品用 Tab 切换，一次只展开一件，弹窗不会越拉越长 -->
      <n-tabs
        :value="activeKey"
        type="card"
        size="small"
        addable
        :closable="multi"
        class="lul-tabs"
        @update:value="(k: string) => (activeKey = k)"
        @add="add"
        @close="remove"
      >
        <n-tab-pane v-for="(item, index) in items" :key="item.key" :name="item.key" :tab="tabLabel(item, index)">
          <div class="lul-row">
            <n-input
              :value="item.name"
              placeholder="物品名称，如：大橙武"
              class="lul-name"
              @update:value="(v: string) => patch(index, { name: v })"
            />
            <n-input-number
              :value="item.price"
              :min="1"
              :show-button="false"
              placeholder="价格"
              class="lul-price"
              @update:value="(v: number | null) => patch(index, { price: v })"
            />
          </div>
          <div class="lu-type-picker">
            <span
              v-for="t in EQUIP_TYPES"
              :key="t"
              class="lu-type-option"
              :class="{ active: item.type === t }"
              @click="patch(index, { type: t })"
            >
              <img :src="EQUIP_ICONS[t]" class="lu-type-icon" />
              <span>{{ t }}</span>
            </span>
          </div>
        </n-tab-pane>
      </n-tabs>
    </template>
  </n-space>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { EQUIP_ICONS, EQUIP_TYPES } from '../../constants/equip'
import { newLinkDraftItem, type LinkDraftItem } from './longUseLink'


// 收支表单里的「联动入账」字段：新增、编辑两个弹窗共用；一笔支出可以记多件物品，各件价格手动填
const props = defineProps<{
  checked: boolean
  items: LinkDraftItem[]
}>()

const emit = defineEmits<{
  (e: 'update:checked', v: boolean): void
  (e: 'update:items', v: LinkDraftItem[]): void
}>()

const multi = computed(() => props.items.length > 1)

function patch(index: number, change: Partial<LinkDraftItem>) {
  emit('update:items', props.items.map((item, i) => (i === index ? { ...item, ...change } : item)))
}

// 当前展开的 Tab；列表被外部整体替换（打开弹窗、切换记录）时回到第一件
const activeKey = ref(props.items[0]?.key ?? '')
watch(
  () => props.items.map((i) => i.key),
  (keys) => {
    if (!keys.includes(activeKey.value)) activeKey.value = keys[0] ?? ''
  }
)

// Tab 标题：填了名称就用名称（过长截断），没填用序号
function tabLabel(item: LinkDraftItem, index: number): string {
  const name = item.name.trim()
  if (!name) return `物品${index + 1}`
  return name.length > 6 ? `${name.slice(0, 6)}…` : name
}

function add() {
  const item = newLinkDraftItem()
  emit('update:items', [...props.items, item])
  activeKey.value = item.key
}

function remove(key: string) {
  const index = props.items.findIndex((i) => i.key === key)
  const next = props.items.filter((i) => i.key !== key)
  // 关掉的是当前 Tab 时，切到相邻的一件
  if (activeKey.value === key) activeKey.value = next[Math.min(index, next.length - 1)]?.key ?? ''
  emit('update:items', next)
}
</script>


<style scoped>
.lul-tabs {
  width: 100%;
  max-width: 440px;
}

.lul-tabs :deep(.n-tab-pane) {
  padding-top: 10px;
}

/* 卡片式 Tab 默认偏大，压小内边距和字号 */
.lul-tabs :deep(.n-tabs-tab) {
  padding: 3px 10px !important;
  font-size: 13px;
}

.lul-tabs :deep(.n-tabs-tab-pad) {
  width: 4px !important;
}

.lul-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.lul-name {
  flex: 1;
  min-width: 0;
}

.lul-price {
  width: 130px;
  flex-shrink: 0;
}

/* 固定 4 列：武器 / 防具 / 暗器 / 项链 一行，腰坠 / 戒指 / 其他 一行 */
.lu-type-picker {
  display: grid;
  grid-template-columns: repeat(4, max-content);
  gap: 8px;
}

.lu-type-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid #e6eaee;
  border-radius: 8px;
  font-size: 13px;
  color: #5a6672;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.lu-type-option:hover {
  border-color: #18a058;
}

.lu-type-option.active {
  border-color: #18a058;
  background: #f0f9f4;
  color: #18a058;
}

.lu-type-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 4px;
}
</style>
