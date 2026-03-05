/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
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
    recognizeImage: (b64: string) => Promise<{ ok: boolean; text?: string; words?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>; error?: string }>
  }
}
