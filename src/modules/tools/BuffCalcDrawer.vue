<template>
  <n-drawer v-model:show="showModel" :width="720" placement="right">
    <n-drawer-content title="增益计算">
      <div class="bc-toolbar">
        <span v-if="prevExpansion" class="bc-inline">
          <n-switch
            size="small"
            :value="tracker.buffCalc.value.showPrevExpansion"
            @update:value="(v: boolean) => tracker.setBuffCalcShowPrev(v)"
          />
          <span class="bc-label">显示{{ prevLabel }}小吃小药</span>
        </span>
        <n-button type="primary" size="small" class="bc-toolbar-right" @click="openBuffManage">额外增益管理</n-button>
      </div>
      <div class="bc-tip">点击数值可修改；点击增益标签为该角色启用 / 取消该增益，同类增益只能启用一个</div>
      <n-divider style="margin: 12px 0" />

      <div class="bc-section-title">每层增益所需基础属性</div>
      <div class="bc-unit-row">
        <span v-for="stat in BUFF_STATS" :key="stat" class="bc-inline">
          <span class="bc-label">{{ BUFF_STAT_LABEL[stat] }}</span>
          <template v-if="editingKey === `unit:${stat}`">
            <n-input-number v-model:value="draft" size="small" :min="1" :show-button="false" style="width: 100px" />
            <n-button text type="primary" size="small" @click="confirmUnitEdit(stat)">确认</n-button>
            <n-button text size="small" @click="cancelEdit">取消</n-button>
          </template>
          <span v-else class="bc-num-plain" :class="{ unset: !unitOf(stat) }" title="点击修改" @click="startEdit(`unit:${stat}`, unitOf(stat) || null)">{{ unitOf(stat) || '未设置' }}<span class="bc-edit-icon">✎</span></span>
        </span>
      </div>

      <n-divider style="margin: 12px 0" />

      <div v-if="calcRoles.length === 0" class="bc-empty">
        暂无适用角色<br />仅门派为 万花 / 七秀 / 五毒 / 长歌 / 药宗（根骨）、天策 / 少林 / 明教 / 苍云（体质）的角色参与计算
      </div>

      <div v-for="item in calcRoles" :key="item.role.id" class="bc-role">
        <div class="bc-role-header">
          <span class="bc-role-name">{{ item.role.id }}@{{ item.role.server }}</span>
          <SchoolBadge :school="item.role.school" />
          <span class="bc-inline">
            <span class="bc-label">{{ BUFF_STAT_LABEL[item.stat] }}</span>
            <template v-if="editingKey === `role:${item.role.id}`">
              <n-input-number v-model:value="draft" size="small" :min="0" :show-button="false" style="width: 120px" />
              <n-button text type="primary" size="small" @click="confirmRoleEdit(item.role.id)">确认</n-button>
              <n-button text size="small" @click="cancelEdit">取消</n-button>
            </template>
            <span v-else class="bc-num-plain" title="点击修改" @click="startEdit(`role:${item.role.id}`, item.base)">{{ item.base }}<span class="bc-edit-icon">✎</span></span>
          </span>
          <span class="bc-layers">层数 <b>{{ item.layers ?? '—' }}</b> 层</span>
        </div>
        <div v-for="row in item.rows" :key="row.label" class="bc-buffs">
          <span v-if="item.rows.length > 1" class="bc-row-label">{{ row.label }}</span>
          <template v-for="(group, gi) in groupBuffs(row.buffs)" :key="gi">
            <span v-if="gi > 0" class="bc-buff-divider" />
            <span
              v-for="d in group"
              :key="d.key"
              class="bc-buff"
              :class="{ selected: item.selected.has(d.key) }"
              @click="tracker.toggleBuffCalcRoleBuff(item.role.id, d.key)"
            >
              <span :style="d.color ? { color: d.color } : undefined">{{ d.name }}</span>
              <span class="bc-buff-val" :title="valueOf(d) ? undefined : '数值未知，可在「额外增益管理」里填写'">{{ valueOf(d) || '?' }}</span>
            </span>
          </template>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>

  <n-modal v-model:show="showBuffManage" preset="card" title="额外增益管理" style="max-width: 620px">
    <n-tabs v-model:value="manageExpansion" type="line" size="small" animated>
      <n-tab-pane v-for="exp in BUFF_EXPANSIONS" :key="exp.key" :name="exp.key" :tab="exp.label ?? exp.name">
    <div v-for="sec in manageSections(exp.key)" :key="sec.title" class="bc-manage-group">
      <div class="bc-section-title">{{ sec.title }}</div>
      <div class="bc-manage-grid">
        <div v-for="d in sec.defs" :key="d.key" class="bc-manage-item">
          <span class="bc-manage-name" :style="d.color ? { color: d.color } : undefined">{{ d.name }}</span>
          <n-input-number
            :value="valueOf(d)"
            size="small"
            :min="0"
            :show-button="false"
            style="width: 100px"
            @update:value="(v: number | null) => tracker.setBuffCalcValue(d.key, v ?? 0)"
          />
        </div>
      </div>
    </div>
      </n-tab-pane>
    </n-tabs>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleSaveBuffDefaults">设为默认值</n-button>
        <n-button @click="handleResetBuffValues">恢复默认值</n-button>
        <n-button type="primary" @click="showBuffManage = false">完成</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialog } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'
