<template>
  <n-card>
    <div class="dm-toolbar">
      <n-space :size="12" align="center" :wrap-item="false">
        <n-button type="primary" @click="openCreate()">新建副本</n-button>
        <n-button @click="showRoster = true">团牌管理</n-button>
      </n-space>
      <div class="dm-tip">拖动 ⠿ 调整顺序 · 难度标签上的数字为本周已通关角色数，鼠标移入查看未通关角色</div>
    </div>

    <div v-if="groups.length === 0" class="dm-empty">暂无副本，点击「新建副本」添加</div>

    <draggable
      :list="groups"
      item-key="name"
      handle=".dm-handle"
      ghost-class="dm-ghost"
      :animation="200"
      class="dm-list"
      @end="onDragEnd"
    >
      <template #item="{ element: group, index }">
        <div class="dm-card">
          <div class="dm-card-head">
            <span class="dm-handle" title="拖动排序">⠿</span>
            <span class="dm-name">{{ group.name }}</span>
            <span v-if="group.name === effectiveDefaultName" class="dm-default-tag" title="新增收支时默认选中这个副本">★ 默认</span>
            <n-dropdown trigger="click" :options="groupMenuOptions(index)" @select="(key: string) => onGroupMenu(key, group)">
              <n-button text class="dm-more" title="更多操作">⋯</n-button>
            </n-dropdown>
          </div>
          <div class="dm-chips">
            <n-popover v-for="d in group.dungeons" :key="d.id" trigger="hover" placement="bottom-start" :show-arrow="false">
              <template #trigger>
                <span class="dm-chip" :class="[`diff-${d.difficulty}`, { done: cdOf(d.id).total > 0 && cdOf(d.id).cleared === cdOf(d.id).total }]">
                  {{ d.players }}{{ d.difficulty }}
                  <span class="dm-chip-cd">{{ cdOf(d.id).cleared }}/{{ cdOf(d.id).total }}</span>
                </span>
              </template>
              <div class="dm-pop">
                <component :is="() => renderCdList(d.id)" />
                <div class="dm-pop-actions">
                  <n-button size="tiny" @click="openEdit(d.id)">编辑</n-button>
                  <n-button size="tiny" type="warning" ghost @click="tracker.hideDungeon(d.id)">隐藏</n-button>
                </div>
              </div>
            </n-popover>
            <span v-if="missingCombos(group.name).length" class="dm-chip dm-chip-add" title="添加难度" @click="openCreate(group.name)">+ 难度</span>
          </div>
        </div>
      </template>
    </draggable>

    <div v-if="hiddenDungeons.length" class="dm-hidden">
      <div class="dm-hidden-head" @click="showHiddenList = !showHiddenList">
        <span>{{ showHiddenList ? '▾' : '▸' }} 已隐藏副本（{{ hiddenDungeons.length }}）</span>
        <span class="dm-tip">隐藏后不会出现在新建记录的副本选项中</span>
      </div>
      <div v-if="showHiddenList" class="dm-hidden-list">
        <div v-for="d in hiddenDungeons" :key="d.id" class="dm-hidden-item">
          <span>{{ d.name }} · {{ d.players }}{{ d.difficulty }}</span>
          <n-space :size="6" :wrap-item="false">
            <n-button size="tiny" @click="tracker.unhideDungeon(d.id)">显示</n-button>
            <n-button size="tiny" type="error" ghost @click="handleDelete(d)">删除</n-button>
          </n-space>
        </div>
      </div>
    </div>
  </n-card>

  <!-- 新建副本 / 给已有副本补难度 -->
  <n-modal v-model:show="showCreate" preset="card" :title="createLocked ? `为「${createForm.name}」添加难度` : '新建副本'" style="max-width: 520px">
    <n-form label-placement="left" label-width="72">
      <n-form-item label="副本名称">
        <n-input v-model:value="createForm.name" placeholder="如：洛阳之战" :disabled="createLocked" />
      </n-form-item>
      <n-form-item label="人数难度">
        <div class="dm-combo-grid">
          <div v-for="p in playerTypes" :key="p" class="dm-combo-row">
            <span class="dm-combo-label">{{ p }}</span>
            <n-checkbox
              v-for="diff in difficultiesFor(p)"
              :key="diff"
              :checked="createForm.combos.includes(`${p}|${diff}`)"
              :disabled="comboExists(createForm.name, p, diff)"
              @update:checked="(v: boolean) => toggleCombo(`${p}|${diff}`, v)"
            >
              {{ diff }}<span v-if="comboExists(createForm.name, p, diff)" class="dm-combo-exist">（已有）</span>
            </n-checkbox>
          </div>
        </div>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showCreate = false">取消</n-button>
        <n-button type="primary" :disabled="createForm.combos.length === 0" @click="saveCreate">
          添加{{ createForm.combos.length ? ` ${createForm.combos.length} 个难度` : '' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showEdit" preset="card" title="编辑副本" style="max-width: 560px">
    <n-form label-placement="left" label-width="80">
      <n-form-item label="人数">
        <n-select v-model:value="editForm.players" :options="playerOptions" :style="{ width: '340px' }" />
      </n-form-item>
      <n-form-item label="难度">
        <n-select v-model:value="editForm.difficulty" :options="editDifficultyOptions" :style="{ width: '340px' }" />
      </n-form-item>
      <n-form-item label="名称">
        <n-input v-model:value="editForm.name" :style="{ width: '340px' }" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showEdit = false">取消</n-button>
        <n-button type="primary" @click="saveEdit">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showRename" preset="card" title="重命名副本" style="max-width: 480px">
    <n-form label-placement="left" label-width="72">
      <n-form-item label="新名称">
        <n-input v-model:value="renameForm.name" @keyup.enter="saveRename" />
      </n-form-item>
    </n-form>
    <div class="dm-tip">该副本下所有难度（含已隐藏的）都会一起改名，历史记录不受影响；改成已有的副本名会合并到该副本</div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showRename = false">取消</n-button>
        <n-button type="primary" @click="saveRename">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showRoster" preset="card" title="团牌管理" style="max-width: 760px">
    <div class="brand-toolbar">
      <n-space :size="8" :wrap-item="false" align="center">
        <n-input v-model:value="brandForm.name" placeholder="输入团牌名称" style="width: 180px" @keyup.enter="handleAddBrand" />
        <n-button type="primary" @click="handleAddBrand">添加团牌</n-button>
      </n-space>
      <n-space :size="8" :wrap-item="false" align="center">
        <n-input v-model:value="brandFilter.keyword" clearable placeholder="搜索团牌/团长" style="width: 180px" />
        <n-select v-model:value="brandFilter.status" :options="brandStatusOptions" style="width: 120px" />
      </n-space>
    </div>
    <div class="brand-tip">收支明细中填写新团牌时会自动创建；团牌拉黑后，录入该团牌的记录将自动标记拉黑</div>
    <n-data-table :columns="rosterColumns" :data="filteredRosterRows" :pagination="false" :max-height="420" />
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NTag, type DataTableColumns, type DropdownOption, useDialog } from 'naive-ui'
import draggable from 'vuedraggable'
import type { Dungeon } from '../../types'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'

type Players = Dungeon['players']
type Difficulty = Dungeon['difficulty']

interface GroupItem {
  name: string
  dungeons: Dungeon[]
}

interface RosterRow {
  id: string
  name: string
  blacklisted: boolean
  leaders: string[]
  recordCount: number
}

const tracker = useTracker()
const dialog = useDialog()

const playerTypes = tracker.playerTypes as readonly Players[]
const difficultyTypes = tracker.difficultyTypes as readonly Difficulty[]
const playerOptions = playerTypes.map((v) => ({ label: v, value: v }))

// 10 人没有挑战难度
function difficultiesFor(players: Players): Difficulty[] {
  return difficultyTypes.filter((d) => !(players === '10人' && d === '挑战'))
}
const COMBO_ORDER = playerTypes.flatMap((p) => difficultyTypes.map((d) => `${p}${d}`))

// ─── 副本分组列表（可拖动排序） ─────────────────────────────────────────
const groups = ref<GroupItem[]>([])
watch(
  () => tracker.orderedDungeonGroups.value,
  (list) => {
    groups.value = list
      .filter((g) => !g.allHidden)
      .map((g) => ({
        name: g.name,
        dungeons: g.dungeons
          .filter((d) => !d.hidden)
          .slice()
          .sort((a, b) => COMBO_ORDER.indexOf(`${a.players}${a.difficulty}`) - COMBO_ORDER.indexOf(`${b.players}${b.difficulty}`))
      }))
  },
  { immediate: true, deep: true }
)

function onDragEnd() {
  tracker.setDungeonOrder(groups.value.map((g) => g.name))
}

function moveGroup(name: string, to: 'top' | 'bottom') {
  const names = groups.value.map((g) => g.name).filter((n) => n !== name)
  tracker.setDungeonOrder(to === 'top' ? [name, ...names] : [...names, name])
}

function groupMenuOptions(index: number): DropdownOption[] {
  return [
    { label: groups.value[index]?.name === effectiveDefaultName.value ? '已是默认副本' : '设为默认', key: 'default', disabled: groups.value[index]?.name === effectiveDefaultName.value },
    { type: 'divider', key: 'd0' },
    { label: '添加难度', key: 'add' },
    { label: '重命名', key: 'rename' },
    { type: 'divider', key: 'd1' },
    { label: '置顶', key: 'top', disabled: index === 0 },
    { label: '置底', key: 'bottom', disabled: index === groups.value.length - 1 },
    { type: 'divider', key: 'd2' },
    { label: '隐藏整组', key: 'hide' }
  ]
}

function onGroupMenu(key: string, group: GroupItem) {
  if (key === 'default') tracker.setDefaultDungeon(group.name)
  else if (key === 'add') openCreate(group.name)
  else if (key === 'rename') openRename(group.name)
  else if (key === 'top' || key === 'bottom') moveGroup(group.name, key)
  else if (key === 'hide') tracker.toggleDungeonHidden(group.name)
}

// 当前实际生效的默认副本（含回退逻辑），用来标「默认」和禁用「设为默认」
const effectiveDefaultName = computed(() => tracker.resolveDefaultDungeonName())

const hiddenDungeons = computed(() =>
  tracker.dungeons.value
    .filter((d) => d.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || `${a.players}${a.difficulty}`.localeCompare(`${b.players}${b.difficulty}`, 'zh-CN'))
)
const showHiddenList = ref(false)

// ─── 本周 CD ───────────────────────────────────────────────────────────
const cdStatus = computed(() => tracker.getWeeklyCdStatusByRole())
const cdMap = computed(() => {
  const map = new Map<string, { cleared: number; total: number; notCleared: { id: string; server: string; school: string }[] }>()
  tracker.dungeons.value.forEach((d) => map.set(d.id, { cleared: 0, total: 0, notCleared: [] }))
  cdStatus.value.forEach((role) => {
    role.dungeons.forEach((item) => {
      const entry = map.get(item.dungeonId)
      if (!entry) return
      entry.total++
      if (item.cleared) entry.cleared++
      else entry.notCleared.push({ id: role.roleId, server: role.roleServer, school: role.roleSchool })
    })
  })
  return map
})
function cdOf(id: string) {
  return cdMap.value.get(id) ?? { cleared: 0, total: 0, notCleared: [] }
}

function renderCdList(dungeonId: string) {
  const cd = cdOf(dungeonId)
  if (cd.total === 0) return h('div', { class: 'cd-popover-empty' }, '暂无计入 CD 统计的角色')
  if (cd.notCleared.length === 0) return h('div', { class: 'cd-popover-done' }, '全部角色已通关')
  return h('div', { class: 'cd-popover' }, [
    h('div', { class: 'cd-popover-header' }, [
      h('span', { class: 'cd-popover-title' }, '未通关角色'),
      h('span', { class: 'cd-popover-count' }, `${cd.notCleared.length} / ${cd.total}`)
    ]),
    h('div', { class: 'cd-popover-list' }, cd.notCleared.map((role) =>
      h('div', { class: 'cd-popover-item', key: role.id }, [
        h('span', { class: 'cd-popover-role-name' }, `${role.id}@${role.server}`),
        h('span', { class: 'cd-popover-school' }, [h(SchoolBadge, { school: role.school })])
      ])
    ))
  ])
}

// ─── 新建副本 / 补难度 ─────────────────────────────────────────────────
const showCreate = ref(false)
const createLocked = ref(false)
const createForm = reactive<{ name: string; combos: string[] }>({ name: '', combos: [] })

function comboExists(name: string, players: Players, difficulty: Difficulty) {
  const n = name.trim()
  if (!n) return false
  return tracker.dungeons.value.some((d) => d.name === n && d.players === players && d.difficulty === difficulty)
}

function missingCombos(name: string) {
  return playerTypes.flatMap((p) => difficultiesFor(p).filter((d) => !comboExists(name, p, d)).map((d) => `${p}|${d}`))
}

// 名称改动后，去掉已存在的组合
watch(() => createForm.name, (name) => {
  createForm.combos = createForm.combos.filter((c) => {
    const [p, d] = c.split('|') as [Players, Difficulty]
    return !comboExists(name, p, d)
  })
})

function openCreate(name?: string) {
  createLocked.value = Boolean(name)
  createForm.name = name ?? ''
  createForm.combos = []
  showCreate.value = true
}

function toggleCombo(key: string, checked: boolean) {
  createForm.combos = checked ? [...createForm.combos, key] : createForm.combos.filter((c) => c !== key)
}

function warn(message?: string) {
  dialog.warning({ title: '提示', content: message ?? '操作失败', positiveText: '知道了' })
}

function saveCreate() {
  const name = createForm.name.trim()
  if (!name) return warn('副本名称不能为空')
  for (const combo of createForm.combos) {
    const [players, difficulty] = combo.split('|') as [Players, Difficulty]
    const result = tracker.addDungeon({ name, players, difficulty })
    if (!result.ok) return warn(result.message)
  }
  showCreate.value = false
}

// ─── 编辑单个难度 / 重命名整组 ─────────────────────────────────────────
const showEdit = ref(false)
const editingId = ref('')
const editForm = reactive<{ players: Players; difficulty: Difficulty; name: string }>({ players: '10人', difficulty: '普通', name: '' })
// 编辑前的原值：历史数据里可能有 10 人挑战，打开编辑时照常显示、不自动改动
const editOriginal = reactive<{ players: Players; difficulty: Difficulty }>({ players: '10人', difficulty: '普通' })
const editDifficultyOptions = computed(() => {
  const list = difficultiesFor(editForm.players)
  if (!list.includes(editForm.difficulty)) list.push(editForm.difficulty)
  return list.map((v) => ({ label: v, value: v }))
})

function openEdit(id: string) {
  const dungeon = tracker.dungeons.value.find((item) => item.id === id)
  if (!dungeon) return
  editingId.value = dungeon.id
  editOriginal.players = dungeon.players
  editOriginal.difficulty = dungeon.difficulty
  editForm.players = dungeon.players
  editForm.difficulty = dungeon.difficulty
  editForm.name = dungeon.name
  showEdit.value = true
}

function saveEdit() {
  const invalid = !difficultiesFor(editForm.players).includes(editForm.difficulty)
  const unchangedCombo = editForm.players === editOriginal.players && editForm.difficulty === editOriginal.difficulty
  if (invalid && !unchangedCombo) return warn(`${editForm.players}没有${editForm.difficulty}难度`)
  const result = tracker.updateDungeon(editingId.value, { ...editForm })
  if (!result.ok) return warn(result.message)
  showEdit.value = false
}

const showRename = ref(false)
const renameForm = reactive({ oldName: '', name: '' })

function openRename(name: string) {
  renameForm.oldName = name
  renameForm.name = name
  showRename.value = true
}

function saveRename() {
  const name = renameForm.name.trim()
  if (!name) return warn('副本名称不能为空')
  const result = tracker.renameDungeonGroup(renameForm.oldName, name)
  if (!result.ok) return warn(result.message)
  showRename.value = false
}

function handleDelete(d: { id: string; players: string; difficulty: string; name: string }) {
  const linked = tracker.records.value.filter((r) => r.dungeonId === d.id).length
  const warning = linked > 0
    ? `该副本已有 ${linked} 条历史记录，删除后这些记录的副本名称将显示为「副本已删除」。`
    : '该副本暂无历史记录。'
  dialog.error({
    title: '删除确认',
    content: () => h('div', { style: 'white-space: pre-wrap; line-height: 1.6;' },
      `确认删除副本「${d.players}${d.difficulty}${d.name}」吗？\n\n${warning}\n\n该操作不可恢复，请谨慎操作。`),
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => {
      tracker.deleteDungeon(d.id)
    }
  })
}

// ─── 团牌管理（与改版前一致） ──────────────────────────────────────────
const showRoster = ref(false)

const rosterRows = computed<RosterRow[]>(() => {
  const countMap = new Map<string, number>()
  tracker.records.value.forEach((r) => {
    const name = r.groupBrand?.trim()
    if (!name) return
    countMap.set(name, (countMap.get(name) ?? 0) + 1)
  })
  return tracker.groupBrands.value
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      blacklisted: Boolean(brand.blacklisted),
      leaders: tracker.getLeadersForBrand(brand.name),
      recordCount: countMap.get(brand.name) ?? 0
    }))
})

