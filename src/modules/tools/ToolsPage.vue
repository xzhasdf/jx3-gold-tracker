<template>
  <n-card hoverable class="tool-card" @click="showWineDrawer = true">
    <div class="tool-card-row">
      <img :src="icon237" class="tool-card-icon" />
      <div>
        <div class="tool-card-title">家园藏酒</div>
        <div class="tool-card-desc">管理家园藏酒进度，到期自动提醒</div>
      </div>
    </div>
  </n-card>

  <n-drawer v-model:show="showWineDrawer" :width="520" placement="right">
    <n-drawer-content title="家园藏酒">
      <div class="wine-section wine-toolbar">
        <n-button type="primary" size="small" @click="showAddModal = true">新增藏酒</n-button>
        <n-select
          v-model:value="filterRoleId"
          :options="roleSelectOptions"
          :render-label="renderRoleOption"
          clearable
          filterable
          placeholder="按角色筛选"
          size="small"
          style="width: 300px"
        />
        <n-button size="small" @click="filterRoleId = null">重置</n-button>
      </div>
      <n-divider style="margin: 12px 0" />
      <div class="wine-section">
        <div v-if="filteredItems.length === 0" class="wine-empty">暂无埋酒记录</div>
        <div v-for="item in filteredItems" :key="item.id" class="wine-item">
          <div class="wine-item-header">
            <img v-if="wineIconMap[item.wineType]" :src="wineIconMap[item.wineType]" class="wine-radio-icon" />
            <span class="wine-item-name" :style="{ color: getTargetColor(item.target) }">{{ item.wineType }}·{{ item.target }}</span>
            <span class="wine-item-role" v-if="item.roleId">
              <img v-if="schoolIconMap.get(roleMap.get(item.roleId)?.school ?? '')" :src="schoolIconMap.get(roleMap.get(item.roleId)!.school)!" class="wine-school-icon" />
              {{ getRoleLabel(item.roleId) }}
            </span>
            <span class="wine-item-close" @click="handleRemove(item.id)">&times;</span>
          </div>
          <n-progress
            type="line"
            :percentage="wineBury.getProgress(item)"
            :status="wineBury.getProgress(item) >= 100 ? 'success' : 'default'"
            :indicator-placement="'inside'"
          />
          <div class="wine-item-info">
            <span>{{ formatTime(item.startTime) }} ~ {{ formatTime(item.endTime) }}</span>
            <span :class="{ 'wine-done': wineBury.getProgress(item) >= 100 }">{{ wineBury.getRemainingText(item) }}</span>
          </div>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>

  <n-modal v-model:show="showAddModal" preset="card" title="新增藏酒" style="max-width: 420px">
    <n-form label-placement="top">
      <n-form-item :show-label="false">
        <n-radio-group v-model:value="addForm.wineType" class="wine-radio-grid">
          <n-radio v-for="w in wineTypes" :key="w" :value="w">
            <span class="wine-radio-label">
              <img :src="wineIconMap[w]" class="wine-radio-icon" />
              <span>{{ w }}</span>
            </span>
          </n-radio>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="角色" required :validation-status="roleValidation" :feedback="roleValidation === 'error' ? '请选择角色' : undefined">
        <n-select v-model:value="addForm.roleId" :options="roleSelectOptions" :render-label="renderRoleOption" filterable placeholder="请选择角色" :status="roleValidation" />
      </n-form-item>
      <n-form-item label="埋藏目标">
        <n-radio-group v-model:value="addForm.target">
          <n-space>
            <n-radio v-for="t in targets" :key="t" :value="t">
              <span :style="{ color: ['今朝醉', '六日醉'].includes(t) ? '#007eff' : '#fe2dfe' }">{{ t }}</span>
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showAddModal = false">取消</n-button>
        <n-button type="primary" @click="handleAdd">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import { useWineBury } from '../../composables/useWineBury'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'
import icon88 from '../../assets/icon/88.png'
import icon237 from '../../assets/icon/237.png'
import icon255 from '../../assets/icon/255.png'
import icon1396 from '../../assets/icon/1396.png'
import icon1400 from '../../assets/icon/1400.png'
import icon10134 from '../../assets/icon/10134.png'

