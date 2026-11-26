import { useSyncExternalStore } from 'react'
import { api, unwrap } from '../api/client'
import type { Quote } from '../api/types'
import { createStore } from './externalStore'
import { getRequestedTenant } from './tenant'

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'error'

export interface StreamState {
  status: StreamStatus
  quotes: ReadonlyMap<string, Quote>
  sparklines: Readonly<Record<string, number[] | undefined>>
  lastTick: Date | null
}

const SPARK_POINTS = 60

/**
 * Live prices over Server-Sent Events, kept OUTSIDE React in an external store.
 * Components read it with useSyncExternalStore, which guarantees a consistent snapshot even with
 * concurrent rendering (no "tearing" between components reading the same tick).
 */
export const streamStore = createStore<StreamState>({ status: 'idle', quotes: new Map(), sparklines: {}, lastTick: null })

let source: EventSource | null = null
let refCount = 0

export function connectStream(): () => void {
  refCount++
  if (!source) open()
  return () => {
    // StrictMode mounts effects twice in development; reference counting keeps one connection.
    refCount--
    if (refCount === 0) {
      source?.close()
      source = null
      streamStore.set((s) => ({ ...s, status: 'idle' }))
    }
  }
}

function open(): void {
  streamStore.set((s) => ({ ...s, status: 'connecting' }))
  void unwrap(api.GET('/api/market/sparklines', { params: { query: { points: SPARK_POINTS } } })).then((history) =>
    streamStore.set((s) => {
      const merged: Record<string, number[] | undefined> = {}
      for (const [symbol, line] of Object.entries(history)) {
        merged[symbol] = [...line, ...(s.sparklines[symbol] ?? [])].slice(-SPARK_POINTS)
      }
      return { ...s, sparklines: merged }
    }),
  )
  const tenant = getRequestedTenant()
  source = new EventSource(`/api/market/stream${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''}`)
  source.onopen = () => streamStore.set((s) => ({ ...s, status: 'live' }))
  source.onerror = () =>
    streamStore.set((s) => ({ ...s, status: source?.readyState === EventSource.CLOSED ? 'error' : 'connecting' }))
  source.addEventListener('quotes', (event) => onQuotes(JSON.parse((event as MessageEvent<string>).data)))
}

export function onQuotes(list: Quote[]): void {
  streamStore.set((s) => {
    const sparklines: Record<string, number[] | undefined> = { ...s.sparklines }
    for (const q of list) {
      sparklines[q.symbol] = [...(sparklines[q.symbol] ?? []).slice(-(SPARK_POINTS - 1)), q.mid]
    }
    return { status: 'live', quotes: new Map(list.map((q) => [q.symbol, q])), sparklines, lastTick: new Date() }
  })
}

/** Subscribe to the whole stream state. */
export function useStream(): StreamState {
  return useSyncExternalStore(streamStore.subscribe, streamStore.get)
}

/** Subscribe to one quote only: the selector returns the same object until that symbol ticks. */
export function useQuote(symbol: string): Quote | undefined {
  return useSyncExternalStore(streamStore.subscribe, () => streamStore.get().quotes.get(symbol))
}