const brandForm = reactive({ name: '' })
const brandFilter = reactive<{ keyword: string; status: 'all' | 'black' | 'normal' }>({ keyword: '', status: 'all' })

const brandStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '黑名单', value: 'black' },
  { label: '未拉黑', value: 'normal' }
]

const filteredRosterRows = computed<RosterRow[]>(() => {
  const kw = brandFilter.keyword.trim().toLowerCase()
  return rosterRows.value.filter((row) => {
    if (brandFilter.status === 'black' && !row.blacklisted) return false
    if (brandFilter.status === 'normal' && row.blacklisted) return false
    if (kw) {
      const matchName = row.name.toLowerCase().includes(kw)
      const matchLeader = row.leaders.some((leader) => leader.toLowerCase().includes(kw))
      if (!matchName && !matchLeader) return false
    }
    return true
  })
})

watch(showRoster, (value) => {
  if (!value) return
  brandForm.name = ''
  brandFilter.keyword = ''
  brandFilter.status = 'all'
})

function handleAddBrand() {
  const result = tracker.addGroupBrand(brandForm.name)
  if (!result.ok) return warn(result.message)
  brandForm.name = ''
}

function handleDeleteBrand(row: RosterRow) {
  const warning = row.recordCount > 0
    ? `该团牌已有 ${row.recordCount} 条历史记录，删除后历史记录仍保留团牌文本，但该团牌不再出现在下拉选项中。`
    : '该团牌暂无历史记录。'
  dialog.error({
    title: '删除确认',
    content: () => h('div', { style: 'white-space: pre-wrap; line-height: 1.6;' },
      `确认删除团牌「${row.name}」吗？\n\n${warning}`),
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => {
      tracker.deleteGroupBrand(row.id)
    }
  })
}

