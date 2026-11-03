// 折线图的轻量封装：按需引入 ECharts（只注册折线图 + 网格 / 提示框 / 图例 + Canvas 渲染器），
// 比 `import * as echarts from 'echarts'` 小很多；并把尺寸变化合并到下一帧重绘，避免切换标签页动画期间反复 resize。
import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

// 所有折线图共用的轻量化设置：不做入场动画，平时不画数据点（悬停时才显示）
export const LIGHT_LINE_DEFAULTS = {
  animation: false
}
export const LIGHT_SERIES_DEFAULTS = {
  showSymbol: false,
  symbol: 'circle',
  symbolSize: 6
}

export function useLineChart(elRef: Ref<HTMLElement | null>, option: Ref<Record<string, unknown>>) {
  let chart: echarts.ECharts | null = null
  let ro: ResizeObserver | null = null
  let frame = 0

  function scheduleResize() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      chart?.resize()
    })
  }

  onMounted(() => {
    const el = elRef.value
    if (!el) return
    chart = echarts.init(el)
    chart.setOption(option.value)
    ro = new ResizeObserver(scheduleResize)
    ro.observe(el)
  })

  watch(option, (opt) => {
    chart?.setOption(opt, true)
  })

  onUnmounted(() => {
    if (frame) cancelAnimationFrame(frame)
    ro?.disconnect()
    chart?.dispose()
    chart = null
  })
}
