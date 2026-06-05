<template>
  <n-card>
    <n-form inline>
      <n-form-item label="人数">
        <n-select v-model:value="form.players" :options="playerOptions" class="field-340" />
      </n-form-item>
      <n-form-item label="难度">
        <n-select v-model:value="form.difficulty" :options="difficultyOptions" class="field-340" />
      </n-form-item>
      <n-form-item label="副本名称">
        <n-input v-model:value="form.name" placeholder="手动录入名称" class="field-340" />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" @click="handleAdd">添加副本</n-button>
      </n-form-item>
    </n-form>
    <n-divider />
    <div class="dungeon-toolbar">
      <div class="dungeon-toolbar-actions">
        <n-button text type="primary" @click="showRoster = true">团牌管理</n-button>
        <n-popover trigger="click" placement="bottom-start" :show-arrow="false" style="width: 320px; padding: 10px">
          <template #trigger>
            <n-button text type="primary">排序</n-button>
          </template>
          <DungeonSortList :options="sortOptions" @change="handleSortChange" />
        </n-popover>
        <n-button text type="primary" @click="showHidden = true">
          已隐藏副本<template v-if="hiddenDungeons.length">（{{ hiddenDungeons.length }}）</template>
        </n-button>
      </div>
      <div class="dungeon-tip">副本隐藏后将不会出现在新建选项中<br/>鼠标移入列表难度 Tag 可查看该副本本周 CD</div>
    </div>
    <n-data-table :columns="columns" :data="tableRows" :pagination="false" table-layout="fixed" :expanded-row-keys="expandedKeys" @update:expanded-row-keys="(keys: string[]) => expandedKeys = keys" />
  </n-card>

  <n-modal v-model:show="showEdit" preset="card" title="编辑副本" style="max-width: 560px">
    <n-form label-placement="left" label-width="80">
      <n-form-item label="人数">
        <n-select v-model:value="editForm.players" :options="playerOptions" :style="{ width: '340px' }" />
      </n-form-item>
      <n-form-item label="难度">
        <n-select v-model:value="editForm.difficulty" :options="difficultyOptions" :style="{ width: '340px' }" />
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

  <n-modal v-model:show="showHidden" preset="card" title="已隐藏副本" style="max-width: 560px">
    <div v-if="hiddenDungeons.length === 0" style="color:#999;font-size:13px;">暂无隐藏副本</div>
    <div v-else class="hidden-list">
      <div v-for="d in hiddenDungeons" :key="d.id" class="hidden-item">
        <span class="hidden-item-label">{{ d.players }}{{ d.difficulty }}{{ d.name }}</span>
        <div class="hidden-item-actions">
          <n-button size="tiny" @click="tracker.unhideDungeon(d.id)">显示</n-button>
          <n-button size="tiny" type="error" ghost @click="handleDelete(d)">删除</n-button>
        </div>
      </div>
    </div>
  </n-modal>


</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NPopover, NTag, type DataTableColumns, useDialog } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'
import DungeonSortList from './DungeonSortList.vue'

interface DungeonTableRow {
  key: string
  id?: string
  name: string
  players?: '10人' | '25人'
  difficulty?: '普通' | '英雄' | '挑战'
  followed?: boolean
  hidden?: boolean
  allHidden?: boolean
  configText?: string
  isGroup: boolean
  children?: DungeonTableRow[]
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

const playerOptions = tracker.playerTypes.map((v) => ({ label: v, value: v }))
const difficultyOptions = tracker.difficultyTypes.map((v) => ({ label: v, value: v }))

const form = reactive<{ players: '10人' | '25人'; difficulty: '普通' | '英雄' | '挑战'; name: string }>({
  players: '10人',
  difficulty: '普通',
  name: ''
})

const showEdit = ref(false)
const showRoster = ref(false)
const showHidden = ref(false)
const editingId = ref('')
const editForm = reactive<{ players: '10人' | '25人'; difficulty: '普通' | '英雄' | '挑战'; name: string }>({
  players: '10人',
  difficulty: '普通',
  name: ''
})

const tableRows = computed<DungeonTableRow[]>(() => {
  return tracker.orderedDungeonGroups.value
    .filter((group) => !group.allHidden)
    .map((group) => {
      const visibleDungeons = group.dungeons.filter((d) => !d.hidden)
      const children: DungeonTableRow[] = visibleDungeons
        .slice()
        .sort((a, b) => `${a.players}${a.difficulty}`.localeCompare(`${b.players}${b.difficulty}`, 'zh-CN'))
        .map((dungeon) => ({
          key: dungeon.id,
          id: dungeon.id,
          name: dungeon.name,
          players: dungeon.players,
          difficulty: dungeon.difficulty,
          followed: dungeon.followed,
          hidden: false,
          configText: `${dungeon.players}${dungeon.difficulty}`,
          isGroup: false
        }))

      const configText = children.map((item) => item.configText).join('、')
      return {
        key: `group-${group.name}`,
        name: group.name,
        configText,
        allHidden: false,
        isGroup: true,
        children
      }
    })
})

const sortOptions = computed(() =>
  tracker.orderedDungeonGroups.value
    .filter((g) => !g.allHidden)
    .map((g) => ({ label: g.name, value: g.name }))
)

const hiddenDungeons = computed(() =>
  tracker.dungeons.value
    .filter((d) => d.hidden)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || `${a.players}${a.difficulty}`.localeCompare(`${b.players}${b.difficulty}`, 'zh-CN'))
)

function handleSortChange(values: string[]) {
  tracker.setDungeonOrder(values)
}

