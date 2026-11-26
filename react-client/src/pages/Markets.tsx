import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { queries } from '../api/queries'
import type { AssetClass, InstrumentView, Quote } from '../api/types'
import { Sparkline } from '../components/Sparkline'
import { useFlash } from '../components/useFlash'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'
import { useTenant } from '../core/TenantProvider'
import { toggleWatch, useWatchlist } from '../core/watchlist'

export default function Markets() {
  const { tenant } = useTenant()
  const instruments = useQuery(queries.instruments())
  const { quotes, sparklines } = useStream()
  const watchlist = useWatchlist()
  const [filter, setFilter] = useState<AssetClass | 'WATCH' | null>(null)
  const [search, setSearch] = useState('')
  // React 19: typing stays responsive; filtering uses the deferred (possibly stale) value.
  const deferredSearch = useDeferredValue(search)

  const rows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return (instruments.data ?? [])
      .filter((i) => filter === null || i.assetClass === filter || (filter === 'WATCH' && watchlist.has(i.symbol)))
      .filter((i) => !q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
  }, [instruments.data, filter, deferredSearch, watchlist])

  return (
    <div className="page">
      <div className="page__header">
        <h1>Markets</h1>
        <div className="row">
          <div className="segmented" role="group" aria-label="Asset class">
            <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>All</button>
            <button type="button" aria-pressed={filter === 'WATCH'} onClick={() => setFilter('WATCH')}>★ Watchlist</button>
            {tenant.allowedAssetClasses.map((c) => (
              <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>
            ))}
          </div>
          <div className="field">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th><span className="sr-only">Watch</span></th><th>Instrument</th><th>Class</th><th>Trend</th><th className="num">Bid</th><th className="num">Ask</th><th className="num">Change</th></tr>
            </thead>
            <tbody>
              {instruments.isPending && [1, 2, 3, 4, 5, 6].map((i) => <tr key={i}><td colSpan={7}><div className="skeleton" /></td></tr>)}
              {rows.map((i) => (
                <MarketRow key={i.symbol} watched={watchlist.has(i.symbol)} instrument={i} quote={quotes.get(i.symbol) ?? i.quote} spark={sparklines[i.symbol] ?? []} />
              ))}
              {!instruments.isPending && rows.length === 0 && <tr><td colSpan={7} className="muted">No instruments match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MarketRow({ instrument: i, quote, spark, watched }: { instrument: InstrumentView; quote: Quote; spark: number[]; watched: boolean }) {
  const fmt = useFormat()
  const bidRef = useFlash<HTMLTableCellElement>(quote.bid)
  const askRef = useFlash<HTMLTableCellElement>(quote.ask)
  return (
    <tr>
      <td>
        <button className="star" type="button" aria-pressed={watched} aria-label={`Watch ${i.symbol}`}
          onClick={() => void toggleWatch(i.symbol)}>★</button>
      </td>
      <td>
        <Link to={i.symbol}>{i.symbol}</Link>
        <div className="muted" style={{ fontSize: '.8rem' }}>{i.name} · {i.exchange}</div>
      </td>
      <td><span className="badge">{i.assetClass}</span></td>
      <td><Sparkline values={spark} /></td>
      <td ref={bidRef} className="num">{fmt.price(quote.bid, i.decimals)}</td>
      <td ref={askRef} className="num">{fmt.price(quote.ask, i.decimals)}</td>
      <td className={`num ${quote.changePct >= 0 ? 'up' : 'down'}`}>{fmt.pct(quote.changePct)}</td>
    </tr>
  )
}
