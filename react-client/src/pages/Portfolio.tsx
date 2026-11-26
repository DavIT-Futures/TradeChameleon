import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError, api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import type { Order } from '../api/types'
import { useAuth } from '../core/auth'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'
import { showToast } from '../core/toast'
import RiskCard from './RiskCard'

type StatusFilter = Order['status'] | 'ALL'
const STATUSES: StatusFilter[] = ['ALL', 'OPEN', 'FILLED', 'CANCELLED', 'REJECTED']

export default function Portfolio() {
  const fmt = useFormat()
  const { isTrader } = useAuth()
  const { quotes } = useStream()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const portfolio = useQuery(queries.portfolio())
  // The query key contains the status: changing the filter fetches (and caches) another list.
  const orders = useQuery(queries.orders(status === 'ALL' ? undefined : status))

  const cancel = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/orders/{id}', { params: { path: { id } } })),
    onSuccess: (o) => showToast('info', 'Order cancelled', `${o.side} ${o.quantity} ${o.symbol}`),
    onError: (e) => showToast('error', e instanceof ApiError ? e.problem.title ?? 'Error' : 'Error', e.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queries.orders().queryKey.slice(0, 2) }),
  })

  const [editing, setEditing] = useState<string | null>(null)
  const protect = useMutation({
    mutationFn: ({ symbol, ...body }: { symbol: string; stopLoss: number | null; takeProfit: number | null }) =>
      unwrap(api.PUT('/api/portfolio/positions/{symbol}/protection', { params: { path: { symbol } }, body })),
    onSuccess: (updated, vars) => {
      queryClient.setQueryData(queries.portfolio().queryKey, updated)
      setEditing(null)
      showToast('success', 'Protection saved', vars.symbol)
    },
    onError: (e) => showToast('error', e instanceof ApiError ? e.problem.title ?? 'Error' : 'Error', e.message),
  })

  const p = portfolio.data
  // Revalue with streamed mids: value_now = value_at_load * mid_now / mid_at_load.
  const positions = (p?.positions ?? []).map((pos) => {
    const live = quotes.get(pos.symbol)?.mid ?? pos.lastPrice
    return { ...pos, live, liveValue: (pos.marketValue * live) / pos.lastPrice }
  })
  const liveTotal = (p?.cash ?? 0) + positions.reduce((sum, pos) => sum + pos.liveValue, 0)

  return (
    <div className="page">
      <div className="page__header">
        <h1>Portfolio</h1>
        <button className="btn btn--ghost" disabled={portfolio.isFetching}
          onClick={() => { void portfolio.refetch(); void orders.refetch() }}>↻ Refresh</button>
      </div>

      {p ? (
        <>
          <section className="grid grid--kpi">
            <div className="card kpi"><div className="kpi__label">Total (live)</div><div className="kpi__value">{fmt.money(liveTotal, p.currency)}</div></div>
            <div className="card kpi"><div className="kpi__label">Cash</div><div className="kpi__value">{fmt.money(p.cash, p.currency)}</div></div>
            <div className="card kpi"><div className="kpi__label">Unrealised P&amp;L</div>
              <div className={`kpi__value ${p.unrealizedPnl >= 0 ? 'up' : 'down'}`}>{fmt.money(p.unrealizedPnl, p.currency)}</div></div>
            <div className="card kpi"><div className="kpi__label">Realised P&amp;L</div>
              <div className={`kpi__value ${p.realizedPnl >= 0 ? 'up' : 'down'}`}>{fmt.money(p.realizedPnl, p.currency)}</div></div>
          </section>
          <section className="card">
            <h2>Positions</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>Instrument</th><th className="num">Quantity</th><th className="num">Avg price</th><th className="num">Last</th>
                  <th className="num">Value ({p.currency})</th><th className="num">P&amp;L</th><th>SL / TP</th>
                </tr></thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.symbol}>
                      <td><Link to={`/markets/${pos.symbol}`}>{pos.symbol}</Link><span className="muted">{pos.name}</span></td>
                      <td className="num">{fmt.qty(pos.quantity)}</td>
                      <td className="num">{fmt.price(pos.avgPrice, pos.decimals)} <span className="muted">{pos.currency}</span></td>
                      <td className="num">{fmt.price(pos.live, pos.decimals)}</td>
                      <td className="num">{fmt.money(pos.liveValue, p.currency)}</td>
                      <td className={`num ${pos.pnl >= 0 ? 'up' : 'down'}`}>{fmt.pct(pos.pnlPct)}</td>
                      <td>
                        {editing === pos.symbol ? (
                          <form className="inline-edit" onSubmit={(e) => {
                            e.preventDefault()
                            const data = new FormData(e.currentTarget)
                            const num = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v))
                            protect.mutate({ symbol: pos.symbol, stopLoss: num(data.get('sl')), takeProfit: num(data.get('tp')) })
                          }}>
                            <input name="sl" type="number" step="any" placeholder="SL" defaultValue={pos.stopLoss ?? ''} aria-label="Stop loss" />
                            <input name="tp" type="number" step="any" placeholder="TP" defaultValue={pos.takeProfit ?? ''} aria-label="Take profit" />
                            <button className="btn btn--small" type="submit" disabled={protect.isPending}>Save</button>
                            <button className="btn btn--ghost btn--small" type="button" onClick={() => setEditing(null)}>×</button>
                          </form>
                        ) : (
                          <>
                            <span className="muted">{pos.stopLoss ?? '–'} / {pos.takeProfit ?? '–'}</span>{' '}
                            {isTrader && <button className="btn btn--ghost btn--small" onClick={() => setEditing(pos.symbol)}>Edit</button>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {positions.length === 0 && <tr><td colSpan={7} className="muted">No positions.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <RiskCard />
        </>
      ) : portfolio.isPending && <div className="card"><div className="skeleton" style={{ blockSize: '8rem' }} /></div>}

      <section className="card">
        <div className="row spread">
          <h2>Orders</h2>
          <div className="segmented" role="group" aria-label="Order status">
            {STATUSES.map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Created</th><th>Order</th><th className="num">Qty</th><th className="num">Stop / limit</th><th className="num">Fill</th><th>Status</th><th /></tr></thead>
            <tbody>
              {orders.data?.map((o) => (
                <tr key={o.id}>
                  <td>{o.createdAt.slice(11, 19)}</td>
                  <td>
                    {o.side} {o.symbol} <span className="muted">{o.type}{o.triggered ? ' (triggered)' : ''}</span>
                    {o.origin !== 'CLIENT' && <> <span className="badge badge--accent">{o.origin}</span></>}
                  </td>
                  <td className="num">{fmt.qty(o.quantity)}</td>
                  <td className="num">{o.stopPrice != null && `stop ${fmt.price(o.stopPrice)} `}{o.limitPrice != null && fmt.price(o.limitPrice)}</td>
                  <td className="num">{fmt.price(o.fillPrice)}</td>
                  <td><span className="badge" title={o.rejectReason ?? ''}>{o.status}</span></td>
                  <td>{o.status === 'OPEN' && isTrader && (
                    <button className="btn btn--ghost btn--small" disabled={cancel.isPending} onClick={() => cancel.mutate(o.id)}>Cancel</button>
                  )}</td>
                </tr>
              ))}
              {orders.data?.length === 0 && <tr><td colSpan={7} className="muted">No orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
