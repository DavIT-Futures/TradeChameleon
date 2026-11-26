import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, api, unwrap } from '../api/client'
import type { InstrumentView, PlaceOrderRequest, Quote } from '../api/types'
import { useAuth } from '../core/auth'
import { useFormat } from '../core/format'
import { useTenant } from '../core/TenantProvider'
import { showToast } from '../core/toast'

type Side = PlaceOrderRequest['side']
type OrderType = PlaceOrderRequest['type']

const TYPES: OrderType[] = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']
const LABELS: Record<OrderType, string> = { MARKET: 'Market', LIMIT: 'Limit', STOP: 'Stop', STOP_LIMIT: 'Stop limit' }

export default function OrderTicket({ instrument, quote }: { instrument: InstrumentView; quote: Quote }) {
  const { tenant } = useTenant()
  const { isTrader } = useAuth()
  const fmt = useFormat()
  const queryClient = useQueryClient()
  const [side, setSide] = useState<Side>('BUY')
  const [type, setType] = useState<OrderType>('MARKET')
  const [form, setForm] = useState({ quantity: '1', limitPrice: '', stopPrice: '', stopLoss: '', takeProfit: '' })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  /** useMutation: POST with pending/error state; on success invalidate what the order changed. */
  const place = useMutation({
    mutationFn: (body: PlaceOrderRequest) => unwrap(api.POST('/api/orders', { body })),
    onSuccess: (order) => {
      const what = `${order.side} ${order.quantity} ${order.symbol}`
      showToast('success', order.status === 'FILLED' ? 'Order filled' : `${LABELS[order.type]} order placed`,
        order.status === 'FILLED' ? `${what} @ ${order.fillPrice}` : what)
      // the portfolio is updated asynchronously by the backend: refetch shortly after
      setTimeout(() => void queryClient.invalidateQueries({
        predicate: (q) => ['portfolio', 'orders', 'transactions'].includes(String(q.queryKey[1])) }), 300)
    },
  })

  const needsLimit = type === 'LIMIT' || type === 'STOP_LIMIT'
  const needsStop = type === 'STOP' || type === 'STOP_LIMIT'
  const qty = Number(form.quantity)
  const price = needsLimit ? Number(form.limitPrice) : type === 'STOP' ? Number(form.stopPrice) : side === 'BUY' ? quote.ask : quote.bid
  const valid = qty > 0 && (!needsLimit || Number(form.limitPrice) > 0) && (!needsStop || Number(form.stopPrice) > 0)
  const problem = place.error instanceof ApiError ? place.error.problem : null
  const num = (v: string) => (v === '' ? null : Number(v))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    place.mutate({
      symbol: instrument.symbol, side, type, quantity: qty,
      limitPrice: needsLimit ? num(form.limitPrice) : null,
      stopPrice: needsStop ? num(form.stopPrice) : null,
      stopLoss: side === 'BUY' ? num(form.stopLoss) : null,
      takeProfit: side === 'BUY' ? num(form.takeProfit) : null,
    })
  }

  return (
    <section className="card order-ticket" aria-labelledby="ticket-title">
      <h2 id="ticket-title">Order ticket</h2>
      <div className="quote-box">
        <div><span className="muted">Bid</span><b className="down">{fmt.price(quote.bid, instrument.decimals)}</b></div>
        <div><span className="muted">Ask</span><b className="up">{fmt.price(quote.ask, instrument.decimals)}</b></div>
      </div>

      {!tenant.features.trading ? (
        <div className="alert"><strong>Portfolio only</strong>{tenant.name} does not offer trading.</div>
      ) : !isTrader ? (
        <div className="alert"><strong>Read-only user</strong>Your role cannot place orders.</div>
      ) : (
        <form className="order-ticket" onSubmit={submit}>
          <div className="order-ticket__sides" role="group" aria-label="Side">
            <button type="button" className="btn btn--buy" aria-pressed={side === 'BUY'} onClick={() => setSide('BUY')}>Buy</button>
            <button type="button" className="btn btn--sell" aria-pressed={side === 'SELL'} onClick={() => setSide('SELL')}>Sell</button>
          </div>
          <div className="segmented" role="group" aria-label="Order type">
            {TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                disabled={t !== 'MARKET' && !tenant.features.limitOrders}
                title={t === 'MARKET' || tenant.features.limitOrders ? '' : 'Not offered by this broker'}>{LABELS[t]}</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" type="number" min="0" step="any" required value={form.quantity} onChange={set('quantity')} />
          </div>
          {needsStop && (
            <div className="field">
              <label htmlFor="stop">Stop price ({instrument.currency}) · {side === 'BUY' ? 'above ask' : 'below bid'}</label>
              <input id="stop" type="number" min="0" step="any" required value={form.stopPrice} onChange={set('stopPrice')} />
            </div>
          )}
          {needsLimit && (
            <div className="field">
              <label htmlFor="limit">Limit price ({instrument.currency})</label>
              <input id="limit" type="number" min="0" step="any" required value={form.limitPrice} onChange={set('limitPrice')} />
            </div>
          )}
          {side === 'BUY' && (
            <details className="protection">
              <summary>Stop loss / Take profit</summary>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="sl">Stop loss</label>
                  <input id="sl" type="number" min="0" step="any" placeholder="optional" value={form.stopLoss} onChange={set('stopLoss')} />
                </div>
                <div className="field">
                  <label htmlFor="tp">Take profit</label>
                  <input id="tp" type="number" min="0" step="any" placeholder="optional" value={form.takeProfit} onChange={set('takeProfit')} />
                </div>
              </div>
            </details>
          )}
          <div className="row spread">
            <span className="muted">Estimated {side === 'BUY' ? 'cost' : 'proceeds'}</span>
            <strong className="num">{fmt.price(qty * price, 2)} {instrument.currency}</strong>
          </div>
          <div className="margin-hint">
            <span>As a CFD (1:{instrument.leverage}) margin would be</span>
            <span className="num">{fmt.price(qty * price * instrument.marginRate, 2)} {instrument.currency}</span>
          </div>
          {problem && <div className="alert alert--error" role="alert"><strong>{problem.title}</strong>{problem.detail}</div>}
          <button className={`btn ${side === 'BUY' ? 'btn--buy' : 'btn--sell'}`} type="submit" disabled={!valid || place.isPending}>
            {place.isPending ? 'Sending…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${instrument.symbol}${type === 'MARKET' ? '' : ' · ' + LABELS[type]}`}
          </button>
        </form>
      )}
    </section>
  )
}
