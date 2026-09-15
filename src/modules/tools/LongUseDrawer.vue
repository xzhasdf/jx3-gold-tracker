<template>
  <n-drawer v-model:show="showModel" :width="760" placement="right">
    <n-drawer-content title="久物主义" :native-scrollbar="false">
      <div class="lu-hero">
        <div class="lu-hero-main">
          <div class="lu-hero-label">在用 {{ inUseItems.length }} 件，每天合计</div>
          <div class="lu-hero-value"><MoneyValue :value="totalPerDay" :precision="goldPrecision(totalPerDay)" /></div>
        </div>
        <div class="lu-hero-side">
          <div class="lu-hero-stat">
            <span class="lu-hero-stat-label">累计投入</span>
            <span class="lu-hero-stat-value"><MoneyValue :value="totalSpent" /></span>
          </div>
          <n-button type="primary" size="small" @click="openAddModal">新增物品</n-button>
        </div>
      </div>

      <div class="lu-filter">
        <span class="lu-chip" :class="{ active: filterType === null }" @click="filterType = null">
          全部<b>{{ allItems.length }}</b>
        </span>
        <span
          v-for="t in EQUIP_TYPES"
          :key="t"
          class="lu-chip"
          :class="{ active: filterType === t }"
          @click="filterType = filterType === t ? null : t"
        >
          <img :src="EQUIP_ICONS[t]" class="lu-chip-icon" />{{ t }}<b>{{ countOf(t) }}</b>
        </span>
      </div>

      <n-empty v-if="viewItems.length === 0" class="lu-empty" />

      <div v-else class="lu-grid">
        <div
          v-for="item in viewItems"
          :key="item.raw.id"
          class="lu-card"
          :class="{ retired: item.retired }"
          @click="openEditModal(item.raw)"
        >
          <div class="lu-card-top">
            <span class="lu-tile">
              <img :src="EQUIP_ICONS[item.raw.type]" />
            </span>
            <span class="lu-status" :class="{ retired: item.retired }">
              <i class="lu-status-dot" />{{ item.retired ? '已停用' : '使用中' }}
            </span>
            <span class="lu-card-actions">
              <button class="lu-act" @click.stop="openEditModal(item.raw)">编辑</button>
              <button class="lu-act danger" @click.stop="handleDelete(item.raw)">删除</button>
            </span>
          </div>

          <div class="lu-card-name" :title="item.raw.name">{{ item.raw.name }}</div>

          <div class="lu-card-sub">
            <span>{{ item.raw.type }}</span>
            <i class="lu-dot-sep" />
            <MoneyValue :value="item.raw.price" />
            <i class="lu-dot-sep" />
            <span>{{ item.days }} 天</span>
          </div>

          <div class="lu-card-cost">
            <span class="lu-card-cost-num">
              <MoneyValue :value="item.perDay" :precision="goldPrecision(item.perDay)" />
            </span>
            <span class="lu-card-cost-unit">/天</span>
          </div>

          <div class="lu-card-trend">
            <span v-if="item.dailyDrop !== null" class="lu-trend-down">
              ↓ 较昨日 −<MoneyValue :value="Math.abs(item.dailyDrop)" :precision="goldPrecision(item.dailyDrop)" />
            </span>
            <span v-else-if="item.retired" class="lu-trend-flat">已停在 {{ item.raw.endDate }}</span>
            <span v-else class="lu-trend-flat">今天刚入手</span>
          </div>

          <div v-if="item.raw.roleId || item.raw.remark" class="lu-card-foot">
            <span v-if="item.raw.roleId" class="lu-card-role">{{ item.raw.roleId }}</span>
            <span v-if="item.raw.remark" class="lu-card-remark" :title="item.raw.remark">{{ item.raw.remark }}</span>
          </div>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>

  <n-modal v-model:show="showFormModal" preset="card" :title="editingId ? '编辑物品' : '新增物品'" style="max-width: 460px">
    <n-form label-placement="top">
      <n-form-item label="物品名称" required>
        <n-input v-model:value="form.name" placeholder="如：大橙武" />
      </n-form-item>
      <n-form-item label="装备类型" required>
        <div class="lu-type-picker">
          <span
            v-for="t in EQUIP_TYPES"
            :key="t"
            class="lu-type-option"
            :class="{ active: form.type === t }"
            @click="form.type = t"
          >
            <img :src="EQUIP_ICONS[t]" class="lu-type-icon" />
            <span>{{ t }}</span>
          </span>
        </div>
      </n-form-item>
      <n-form-item label="归属角色（选填）">
        <n-select v-model:value="form.roleId" :options="roleOptions" placeholder="请选择角色" filterable clearable />
      </n-form-item>
      <n-form-item label="购入价格（金）" required>
        <n-input-number v-model:value="form.price" :min="1" :show-button="false" placeholder="输入购入价格" style="width: 100%" />
      </n-form-item>
      <n-form-item label="购入日期" required>
        <n-date-picker v-model:value="form.startTs" type="date" style="width: 100%" />
      </n-form-item>
      <n-form-item label="停用日期（选填，留空表示还在用）">
        <n-date-picker v-model:value="form.endTs" type="date" clearable style="width: 100%" />
      </n-form-item>
      <n-form-item label="备注（选填）">
        <n-input v-model:value="form.remark" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showFormModal = false">取消</n-button>
        <n-button type="primary" @click="handleSubmit">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import MoneyValue from '../shared/MoneyValue.vue'
