import { useSyncExternalStore } from 'react'
import { createStore } from './externalStore'

export interface Toast {
  id: number
  kind: 'error' | 'success' | 'info'
  title: string
  detail?: string
}

let nextId = 1
export const toastStore = createStore<readonly Toast[]>([])

export function showToast(kind: Toast['kind'], title: string, detail?: string, ttlMs = 5000): void {
  const toast: Toast = { id: nextId++, kind, title, detail }
  toastStore.set((list) => [...list.slice(-3), toast])
  setTimeout(() => dismissToast(toast.id), ttlMs)
}

export function dismissToast(id: number): void {
  toastStore.set((list) => list.filter((t) => t.id !== id))
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(toastStore.subscribe, toastStore.get)
}
