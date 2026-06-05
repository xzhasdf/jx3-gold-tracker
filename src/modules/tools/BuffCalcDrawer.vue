<template>
  <n-drawer v-model:show="showModel" :width="720" placement="right">
    <n-drawer-content title="增益计算">
      <div class="bc-toolbar">
        <n-button type="primary" size="small" @click="showBuffManage = true">额外增益管理</n-button>
        <span class="bc-tip">点击数值可修改；点击增益标签为该角色启用 / 取消该增益</span>
      </div>
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
          <span v-else class="bc-num-plain" title="点击修改" @click="startEdit(`unit:${stat}`, unitOf(stat))">{{ unitOf(stat) }}<span class="bc-edit-icon">✎</span></span>
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
          <span class="bc-layers">层数 <b>{{ item.layers }}</b> 层</span>
        </div>
        <div class="bc-buffs">
          <template v-for="(group, gi) in groupBuffs(item.buffs)" :key="gi">
            <span v-if="gi > 0" class="bc-buff-divider" />
            <span
              v-for="d in group"
              :key="d.key"
              class="bc-buff"
              :class="{ selected: item.selected.has(d.key) }"
              @click="tracker.toggleBuffCalcRoleBuff(item.role.id, d.key)"
            >
              <span :style="d.color ? { color: d.color } : undefined">{{ d.name }}</span>
              <span class="bc-buff-val">{{ valueOf(d) }}</span>
            </span>
          </template>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>

  <n-modal v-model:show="showBuffManage" preset="card" title="额外增益管理" style="max-width: 620px">
    <div v-for="stat in BUFF_STATS" :key="stat" class="bc-manage-group">
      <div class="bc-section-title">{{ BUFF_STAT_LABEL[stat] }}增益</div>
      <div class="bc-manage-grid">
        <div v-for="d in BUFF_DEFS.filter((x) => x.stat === stat)" :key="d.key" class="bc-manage-item">
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
const editingKey = ref<string | null>(null)
const draft = ref<number | null>(null)

function startEdit(key: string, current: number) {
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

function unitOf(stat: BuffStat): number {
  return stat === 'spirit' ? tracker.buffCalc.value.unitSpirit : tracker.buffCalc.value.unitVitality
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
      const buffs = BUFF_DEFS.filter((d) => d.stat === stat)
      const sum = buffs.filter((d) => selected.has(d.key)).reduce((acc, d) => acc + valueOf(d), 0)
      const unit = unitOf(stat)
      const layers = unit > 0 ? Math.floor((base + sum) / unit) : 0
      return { role: r, stat, base, selected, buffs, layers }
    })
)

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
.bc-tip {
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
