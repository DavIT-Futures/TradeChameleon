import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useMemo } from 'react'
import { Link } from 'react-router'
import { queries } from '../api/queries'
import { useAuth } from '../core/auth'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'
import { useTenant } from '../core/TenantProvider'

/** React.lazy + Suspense: the allocation card is a separate chunk, the React counterpart of @defer. */
const Allocation = lazy(() => import('./Allocation'))

export default function Dashboard() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const fmt = useFormat()
  const portfolio = useQuery(queries.portfolio())
  const orders = useQuery(queries.orders(undefined, 5))
  const instruments = useQuery(queries.instruments())
  const { quotes } = useStream()

  const p = portfolio.data
  const kpis = [
    { label: 'Total value', value: p && fmt.money(p.totalValue, p.currency), tone: '' },
    { label: 'Cash', value: p && fmt.money(p.cash, p.currency), tone: '' },
    { label: 'Invested', value: p && fmt.money(p.positionsValue, p.currency), tone: '' },
    {
      label: 'Unrealised P&L',
      value: p && `${fmt.money(p.unrealizedPnl, p.currency)} (${fmt.pct(p.unrealizedPnlPct)})`,
      tone: p && p.unrealizedPnl >= 0 ? 'up' : 'down',
    },
  ]

  const movers = useMemo(() => {
    const meta = new Map((instruments.data ?? []).map((i) => [i.symbol, i]))
    return [...quotes.values()]
      .map((q) => ({ ...q, name: meta.get(q.symbol)?.name ?? '', decimals: meta.get(q.symbol)?.decimals ?? 2 }))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 6)
  }, [quotes, instruments.data])

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Hello, {user?.name}</h1>
          <p className="muted">{tenant.tagline}</p>
        </div>
      </div>

      {portfolio.isError && <div className="alert alert--error">Could not load the portfolio.</div>}
      <section className="grid grid--kpi" aria-label="Key figures">
        {kpis.map((k) => (
          <div key={k.label} className="card kpi">
            <div className="kpi__label">{k.label}</div>
            {p ? <div className={`kpi__value ${k.tone}`}>{k.value}</div> : <div className="skeleton" style={{ blockSize: '2rem' }} />}
          </div>
        ))}
      </section>

      <div className="grid grid--2">
        <section className="card">
          <h2>Top movers</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Symbol</th><th className="num">Last</th><th className="num">Change</th></tr></thead>
              <tbody>
                {movers.map((m) => (
                  <tr key={m.symbol}>
                    <td><Link to={`/markets/${m.symbol}`}>{m.symbol}</Link><span className="muted">{m.name}</span></td>
                    <td className="num">{fmt.price(m.mid, m.decimals)}</td>
                    <td className="num"><span className={`badge ${m.changePct >= 0 ? 'badge--up' : 'badge--down'}`}>{fmt.pct(m.changePct)}</span></td>
                  </tr>
                ))}
                {movers.length === 0 && <tr><td colSpan={3} className="muted">Waiting for live prices…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Recent orders</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th className="num">Qty</th><th>Status</th></tr></thead>
              <tbody>
                {orders.data?.map((o) => (
                  <tr key={o.id}>
                    <td>{o.side} {o.symbol} <span className="muted">{o.type}</span></td>
                    <td className="num">{fmt.qty(o.quantity)}</td>
                    <td><span className="badge">{o.status}</span></td>
                  </tr>
                ))}
                {orders.data?.length === 0 && <tr><td colSpan={3} className="muted">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Suspense fallback={<div className="card"><div className="skeleton" style={{ blockSize: '6rem' }} /></div>}>
        {p && <Allocation portfolio={p} />}
      </Suspense>
    </div>
  )
}
