<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <HomeView />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
  <div class="app-watermark">夏天の记账小工具 —— by 遗忘的夏天@梦江南</div>
</template>

<script setup lang="ts">
import { dateZhCN, zhCN } from 'naive-ui'
import HomeView from './views/HomeView.vue'
</script>

<style scoped>
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
