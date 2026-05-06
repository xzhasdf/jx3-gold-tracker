<template>
  <div class="tool-cards">
    <n-card hoverable class="tool-card" @click="showWineDrawer = true">
      <div class="tool-card-row">
        <img :src="icon237" class="tool-card-icon" />
        <div>
          <div class="tool-card-title">家园藏酒</div>
          <div class="tool-card-desc">管理家园藏酒进度，到期自动提醒</div>
        </div>
      </div>
    </n-card>

    <n-card hoverable class="tool-card" @click="showDivinationModal = true">
      <div class="tool-card-row">
        <img :src="icon13867" class="tool-card-icon" />
        <div>
          <div class="tool-card-title">试炼翻牌占卜</div>
          <div class="tool-card-desc">玄学起卦，算试炼翻牌结果</div>
        </div>
      </div>
    </n-card>
  </div>

  <n-modal v-model:show="showDivinationModal" preset="card" title="试炼翻牌占卜" style="max-width: 420px">
    <n-form label-placement="left" label-width="60">
      <n-form-item :show-label="false" style="padding-left: 20px;">
        <n-radio-group v-model:value="divForm.method">
          <n-space>
            <n-radio value="meihua">梅花易数</n-radio>
            <n-radio value="liuren">小六壬</n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="分数">
        <n-input-number v-model:value="divForm.score" :min="1" :show-button="false" placeholder="输入分数" style="width: 100%" @update:value="(v: number | null) => divForm.score = v !== null ? Math.floor(v) : null" />
      </n-form-item>
      <n-form-item label="层数">
        <n-input-number v-model:value="divForm.floor" :min="1" :show-button="false" placeholder="输入层数" style="width: 100%" @update:value="(v: number | null) => divForm.floor = v !== null ? Math.floor(v) : null" />
      </n-form-item>
    </n-form>
    <div v-if="divResult !== null" class="div-result">
      <div class="div-result-card">
        <!-- 梅花易数结果 -->
        <template v-if="divForm.method === 'meihua'">
          <div class="div-result-label">梅花易数起卦</div>
          <div class="div-result-gua-row">
            <div class="div-hexagram">
              <img :src="GUA_ICONS[divUpperNum]" class="div-gua-icon" />
              <img :src="GUA_ICONS[divLowerNum]" class="div-gua-icon" />
            </div>
            <div class="div-gua-info">
              <span class="div-gua-name">{{ TRIGRAMS[divUpperNum].name }}上{{ TRIGRAMS[divLowerNum].name }}下</span>
              <span class="div-gua-yao">动爻第{{ divChangingLine }}爻</span>
            </div>
          </div>
        </template>
        <!-- 小六壬结果 -->
        <template v-else>
          <div class="div-liuren-steps">
            <div class="div-liuren-step" v-for="(step, i) in liurenSteps" :key="i">
              <span class="div-liuren-step-label">{{ step.label }}</span>
              <span class="div-liuren-step-arrow">→</span>
              <span class="div-liuren-step-gong" :style="{ color: LIUREN_GONG[step.gong].color }">{{ step.gong }}</span>
            </div>
          </div>
        </template>
        <div class="div-result-pick-row">
          翻第 <span class="div-result-pick">{{ divResult }}</span> 张牌
        </div>
      </div>
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="resetDivination">重置</n-button>
        <n-button type="primary" @click="handleDivination" :disabled="!divForm.score || !divForm.floor">起卦</n-button>
      </n-space>
    </template>
  </n-modal>

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
            <span class="wine-item-status">
              <span :class="{ 'wine-done': wineBury.getProgress(item) >= 100 }">{{ wineBury.getRemainingText(item) }}</span>
              <n-button
                v-if="wineBury.getProgress(item) >= 100"
                size="tiny"
                type="warning"
                ghost
                @click="handleReset(item.id)"
              >重置</n-button>
            </span>
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
import { computed, h, reactive, ref, watch } from 'vue'
import { useWineBury } from '../../composables/useWineBury'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'
import icon88 from '../../assets/icon/88.png'
import icon237 from '../../assets/icon/237.png'
import icon255 from '../../assets/icon/255.png'
import icon1396 from '../../assets/icon/1396.png'
import icon1400 from '../../assets/icon/1400.png'
import icon10134 from '../../assets/icon/10134.png'
import icon13867 from '../../assets/icon/13867.png'
import iconNum1 from '../../assets/icon/7674.png'
import iconNum2 from '../../assets/icon/7676.png'
import iconNum3 from '../../assets/icon/7673.png'
import iconNum4 from '../../assets/icon/7675.png'
import iconNum5 from '../../assets/icon/7672.png'
import iconGua1 from '../../assets/icon/20101.png'
import iconGua2 from '../../assets/icon/20102.png'
import iconGua3 from '../../assets/icon/20103.png'
import iconGua4 from '../../assets/icon/20104.png'
import iconGua5 from '../../assets/icon/20105.png'
import iconGua6 from '../../assets/icon/20106.png'
import iconGua7 from '../../assets/icon/20107.png'
import iconGua8 from '../../assets/icon/20108.png'

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

