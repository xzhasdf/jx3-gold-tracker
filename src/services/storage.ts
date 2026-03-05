import { STORAGE_KEY } from '../constants/game'
import type { StoreState } from '../types'

const EMPTY_STATE: StoreState = { roles: [], dungeons: [], records: [] }

function sanitizeState(input: unknown): StoreState {
  const parsed = input as Partial<StoreState> | null
  return {
    roles: Array.isArray(parsed?.roles) ? parsed!.roles : [],
    dungeons: Array.isArray(parsed?.dungeons) ? parsed!.dungeons : [],
    records: Array.isArray(parsed?.records) ? parsed!.records : []
  }
}

function readLocalStorageState(): StoreState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return EMPTY_STATE
  try {
    return sanitizeState(JSON.parse(raw))
  } catch {
    return EMPTY_STATE
  }
}

export function loadState(): StoreState {
  // App mode: persist to filesystem via Electron IPC.
  if (window.electronAPI?.readStateSync) {
    const fromFile = window.electronAPI.readStateSync()
    if (fromFile) {
      return sanitizeState(fromFile)
    }
    // One-time migration from legacy localStorage.
    const legacy = readLocalStorageState()
    if (legacy.roles.length || legacy.dungeons.length || legacy.records.length) {
      window.electronAPI.writeStateSync(legacy)
      return legacy
    }
    return EMPTY_STATE
  }

  return readLocalStorageState()
}

export function saveState(state: StoreState): void {
  if (window.electronAPI?.writeStateSync) {
    // Vue 响应式 Proxy 必须在 IPC 传输前剥离，否则 structured-clone 会抛出异常，
    // 导致调用方的后续代码（如关闭弹窗）永远无法执行。
    const plain = JSON.parse(JSON.stringify(state)) as StoreState
    window.electronAPI.writeStateSync(plain)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
