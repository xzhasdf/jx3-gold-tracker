<template>
  <n-layout class="page">
    <n-layout-header bordered class="header">
      <div class="header-row">
        <div class="header-brand">
          <img src="../assets/logo.png" alt="logo" class="header-logo" />
          <n-thing title="剑网3副本收支记录" />
          <span class="header-version">v1.2.2</span>
        </div>
        <n-dropdown trigger="click" :options="settingOptions" @select="handleSettingSelect">
          <button class="gear-btn" type="button" aria-label="设置">⚙</button>
        </n-dropdown>
      </div>
    </n-layout-header>
    <Transition name="ocr-bar-fade">
      <div v-if="ocrLoading" class="ocr-top-bar">
        <div class="ocr-top-bar-inner">
          <span class="ocr-top-bar-text">{{ ocrLoadingText || '正在加载 OCR 模型...' }}</span>
          <div class="ocr-top-bar-progress">
            <div v-if="ocrDownloadPercent >= 0" class="ocr-top-bar-fill" :style="{ width: ocrDownloadPercent + '%' }" />
            <div v-else class="ocr-top-bar-fill ocr-top-bar-indeterminate" />
          </div>
        </div>
      </div>
    </Transition>
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
        <n-tab-pane name="tools" tab="小工具">
          <ToolsPage />
        </n-tab-pane>
      </n-tabs>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, Transition } from 'vue'
import { NCheckbox, type DropdownOption, useDialog, useMessage } from 'naive-ui'
import RecordManager from '../modules/record/RecordManager.vue'
import OverviewPage from '../modules/overview/OverviewPage.vue'
import RoleManager from '../modules/role/RoleManager.vue'
import DungeonManager from '../modules/dungeon/DungeonManager.vue'
import ToolsPage from '../modules/tools/ToolsPage.vue'
import { useTracker } from '../composables/useTracker'
import { useOcrState } from '../composables/useOcrState'
import { useWineBury } from '../composables/useWineBury'

const dialog = useDialog()
const message = useMessage()
const tracker = useTracker()
const { ocrReady, ocrLoading, ocrLoadingText, ocrDownloadPercent, setReady, setLoading, setLoadingStatus } = useOcrState()

const wineBury = useWineBury()

onMounted(() => {
  const upcomingWines = wineBury.getUpcomingWines()
  if (upcomingWines.length > 0 && !wineBury.isDismissed()) {
    const roleMap = new Map(tracker.roles.value.map((r) => [r.id, r]))
    const dismissChecked = ref(false)
    dialog.info({
      title: '埋酒提醒',
      content: () => h('div', null, [
        h('div', null, '家园藏酒即将完成，请注意：'),
        h('ul', { style: 'margin: 8px 0 0; padding-left: 20px; line-height: 1.8;' },
          upcomingWines.map((w) => {
            const role = w.roleId ? roleMap.get(w.roleId) : null
            const roleText = role ? `(${role.id}@${role.server})` : ''
            return h('li', null, `${w.wineType}·${w.target}${roleText}`)
          })
        ),
        h('div', { style: 'margin-top: 12px;' }, [
          h(NCheckbox, {
            checked: dismissChecked.value,
            'onUpdate:checked': (v: boolean) => { dismissChecked.value = v }
          }, { default: () => '本次不再提示' })
        ])
      ]),
      positiveText: '我知道了',
      onPositiveClick: () => {
        if (dismissChecked.value) wineBury.dismiss24h()
      }
    })
  }
})

const showChangelog = ref(false)

const settingOptions = computed<DropdownOption[]>(() => [
  ...(!ocrReady.value ? [{ label: '下载 OCR 模型', key: 'download-ocr' }] : []),
  { label: '导出数据', key: 'export-data' },
  { label: '导入数据', key: 'import-data' },
  { type: 'divider' as const, key: 'div1' },
  { label: '打开数据目录', key: 'open-data-dir' },
  { label: '修改数据路径', key: 'change-data-dir' },
  { type: 'divider' as const, key: 'div2' },
  { label: '更新日志', key: 'changelog' }
])