function handleReset(id: string) {
  wineBury.resetWine(id)
}

function getTargetColor(target: string): string {
  return ['今朝醉', '六日醉'].includes(target) ? '#007eff' : '#fe2dfe'
}

// ─── 试炼翻牌占卜（梅花易数） ────────────────────────────────────────────
const showDivinationModal = ref(false)
const divForm = reactive({ score: null as number | null, floor: null as number | null, method: 'meihua' as 'meihua' | 'liuren' })

watch(() => divForm.method, () => {
  divResult.value = null
  liurenSteps.value = []
})
const divResult = ref<number | null>(null)
const divGuaText = ref('')
const divUpperNum = ref(0)
const divLowerNum = ref(0)
const divChangingLine = ref(0)

const NUM_ICONS: Record<number, string> = { 1: iconNum1, 2: iconNum2, 3: iconNum3, 4: iconNum4, 5: iconNum5 }
// 20101坤 20102巽 20103离 20104震 20105艮 20106坎 20107乾 20108兑
const GUA_ICONS: Record<number, string> = { 1: iconGua7, 2: iconGua8, 3: iconGua3, 4: iconGua4, 5: iconGua2, 6: iconGua6, 7: iconGua5, 8: iconGua1 }

// 先天八卦：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
const TRIGRAMS: Record<number, { name: string; symbol: string; element: string }> = {
  1: { name: '乾', symbol: '☰', element: '金' },
  2: { name: '兑', symbol: '☱', element: '金' },
  3: { name: '离', symbol: '☲', element: '火' },
  4: { name: '震', symbol: '☳', element: '木' },
  5: { name: '巽', symbol: '☴', element: '木' },
  6: { name: '坎', symbol: '☵', element: '水' },
  7: { name: '艮', symbol: '☶', element: '土' },
  8: { name: '坤', symbol: '☷', element: '土' },
}

function trigramNumber(num: number): number {
  const r = num % 8
  return r === 0 ? 8 : r
}

function movingLineNumber(num: number): number {
  const r = num % 6
  return r === 0 ? 6 : r
}

function getShichenNumber(hour: number): number {
  if (hour === 23 || hour === 0) return 1  // 子时
  return Math.floor((hour + 1) / 2) + 1
}

// ─── 小六壬 ─────────────────────────────────────────────────────────────
// 六宫顺序：大安→留连→速喜→赤口→小吉→空亡
const LIUREN_ORDER = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const
type LiurenGongName = typeof LIUREN_ORDER[number]