import { daysInclusive, toYmd } from '../../utils/date'
import { EQUIP_ICONS, EQUIP_TYPES, type EquipType } from '../../constants/equip'
import type { LongUseItem } from '../../types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const showModel = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v)
})

const tracker = useTracker()
const dialog = useDialog()
const message = useMessage()

const roleOptions = computed(() => tracker.roleOptions.value)

const filterType = ref<EquipType | null>(null)
const showFormModal = ref(false)
const editingId = ref<string | null>(null)

const form = reactive<{
  name: string
  type: EquipType
  roleId: string | null
  price: number | null
  startTs: number | null
  endTs: number | null
  remark: string
}>({
  name: '',
  type: '武器',
  roleId: null,
  price: null,
  startTs: Date.now(),
  endTs: null,
  remark: ''
})

interface LongUseView {
  raw: LongUseItem
  retired: boolean
  days: number
  perDay: number
  /** 相比昨天下降了多少金/天；今天刚入手或已停用时为 null */
  dailyDrop: number | null
}

const allItems = computed<LongUseView[]>(() => {
  const today = toYmd(Date.now())
  return tracker.longUse.value
    .map((raw) => {
      const retired = Boolean(raw.endDate)
      const days = daysInclusive(raw.startDate, raw.endDate ?? today)
      const perDay = raw.price / days
      return {
        raw,
        retired,
        days,
        perDay,
        // 停用后天数不再增长，昨天和今天一样；入手当天也没有「昨天」可比
        dailyDrop: retired || days <= 1 ? null : raw.price / (days - 1) - perDay
      }
    })
    .sort((a, b) => {
      if (a.retired !== b.retired) return a.retired ? 1 : -1
      return b.perDay - a.perDay
    })
})

const viewItems = computed(() =>
  filterType.value === null ? allItems.value : allItems.value.filter((i) => i.raw.type === filterType.value)
)

// 顶部汇总始终统计全部物品，不随类型筛选变化
const inUseItems = computed(() => allItems.value.filter((i) => !i.retired))
const totalPerDay = computed(() => inUseItems.value.reduce((sum, i) => sum + i.perDay, 0))
const totalSpent = computed(() => allItems.value.reduce((sum, i) => sum + i.raw.price, 0))

function countOf(type: EquipType): number {
  return allItems.value.filter((i) => i.raw.type === type).length
}

// 摊销值是算出来的小数：金额越小越要多给小数位，不然长期持有的物品看不出每天在降
function goldPrecision(value: number): number {
  const abs = Math.abs(value)
  if (abs >= 100) return 0
  if (abs >= 1) return 2
  return 4
}

function resetForm() {
  form.name = ''
  form.type = filterType.value ?? '武器'
  form.roleId = null
  form.price = null
  form.startTs = Date.now()
  form.endTs = null
  form.remark = ''
}

function openAddModal() {
  editingId.value = null
  resetForm()
  showFormModal.value = true
}

function openEditModal(item: LongUseItem) {
  editingId.value = item.id
  form.name = item.name
  form.type = item.type
  form.roleId = item.roleId ?? null
  form.price = item.price
  form.startTs = new Date(`${item.startDate}T00:00:00`).getTime()
  form.endTs = item.endDate ? new Date(`${item.endDate}T00:00:00`).getTime() : null
  form.remark = item.remark ?? ''
  showFormModal.value = true
}

