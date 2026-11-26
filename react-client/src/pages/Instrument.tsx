import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { queries } from '../api/queries'
import type { ChartPoint } from '../components/chartGeometry'
import { PriceChart } from '../components/PriceChart'
import { useFormat } from '../core/format'
import { useQuote } from '../core/priceStream'
import OrderTicket from './OrderTicket'

export default function Instrument() {
  const { symbol = '' } = useParams()
  const fmt = useFormat()
  const instrument = useQuery(queries.instrument(symbol))
  const history = useQuery(queries.history(symbol))
  const liveQuote = useQuote(symbol)
  const quote = liveQuote ?? instrument.data?.quote

  // Chart = HTTP history + streamed ticks appended client-side (keeps the last 180 points).
  // "Adjusting state when a prop changes" pattern: reset when a new history arrives, no effect needed.
  const [points, setPoints] = useState<ChartPoint[]>([])
  const [source, setSource] = useState(history.data)
  if (source !== history.data) {
    setSource(history.data)
    setPoints((history.data ?? []).map((p) => ({ t: Date.parse(p.t), price: p.price })))
  }
  useEffect(() => {
    if (!liveQuote) return
    const t = Date.parse(liveQuote.timestamp)
    setPoints((prev) => (prev.length && prev[prev.length - 1].t >= t ? prev : [...prev.slice(-179), { t, price: liveQuote.mid }]))
  }, [liveQuote])

  return (
    <div className="page">
      <Link to="/markets">← Markets</Link>
      {instrument.isError && (
        <div className="alert alert--error"><strong>Not available</strong>This broker does not offer {symbol}.</div>
      )}
      {instrument.data && (
        <>
          <div className="page__header">
            <div>
              <h1>{instrument.data.symbol} <span className="muted" style={{ fontWeight: 400 }}>{instrument.data.name}</span></h1>
              <p className="muted">{instrument.data.exchange} · {instrument.data.assetClass} · {instrument.data.currency}</p>
            </div>
            {quote && (
              <div style={{ textAlign: 'end' }}>
                <div className="kpi__value">{fmt.price(quote.mid, instrument.data.decimals)} <small className="muted">{instrument.data.currency}</small></div>
                <span className={`badge ${quote.changePct >= 0 ? 'badge--up' : 'badge--down'}`}>{fmt.pct(quote.changePct)}</span>
              </div>
            )}
          </div>
          <div className="grid grid--2">
            <section className="card">
              <h2>Price</h2>
              {points.length > 1
                ? <PriceChart points={points} decimals={instrument.data.decimals} label={`${symbol} price chart`} />
                : <div className="skeleton" style={{ blockSize: 260 }} />}
            </section>
            {quote && <OrderTicket instrument={instrument.data} quote={quote} />}
          </div>
        </>
      )}
    </div>
  )
}
