<template>
  <n-layout class="page">
    <n-layout-header bordered class="header">
      <div class="header-row">
        <div class="header-brand">
          <img src="../assets/logo.png" alt="logo" class="header-logo" />
          <n-thing title="剑网3副本收支记录" />
          <span class="header-version">v1.2.11</span>
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

  <SeasonSettingsModal v-model:show="showSeasonSettings" />
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, Transition } from 'vue'
import { NCheckbox, type DropdownOption, useDialog, useMessage } from 'naive-ui'
import RecordManager from '../modules/record/RecordManager.vue'
import OverviewPage from '../modules/overview/OverviewPage.vue'
import RoleManager from '../modules/role/RoleManager.vue'
import DungeonManager from '../modules/dungeon/DungeonManager.vue'
import ToolsPage from '../modules/tools/ToolsPage.vue'
import SeasonSettingsModal from '../modules/shared/SeasonSettingsModal.vue'
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
  if (upcomingWines.length > 0) {
    const roleMap = new Map(tracker.roles.value.map((r) => [r.id, r]))
    const now = Date.now()
    const hasFinished = upcomingWines.some((w) => w.endTime - now <= 0)
    const hasUpcoming = upcomingWines.some((w) => w.endTime - now > 0)
    const headerText = hasFinished && hasUpcoming
      ? '家园藏酒即将完成或已完成，请注意：'
      : hasFinished
      ? '家园藏酒已完成，请注意：'
      : '家园藏酒即将完成，请注意：'
    const dismissChecked = ref(false)
    dialog.info({
      title: '埋酒提醒',
      content: () => h('div', null, [
        h('div', null, headerText),
        h('ul', { style: 'margin: 8px 0 0; padding-left: 20px; line-height: 1.8;' },
          upcomingWines.map((w) => {
            const role = w.roleId ? roleMap.get(w.roleId) : null
            const roleText = role ? `(${role.id}@${role.server})` : ''
            const statusSuffix = hasFinished && hasUpcoming
              ? ` [${w.endTime - now <= 0 ? '已完成' : '即将完成'}]`
              : ''
            return h('li', null, `${w.wineType}·${w.target}${roleText}${statusSuffix}`)
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
        if (dismissChecked.value) {
          wineBury.dismissWines(upcomingWines.map((w) => w.id))
        }
      }
    })
  }
})

const showChangelog = ref(false)
const showSeasonSettings = ref(false)

const settingOptions = computed<DropdownOption[]>(() => [
  ...(!ocrReady.value ? [{ label: '下载 OCR 模型', key: 'download-ocr' }] : []),
  { label: '赛季设置', key: 'season-settings' },
  { type: 'divider' as const, key: 'div0' },
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
    version: 'v1.2.11',
    items: [
      '齿轮菜单新增「赛季设置」，可命名管理多个赛季的起止时间，新增/编辑时已被占用的日期自动禁用',
      '收支明细、总览、黑本收益统计的查询表单新增「赛季」下拉，选中后自动套用赛季起止时间，重置或手动改日期会取消赛季选中',
      '新增/编辑收支记录时，团牌输入框下方显示「常用团牌」（系统自动统计：录入次数 ≥5 次的团牌），点击直接填充',
      '选定团牌后，下方显示「历史团长」标签（取该团牌历史记录中出现过的团长 ID），点击直接填充',
      '常用团牌超过一行、历史团长超过两行自动折叠，提供「展开 / 收起」按钮',
      '所有团长 ID 与黑本人字段自动去除名字两侧的 [] / 【】（保存、编辑回填、OCR 识别、关键字搜索均统一处理）',
    ]
  },
  {
    version: 'v1.2.10',
    items: [
      '小工具新增「特殊掉落」卡片，副本三级级联选择 + 图标上传，支持右键编辑、删除二次确认',
      '内置一批通用掉落（玄晶 / 卦预乾坤 / 赐清平 / 朝露昙华 / 残卷·秘卷系列），不可编辑删除；卦预乾坤等限定 10 人副本',
      '新增 / 编辑收支记录时，按副本匹配特殊掉落并支持多选；保留已删除掉落的历史关联（显示为「掉落已删除」）',
      '收支明细列表「副本名称」下方展示该次记录的特殊掉落（图标 + 名称，每个一行）',
      '总览新增「特殊掉落」 Tab，按物品聚合次数，可展开查看角色明细',
      '副本管理彻底删除时关联记录的副本名称回退为「副本已删除」',
    ]
  },
  {
    version: 'v1.2.9',
    items: [
      '副本管理新增手动排序功能（popover 拖拽 + 置顶/置底），隐藏副本不参与排序自动置底',
      '副本管理「删除」改为「隐藏」，隐藏后不在列表显示；新增「已隐藏副本」面板可逐条恢复',
      '角色管理新增排序 popover，与副本排序交互一致',
    ]
  },
  {
    version: 'v1.2.8',
    items: [
      '家园藏酒已完成项新增「重置」按钮（warning 样式），点击后开始时间设为当前、按目标时长重新计算结束时间',
    ]
  },
  {
    version: 'v1.2.7',
    items: [
      '收支明细的副本筛选纳入已隐藏副本，标注「已隐藏」(warning) 标签',
      '副本级联选项排序固定为人数（10人 → 25人）/ 难度（普通 → 英雄 → 挑战），同难度下隐藏副本沉底并按创建时间排序',
      '编辑历史记录时若指向已隐藏副本可正确显示并允许保存',
      '修复收支明细列表分页器消失（误用 remote 模式）',
      '收支明细「重置」按钮把日期范围回到本周（与初始化一致）',
    ]
  },
  {
    version: 'v1.2.6',
    items: [
      '收支记录选择「百战/试炼之地/其他」时，「黑本人」字段也一同隐藏',
      '修复编辑收支记录切换到固定副本时未清空团牌/团长的问题',
      '总览页折线图 tab 改为保留 DOM，切换不再卡顿',
      '总览页角色筛选下拉、汇总明细表格的代清角色添加「代清」标签（不显示比例）',
      '开发者新增 DISABLE_OCR 环境变量，本地启动可跳过 OCR 子进程',
    ]
  },
  {
    version: 'v1.2.5',
    items: [
      '副本选项新增「其他」固定项，规则同「百战」「试炼之地」（无需填写团牌/团长）',
      '新增收支记录默认副本优先级修正：10人普通 → 25人普通 → 25人英雄 → 25人挑战，避免选中隐藏副本',
      '家园藏酒到期不再自动清理，已完成的酒在用户手动删除前持续保留并提醒',
      '埋酒提醒「本次不再提示」改为按本次弹窗中的酒维度处理：仅当前这些酒不再提示，新到达阈值的酒仍会触发',
      '埋酒提醒文案根据状态动态显示；混合状态下每条酒标注「即将完成 / 已完成」',
    ]
  },
  {
    version: 'v1.2.4',
    items: [
      '角色管理新增「忽略副本CD」按钮，可将指定角色从副本CD浮窗中排除',
      '修复窗口图标未显示的问题',
      '更换应用程序图标',
    ]
  },
  {
    version: 'v1.2.3',
    items: [
      '编辑收支记录支持修改日期/角色/副本',
      '副本管理：置顶、隐藏改为按副本名称整组操作，移至父行',
      '副本管理：隐藏副本默认折叠、置底显示',
      '收支明细新增「列排序」，可选择显示哪些列，配置随数据导出',
      '家园藏酒数据纳入主数据流，支持导入导出',
      '家园藏酒到期 24 小时后自动清理',
    ]
  },
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
  if (key === 'season-settings') {
    showSeasonSettings.value = true
    return
  }

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
      const state = JSON.parse(JSON.stringify({ roles: tracker.roles.value, dungeons: tracker.dungeons.value, records: tracker.records.value, columnConfig: tracker.columnConfig.value, wineBury: tracker.wineBury.value, seasons: tracker.seasons.value }))
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
