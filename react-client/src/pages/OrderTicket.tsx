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

export default function OrderTicket({ instrument, quote }: { instrument: InstrumentView; quote: Quote }) {
  const { tenant } = useTenant()
  const { isTrader } = useAuth()
  const fmt = useFormat()
  const queryClient = useQueryClient()
  const [side, setSide] = useState<Side>('BUY')
  const [type, setType] = useState<OrderType>('MARKET')
  const [quantity, setQuantity] = useState('1')
  const [limitPrice, setLimitPrice] = useState('')

  /** useMutation: POST with pending/error state; on success invalidate what the order changed. */
  const place = useMutation({
    mutationFn: (body: PlaceOrderRequest) => unwrap(api.POST('/api/orders', { body })),
    onSuccess: (order) => {
      const what = `${order.side} ${order.quantity} ${order.symbol}`
      showToast('success', order.status === 'FILLED' ? 'Order filled' : 'Order placed',
        order.status === 'FILLED' ? `${what} @ ${order.fillPrice}` : `${what}, limit ${order.limitPrice}`)
      // the portfolio is updated asynchronously by the backend: refetch shortly after
      setTimeout(() => void queryClient.invalidateQueries({ predicate: (q) => ['portfolio', 'orders'].includes(String(q.queryKey[1])) }), 300)
    },
  })

  const qty = Number(quantity)
  const price = type === 'LIMIT' ? Number(limitPrice) : side === 'BUY' ? quote.ask : quote.bid
  const valid = qty > 0 && (type === 'MARKET' || Number(limitPrice) > 0)
  const problem = place.error instanceof ApiError ? place.error.problem : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    place.mutate({ symbol: instrument.symbol, side, type, quantity: qty, limitPrice: type === 'LIMIT' ? Number(limitPrice) : null })
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
            <button type="button" aria-pressed={type === 'MARKET'} onClick={() => setType('MARKET')}>Market</button>
            <button type="button" aria-pressed={type === 'LIMIT'} onClick={() => setType('LIMIT')}
              disabled={!tenant.features.limitOrders} title={tenant.features.limitOrders ? '' : 'Not offered by this broker'}>Limit</button>
          </div>
          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" type="number" min="0" step="any" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          {type === 'LIMIT' && (
            <div className="field">
              <label htmlFor="limit">Limit price ({instrument.currency})</label>
              <input id="limit" type="number" min="0" step="any" required value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
            </div>
          )}
          <div className="row spread">
            <span className="muted">Estimated {side === 'BUY' ? 'cost' : 'proceeds'}</span>
            <strong className="num">{fmt.price(qty * price, 2)} {instrument.currency}</strong>
          </div>
          {problem && <div className="alert alert--error" role="alert"><strong>{problem.title}</strong>{problem.detail}</div>}
          <button className={`btn ${side === 'BUY' ? 'btn--buy' : 'btn--sell'}`} type="submit" disabled={!valid || place.isPending}>
            {place.isPending ? 'Sending…' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${instrument.symbol}`}
          </button>
        </form>
      )}
    </section>
  )
}