const wineBury = useWineBury()
const tracker = useTracker()

const showWineDrawer = ref(false)
const showAddModal = ref(false)
const filterRoleId = ref<string | null>(null)

const filteredItems = computed(() => {
  if (!filterRoleId.value) return wineBury.items.value
  return wineBury.items.value.filter((w) => w.roleId === filterRoleId.value)
})

const schoolIconModules = import.meta.glob('../../assets/school/*.png', { eager: true, import: 'default' }) as Record<string, string>
const schoolIconMap = new Map<string, string>()
Object.entries(schoolIconModules).forEach(([path, url]) => {
  const name = path.split('/').pop()?.replace(/\.png$/i, '') ?? ''
  schoolIconMap.set(name, url)
})

const roleSelectOptions = computed(() =>
  tracker.roles.value.map((r) => ({ label: `${r.id}@${r.server}`, value: r.id }))
)
const roleMap = computed(() => new Map(tracker.roles.value.map((r) => [r.id, r])))

const wineIconMap: Record<string, string> = {
  '汾酒': icon88,
  '玉露酒': icon255,
  '葡萄酒': icon1400,
  '女儿红': icon10134,
  '状元红': icon10134,
  '高粱酒': icon237,
  '关外白酒': icon1396,
}

const wineTypes = ['汾酒', '玉露酒', '葡萄酒', '女儿红', '状元红', '高粱酒', '关外白酒']
const targets = ['今朝醉', '六日醉', '旬又三', '醉月香', '藏百日']

const addForm = reactive({
  wineType: '汾酒',
  target: '今朝醉',
  roleId: null as string | null,
})

const roleSubmitted = ref(false)
const roleValidation = computed(() => roleSubmitted.value && !addForm.roleId ? 'error' as const : undefined)

function handleAdd() {
  roleSubmitted.value = true
  if (!addForm.roleId) return
  wineBury.addWine(addForm.wineType, addForm.target, addForm.roleId)
  roleSubmitted.value = false
  showAddModal.value = false
  addForm.wineType = '汾酒'
  addForm.target = '今朝醉'
  addForm.roleId = null
}

function getRoleLabel(roleId?: string): string {
  if (!roleId) return ''
  const role = roleMap.value.get(roleId)
  return role ? `${role.id}@${role.server}` : roleId
}

function renderRoleOption(option: { value?: string | number; label?: string | number }) {
  const roleId = String(option.value ?? '')
  const role = roleMap.value.get(roleId)
  if (!role) return String(option.label ?? roleId)
  return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
    h('span', `${role.id}（${role.server}/`),
    h(SchoolBadge, { school: role.school }),
    h('span', '）')
  ])
}

function handleRemove(id: string) {
  wineBury.removeWine(id)
}

function getTargetColor(target: string): string {
  return ['今朝醉', '六日醉'].includes(target) ? '#007eff' : '#fe2dfe'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}
</script>

<style scoped>
.tool-card {
  width: 220px;
  cursor: pointer;
}

.tool-card-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.tool-card-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 8px;
}

.tool-card-title {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 4px;
}

.tool-card-desc {
  font-size: 12px;
  color: #909399;
}


.wine-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wine-empty {
  color: #909399;
  font-size: 13px;
  text-align: center;
  padding: 32px 0;
}

.wine-item {
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.wine-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  position: relative;
}

.wine-item-name {
  font-weight: bold;
  font-size: 14px;
}

.wine-item-role {
  margin-left: auto;
  margin-right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #909399;
}

.wine-school-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.wine-item-close {
  position: absolute;
  top: -4px;
  right: -4px;
  cursor: pointer;
  font-size: 18px;
  color: #c0c4cc;
  line-height: 1;
}

.wine-item-close:hover {
  color: #d03050;
}

.wine-item-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.wine-done {
  color: #18a058;
  font-weight: bold;
}

.wine-radio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 0;
  width: 100%;
}

.wine-radio-label {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 4em;
  text-align: center;
}

.wine-radio-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
}
</style>
