<template>
  <n-card>
    <n-form inline class="role-form">
      <div class="role-form-row top-row">
        <n-form-item label="角色ID">
          <n-input v-model:value="form.id" placeholder="请输入角色ID" class="field-340" />
        </n-form-item>
        <n-form-item label="服务器">
          <n-select v-model:value="form.server" :options="serverOptions" filterable class="field-340" />
        </n-form-item>
        <n-form-item label="门派">
          <n-select v-model:value="form.school" :options="schoolOptions" :render-label="renderSchoolOption" filterable class="field-340" />
        </n-form-item>
        <n-form-item>
          <n-button type="primary" @click="handleAdd">添加角色</n-button>
        </n-form-item>
        <n-form-item>
          <n-button @click="showWeeklyCd = true">本周CD查询</n-button>
        </n-form-item>
      </div>
      <div class="role-form-row">
        <n-form-item :show-label="false">
          <n-space align="center" :wrap-item="false">
            <n-checkbox v-model:checked="form.isProxyClear">代清</n-checkbox>
            <span v-if="form.isProxyClear" class="ratio-label">工资比例</span>
            <n-slider
              v-if="form.isProxyClear"
              v-model:value="form.wageRatio"
              :min="0"
              :max="100"
              :step="10"
              :style="{ width: '340px' }"
            />
            <span v-if="form.isProxyClear" class="ratio-value">{{ form.wageRatio }}%</span>
          </n-space>
        </n-form-item>
      </div>
    </n-form>
    <n-divider />
    <div style="text-align:right;font-size:12px;color:#666;margin-top:8px;margin-bottom:8px;">共 {{ roles.length }} 个角色</div>
    <n-data-table :columns="columns" :data="roles" :pagination="false" />
  </n-card>

  <n-modal v-model:show="showEdit" preset="card" title="编辑角色" style="max-width: 560px">
    <n-form label-placement="left" label-width="80">
      <n-form-item label="角色ID">
        <n-input v-model:value="editForm.id" class="field-340" />
      </n-form-item>
      <n-form-item label="服务器">
        <n-select v-model:value="editForm.server" :options="serverOptions" filterable class="field-340" />
      </n-form-item>
      <n-form-item label="门派">
        <n-select
          v-model:value="editForm.school"
          :options="schoolOptions"
          :render-label="renderSchoolOption"
          filterable
          class="field-340"
        />
      </n-form-item>
      <n-form-item label="代清">
        <n-checkbox v-model:checked="editForm.isProxyClear" />
      </n-form-item>
      <n-form-item v-if="editForm.isProxyClear" label="工资比例">
        <n-space align="center" :wrap-item="false">
          <n-slider v-model:value="editForm.wageRatio" :min="0" :max="100" :step="10" :style="{ width: '340px' }" />
          <span class="ratio-value">{{ editForm.wageRatio }}%</span>
        </n-space>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showEdit = false">取消</n-button>
        <n-button type="primary" @click="saveEdit">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showWeeklyCd" preset="card" title="本周CD查询" style="max-width: 860px">
    <n-data-table :columns="weeklyCdColumns" :data="weeklyCdRows" :pagination="false" />
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import { NTag, type DataTableColumns, useDialog } from 'naive-ui'
import type { Role } from '../../types'
import { useTracker } from '../../composables/useTracker'
import SchoolBadge from '../shared/SchoolBadge.vue'

const tracker = useTracker()
const dialog = useDialog()

const form = reactive({
  id: '',
  server: tracker.servers[0],
  school: tracker.schools[0],
  isProxyClear: false,
  wageRatio: 100
})

const showEdit = ref(false)
const showWeeklyCd = ref(false)
const editForm = reactive({
  oldId: '',
  id: '',
  server: tracker.servers[0],
  school: tracker.schools[0],
  isProxyClear: false,
  wageRatio: 100
})

const serverOptions = tracker.servers.map((v) => ({ label: v, value: v }))
const schoolOptions = tracker.schools.map((v) => ({ label: v, value: v }))
const roles = computed(() => tracker.roles.value)
const roleMap = computed(() => new Map(roles.value.map((item) => [item.id, item])))

interface WeeklyCdRow {
  key: string
  name: string
  isRole: boolean
  roleId?: string
  dungeonName?: string
  cleared?: boolean
  progressText?: string
  children?: WeeklyCdRow[]
}