function handleSubmit() {
  if (form.startTs === null) {
    message.error('请选择购入日期')
    return
  }
  const payload = {
    name: form.name,
    type: form.type,
    price: form.price ?? 0,
    startDate: toYmd(form.startTs),
    endDate: form.endTs !== null ? toYmd(form.endTs) : undefined,
    roleId: form.roleId ?? undefined,
    remark: form.remark
  }
  const result = editingId.value
    ? tracker.updateLongUseItem(editingId.value, payload)
    : tracker.addLongUseItem(payload)
  if (!result.ok) {
    message.error(result.message ?? '保存失败')
    return
  }
  showFormModal.value = false
}

function handleDelete(item: LongUseItem) {
  dialog.warning({
    title: '删除物品',
    content: `确定删除「${item.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => tracker.deleteLongUseItem(item.id)
  })
}
</script>

<style scoped>
/* ── 顶部汇总 ─────────────────────────────────────── */
.lu-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f3f9f5 0%, #eef5fb 100%);
}

.lu-hero-label {
  font-size: 12px;
  color: #7a8794;
}

.lu-hero-value {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: #1f2a44;
  letter-spacing: -0.5px;
}

/* 大号数字里图标按默认 1.1em 会压过数字本身，单独收窄 */
.lu-hero-value :deep(.money-icon) {
  height: 0.72em;
}

.lu-hero-value :deep(.money-icon.coin) {
  height: 0.56em;
}

.lu-hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.lu-hero-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.lu-hero-stat-label {
  font-size: 12px;
  color: #7a8794;
}

.lu-hero-stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a44;
}

/* ── 类型筛选 ─────────────────────────────────────── */
.lu-filter {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.lu-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  background: #f4f6f8;
  font-size: 13px;
  color: #5a6672;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.lu-chip b {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.5;
}

.lu-chip:hover {
  background: #eaeef2;
}

.lu-chip.active {
  background: #18a058;
  color: #fff;
}

.lu-chip.active b {
  opacity: 0.75;
}

.lu-chip-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 3px;
}

.lu-empty {
  padding: 56px 0;
}

/* ── 物品卡片 ─────────────────────────────────────── */
.lu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
  gap: 14px;
  align-items: start;
}

.lu-card {
  position: relative;
  padding: 16px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #edf0f3;
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
}

.lu-card:hover {
  border-color: transparent;
  box-shadow: 0 8px 24px rgba(31, 42, 68, 0.1);
  transform: translateY(-2px);
}

.lu-card.retired {
  background: #fbfcfd;
}

.lu-card.retired .lu-tile,
.lu-card.retired .lu-card-name,
.lu-card.retired .lu-card-cost-num {
  opacity: 0.6;
}

.lu-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.lu-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f2f6f4;
}

.lu-tile img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.lu-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background: #f4f6f8;
  font-size: 12px;
  color: #5a6672;
  transition: opacity 0.15s ease;
}

.lu-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #18a058;
}

.lu-status.retired .lu-status-dot {
  background: #b4bcc4;
}

/* 悬停时操作按钮顶掉状态胶囊，避免卡片高度跳动 */
.lu-card-actions {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.lu-card:hover .lu-status {
  opacity: 0;
}

.lu-card:hover .lu-card-actions {
  opacity: 1;
  pointer-events: auto;
}

.lu-act {
  border: none;
  background: #f4f6f8;
  border-radius: 10px;
  height: 24px;
  padding: 0 9px;
  font-size: 12px;
  color: #5a6672;
  cursor: pointer;
}

.lu-act:hover {
  background: #e8ebef;
  color: #1f2a44;
}

.lu-act.danger:hover {
  background: #fef0f0;
  color: #d03050;
}

.lu-card-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lu-card-sub {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  font-size: 12px;
  color: #9aa4b0;
}

.lu-dot-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #d4dae0;
  flex-shrink: 0;
}

.lu-card-cost {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-top: 14px;
}

.lu-card-cost-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  color: #1f2a44;
  letter-spacing: -0.5px;
}

.lu-card-cost-num :deep(.money-icon) {
  height: 0.75em;
}

.lu-card-cost-num :deep(.money-icon.coin) {
  height: 0.58em;
}

.lu-card-cost-unit {
  font-size: 13px;
  color: #9aa4b0;
}

.lu-card-trend {
  margin-top: 6px;
  font-size: 12px;
}

.lu-trend-down {
  display: inline-flex;
  align-items: center;
  color: #18a058;
}

.lu-trend-flat {
  color: #b4bcc4;
}

.lu-card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f2f4f6;
  font-size: 12px;
  color: #9aa4b0;
  min-width: 0;
}

.lu-card-role {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 9px;
  background: #f4f6f8;
  color: #5a6672;
}

.lu-card-remark {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 表单里的类型选择 ──────────────────────────────── */
.lu-type-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lu-type-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
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
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
}
</style>
