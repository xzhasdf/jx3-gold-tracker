<template>
  <n-card>
    <div class="rm-toolbar">
      <n-space :size="12" align="center" :wrap-item="false">
        <n-button type="primary" @click="openCreate">添加角色</n-button>
        <n-dropdown trigger="click" :options="quickSortOptions" @select="onQuickSort">
          <n-button>快速排序 ▾</n-button>
        </n-dropdown>
      </n-space>
      <div class="rm-tip">拖动 ⠿ 调整顺序 · 共 {{ roleList.length }} 个角色</div>
    </div>

    <div v-if="roleList.length === 0" class="rm-empty">暂无角色，点击「添加角色」开始</div>

    <draggable
      :list="roleList"
      item-key="id"
      handle=".rm-handle"
      ghost-class="rm-ghost"
      :animation="200"
      class="rm-list"
      @end="onDragEnd"
    >
      <template #item="{ element: role, index }">
        <div class="rm-card" :class="{ ignored: role.ignoreCd }">
          <div class="rm-card-head">
            <span class="rm-handle" title="拖动排序">⠿</span>
            <span class="rm-name">{{ role.id }}<span class="rm-server">@{{ role.server }}</span></span>
            <SchoolBadge :school="role.school" />
            <n-tag v-if="role.isProxyClear" type="success" size="small">代清 · 工资{{ Math.round(Number(role.wageRatio) || 100) }}%</n-tag>
            <div class="rm-head-right">
              <n-tooltip trigger="hover">
                <template #trigger>
                  <span class="rm-cd-switch">
                    <n-switch size="small" :value="!role.ignoreCd" @update:value="() => tracker.toggleRoleCdIgnore(role.id)" />
                    <span>计入CD统计</span>
                  </span>
                </template>
                关闭后，该角色不参与副本 CD 统计（副本管理里的通关进度、未通关名单等）
              </n-tooltip>
              <n-dropdown trigger="click" :options="roleMenuOptions(index)" @select="(key: string) => onRoleMenu(key, role)">
                <n-button text class="rm-more" title="更多操作">⋯</n-button>
              </n-dropdown>
            </div>
          </div>
          <div class="rm-cd">
            <template v-if="role.ignoreCd">
              <span class="rm-cd-muted">不计入 CD 统计</span>
            </template>
            <template v-else-if="cdGroups.length === 0">
              <span class="rm-cd-muted">暂无副本</span>
            </template>
            <template v-else>
              <span class="rm-cd-label">本周</span>
              <span v-for="g in cdGroups" :key="g.name" class="rm-cd-group">
                <span class="rm-cd-group-name">{{ g.name }}</span>
                <span
                  v-for="d in g.dungeons"
                  :key="d.id"
                  class="rm-cd-chip"
                  :class="{ cleared: isCleared(role.id, d.id) }"
                  :title="`${d.players}${d.difficulty}${g.name}：${isCleared(role.id, d.id) ? '本周已通关' : '本周未通关'}`"
                >{{ shortCombo(d) }} {{ isCleared(role.id, d.id) ? '✓' : '·' }}</span>
              </span>
            </template>
          </div>
        </div>
      </template>
    </draggable>
  </n-card>

  <n-modal v-model:show="showForm" preset="card" :title="formMode === 'create' ? '添加角色' : '编辑角色'" style="max-width: 560px">
    <n-form label-placement="left" label-width="80">
      <n-form-item label="角色ID">
        <n-input v-model:value="form.id" placeholder="请输入角色ID" class="field-340" />
      </n-form-item>
      <n-form-item label="服务器">
        <n-select v-model:value="form.server" :options="serverOptions" filterable class="field-340" />
      </n-form-item>
      <n-form-item label="门派">
        <n-select v-model:value="form.school" :options="schoolOptions" :render-label="renderSchoolOption" filterable class="field-340" />
      </n-form-item>
      <n-form-item label="代清">
        <n-checkbox v-model:checked="form.isProxyClear">帮别人代清的角色</n-checkbox>
      </n-form-item>
      <n-form-item v-if="form.isProxyClear" label="工资比例">
        <n-space align="center" :wrap-item="false">
          <n-slider v-model:value="form.wageRatio" :min="0" :max="100" :step="10" :style="{ width: '340px' }" />
          <span class="ratio-value">{{ form.wageRatio }}%</span>
        </n-space>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showForm = false">取消</n-button>
        <n-button type="primary" @click="saveForm">{{ formMode === 'create' ? '添加' : '保存' }}</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NTooltip, type DropdownOption, useDialog } from 'naive-ui'