import {
  BUFF_DEFS,
  BUFF_EXPANSIONS,
  DEFAULT_BUFF_EXPANSION,
  BUFF_STAT_LABEL,
  SPIRIT_SCHOOLS,
  VITALITY_SCHOOLS,
  type BuffDef,
  type BuffStat
} from '../../constants/buffCalc'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()
const showModel = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v)
})

const tracker = useTracker()
const dialog = useDialog()

const BUFF_STATS: BuffStat[] = ['spirit', 'vitality']

const showBuffManage = ref(false)
// 固定用最新资料片；上一个资料片的小吃小药通过开关附带显示
const currentExpansion = computed(() => DEFAULT_BUFF_EXPANSION)
const manageExpansion = ref<string>(DEFAULT_BUFF_EXPANSION)
// 上一个资料片（BUFF_EXPANSIONS 新的在前，所以取下一项）；当前已是最老的则没有
const prevExpansion = computed(() => {
  const idx = BUFF_EXPANSIONS.findIndex((e) => e.key === currentExpansion.value)
  return idx >= 0 ? BUFF_EXPANSIONS[idx + 1] ?? null : null
})
const prevLabel = computed(() => prevExpansion.value?.label ?? prevExpansion.value?.name ?? '')

// 打开管理弹窗时默认定位到当前资料片的页签
function openBuffManage() {
  manageExpansion.value = currentExpansion.value
  showBuffManage.value = true
}
const editingKey = ref<string | null>(null)
const draft = ref<number | null>(null)

function startEdit(key: string, current: number | null) {
  editingKey.value = key
  draft.value = current
}

function cancelEdit() {
  editingKey.value = null
  draft.value = null
}

function confirmUnitEdit(stat: BuffStat) {
  if (draft.value != null && draft.value > 0) tracker.setBuffCalcUnit(stat, draft.value)
  cancelEdit()
}

function confirmRoleEdit(roleId: string) {
  if (draft.value != null && draft.value >= 0) tracker.setBuffCalcRoleBase(roleId, draft.value)
  cancelEdit()
}

// 当前资料片的每层所需属性；0 表示还没设置
function unitOf(stat: BuffStat): number {
  return tracker.buffCalc.value.units[currentExpansion.value]?.[stat] ?? 0
}

function valueOf(d: BuffDef): number {
  return tracker.buffCalc.value.buffValues[d.key] ?? d.defaultValue
}

const spiritSchoolSet = new Set(SPIRIT_SCHOOLS)
const vitalitySchoolSet = new Set(VITALITY_SCHOOLS)

const calcRoles = computed(() =>
  tracker.roles.value
    .filter((r) => spiritSchoolSet.has(r.school) || vitalitySchoolSet.has(r.school))
    .map((r) => {
      const stat: BuffStat = spiritSchoolSet.has(r.school) ? 'spirit' : 'vitality'
      const base = tracker.buffCalc.value.roleBase[r.id] ?? 0
      const selected = new Set(tracker.buffCalc.value.roleSelected[r.id] ?? [])
      const ofExpansion = (key: string) => BUFF_DEFS.filter((d) => d.stats.includes(stat) && d.expansion === key)
      const curName = BUFF_EXPANSIONS.find((e) => e.key === currentExpansion.value)?.name ?? ''
      const rows = [{ label: curName, buffs: ofExpansion(currentExpansion.value) }]
      if (prevExpansion.value && tracker.buffCalc.value.showPrevExpansion) {
        rows.push({ label: prevLabel.value, buffs: ofExpansion(prevExpansion.value.key) })
      }
      const buffs = rows.flatMap((r) => r.buffs)
      const sum = buffs.filter((d) => selected.has(d.key)).reduce((acc, d) => acc + valueOf(d), 0)
      const unit = unitOf(stat)
      const layers = unit > 0 ? Math.floor((base + sum) / unit) : null
      return { role: r, stat, base, selected, rows, layers }
    })
)

