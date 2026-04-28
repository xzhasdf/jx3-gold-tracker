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
      <n-form-item>
        <n-button @click="showRoster = true">团牌名单</n-button>
      </n-form-item>
    </n-form>
    <n-divider />
    <div style="color: #666; font-size: 12px; margin-bottom: 8px;">副本隐藏后将不会出现在新建选项中<br/>鼠标移入列表难度 Tag 可查看该副本本周 CD</div>
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

  <n-modal v-model:show="showRoster" preset="card" title="团牌名单" style="max-width: 680px">
    <n-data-table :columns="rosterColumns" :data="rosterRows" :pagination="false" />
  </n-modal>

</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NPopover, NTag, type DataTableColumns, useDialog } from 'naive-ui'
import type { Dungeon } from '../../types'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'

interface DungeonTableRow {
  key: string
  id?: string
  name: string
  players?: '10人' | '25人'
  difficulty?: '普通' | '英雄' | '挑战'
  followed?: boolean
  hidden?: boolean
  pinned?: boolean
  allHidden?: boolean
  configText?: string
  isGroup: boolean
  children?: DungeonTableRow[]
}

interface RosterRow {
  groupBrand: string
  leaderId: string
  blacklisted: boolean
  _span: number
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
const editingId = ref('')
const editForm = reactive<{ players: '10人' | '25人'; difficulty: '普通' | '英雄' | '挑战'; name: string }>({
  players: '10人',
  difficulty: '普通',
  name: ''
})

const tableRows = computed<DungeonTableRow[]>(() => {
  const groupMap = new Map<string, Dungeon[]>()
  tracker.dungeons.value.forEach((item) => {
    const list = groupMap.get(item.name) ?? []
    list.push(item)
    groupMap.set(item.name, list)
  })

  return Array.from(groupMap.entries())
    .sort(([, listA], [, listB]) => {
      const aPinned = listA.some((d) => d.pinned)
      const bPinned = listB.some((d) => d.pinned)
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      const aHidden = listA.every((d) => d.hidden)
      const bHidden = listB.every((d) => d.hidden)
      if (aHidden !== bHidden) return aHidden ? 1 : -1
      return listA[0]?.name.localeCompare(listB[0]?.name ?? '', 'zh-CN') ?? 0
    })
    .map(([name, list]) => {
      const children: DungeonTableRow[] = list
        .slice()
        .sort((a, b) => `${a.players}${a.difficulty}`.localeCompare(`${b.players}${b.difficulty}`, 'zh-CN'))
        .map((dungeon) => ({
          key: dungeon.id,
          id: dungeon.id,
          name: dungeon.name,
          players: dungeon.players,
          difficulty: dungeon.difficulty,
          followed: dungeon.followed,
          hidden: dungeon.hidden,
          pinned: dungeon.pinned,
          configText: `${dungeon.players}${dungeon.difficulty}`,
          isGroup: false
        }))

      const allHidden = list.every((d) => d.hidden)
      const configText = children.map((item) => item.configText).join('、')
      return {
        key: `group-${name}`,
        name,
        configText,
        allHidden,
        isGroup: true,
        children
      }
    })
})

const expandedKeys = ref<string[]>([])
watch(tableRows, (rows) => {
  expandedKeys.value = rows.filter((r) => !r.allHidden).map((r) => r.key)
}, { immediate: true })

const rosterRows = computed<RosterRow[]>(() => {
  const rows = tracker.getGroupBrandRoster()
  const result: RosterRow[] = []
  let i = 0
  while (i < rows.length) {
    const brand = rows[i].groupBrand
    let j = i
    while (j < rows.length && rows[j].groupBrand === brand) j++
    const count = j - i
    for (let k = i; k < j; k++) {
      result.push({ ...rows[k], _span: k === i ? count : 0 })
    }
    i = j
  }
  return result
})

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

function handleDelete(row: DungeonTableRow) {
  if (row.isGroup || !row.id) return
  dialog.warning({
    title: '删除确认',
    content: `确认删除副本「${row.players}${row.difficulty}${row.name}」吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = tracker.deleteDungeon(row.id!)
      if (!result.ok) {
        dialog.warning({
          title: '提示',
          content: result.message ?? '操作失败',
          positiveText: '知道了'
        })
      }
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
        const isPinned = row.children?.some((c) => c.pinned)
        const btns = []
        if (!row.allHidden) {
          btns.push(h('button', {
            class: 'mini-btn',
            style: isPinned ? 'color: #e6a23c; border-color: #e6a23c;' : '',
            onClick: () => tracker.toggleDungeonPinned(row.name)
          }, isPinned ? '取消置顶' : '置顶'))
        }
        btns.push(h('button', {
          class: row.allHidden ? 'mini-btn' : 'mini-btn warning',
          onClick: () => tracker.toggleDungeonHidden(row.name)
        }, row.allHidden ? '显示' : '隐藏'))
        return h('div', { class: 'action-group' }, btns)
      }
      return h('div', { class: 'action-group' }, [
        h(
          'button',
          {
            class: 'mini-btn',
            onClick: () => openEdit(row)
          },
          '编辑'
        ),
        h(
          'button',
          {
            class: 'mini-btn danger',
            onClick: () => handleDelete(row)
          },
          '删除'
        )
      ])
    }
  }
]

const rosterColumns: DataTableColumns<RosterRow> = [
  {
    title: '团牌',
    key: 'groupBrand',
    rowSpan: (row) => row._span
  },
  { title: '团长ID', key: 'leaderId' },
  {
    title: '状态',
    key: 'blacklisted',
    rowSpan: (row) => row._span,
    render: (row) => (row.blacklisted ? h(NTag, { type: 'error', size: 'small' }, { default: () => '黑名单' }) : '-')
  }
]
</script>