import draggable from 'vuedraggable'
import type { Dungeon, Role } from '../../types'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'

const tracker = useTracker()
const dialog = useDialog()

const serverOptions = tracker.servers.map((v) => ({ label: v, value: v }))
const schoolOptions = tracker.schools.map((v) => ({ label: v, value: v }))

function renderSchoolOption(option: { label?: string | number }) {
  return h(SchoolBadge, { school: String(option.label ?? '') })
}

function warn(message?: string) {
  dialog.warning({ title: '提示', content: message ?? '操作失败', positiveText: '知道了' })
}

// ─── 角色列表（可拖动排序） ────────────────────────────────────────────
const roleList = ref<Role[]>([])
watch(() => tracker.roles.value, (list) => { roleList.value = list.slice() }, { immediate: true, deep: true })

function onDragEnd() {
  tracker.setRoleOrder(roleList.value.map((r) => r.id))
}

function moveRole(id: string, to: 'top' | 'bottom') {
  const ids = roleList.value.map((r) => r.id).filter((x) => x !== id)
  tracker.setRoleOrder(to === 'top' ? [id, ...ids] : [...ids, id])
}

const quickSortOptions: DropdownOption[] = [
  { label: '按角色名', key: 'id' },
  { label: '按服务器', key: 'server' },
  { label: '按门派', key: 'school' }
]

// 快速排序会覆盖当前自定义顺序（与改版前点表头排序不同，这里会保存）
function onQuickSort(key: 'id' | 'server' | 'school') {
  const label = quickSortOptions.find((o) => o.key === key)?.label
  dialog.info({
    title: '快速排序',
    content: `将按「${String(label).replace('按', '')}」重新排列所有角色，并替换当前的自定义顺序。确认吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const sorted = roleList.value
        .slice()
        .sort((a, b) => a[key].localeCompare(b[key], 'zh-CN') || a.id.localeCompare(b.id, 'zh-CN'))
      tracker.setRoleOrder(sorted.map((r) => r.id))
    }
  })
}

function roleMenuOptions(index: number): DropdownOption[] {
  return [
    { label: '编辑', key: 'edit' },
    { type: 'divider', key: 'd1' },
    { label: '置顶', key: 'top', disabled: index === 0 },
    { label: '置底', key: 'bottom', disabled: index === roleList.value.length - 1 },
    { type: 'divider', key: 'd2' },
    { label: '删除', key: 'delete', props: { style: 'color:#d03050' } }
  ]
}

function onRoleMenu(key: string, role: Role) {
  if (key === 'edit') openEdit(role)
  else if (key === 'top' || key === 'bottom') moveRole(role.id, key)
  else if (key === 'delete') handleDelete(role.id)
}

// ─── 本周 CD ───────────────────────────────────────────────────────────
const COMBO_ORDER = (tracker.playerTypes as readonly string[]).flatMap((p) =>
  (tracker.difficultyTypes as readonly string[]).map((d) => `${p}${d}`)
)

// 只展示未隐藏的副本，顺序与副本管理一致
const cdGroups = computed(() =>
  tracker.orderedDungeonGroups.value
    .filter((g) => !g.allHidden)
    .map((g) => ({
      name: g.name,
      dungeons: g.dungeons
        .filter((d) => !d.hidden)
        .slice()
        .sort((a, b) => COMBO_ORDER.indexOf(`${a.players}${a.difficulty}`) - COMBO_ORDER.indexOf(`${b.players}${b.difficulty}`))
    }))
    .filter((g) => g.dungeons.length > 0)
)

const clearedByRole = computed(() => {
  const map = new Map<string, Set<string>>()
  tracker.getWeeklyCdStatusByRole().forEach((role) => {
    map.set(role.roleId, new Set(role.dungeons.filter((d) => d.cleared).map((d) => d.dungeonId)))
  })
  return map
})

function isCleared(roleId: string, dungeonId: string) {
  return clearedByRole.value.get(roleId)?.has(dungeonId) ?? false
}

// 10人普通 → 10普
function shortCombo(d: Dungeon) {
  return `${d.players.replace('人', '')}${d.difficulty.slice(0, 1)}`
}

// ─── 添加 / 编辑（共用表单） ───────────────────────────────────────────
const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const form = reactive({
  oldId: '',
  id: '',
  server: tracker.servers[0],
  school: tracker.schools[0],
  isProxyClear: false,
  wageRatio: 100
})

function openCreate() {
  formMode.value = 'create'
  // 服务器 / 门派沿用上次的选择，连续添加同服角色更快
  form.oldId = ''
  form.id = ''
  form.isProxyClear = false
  form.wageRatio = 100
  showForm.value = true
}

function openEdit(row: Role) {
  formMode.value = 'edit'
  form.oldId = row.id
  form.id = row.id
  form.server = row.server
  form.school = row.school
  form.isProxyClear = Boolean(row.isProxyClear)
  form.wageRatio = Number.isFinite(row.wageRatio) ? row.wageRatio : 100
  showForm.value = true
}

function saveForm() {
  const result = formMode.value === 'create'
    ? tracker.addRole({ id: form.id, server: form.server, school: form.school, isProxyClear: form.isProxyClear, wageRatio: form.wageRatio })
    : tracker.updateRole(form.oldId, form.id, form.server, form.school, form.isProxyClear, form.wageRatio)
  if (!result.ok) return warn(result.message)
  showForm.value = false
}

function handleDelete(id: string) {
  dialog.warning({
    title: '删除确认',
    content: `确认删除角色「${id}」吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = tracker.deleteRole(id)
      if (!result.ok) warn(result.message)
    }
  })
}
</script>

