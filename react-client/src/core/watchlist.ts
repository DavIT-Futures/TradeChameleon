import { useSyncExternalStore } from 'react'
import { api, unwrap } from '../api/client'
import { createStore } from './externalStore'

/** The user's watchlist in an external store; the star toggles optimistically and rolls back on error. */
export const watchlistStore = createStore<ReadonlySet<string>>(new Set())

export async function loadWatchlist(): Promise<void> {
  watchlistStore.set(new Set(await unwrap(api.GET('/api/watchlist'))))
}

export async function toggleWatch(symbol: string): Promise<void> {
  const previous = watchlistStore.get()
  const watched = previous.has(symbol)
  const next = new Set(previous)
  if (watched) next.delete(symbol)
  else next.add(symbol)
  watchlistStore.set(next)
  const params = { params: { path: { symbol } } }
  const { response } = watched ? await api.DELETE('/api/watchlist/{symbol}', params) : await api.PUT('/api/watchlist/{symbol}', params)
  if (!response.ok) watchlistStore.set(previous)
}

export function useWatchlist(): ReadonlySet<string> {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.get)
}