// 管理弹窗的分块：根骨 / 体质通用的放一块，只适用一种主属性的各放一块
function manageSections(expKey: string): { title: string; defs: BuffDef[] }[] {
  const defs = BUFF_DEFS.filter((d) => d.expansion === expKey)
  const shared = defs.filter((d) => BUFF_STATS.every((st) => d.stats.includes(st)))
  const sections: { title: string; defs: BuffDef[] }[] = []
  if (shared.length) sections.push({ title: '主属性增益（根骨、体质通用）', defs: shared })
  BUFF_STATS.forEach((st) => {
    const only = defs.filter((d) => d.stats.length === 1 && d.stats[0] === st)
    if (only.length) sections.push({ title: shared.length ? `仅${BUFF_STAT_LABEL[st]}门派` : `${BUFF_STAT_LABEL[st]}增益`, defs: only })
  })
  return sections
}

// 按互斥组聚合，组间显示分隔线；无组的 buff 各自成组
function groupBuffs(buffs: BuffDef[]): BuffDef[][] {
  const groups: BuffDef[][] = []
  const idx = new Map<string, number>()
  buffs.forEach((d) => {
    const g = d.group ?? `solo:${d.key}`
    if (!idx.has(g)) {
      idx.set(g, groups.length)
      groups.push([])
    }
    groups[idx.get(g)!].push(d)
  })
  return groups
}

function handleSaveBuffDefaults() {
  dialog.info({
    title: '设为默认值',
    content: '将当前所有增益数值保存为默认值，之后「恢复默认值」会恢复到这组数值。确认吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => tracker.saveBuffCalcDefaults()
  })
}

function handleResetBuffValues() {
  dialog.warning({
    title: '恢复默认值',
    content: '确认将所有增益数值恢复为默认值吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => tracker.resetBuffCalcValues()
  })
}
</script>

<style scoped>
.bc-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bc-toolbar-right {
  margin-left: auto;
}
.bc-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}
.bc-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}
.bc-unit-row {
  display: flex;
  align-items: center;
  gap: 40px;
}
.bc-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bc-label {
  font-size: 13px;
  color: #606266;
}
.bc-num-plain {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 14px;
  font-weight: 600;
  color: #234;
  cursor: pointer;
  border-bottom: 1px dashed #9aa3b0;
  padding-bottom: 1px;
}
.bc-num-plain.unset {
  color: #d03050;
  font-weight: 400;
}
.bc-num-plain:hover {
  color: #3f83f8;
  border-bottom-color: #3f83f8;
}
.bc-edit-icon {
  font-size: 12px;
  font-weight: 400;
  color: #c0c4cc;
}
.bc-num-plain:hover .bc-edit-icon {
  color: #3f83f8;
}
.bc-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  line-height: 1.8;
  padding: 24px 0;
}
.bc-role {
  margin-bottom: 10px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
}
.bc-role-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.bc-role-name {
  font-weight: 600;
  font-size: 14px;
}
.bc-layers {
  margin-left: auto;
  font-size: 13px;
  color: #606266;
}
.bc-layers b {
  font-size: 16px;
  color: #18a058;
}
.bc-buffs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
}
.bc-buff {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  user-select: none;
  opacity: 0.6;
}
.bc-buff:hover {
  opacity: 1;
  border-color: #3f83f8;
}
.bc-buff.selected {
  opacity: 1;
  border-color: #18a058;
  background: #18a05814;
}
.bc-buff-val {
  color: #909399;
}
.bc-buff.selected .bc-buff-val {
  color: #18a058;
}
.bc-row-label {
  /* 占满一行，增益标签从下一行开始 */
  flex-basis: 100%;
  font-size: 12px;
  color: #909399;
}
.bc-buff-divider {
  width: 1px;
  height: 14px;
  background: #dcdfe6;
  margin: 0 3px;
}
.bc-manage-group {
  margin-bottom: 16px;
}
.bc-manage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
}
.bc-manage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.bc-manage-name {
  font-size: 13px;
}
</style>
