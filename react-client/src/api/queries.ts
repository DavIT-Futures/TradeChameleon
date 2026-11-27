import { queryOptions } from '@tanstack/react-query'
import { getRequestedTenant } from '../core/tenant'
import { api, unwrap } from './client'
import type { AssetClass, Order } from './types'

/**
 * Query definitions in one place. Keys start with the tenant so caches of different brokers never mix.
 * queryOptions() keeps key, fetcher and result type together and fully typed.
 */
const t = () => getRequestedTenant() ?? 'default'

export const queries = {
  /** The maintainer's own broker: no id in the URL, the broker comes from the request. */
  tenantAdminBroker: () =>
    queryOptions({ queryKey: [t(), 'tenant-admin', 'broker'], queryFn: () => unwrap(api.GET('/api/tenant-admin/broker')) }),
  tenantAdminOptions: () =>
    queryOptions({ queryKey: [t(), 'tenant-admin', 'options'], queryFn: () => unwrap(api.GET('/api/tenant-admin/settings-options')), staleTime: Infinity }),
  tenantAdminChanges: () =>
    queryOptions({
      queryKey: [t(), 'tenant-admin', 'changes'],
      queryFn: () => unwrap(api.GET('/api/tenant-admin/changes', { params: { query: { limit: 20 } } })),
    }),
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
  candles: (symbol: string, interval: '5s' | '15s' | '1m' | '5m', limit = 90) =>
    queryOptions({
      queryKey: [t(), 'candles', symbol, interval, limit],
      queryFn: () =>
        unwrap(api.GET('/api/market/instruments/{symbol}/candles', { params: { path: { symbol }, query: { interval, limit } } })),
      refetchInterval: 5_000,
    }),
  depth: (symbol: string, levels = 10) =>
    queryOptions({
      queryKey: [t(), 'depth', symbol, levels],
      queryFn: () => unwrap(api.GET('/api/market/instruments/{symbol}/depth', { params: { path: { symbol }, query: { levels } } })),
      refetchInterval: 1_000,
    }),
  overview: () =>
    queryOptions({ queryKey: [t(), 'overview'], queryFn: () => unwrap(api.GET('/api/market/overview')), refetchInterval: 10_000 }),
  options: (symbol: string, expiry?: string) =>
    queryOptions({
      queryKey: [t(), 'options', symbol, expiry ?? 'default'],
      queryFn: () =>
        unwrap(api.GET('/api/market/instruments/{symbol}/options', { params: { path: { symbol }, query: { expiry } } })),
      refetchInterval: 3_000,
      placeholderData: (previous) => previous, // keep the old chain on screen while switching expiries
      retry: false,
    }),
  stats: () =>
    queryOptions({ queryKey: [t(), 'stats'], queryFn: () => unwrap(api.GET('/api/market/stats')), refetchInterval: 5_000 }),
  calendar: (minImportance: number) =>
    queryOptions({
      queryKey: [t(), 'calendar', minImportance],
      queryFn: () => unwrap(api.GET('/api/market/calendar', { params: { query: { minImportance } } })),
      staleTime: 60_000,
    }),
  news: (filter: { symbol?: string; assetClass?: AssetClass; limit?: number }) =>
    queryOptions({
      queryKey: [t(), 'news', filter.symbol ?? '*', filter.assetClass ?? '*', filter.limit ?? 30],
      queryFn: () => unwrap(api.GET('/api/market/news', { params: { query: filter } })),
      refetchInterval: 60_000,
    }),
  risk: () =>
    queryOptions({ queryKey: [t(), 'risk'], queryFn: () => unwrap(api.GET('/api/portfolio/risk')), refetchInterval: 5_000 }),
  alerts: () => queryOptions({ queryKey: [t(), 'alerts'], queryFn: () => unwrap(api.GET('/api/alerts')) }),
  transactions: (limit = 100) =>
    queryOptions({
      queryKey: [t(), 'transactions', limit],
      queryFn: () => unwrap(api.GET('/api/portfolio/transactions', { params: { query: { limit } } })),
    }),
  closedTrades: (limit = 100) =>
    queryOptions({
      queryKey: [t(), 'closed-trades', limit],
      queryFn: () => unwrap(api.GET('/api/portfolio/closed-trades', { params: { query: { limit } } })),
    }),
  simulator: () => queryOptions({ queryKey: ['simulator'], queryFn: () => unwrap(api.GET('/api/simulator')) }),
}
