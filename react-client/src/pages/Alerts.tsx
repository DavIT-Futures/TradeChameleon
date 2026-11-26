import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'

/** All price alerts of the user; create them from an instrument page. */
export default function Alerts() {
  const fmt = useFormat()
  const { quotes } = useStream()
  const queryClient = useQueryClient()
  const alerts = useQuery(queries.alerts())
  const cancel = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/alerts/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queries.alerts().queryKey }),
  })

  return (
    <div className="page">
      <div className="page__header">
        <h1>Price alerts</h1>
        <span className="muted">Create alerts from an instrument page.</span>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Instrument</th><th>Condition</th><th className="num">Now</th><th>Status</th><th>Created</th><th /></tr></thead>
            <tbody>
              {alerts.data?.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/markets/${a.symbol}`}>{a.symbol}</Link><span className="muted">{a.note}</span></td>
                  <td>{a.condition.toLowerCase()} {fmt.price(a.price, 4)}</td>
                  <td className="num">{fmt.price(quotes.get(a.symbol)?.mid, 4)}</td>
                  <td>
                    <span className={`badge ${a.status === 'TRIGGERED' ? 'badge--up' : ''}`}>{a.status}</span>
                    {a.triggeredPrice != null && <span className="muted"> at {fmt.price(a.triggeredPrice, 4)}</span>}
                  </td>
                  <td>{a.createdAt.slice(11, 19)}</td>
                  <td>{a.status === 'ACTIVE' && (
                    <button className="btn btn--ghost btn--small" disabled={cancel.isPending} onClick={() => cancel.mutate(a.id)}>Cancel</button>
                  )}</td>
                </tr>
              ))}
              {alerts.data?.length === 0 && <tr><td colSpan={6} className="muted">No alerts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