const weeklyCdRows = computed<WeeklyCdRow[]>(() =>
  tracker.getWeeklyCdStatusByRole().map((role) => ({
    key: `role-${role.roleId}`,
    name: role.roleId,
    isRole: true,
    roleId: role.roleId,
    progressText: `${role.cleared}/${role.total}`,
    children: role.dungeons.map((dungeon) => ({
      key: `dungeon-${role.roleId}-${dungeon.dungeonId}`,
      name: dungeon.dungeonName,
      isRole: false,
      dungeonName: dungeon.dungeonName,
      cleared: dungeon.cleared
    }))
  }))
)

function renderSchoolOption(option: { label?: string | number }) {
  return h(SchoolBadge, { school: String(option.label ?? '') })
}

function handleAdd() {
  const result = tracker.addRole({ ...form })
  if (!result.ok) {
    dialog.warning({
      title: '提示',
      content: result.message ?? '操作失败',
      positiveText: '知道了'
    })
    return
  }
  form.id = ''
  form.isProxyClear = false
  form.wageRatio = 100
}

function openEdit(row: Role) {
  editForm.oldId = row.id
  editForm.id = row.id
  editForm.server = row.server
  editForm.school = row.school
  editForm.isProxyClear = Boolean(row.isProxyClear)
  editForm.wageRatio = Number.isFinite(row.wageRatio) ? row.wageRatio : 100
  showEdit.value = true
}

function saveEdit() {
  const result = tracker.updateRole(
    editForm.oldId,
    editForm.id,
    editForm.server,
    editForm.school,
    editForm.isProxyClear,
    editForm.wageRatio
  )
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

function handleDelete(id: string) {
  dialog.warning({
    title: '删除确认',
    content: `确认删除角色「${id}」吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const result = tracker.deleteRole(id)
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

const columns: DataTableColumns<Role> = [
  {
    title: '角色ID',
    key: 'id',
    sorter: (a, b) => a.id.localeCompare(b.id, 'zh-CN'),
    render: (row) =>
        h('div', { style: 'display:inline-flex;align-items:center;gap:6px;' }, [
        h('span', row.id),
        row.isProxyClear
          ? h(NTag, { type: 'success', size: 'small' }, { default: () => `代清（工资${Math.round(Number(row.wageRatio) || 100)}%）` })
          : null
      ])
  },
  {
    title: '服务器',
    key: 'server',
    sorter: (a, b) => a.server.localeCompare(b.server, 'zh-CN')
  },
  {
    title: '门派',
    key: 'school',
    sorter: (a, b) => a.school.localeCompare(b.school, 'zh-CN'),
    render: (row) => h(SchoolBadge, { school: row.school })
  },
  {
    title: '操作',
    key: 'actions',
    render: (row) =>
      h('div', { class: 'action-group' }, [
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
            onClick: () => handleDelete(row.id)
          },
          '删除'
        )
      ])
  }
]

const weeklyCdColumns: DataTableColumns<WeeklyCdRow> = [
  {
    title: '角色/副本',
    key: 'name',
    render: (row) => {
      if (!row.isRole || !row.roleId) return row.dungeonName
      const role = roleMap.value.get(row.roleId)
      if (!role) return row.roleId
      return h('span', { style: 'display:inline-flex;align-items:center;gap:4px;' }, [
        h('span', `${role.id}（${role.server}/`),
        h(SchoolBadge, { school: role.school }),
        h('span', '）')
      ])
    }
  },
  {
    title: '本周进度',
    key: 'progress',
    width: 130,
    render: (row) => (row.isRole ? row.progressText : '-')
  },
  {
    title: '状态',
    key: 'status',
    width: 140,
    render: (row) => {
      if (row.isRole) return '-'
      return row.cleared
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => '已通关' })
        : h(NTag, { type: 'warning', size: 'small' }, { default: () => '未通关' })
    }
  }
]
</script>

<style scoped>
.role-form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
}

.role-form-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
}

.role-form-row.top-row {
  flex-wrap: nowrap;
}

.ratio-label {
  color: #606266;
  font-size: 14px;
}

.ratio-value {
  color: #606266;
  font-size: 14px;
  min-width: 44px;
}
</style>
