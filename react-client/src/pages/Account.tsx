import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import { useAuth } from '../core/auth'
import { useFormat } from '../core/format'
import { showToast } from '../core/toast'

/** Account: deposits/withdrawals, the cash statement and closed trades with realised P&L. */
export default function Account() {
  const fmt = useFormat()
  const { isTrader } = useAuth()
  const queryClient = useQueryClient()
  const portfolio = useQuery(queries.portfolio())
  const statement = useQuery(queries.transactions())
  const closed = useQuery(queries.closedTrades())
  const [amount, setAmount] = useState('')

  const move = useMutation({
    mutationFn: ({ kind, value }: { kind: 'deposits' | 'withdrawals'; value: number }) =>
      unwrap(kind === 'deposits'
        ? api.POST('/api/portfolio/deposits', { body: { amount: value } })
        : api.POST('/api/portfolio/withdrawals', { body: { amount: value } })),
    onSuccess: (tx) => {
      showToast('success', tx.type === 'DEPOSIT' ? 'Deposit booked' : 'Withdrawal booked', `New balance ${tx.balanceAfter}`)
      setAmount('')
      void queryClient.invalidateQueries({ predicate: (q) => ['portfolio', 'transactions'].includes(String(q.queryKey[1])) })
    },
  })
  const problem = move.error instanceof ApiError ? move.error.problem : null
  const p = portfolio.data
  const ccy = p?.currency

  return (
    <div className="page">
      <div className="page__header"><h1>Account</h1></div>
      {p && (
        <section className="grid grid--kpi">
          <div className="card kpi"><div className="kpi__label">Cash</div><div className="kpi__value">{fmt.money(p.cash, ccy)}</div></div>
          <div className="card kpi"><div className="kpi__label">Realised P&amp;L</div>
            <div className={`kpi__value ${p.realizedPnl >= 0 ? 'up' : 'down'}`}>{fmt.money(p.realizedPnl, ccy)}</div></div>
          <div className="card kpi"><div className="kpi__label">Unrealised P&amp;L</div>
            <div className={`kpi__value ${p.unrealizedPnl >= 0 ? 'up' : 'down'}`}>{fmt.money(p.unrealizedPnl, ccy)}</div></div>
        </section>
      )}

      {isTrader && (
        <section className="card stack">
          <h2>Deposit / withdraw</h2>
          <form className="form-row" onSubmit={(e) => { e.preventDefault(); move.mutate({ kind: 'deposits', value: Number(amount) }) }}>
            <div className="field">
              <label htmlFor="amount">Amount ({ccy})</label>
              <input id="amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={!(Number(amount) > 0) || move.isPending}>Deposit</button>
            <button className="btn btn--ghost" type="button" disabled={!(Number(amount) > 0) || move.isPending}
              onClick={() => move.mutate({ kind: 'withdrawals', value: Number(amount) })}>Withdraw</button>
          </form>
          {problem && <div className="alert alert--error" role="alert"><strong>{problem.title}</strong>{problem.detail}</div>}
        </section>
      )}

      <div className="grid grid--2">
        <section className="card">
          <h2>Statement</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {statement.data?.map((t) => (
                  <tr key={t.id}>
                    <td>{t.createdAt.slice(0, 10)} {t.createdAt.slice(11, 19)}</td>
                    <td><span className="badge">{t.type}</span> {t.description}</td>
                    <td className={`num ${t.amount > 0 ? 'up' : 'down'}`}>{fmt.money(t.amount, ccy)}</td>
                    <td className="num">{fmt.money(t.balanceAfter, ccy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>Closed trades</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Closed</th><th>Symbol</th><th className="num">Qty</th><th className="num">Open → Close</th><th className="num">P&amp;L</th></tr></thead>
              <tbody>
                {closed.data?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.closedAt.slice(11, 19)}</td>
                    <td>{c.symbol}</td>
                    <td className="num">{fmt.qty(c.quantity)}</td>
                    <td className="num">{fmt.price(c.openPrice)} → {fmt.price(c.closePrice)} <span className="muted">{c.currency}</span></td>
                    <td className={`num ${c.realizedPnl >= 0 ? 'up' : 'down'}`}>{fmt.money(c.realizedPnl, ccy)}</td>
                  </tr>
                ))}
                {closed.data?.length === 0 && <tr><td colSpan={5} className="muted">No closed trades yet. Sell something!</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
