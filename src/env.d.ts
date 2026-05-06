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

interface Window {
  electronAPI?: {
    openDataDir: () => Promise<string>
    getDataDir: () => Promise<string>
    pickDataDir: () => Promise<string | null>
    readStateSync: () => unknown
    writeStateSync: (state: unknown) => { ok: boolean; message?: string }
    exportData: (state: unknown) => Promise<{ ok: boolean; filePath?: string; message?: string }>
    importData: () => Promise<{ ok: boolean; data?: unknown; message?: string }>
    recognizeImage: (b64: string) => Promise<{ ok: boolean; text?: string; words?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; confidence?: number }>; icons?: Array<{ type: string; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }>; error?: string }>
    waitOcrReady: () => Promise<void>
    isOcrReady: () => Promise<{ ready: boolean; disabled: boolean }>
    startOcr: () => Promise<{ ok: boolean; message: string }>
    onOcrStatus: (callback: (status: string) => void) => void
  }
}