const CHANGELOG = [
  {
    version: 'v1.2.2',
    items: [
      '小工具新增「试炼翻牌占卜」，支持梅花易数和小六壬两种算法',
    ]
  },
  {
    version: 'v1.2.1',
    items: [
      '修复副本 CD 判定逻辑：记录保存时刻作为通关时间，与重置时间精确比较',
      '兼容历史数据：无精确时间戳的记录回退到日期级别比较',
      '收支明细分页改为每页 10 条',
    ]
  },
  {
    version: 'v1.2.0',
    items: [
      '新增「小工具」页签，首个工具：家园藏酒',
      '家园藏酒：支持选择酒类、埋藏目标和角色，进度条展示藏酒进度',
      '家园藏酒：到期前 24 小时自动弹窗提醒，支持勾选本次不再提示',
      '统一金币/金砖图片引用方式，清理 public 冗余资源',
      '更换应用程序图标',
    ]
  },
  {
    version: 'v1.1.6',
    items: [
      '副本管理新增隐藏功能，隐藏后不再出现在所有副本选项中',
      '副本级联选择器支持鼠标悬停展开下一级',
      '收支明细关键字查询新增黑本人搜索',
      '新增更新日志',
    ]
  },
  {
    version: 'v1.1.5',
    items: [
      '编辑收支记录时解除日期/角色/副本的禁用状态',
      '总览页默认查询所有记录（不再限定本周）',
      '修复 PaddlePaddle OneDNN 兼容问题（部分 CPU 上 OCR 识别报错）',
    ]
  },
  {
    version: 'v1.1.4',
    items: [
      '修复 NSIS 安装脚本报错，安装界面显示详细解压进度',
    ]
  },
  {
    version: 'v1.1.3',
    items: [
      '修复非 C 盘安装时 OCR 模型加载失败（HuggingFace 缓存路径重定向）',
      '覆盖安装前自动关闭旧版进程，解决文件占用死循环',
      '新增 Lite 版打包（无 OCR，安装包更小）',
      '安装界面展示详细文件解压信息',
    ]
  },
  {
    version: 'v1.1.2',
    items: [
      '收支明细新增关键字模糊查询（团牌/团长）',
    ]
  },
  {
    version: 'v1.1.1',
    items: [
      '清理无用依赖（sympy、rapidocr_onnxruntime），减小安装包约 45MB',
    ]
  },
  {
    version: 'v1.1.0',
    items: [
      '替换 RapidOCR 为 PaddleOCR，大幅提升中文识别准确率',
      'OCR 模型 CI 构建时预下载打包，首次启动无需联网',
    ]
  },
  {
    version: 'v1.0.x',
    items: [
      '基础收支记录、角色管理、副本管理、总览统计',
      'OCR 截图识别录入（RapidOCR / Tesseract）',
      '黑本人记录与趋势图表',
      '数据导入/导出、自定义数据路径',
      '便携模式支持（U 盘运行）',
    ]
  },
]

function renderChangelog() {
  return h('div', { style: 'max-height: 480px; overflow-y: auto;' },
    CHANGELOG.map((entry) =>
      h('div', { style: 'margin-bottom: 16px;' }, [
        h('div', { style: 'font-weight: bold; font-size: 14px; margin-bottom: 4px;' }, entry.version),
        h('ul', { style: 'margin: 0; padding-left: 20px; color: #606266; font-size: 13px; line-height: 1.8;' },
          entry.items.map((item) => h('li', null, item))
        )
      ])
    )
  )
}

function showAppOnlyTip() {
  dialog.warning({ title: '提示', content: '当前为浏览器模式，请在 App 中使用该功能。', positiveText: '知道了' })
}

async function handleSettingSelect(key: string | number) {
  if (key === 'download-ocr') {
    if (!window.electronAPI) { showAppOnlyTip(); return }
    setLoading(true)
    setLoadingStatus('正在启动 OCR 服务...')
    window.electronAPI.onOcrStatus((status) => {
      setLoadingStatus(status)
    })
    await window.electronAPI.startOcr()
    window.electronAPI.waitOcrReady().then(() => {
      setReady(true)
      message.success('OCR 模型加载完成，截图识别功能已启用')
    })
    return
  }

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

  if (key === 'changelog') {
    dialog.info({
      title: '更新日志',
      content: renderChangelog,
      positiveText: '关闭',
      style: 'max-width: 520px;'
    })
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

.ocr-top-bar {
  background: #fff;
  border-bottom: 1px solid #efeff5;
  padding: 8px 24px;
}

.ocr-top-bar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ocr-top-bar-text {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  flex-shrink: 0;
}

.ocr-top-bar-progress {
  flex: 1;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.ocr-top-bar-fill {
  height: 100%;
  background: #18a058;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.ocr-top-bar-indeterminate {
  width: 30%;
  animation: ocr-indeterminate 1.5s ease-in-out infinite;
}

@keyframes ocr-indeterminate {
  0% { margin-left: 0; }
  50% { margin-left: 70%; }
  100% { margin-left: 0; }
}

.ocr-bar-fade-enter-active,
.ocr-bar-fade-leave-active {
  transition: opacity 0.3s ease, max-height 0.3s ease;
  max-height: 40px;
  overflow: hidden;
}

.ocr-bar-fade-enter-from,
.ocr-bar-fade-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