const expandedKeys = ref<string[]>([])
watch(tableRows, (rows) => {
  expandedKeys.value = rows.filter((r) => !r.allHidden).map((r) => r.key)
}, { immediate: true })

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
  if (!result.ok) {
    dialog.warning({
      title: '提示',
      content: result.message ?? '操作失败',
      positiveText: '知道了'
    })
    return
  }
  brandForm.name = ''
}

function handleToggleBrandBlacklist(row: RosterRow) {
  tracker.setGroupBrandBlacklisted(row.id, !row.blacklisted)
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

function handleAdd() {
  const result = tracker.addDungeon({ ...form })
  if (!result.ok) {
    dialog.warning({
      title: '提示',
      content: result.message ?? '操作失败',
      positiveText: '知道了'
    })
    return
  }
  form.name = ''
}

function openEdit(row: DungeonTableRow) {
  if (row.isGroup || !row.id) return
  const dungeon = tracker.dungeons.value.find((item) => item.id === row.id)
  if (!dungeon) return
  editingId.value = dungeon.id
  editForm.players = dungeon.players
  editForm.difficulty = dungeon.difficulty
  editForm.name = dungeon.name
  showEdit.value = true
}

function saveEdit() {
  const result = tracker.updateDungeon(editingId.value, { ...editForm })
  if (!result.ok) {
    dialog.warning({
      title: '提示',
      content: result.message ?? '操作失败',
      positiveText: '知道了'
    })
    return
  }
  showEdit.value = false
}

function handleHide(row: DungeonTableRow) {
  if (row.isGroup || !row.id) return
  tracker.hideDungeon(row.id)
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

function renderDungeonCdPopover(dungeonId: string) {
  const cdStatus = tracker.getWeeklyCdStatusByRole()
  const notCleared: { id: string; server: string; school: string }[] = []
  let total = 0
  cdStatus.forEach((role) => {
    total++
    const d = role.dungeons.find((item) => item.dungeonId === dungeonId)
    if (!d?.cleared) {
      notCleared.push({ id: role.roleId, server: role.roleServer, school: role.roleSchool })
    }
  })
  if (total === 0) return h('div', { class: 'cd-popover-empty' }, '暂无角色')
  if (notCleared.length === 0) return h('div', { class: 'cd-popover-done' }, '全部角色已通关')
  return h('div', { class: 'cd-popover' }, [
    h('div', { class: 'cd-popover-header' }, [
      h('span', { class: 'cd-popover-title' }, '未通关角色'),
      h('span', { class: 'cd-popover-count' }, `${notCleared.length} / ${total}`)
    ]),
    h('div', { class: 'cd-popover-list' }, notCleared.map((role) =>
      h('div', { class: 'cd-popover-item', key: role.id }, [
        h('span', { class: 'cd-popover-role-name' }, `${role.id}@${role.server}`),
        h('span', { class: 'cd-popover-school' }, [
          h(SchoolBadge, { school: role.school })
        ])
      ])
    ))
  ])
}

function getPlayerTagType() {
  return 'default' as const
}

function getDifficultyTagType(difficulty?: '普通' | '英雄' | '挑战') {
  if (difficulty === '普通') return 'warning' as const
  if (difficulty === '英雄') return 'info' as const
  return 'error' as const
}

const columns: DataTableColumns<DungeonTableRow> = [
  {
    title: '副本名称',
    key: 'name',
    width: 280,
    sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
    render: (row) => (row.isGroup ? row.name : '')
  },
  {
    title: '人数',
    key: 'players',
    width: 120,
    render: (row) => (row.isGroup ? '' : h(NTag, { type: getPlayerTagType(), size: 'small' }, { default: () => row.players }))
  },
  {
    title: '难度',
    key: 'difficulty',
    width: 120,
    render: (row) => {
      if (row.isGroup || !row.id) return ''
      return h(NPopover, { trigger: 'hover', placement: 'right' }, {
        trigger: () => h(NTag, {
          type: getDifficultyTagType(row.difficulty),
          size: 'small',
          style: 'cursor: pointer;'
        }, { default: () => row.difficulty }),
        default: () => renderDungeonCdPopover(row.id!)
      })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    render: (row) => {
      if (row.isGroup) {
        return h('div', { class: 'action-group' }, [
          h('button', {
            class: 'mini-btn warning',
            onClick: () => tracker.toggleDungeonHidden(row.name)
          }, '隐藏整组')
        ])
      }
      return h('div', { class: 'action-group' }, [
        h('button', { class: 'mini-btn', onClick: () => openEdit(row) }, '编辑'),
        h('button', { class: 'mini-btn warning', onClick: () => handleHide(row) }, '隐藏')
      ])
    }
  }
]

const rosterColumns: DataTableColumns<RosterRow> = [
  {
    title: '团牌',
    key: 'name',
    width: 160
  },
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
        onClick: () => handleToggleBrandBlacklist(row)
      }, row.blacklisted ? '取消拉黑' : '拉黑'),
      h('button', { class: 'mini-btn danger', onClick: () => handleDeleteBrand(row) }, '删除')
    ])
  }
]
</script>

<style scoped>
.dungeon-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.dungeon-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-right: 12px;
  border-right: 1px solid #e0e0e6;
}
.dungeon-tip {
  color: #999;
  font-size: 12px;
  line-height: 1.5;
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
.hidden-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hidden-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid #efeff5;
  border-radius: 4px;
  font-size: 13px;
}
.hidden-item-label {
  color: #333;
}
.hidden-item-actions {
  display: flex;
  gap: 6px;
}
</style>

