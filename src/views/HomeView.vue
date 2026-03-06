<template>
  <n-layout class="page">
    <n-layout-header bordered class="header">
      <div class="header-row">
        <div class="header-brand">
          <img src="../assets/logo.png" alt="logo" class="header-logo" />
          <n-thing title="剑网3副本收支记录" />
          <span class="header-version">v1.0.10</span>
        </div>
        <n-dropdown trigger="click" :options="settingOptions" @select="handleSettingSelect">
          <button class="gear-btn" type="button" aria-label="设置">⚙</button>
        </n-dropdown>
      </div>
    </n-layout-header>
    <n-layout-content class="content">
      <n-tabs type="line" animated default-value="overview">
        <n-tab-pane name="overview" tab="总览">
          <OverviewPage />
        </n-tab-pane>
        <n-tab-pane name="records" tab="收支明细">
          <RecordManager />
        </n-tab-pane>
        <n-tab-pane name="roles" tab="角色管理">
          <RoleManager />
        </n-tab-pane>
        <n-tab-pane name="dungeons" tab="副本管理">
          <DungeonManager />
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { type DropdownOption, useDialog, useMessage } from 'naive-ui'
import RecordManager from '../modules/record/RecordManager.vue'
import OverviewPage from '../modules/overview/OverviewPage.vue'
import RoleManager from '../modules/role/RoleManager.vue'
import DungeonManager from '../modules/dungeon/DungeonManager.vue'
import { useTracker } from '../composables/useTracker'

const dialog = useDialog()
const message = useMessage()
const tracker = useTracker()

const settingOptions: DropdownOption[] = [
  { label: '导出数据', key: 'export-data' },
  { label: '导入数据', key: 'import-data' },
  { type: 'divider', key: 'div1' },
  { label: '打开数据目录', key: 'open-data-dir' },
  { label: '修改数据路径', key: 'change-data-dir' }
]

function showAppOnlyTip() {
  dialog.warning({ title: '提示', content: '当前为浏览器模式，请在 App 中使用该功能。', positiveText: '知道了' })
}

async function handleSettingSelect(key: string | number) {
  if (key === 'export-data') {
    if (!window.electronAPI) { showAppOnlyTip(); return }
    try {
      const state = JSON.parse(JSON.stringify({ roles: tracker.roles.value, dungeons: tracker.dungeons.value, records: tracker.records.value }))
      const result = await window.electronAPI.exportData(state)
      if (result?.ok) {
        message.success('数据已成功导出')
      } else if (result?.message) {
        dialog.error({ title: '导出失败', content: result.message, positiveText: '知道了' })
      }
    } catch (e) {
      dialog.error({ title: '导出失败', content: e instanceof Error ? e.message : '未知错误', positiveText: '知道了' })
    }
    return
  }

  if (key === 'import-data') {
    if (!window.electronAPI) { showAppOnlyTip(); return }
    const importResult = await window.electronAPI.importData()
    if (!importResult?.ok) {
      if (importResult?.message) dialog.error({ title: '导入失败', content: importResult.message, positiveText: '知道了' })
      return
    }
    const raw = importResult.data as { roles?: unknown; dungeons?: unknown; records?: unknown } | null
    if (!raw || !Array.isArray(raw.roles) || !Array.isArray(raw.dungeons) || !Array.isArray(raw.records)) {
      dialog.error({ title: '格式错误', content: '所选文件不是有效的备份文件，请重新选择。', positiveText: '知道了' })
      return
    }
    dialog.warning({
      title: '确认导入',
      content: '导入将覆盖当前所有数据，此操作不可撤销，确认继续吗？',
      positiveText: '确认导入',
      negativeText: '取消',
      onPositiveClick: () => {
        tracker.importState(raw as { roles: never[]; dungeons: never[]; records: never[] })
        message.success('数据已成功导入')
      }
    })
    return
  }

  if (!window.electronAPI) { showAppOnlyTip(); return }

  if (key === 'open-data-dir') {
    await window.electronAPI.openDataDir()
    return
  }

  if (key === 'change-data-dir') {
    const changed = await window.electronAPI.pickDataDir?.()
    if (!changed) return
    dialog.warning({
      title: '已修改数据路径',
      content: `新路径：${changed}\n为避免数据目录切换过程中状态混用，请重启应用后继续使用。`,
      positiveText: '知道了'
    })
  }
}
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex: 0 0 auto;
}

.header-version {
  color: #8a8f99;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.gear-btn {
  border: 0;
  background: transparent;
  color: #606266;
  font-size: 18px;
  line-height: 1;
  padding: 6px 8px;
  cursor: pointer;
}

.gear-btn:hover {
  color: #18a058;
}
</style>
