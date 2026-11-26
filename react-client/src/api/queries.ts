import { queryOptions } from '@tanstack/react-query'
import { getRequestedTenant } from '../core/tenant'
import { api, unwrap } from './client'
import type { Order } from './types'

/**
 * Query definitions in one place. Keys start with the tenant so caches of different brokers never mix.
 * queryOptions() keeps key, fetcher and result type together and fully typed.
 */
const t = () => getRequestedTenant() ?? 'default'

export const queries = {
  tenants: () => queryOptions({ queryKey: ['tenants'], queryFn: () => unwrap(api.GET('/api/tenants')), staleTime: 60_000 }),
  instruments: () =>
    queryOptions({ queryKey: [t(), 'instruments'], queryFn: () => unwrap(api.GET('/api/market/instruments')), staleTime: 30_000 }),
  instrument: (symbol: string) =>
    queryOptions({
      queryKey: [t(), 'instrument', symbol],
      queryFn: () => unwrap(api.GET('/api/market/instruments/{symbol}', { params: { path: { symbol } } })),
      retry: false,
    }),
  history: (symbol: string, points = 180) =>
    queryOptions({
      queryKey: [t(), 'history', symbol, points],
      queryFn: () =>
        unwrap(api.GET('/api/market/instruments/{symbol}/history', { params: { path: { symbol }, query: { points } } })),
      staleTime: Infinity, // live ticks are appended client-side
    }),
  portfolio: () => queryOptions({ queryKey: [t(), 'portfolio'], queryFn: () => unwrap(api.GET('/api/portfolio')) }),
  orders: (status?: Order['status'], limit = 50) =>
    queryOptions({
      queryKey: [t(), 'orders', status ?? 'ALL', limit],
      queryFn: () => unwrap(api.GET('/api/orders', { params: { query: { status, limit } } })),
    }),
  simulator: () => queryOptions({ queryKey: ['simulator'], queryFn: () => unwrap(api.GET('/api/simulator')) }),
}
