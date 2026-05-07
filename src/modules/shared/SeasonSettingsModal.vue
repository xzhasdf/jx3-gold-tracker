<template>
  <n-modal
    :show="show"
    preset="card"
    title="赛季设置"
    style="max-width: 560px;"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-space vertical :size="14">
      <div class="action-bar">
        <n-button type="primary" size="small" @click="openCreate">新增赛季</n-button>
      </div>

      <n-card v-if="formVisible" size="small" :title="formMode === 'create' ? '新增赛季' : '编辑赛季'">
        <n-form label-placement="left" label-width="72" :show-feedback="false">
          <n-form-item label="名称">
            <n-input v-model:value="form.name" placeholder="如：第一赛季" maxlength="20" show-count />
          </n-form-item>
          <n-form-item label="起止时间" style="margin-top: 12px;">
            <n-date-picker
              v-model:value="form.range"
              type="daterange"
              clearable
              :is-date-disabled="isDateDisabled"
              style="width: 100%;"
            />
          </n-form-item>
        </n-form>
        <div class="form-actions">
          <n-space>
            <n-button size="small" @click="cancelForm">取消</n-button>
            <n-button type="primary" size="small" @click="saveForm">保存</n-button>
          </n-space>
        </div>
      </n-card>

      <n-data-table
        v-if="seasons.length > 0"
        :columns="columns"
        :data="seasons"
        :pagination="false"
        :row-key="(row: Season) => row.id"
        size="small"
      />
      <n-empty v-else description="暂无赛季" />
    </n-space>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue'
import { NButton, NSpace, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { useTracker } from '../../composables/useTracker'
import { toYmd } from '../../utils/date'
import type { Season } from '../../types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const tracker = useTracker()
const dialog = useDialog()
const message = useMessage()

const seasons = computed(() => tracker.seasons.value)

const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string>('')
const form = reactive<{ name: string; range: [number, number] | null }>({ name: '', range: null })

watch(
  () => props.show,
  (v) => {
    if (!v) {
      formVisible.value = false
      editingId.value = ''
      form.name = ''
      form.range = null
    }
  }
)

function openCreate() {
  formMode.value = 'create'
  editingId.value = ''
  form.name = ''
  form.range = null
  formVisible.value = true
}

function openEdit(season: Season) {
  formMode.value = 'edit'
  editingId.value = season.id
  form.name = season.name
  form.range = [season.startTs, season.endTs]
  formVisible.value = true
}

function cancelForm() {
  formVisible.value = false
}

function saveForm() {
  if (!form.range) {
    message.warning('请选择起止时间')
    return
  }
  const [startTs, endTs] = form.range
  const payload = { name: form.name, startTs, endTs }
  const result = formMode.value === 'create'
    ? tracker.addSeason(payload)
    : tracker.updateSeason(editingId.value, payload)
  if (!result.ok) {
    message.error(result.message ?? '保存失败')
    return
  }
  message.success('已保存')
  formVisible.value = false
}

function isDateDisabled(ts: number) {
  return seasons.value.some((s) => {
    if (formMode.value === 'edit' && s.id === editingId.value) return false
    return ts >= s.startTs && ts <= s.endTs
  })
}

function confirmDelete(season: Season) {
  dialog.warning({
    title: '删除赛季',
    content: `确定要删除赛季「${season.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      tracker.deleteSeason(season.id)
      message.success('已删除')
    }
  })
}

const columns = computed<DataTableColumns<Season>>(() => [
  { title: '名称', key: 'name', minWidth: 100 },
  {
    title: '起止时间',
    key: 'range',
    minWidth: 200,
    render: (row) => `${toYmd(row.startTs)} ~ ${toYmd(row.endTs)}`
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render: (row) =>
      h(NSpace, { size: 16 }, {
        default: () => [
          h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { text: true, type: 'error', size: 'small', onClick: () => confirmDelete(row) }, { default: () => '删除' })
        ]
      })
  }
])
</script>

<style scoped>
.action-bar {
  display: flex;
  justify-content: flex-start;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
