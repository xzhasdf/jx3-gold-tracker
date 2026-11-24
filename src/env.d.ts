/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vuedraggable' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

interface GoldServer {
  zoneId: string
  zoneName: string
  serverId: string
  serverName: string
}

interface GoldZone {
  zone_id: string
  zone_name: string
  servers: Array<{ server_id: string; server_name: string }>
}

interface GoldPrice {
  price: number
  goldAmount: number
  unitPrice: number
  remainCount: number
  zoneName: string
  serverName: string
  updatedAt: number
}

interface AuctionPrice {
  /** 该小时最低单价，单位：铜 */
  price: number
  /** 该价位附近的在售数量 */
  count: number
  /** 毫秒时间戳 */
  updatedAt: number
}

interface AuctionPriceResult {
  server: string
  /** null 表示 JX3Box 没有这件物品的交易行记录 */
  prices: Record<string, AuctionPrice | null>
  failed: string[]
}

interface AuctionItem {
  /** `<类型>_<ID>`，如 5_24428 */
  id: string
  name: string
  quality: number
  iconId: number
}

interface AuctionTrendPoint {
  /** 当天最低单价，单位：铜 */
  price: number
  count: number
  /** 毫秒时间戳 */
  ts: number
}

interface Window {
  electronAPI?: {
    openDataDir: () => Promise<string>
    getDataDir: () => Promise<string>
    pickDataDir: () => Promise<string | null>
    readStateSync: () => unknown
    writeStateSync: (state: unknown) => { ok: boolean; message?: string }
    exportData: (state: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>
    saveFile: (defaultName: string, base64: string, filterName: string, extension: string) => Promise<{ ok: boolean; filePath?: string; message?: string }>
    importData: () => Promise<{ ok: boolean; data?: unknown; message?: string }>
    getGoldPrice: (server?: GoldServer) => Promise<{ ok: boolean; data?: GoldPrice; message?: string }>
    getGoldGateways: () => Promise<{ ok: boolean; data?: GoldZone[]; message?: string }>
    getGoldServer: () => Promise<GoldServer>
    setGoldServer: (server: GoldServer) => Promise<{ ok: boolean; data?: GoldServer; message?: string }>
    getAuctionPrices: (itemIds: string[], force?: boolean) => Promise<{ ok: boolean; data?: AuctionPriceResult; message?: string }>
    searchAuctionItems: (keyword: string) => Promise<{ ok: boolean; data?: AuctionItem[]; message?: string }>
    getAuctionTrend: (itemId: string) => Promise<{ ok: boolean; data?: AuctionTrendPoint[]; message?: string }>
    recognizeImage: (b64: string) => Promise<{ ok: boolean; text?: string; words?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; confidence?: number }>; icons?: Array<{ type: string; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }>; error?: string }>
    waitOcrReady: () => Promise<void>
    isOcrReady: () => Promise<{ ready: boolean; disabled: boolean }>
    startOcr: () => Promise<{ ok: boolean; message: string }>
    onOcrStatus: (callback: (status: string) => void) => void
  }
}
