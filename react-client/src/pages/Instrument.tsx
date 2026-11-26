import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { queries } from '../api/queries'
import { CandleChart } from '../components/CandleChart'
import type { IndicatorFlags, OhlcCandle } from '../components/candleGeometry'
import type { ChartPoint } from '../components/chartGeometry'
import { PriceChart } from '../components/PriceChart'
import { useFormat } from '../core/format'
import { useQuote } from '../core/priceStream'
import { toggleWatch, useWatchlist } from '../core/watchlist'
import AlertCard from './AlertCard'
import ContractCard from './ContractCard'

/** The option chain is a separate chunk, loaded only for optionable instruments. */
const OptionChainCard = lazy(() => import('./OptionChainCard'))
import DepthCard from './DepthCard'
import OrderTicket from './OrderTicket'

type Interval = '5s' | '15s' | '1m' | '5m'
const INTERVALS: Interval[] = ['5s', '15s', '1m', '5m']
const INTERVAL_MS: Record<Interval, number> = { '5s': 5_000, '15s': 15_000, '1m': 60_000, '5m': 300_000 }

export default function Instrument() {
  const { symbol = '' } = useParams()
  const fmt = useFormat()
  const watchlist = useWatchlist()
  const instrument = useQuery(queries.instrument(symbol))
  const history = useQuery(queries.history(symbol))
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles')
  const [interval, setChartInterval] = useState<Interval>('15s')
  const [indicators, setIndicators] = useState<IndicatorFlags>({ sma: true, ema: false, rsi: true })
  // refetchInterval in the query options re-fetches candles every 5 s
  const candles = useQuery(queries.candles(symbol, interval))
  const liveQuote = useQuote(symbol)
  const quote = liveQuote ?? instrument.data?.quote

  /** Server candles with the last one updated (or a new one opened) from the live stream. */
  const liveCandles = useMemo<OhlcCandle[]>(() => {
    const base = (candles.data ?? []).map((c) => ({ t: Date.parse(c.t), open: c.open, high: c.high, low: c.low, close: c.close }))
    if (!liveQuote || base.length === 0) return base
    const size = INTERVAL_MS[interval]
    const bucket = Math.floor(Date.parse(liveQuote.timestamp) / size) * size
    const last = base[base.length - 1]
    if (bucket === last.t) {
      base[base.length - 1] = { ...last, high: Math.max(last.high, liveQuote.mid), low: Math.min(last.low, liveQuote.mid), close: liveQuote.mid }
    } else if (bucket > last.t) {
      base.push({ t: bucket, open: last.close, high: Math.max(last.close, liveQuote.mid), low: Math.min(last.close, liveQuote.mid), close: liveQuote.mid })
    }
    return base
  }, [candles.data, liveQuote, interval])

  // Line chart = HTTP history + streamed ticks; reset when a new history arrives (no effect needed).
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

  // Deep link /markets/AAPL#options: scroll the option chain into view once the page has data.
  const { hash } = useLocation()
  const hasChain = instrument.data?.optionChain ?? false
  useEffect(() => {
    if (hasChain && hash === '#options') {
      const id = setTimeout(() => document.getElementById('options')?.scrollIntoView({ block: 'start' }), 50)
      return () => clearTimeout(id)
    }
  }, [hasChain, hash])

  const flip = (key: keyof IndicatorFlags) => setIndicators((f) => ({ ...f, [key]: !f[key] }))
  const i = instrument.data

  return (
    <div className="page">
      <Link to="/markets">← Markets</Link>
      {instrument.isError && <div className="alert alert--error"><strong>Not available</strong>This broker does not offer {symbol}.</div>}
      {i && (
        <>
          <div className="page__header">
            <div>
              <h1 className="row">
                <button className="star" type="button" aria-pressed={watchlist.has(i.symbol)} aria-label={`Watch ${i.symbol}`}
                  onClick={() => void toggleWatch(i.symbol)}>★</button>
                {i.symbol} <span className="muted" style={{ fontWeight: 400 }}>{i.name}</span>
              </h1>
              <p className="muted">{i.exchange} · {i.assetClass} · {i.currency}</p>
            </div>
            {quote && (
              <div style={{ textAlign: 'end' }}>
                <div className="kpi__value">{fmt.price(quote.mid, i.decimals)} <small className="muted">{i.currency}</small></div>
                <span className={`badge ${quote.changePct >= 0 ? 'badge--up' : 'badge--down'}`}>{fmt.pct(quote.changePct)}</span>
              </div>
            )}
          </div>
          <div className="grid grid--2">
            <div className="stack">
              <section className="card">
                <div className="chart-toolbar">
                  <div className="segmented" role="group" aria-label="Chart type">
                    <button type="button" aria-pressed={chartType === 'candles'} onClick={() => setChartType('candles')}>Candles</button>
                    <button type="button" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>Line</button>
                  </div>
                  {chartType === 'candles' && (
                    <>
                      <div className="segmented" role="group" aria-label="Interval">
                        {INTERVALS.map((iv) => (
                          <button key={iv} type="button" aria-pressed={interval === iv} onClick={() => setChartInterval(iv)}>{iv}</button>
                        ))}
                      </div>
                      <div className="row">
                        <button type="button" className="toggle" aria-pressed={indicators.sma} onClick={() => flip('sma')}><i style={{ background: 'var(--tc-accent)' }} />SMA 20</button>
                        <button type="button" className="toggle" aria-pressed={indicators.ema} onClick={() => flip('ema')}><i style={{ background: 'var(--tc-primary)' }} />EMA 9</button>
                        <button type="button" className="toggle" aria-pressed={indicators.rsi} onClick={() => flip('rsi')}>RSI 14</button>
                      </div>
                    </>
                  )}
                </div>
                {chartType === 'candles'
                  ? liveCandles.length
                    ? <CandleChart candles={liveCandles} indicators={indicators} decimals={i.decimals} label={`${i.symbol} candles ${interval}`} />
                    : <div className="skeleton" style={{ blockSize: 300 }} />
                  : points.length > 1 && <PriceChart points={points} decimals={i.decimals} label={`${symbol} price chart`} />}
              </section>
              <DepthCard symbol={i.symbol} decimals={i.decimals} />
            </div>
            <div className="stack">
              {quote && <OrderTicket instrument={i} quote={quote} />}
              {quote && <ContractCard instrument={i} quote={quote} />}
              {quote && <AlertCard instrument={i} mid={quote.mid} />}
            </div>
          </div>
          {i.optionChain && (
            <Suspense fallback={<div className="card" id="options"><div className="skeleton" style={{ blockSize: '12rem' }} /></div>}>
              <OptionChainCard symbol={i.symbol} />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}
