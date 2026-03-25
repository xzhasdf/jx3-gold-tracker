<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <HomeView />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
  <div class="app-watermark">夏天の记账小工具 —— by 遗忘的夏天@梦江南</div>
  <Transition name="loading-fade">
    <div v-if="loading" class="app-loading">
      <div class="app-loading-box">
        <div class="app-loading-spinner" />
        <span class="app-loading-text">{{ loadingText }}</span>
        <div v-if="downloadPercent >= 0 || isLoading" class="app-loading-progress">
          <div v-if="downloadPercent >= 0" class="app-loading-progress-bar" :style="{ width: downloadPercent + '%' }" />
          <div v-else class="app-loading-progress-bar app-loading-progress-indeterminate" />
        </div>
        <span class="app-loading-hint">{{ isDownloading ? '首次启动需下载模型（约50MB），请确保网络畅通' : '模型加载中，请稍候...' }}</span>
        <button v-if="isDownloading" class="app-loading-skip" @click="skipOcr">跳过，稍后在右上角 ⚙ 中下载</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dateZhCN, zhCN } from 'naive-ui'
import HomeView from './views/HomeView.vue'
import { useOcrState } from './composables/useOcrState'

const { setReady } = useOcrState()

const loading = ref(!!window.electronAPI)
const loadingText = ref('正在启动 OCR 服务...')
const downloadPercent = ref(-1)
const isDownloading = ref(false)
const isLoading = ref(false)

function skipOcr() {
  loading.value = false
}

onMounted(async () => {
  if (!window.electronAPI) return
  window.electronAPI.onOcrStatus((status) => {
    loadingText.value = status
    const match = status.match(/(\d+)%/)
    if (match) {
      downloadPercent.value = Number(match[1])
      isDownloading.value = true
      isLoading.value = false
    } else if (status.includes('下载')) {
      isDownloading.value = true
      isLoading.value = false
      downloadPercent.value = 0
    } else if (status.includes('加载')) {
      isLoading.value = true
    }
  })
  await window.electronAPI.waitOcrReady()
  const ocrStatus = await window.electronAPI.isOcrReady()
  if (!ocrStatus.disabled) setReady(true)
  loading.value = false
})
</script>

<style scoped>
.app-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
}

.app-loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 280px;
}

.app-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e0e0e0;
  border-top-color: #18a058;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.app-loading-text {
  color: #606266;
  font-size: 14px;
}

.app-loading-progress {
  width: 100%;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.app-loading-progress-bar {
  height: 100%;
  background: #18a058;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.app-loading-progress-indeterminate {
  width: 30% !important;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { margin-left: 0; }
  50% { margin-left: 70%; }
  100% { margin-left: 0; }
}

.app-loading-hint {
  color: #909399;
  font-size: 12px;
  margin-top: -4px;
}

.app-loading-skip {
  margin-top: 4px;
  border: none;
  background: transparent;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 4px 8px;
}

.app-loading-skip:hover {
  color: #18a058;
}

.loading-fade-leave-active {
  transition: opacity 0.4s ease;
}

.loading-fade-leave-to {
  opacity: 0;
}

.app-watermark {
  position: fixed;
  right: 16px;
  bottom: 12px;
  z-index: 999;
  pointer-events: none;
  color: rgba(0, 0, 0, 0.35);
  font-size: 14px;
  line-height: 1;
  user-select: none;
}
</style>