<style scoped>
.rm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.rm-tip {
  color: #999;
  font-size: 12px;
}
.rm-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 32px 0;
}
.rm-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 900px) {
  .rm-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
.rm-card {
  border: 1px solid #efeff5;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
.rm-card:hover {
  border-color: #d6e4ff;
}
.rm-card.ignored {
  background: #fafafa;
}
.rm-card.ignored .rm-name {
  color: #909399;
}
.rm-ghost {
  opacity: 0.4;
  background: #f0f7ff;
}
.rm-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rm-handle {
  cursor: grab;
  color: #c0c4cc;
  font-size: 16px;
  line-height: 1;
  user-select: none;
}
.rm-handle:hover {
  color: #3f83f8;
}
.rm-name {
  /* 名字与 @服务器 字号不同，按基线对齐并统一行高，整体再与门派图标居中 */
  display: inline-flex;
  align-items: baseline;
  line-height: 20px;
  font-size: 15px;
  font-weight: 600;
  color: #222;
}
.rm-server {
  font-weight: 400;
  color: #909399;
  font-size: 13px;
  line-height: 20px;
}
.rm-head-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.rm-cd-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}
.rm-more {
  font-size: 18px;
  line-height: 1;
  color: #909399;
}
.rm-cd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin-top: 8px;
  padding-left: 24px;
  font-size: 12px;
}
.rm-cd-label,
.rm-cd-muted {
  color: #909399;
}
.rm-cd-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rm-cd-group-name {
  color: #606266;
  margin-right: 2px;
}
.rm-cd-chip {
  padding: 0 6px;
  line-height: 20px;
  border-radius: 3px;
  background: #f4f4f5;
  color: #909399;
}
.rm-cd-chip.cleared {
  background: #18a05814;
  color: #18a058;
}
.ratio-value {
  color: #606266;
  font-size: 14px;
  min-width: 44px;
}
</style>
