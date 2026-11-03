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

interface Window {
  electronAPI?: {
    openDataDir: () => Promise<string>
    getDataDir: () => Promise<string>
    pickDataDir: () => Promise<string | null>
    readStateSync: () => unknown
    writeStateSync: (state: unknown) => { ok: boolean; message?: string }
    exportData: (state: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>
    importData: () => Promise<{ ok: boolean; data?: unknown; message?: string }>
    getGoldPrice: (server?: GoldServer) => Promise<{ ok: boolean; data?: GoldPrice; message?: string }>
    getGoldGateways: () => Promise<{ ok: boolean; data?: GoldZone[]; message?: string }>
    getGoldServer: () => Promise<GoldServer>
    setGoldServer: (server: GoldServer) => Promise<{ ok: boolean; data?: GoldServer; message?: string }>
    recognizeImage: (b64: string) => Promise<{ ok: boolean; text?: string; words?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; confidence?: number }>; icons?: Array<{ type: string; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }>; error?: string }>
    waitOcrReady: () => Promise<void>
    isOcrReady: () => Promise<{ ready: boolean; disabled: boolean }>
    startOcr: () => Promise<{ ok: boolean; message: string }>
    onOcrStatus: (callback: (status: string) => void) => void
  }
}
