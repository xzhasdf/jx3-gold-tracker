import { ref } from 'vue'

// 万宝楼金价：price 是「每元多少金」，值越大金价越便宜。
const price = ref<GoldPrice | null>(null)
const server = ref<GoldServer | null>(null)
const loading = ref(false)
const error = ref('')

let loaded = false
// 查询序号：只采用最后一次发起的查询结果，避免切换区服后旧区服的结果晚到覆盖
let requestSeq = 0

export function useGoldPrice() {
  // force：即使已有查询在进行也重新发起（切换区服时用），旧查询的结果会被丢弃
  async function refresh(next?: GoldServer, force = false) {
    if (!window.electronAPI || (loading.value && !force)) return
    const seq = ++requestSeq
    loading.value = true
    error.value = ''
    try {
      const result = await window.electronAPI.getGoldPrice(next)
      if (seq !== requestSeq) return
      if (result.ok && result.data) {
        price.value = result.data
      } else {
        error.value = result.message || '查询失败'
      }
    } catch (e) {
      if (seq !== requestSeq) return
      error.value = e instanceof Error ? e.message : '查询失败'
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  async function loadServer() {
    if (!window.electronAPI) return null
    server.value = await window.electronAPI.getGoldServer()
    return server.value
  }

  async function changeServer(next: GoldServer): Promise<{ ok: boolean; message?: string }> {
    if (!window.electronAPI) return { ok: false, message: '仅桌面端可用' }
    const result = await window.electronAPI.setGoldServer(next)
    if (!result.ok || !result.data) return { ok: false, message: result.message || '保存失败' }
    server.value = result.data
    price.value = null
    void refresh(result.data, true)
    return { ok: true }
  }

  // 应用启动时只自动查一次，之后由用户点击刷新
  async function init() {
    if (loaded || !window.electronAPI) return
    loaded = true
    await loadServer()
    await refresh()
  }

  return { price, server, loading, error, init, refresh, loadServer, changeServer }
}