const rosterColumns: DataTableColumns<RosterRow> = [
  { title: '团牌', key: 'name', width: 160 },
  {
    title: '历史团长',
    key: 'leaders',
    render: (row) => {
      if (row.leaders.length === 0) return '-'
      return h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;' },
        row.leaders.map((leader) => h(NTag, { size: 'small', key: leader }, { default: () => leader })))
    }
  },
  {
    title: '状态',
    key: 'blacklisted',
    width: 90,
    render: (row) => (row.blacklisted ? h(NTag, { type: 'error', size: 'small' }, { default: () => '黑名单' }) : '-')
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render: (row) => h('div', { class: 'action-group' }, [
      h('button', {
        class: row.blacklisted ? 'mini-btn' : 'mini-btn warning',
        onClick: () => tracker.setGroupBrandBlacklisted(row.id, !row.blacklisted)
      }, row.blacklisted ? '取消拉黑' : '拉黑'),
      h('button', { class: 'mini-btn danger', onClick: () => handleDeleteBrand(row) }, '删除')
    ])
  }
]
</script>

<style scoped>
.dm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.dm-tip {
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.dm-empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 32px 0;
}
.dm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dm-card {
  border: 1px solid #efeff5;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
.dm-card:hover {
  border-color: #d6e4ff;
}
.dm-ghost {
  opacity: 0.4;
  background: #f0f7ff;
}
.dm-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dm-handle {
  cursor: grab;
  color: #c0c4cc;
  font-size: 16px;
  line-height: 1;
  user-select: none;
}
.dm-handle:hover {
  color: #3f83f8;
}
.dm-name {
  font-size: 15px;
  font-weight: 600;
  color: #222;
}
.dm-more {
  margin-left: auto;
  font-size: 18px;
  line-height: 1;
  color: #909399;
}
.dm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-left: 24px;
}
.dm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  border-left-width: 3px;
  border-radius: 4px;
  background: #fafafa;
  cursor: default;
  user-select: none;
}
.dm-chip.diff-普通 { border-left-color: #f0a020; }
.dm-chip.diff-英雄 { border-left-color: #2080f0; }
.dm-chip.diff-挑战 { border-left-color: #d03050; }
.dm-chip-cd {
  color: #909399;
  font-variant-numeric: tabular-nums;
}
.dm-chip.done .dm-chip-cd {
  color: #18a058;
  font-weight: 600;
}
.dm-chip-add {
  border-style: dashed;
  border-left-width: 1px;
  color: #3f83f8;
  background: #fff;
  cursor: pointer;
}
.dm-chip-add:hover {
  border-color: #3f83f8;
}
.dm-pop {
  min-width: 180px;
}
/* 角色多时名单在弹层内滚动，不撑出屏幕；细滚动条，轨道透明 */
.dm-pop :deep(.cd-popover-list) {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
.dm-pop :deep(.cd-popover-list)::-webkit-scrollbar {
  width: 6px;
}
.dm-pop :deep(.cd-popover-list)::-webkit-scrollbar-track {
  background: transparent;
}
.dm-pop :deep(.cd-popover-list)::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}
.dm-pop :deep(.cd-popover-list):hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.25);
}
.dm-pop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #efeff5;
}
.dm-default-tag {
  padding: 0 7px;
  border-radius: 9px;
  background: #fdf6ec;
  font-size: 12px;
  line-height: 18px;
  color: #f0a020;
}

.dm-hidden {
  margin-top: 16px;
  border-top: 1px dashed #e0e0e6;
  padding-top: 10px;
}
.dm-hidden-head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  user-select: none;
}
.dm-hidden-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.dm-hidden-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid #efeff5;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
}
.dm-combo-grid {
  display: flex;
  flex-direction: column;
}
.dm-combo-row {
  /* 每行与表单标签同高，「人数难度」与首行水平对齐 */
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: var(--n-blank-height, 34px);
}
.dm-combo-label {
  width: 40px;
  color: #606266;
}
.dm-combo-exist {
  color: #c0c4cc;
  font-size: 12px;
}
.brand-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.brand-tip {
  color: #999;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}
</style>