const LIUREN_GONG: Record<string, { meaning: string; color: string }> = {
  '大安': { meaning: '身不动时，五行属木，颜色青色，方位东方', color: '#18a058' },
  '留连': { meaning: '卒未归时，五行属水，颜色黑色，方位北方', color: '#2080f0' },
  '速喜': { meaning: '人即至时，五行属火，颜色红色，方位南方', color: '#d03050' },
  '赤口': { meaning: '官事凶时，五行属金，颜色白色，方位西方', color: '#e6a23c' },
  '小吉': { meaning: '人来喜时，五行属水，颜色黑色，方位北方', color: '#8b5cf6' },
  '空亡': { meaning: '音信稀时，五行属土，颜色黄色，方位中央', color: '#909399' },
}

const liurenSteps = ref<{ label: string; gong: string }[]>([])

/**
 * 小六壬推算
 * 第一轮：从大安起，数月数
 * 第二轮：从第一轮落宫起，数日数
 * 第三轮：从第二轮落宫起，数时辰数
 */
function calcLiuren(month: number, day: number, shichen: number): { gong: string; steps: { label: string; gong: string }[] } {
  // 第一轮：月份起大安
  const monthIdx = (month - 1) % 6
  const monthGong = LIUREN_ORDER[monthIdx]

  // 第二轮：从月落宫起，数日数
  const dayStart = monthIdx
  const dayIdx = (dayStart + day - 1) % 6
  const dayGong = LIUREN_ORDER[dayIdx]

  // 第三轮：从日落宫起，数时辰数
  const hourStart = dayIdx
  const hourIdx = (hourStart + shichen - 1) % 6
  const hourGong = LIUREN_ORDER[hourIdx]

  return {
    gong: hourGong,
    steps: [
      { label: `月（${month}）`, gong: monthGong },
      { label: `日（${day}）`, gong: dayGong },
      { label: `时辰（${shichen}）`, gong: hourGong },
    ]
  }
}

function handleDivination() {
  if (!divForm.score || !divForm.floor) return
  const score = divForm.score
  const floor = divForm.floor
  const now = new Date()
  const shichen = getShichenNumber(now.getHours())
  const minutes = now.getMinutes()

  if (divForm.method === 'meihua') {
    // 梅花易数起卦
    const upperNum = trigramNumber(score + minutes)
    const lowerNum = trigramNumber(floor + shichen)
    const changingLine = movingLineNumber(score + floor + shichen + minutes)

    divUpperNum.value = upperNum
    divLowerNum.value = lowerNum
    divChangingLine.value = changingLine
    divResult.value = (upperNum + lowerNum + changingLine) % 5 + 1
  } else {
    // 小六壬：分数当月、层数当日、时辰+分钟当时
    const result = calcLiuren(score, floor, shichen + minutes)
    liurenSteps.value = result.steps
    const gongIdx = LIUREN_ORDER.indexOf(result.gong as LiurenGongName)
    divResult.value = (gongIdx % 5) + 1
  }
}

function resetDivination() {
  divForm.score = null
  divForm.floor = null
  divResult.value = null
  divGuaText.value = ''
  divUpperNum.value = 0
  divLowerNum.value = 0
  divChangingLine.value = 0
  liurenSteps.value = []
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
.tool-cards {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

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


.div-result {
  padding: 12px 0 0;
}

.div-result-card {
  background: linear-gradient(135deg, #f5f0ff, #eef6ff);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.div-result-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.div-result-gua-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.div-hexagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.div-gua-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 4px;
}

.div-gua-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.div-gua-name {
  font-size: 14px;
  color: #303133;
  font-weight: bold;
}

.div-gua-yao {
  font-size: 13px;
  color: #764ba2;
}

.div-result-pick-row {
  font-size: 16px;
  color: #303133;
}

.div-result-pick {
  font-size: 36px;
  font-weight: bold;
  color: #e6a23c;
  margin: 0 6px;
}

.div-liuren-steps {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.div-liuren-step {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.div-liuren-step-label {
  color: #909399;
  width: 90px;
  text-align: right;
}

.div-liuren-step-arrow {
  color: #c0c4cc;
  width: 40px;
  text-align: center;
}

.div-liuren-step-gong {
  font-weight: bold;
  font-size: 16px;
  width: 60px;
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

.wine-item-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
