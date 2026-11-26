import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError, api, unwrap } from '../api/client'
import type { CreateAlertRequest, InstrumentView, PriceAlert } from '../api/types'
import { showToast } from '../core/toast'

/** "Notify me when…" form. */
export default function AlertCard({ instrument, mid }: { instrument: InstrumentView; mid: number }) {
  const queryClient = useQueryClient()
  const [condition, setCondition] = useState<PriceAlert['condition']>('ABOVE')
  const [price, setPrice] = useState('')

  const create = useMutation({
    mutationFn: (body: CreateAlertRequest) => unwrap(api.POST('/api/alerts', { body })),
    onSuccess: (alert) => {
      showToast('success', 'Alert set', `${alert.symbol} ${alert.condition.toLowerCase()} ${alert.price}`)
      setPrice('')
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === 'alerts' })
    },
  })
  const problem = create.error instanceof ApiError ? create.error.problem : null

  return (
    <section className="card stack" aria-labelledby="alert-title">
      <div className="row spread">
        <h2 id="alert-title">Price alert</h2>
        <Link to="/alerts" style={{ fontSize: '.85rem' }}>All alerts →</Link>
      </div>
      <form className="form-row" onSubmit={(e) => {
        e.preventDefault()
        create.mutate({ symbol: instrument.symbol, condition, price: Number(price), note: null })
      }}>
        <div className="field">
          <label htmlFor="alert-cond">When price is</label>
          <select id="alert-cond" value={condition} onChange={(e) => setCondition(e.target.value as PriceAlert['condition'])}>
            <option value="ABOVE">above</option>
            <option value="BELOW">below</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="alert-price">Price ({instrument.currency})</label>
          <input id="alert-price" type="number" step="any" min="0" required value={price} placeholder={String(mid)}
            onChange={(e) => setPrice(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={!price || create.isPending}>Set alert</button>
      </form>
      {problem && <div className="alert alert--error" role="alert"><strong>{problem.title}</strong>{problem.detail}</div>}
    </section>
  )
}
