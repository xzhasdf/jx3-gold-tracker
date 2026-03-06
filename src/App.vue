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
        <span class="app-loading-text">正在启动 OCR 服务...</span>
        <span class="app-loading-hint">首次启动需加载模型，可能需要数十秒，请耐心等待</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dateZhCN, zhCN } from 'naive-ui'
import HomeView from './views/HomeView.vue'

const loading = ref(!!window.electronAPI)

onMounted(async () => {
  if (!window.electronAPI) return
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 30000))
  await Promise.race([window.electronAPI.waitOcrReady(), timeout])
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

.app-loading-hint {
  color: #909399;
  font-size: 12px;
  margin-top: -4px;
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
