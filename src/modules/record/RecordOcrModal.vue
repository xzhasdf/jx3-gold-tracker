<template>
  <n-modal :show="show" preset="card" title="上传截图识别" style="max-width: 760px" @update:show="handleShowUpdate">
    <n-space vertical :size="12">
      <div class="drop-zone" @dragover.prevent @drop.prevent="handleDrop" @click="pickFile">
        <input ref="fileInputRef" class="hidden-input" type="file" accept="image/*" @change="handleFileChange" />
        <div>{{ file ? '已选择图片，点击可重新选择' : '拖拽图片到此处，或点击选择文件' }}</div>
        <div class="drop-subtitle">支持 Ctrl+V 粘贴剪切板图片</div>
      </div>
      <div v-if="previewUrl" class="preview-wrap">
        <img :src="previewUrl" alt="ocr-preview" class="preview-image" />
      </div>
      <div class="example-wrap">
        <div class="example-title">示例</div>
        <img :src="exampleImageUrl" alt="ocr-example" class="example-image" />
      </div>
      <div class="progress-text" :class="{ error: !!errorMessage }">{{ statusText }}</div>
    </n-space>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleShowUpdate(false)">取消</n-button>
        <n-button type="primary" :disabled="!file || running" @click="recognizeAndApply">
          {{ running ? '识别中...' : '识别并填充' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { parseOcrText, recognizeImageText, type OcrDungeonMeta, type OcrFillResult, type OcrRoleMeta } from './ocr'
import exampleImageUrl from '../../assets/example.png'

const props = defineProps<{
  show: boolean
  roles: OcrRoleMeta[]
  dungeons: OcrDungeonMeta[]
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'apply', value: OcrFillResult): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const previewUrl = ref('')
const running = ref(false)
const progress = ref(0)
const status = ref('')
const errorMessage = ref('')

const statusText = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (running.value) return `识别进度：${Math.round(progress.value * 100)}% ${status.value || ''}`
  return '识别会自动提取角色、收入、支出(请手动确认)'
})

watch(
  () => props.show,
  (value) => {
    if (value) {
      window.addEventListener('paste', handlePaste)
      return
    }
    window.removeEventListener('paste', handlePaste)
    resetState()
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste)
  clearPreview()
})

function handleShowUpdate(value: boolean) {
  if (!value) resetState()
  emit('update:show', value)
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function resetState() {
  file.value = null
  clearPreview()
  running.value = false
  progress.value = 0
  status.value = ''
  errorMessage.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function setFile(nextFile: File) {
  file.value = nextFile
  errorMessage.value = ''
  progress.value = 0
  status.value = ''
  clearPreview()
  previewUrl.value = URL.createObjectURL(nextFile)
}

function pickFile() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const selected = target.files?.[0]
  if (!selected) return
  setFile(selected)
  target.value = ''
}

function handleDrop(event: DragEvent) {
  const selected = event.dataTransfer?.files?.[0]
  if (!selected || !selected.type.startsWith('image/')) return
  setFile(selected)
}

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items ?? []
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue
    const pasted = item.getAsFile()
    if (!pasted) continue
    event.preventDefault()
    setFile(pasted)
    return
  }
}

async function recognizeAndApply() {
  if (!file.value) return
  running.value = true
  errorMessage.value = ''
  progress.value = 0
  status.value = ''
  try {
    const recognized = await recognizeImageText(file.value, (nextProgress, nextStatus) => {
      progress.value = nextProgress
      status.value = nextStatus
    })
    const parsed = parseOcrText(recognized, props.roles, props.dungeons)
    if (!parsed.dateTs && !parsed.roleId && !parsed.dungeonId && parsed.incomeGold == null && parsed.expenseGold == null) {
      errorMessage.value = '未识别到可回填字段，请更换清晰截图或手动录入。'
      return
    }
    emit('apply', parsed)
    resetState()
    emit('update:show', false)
  } catch (error) {
    errorMessage.value = `识别失败：${error instanceof Error ? error.message : 'OCR 处理异常'}`
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.hidden-input {
  display: none;
}

.drop-zone {
  border: 1px dashed #c8d0dc;
  border-radius: 8px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.drop-subtitle {
  color: #8a8f99;
  font-size: 12px;
}

.preview-wrap {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  max-height: 320px;
}

.preview-image {
  width: 100%;
  display: block;
  object-fit: contain;
  background: #f7f7f8;
}

.example-wrap {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
}

.example-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.example-image {
  width: 100%;
  display: block;
  border-radius: 6px;
}

.progress-text {
  min-height: 24px;
  line-height: 24px;
  font-size: 12px;
  color: #666;
}

.progress-text.error {
  color: #d03050;
}
</style>
