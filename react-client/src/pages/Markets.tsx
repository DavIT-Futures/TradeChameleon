import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { queries } from '../api/queries'
import type { AssetClass, InstrumentView, Quote } from '../api/types'
import { CLASS_LABELS, SORTS, type SortKey, matches, sortRows, spreadBps, spreadPips } from '../components/marketBrowse'
import { Sparkline } from '../components/Sparkline'
import { useFlash } from '../components/useFlash'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'
import { toggleWatch, useWatchlist } from '../core/watchlist'

type Tab = 'ALL' | 'WATCH' | AssetClass
const ORDER = Object.keys(CLASS_LABELS)

/**
 * Market browser: overview cards per asset class, class tabs, sub-category chips, search and sorting.
 * The selected tab lives in the URL (?class=FX), so links and the back button work.
 */
export default function Markets() {
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('class') as Tab | null) ?? 'ALL'
  const instruments = useQuery(queries.instruments())
  const overview = useQuery(queries.overview())
  const { quotes, sparklines } = useStream()
  const watchlist = useWatchlist()
  // category is reset when the tab changes: keyed by tab ("adjusting state when a prop changes")
  const [category, setCategory] = useState<{ tab: Tab; value: string | null }>({ tab, value: null })
  const activeCategory = category.tab === tab ? category.value : null
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search) // typing stays responsive
  const [sort, setSort] = useState<SortKey>('symbol')

  const select = (next: Tab) => setParams(next === 'ALL' ? {} : { class: next }, { replace: true })

  const all = useMemo(
    () => (instruments.data ?? []).map((i) => ({ instrument: i, quote: quotes.get(i.symbol) ?? i.quote })),
    [instruments.data, quotes],
  )

  const classes = useMemo(() => {
    const counts = new Map<AssetClass, number>()
    for (const r of all) counts.set(r.instrument.assetClass, (counts.get(r.instrument.assetClass) ?? 0) + 1)
    const result = [...counts.entries()].map(([assetClass, count]) => ({ assetClass, count }))
    const optionable = all.filter((r) => r.instrument.optionChain).length
    if (optionable) result.push({ assetClass: 'OPTION', count: optionable })
    return result.sort((a, b) => ORDER.indexOf(a.assetClass) - ORDER.indexOf(b.assetClass))
  }, [all])

  const inTab = all.filter((r) =>
    tab === 'ALL' ? true
      : tab === 'WATCH' ? watchlist.has(r.instrument.symbol)
      : tab === 'OPTION' ? r.instrument.optionChain
      : r.instrument.assetClass === tab)
  const categories = tab === 'ALL' || tab === 'WATCH' || tab === 'OPTION' ? [] : [...new Set(inTab.map((r) => r.instrument.category))].sort()
  const rows = sortRows(
    inTab.filter((r) => activeCategory === null || r.instrument.category === activeCategory).filter((r) => matches(r.instrument, deferredSearch)),
    sort,
  )

  return (
    <div className="page">
      <div className="page__header"><h1>Markets</h1></div>

      <section className="overview" aria-label="Market overview">
        {overview.data?.map((o) => (
          <button key={o.assetClass} type="button" aria-pressed={tab === o.assetClass} onClick={() => select(o.assetClass)}>
            <span className="ov-title">
              {CLASS_LABELS[o.assetClass]}
              {o.assetClass !== 'OPTION' && <span className={o.avgChangePct >= 0 ? 'up' : 'down'}>{fmt.pct(o.avgChangePct)}</span>}
            </span>
            {o.assetClass === 'OPTION' ? (
              <span className="ov-meta">{o.instruments} underlyings with option chains</span>
            ) : (
              <>
                <span className="breadth" aria-hidden="true"><span className="g" style={{ flex: o.gainers }} /><span className="l" style={{ flex: o.losers }} /></span>
                <span className="ov-meta">{o.instruments} · ▲ {o.best?.symbol} {fmt.pct(o.best?.changePct)} · ▼ {o.worst?.symbol} {fmt.pct(o.worst?.changePct)}</span>
              </>
            )}
          </button>
        ))}
      </section>

      <section className="card stack">
        <div className="tabs" role="tablist" aria-label="Asset class">
          <button role="tab" aria-selected={tab === 'ALL'} onClick={() => select('ALL')}>All<small>{all.length}</small></button>
          <button role="tab" aria-selected={tab === 'WATCH'} onClick={() => select('WATCH')}>★ Watchlist<small>{watchlist.size}</small></button>
          {classes.map((c) => (
            <button key={c.assetClass} role="tab" aria-selected={tab === c.assetClass} onClick={() => select(c.assetClass)}>
              {CLASS_LABELS[c.assetClass]}<small>{c.count}</small>
            </button>
          ))}
        </div>

        <div className="toolbar">
          <div className="chips" role="group" aria-label="Category">
            {categories.length > 1 && (
              <>
                <button className="chip" type="button" aria-pressed={activeCategory === null} onClick={() => setCategory({ tab, value: null })}>All</button>
                {categories.map((c) => (
                  <button key={c} className="chip" type="button" aria-pressed={activeCategory === c} onClick={() => setCategory({ tab, value: c })}>{c}</button>
                ))}
              </>
            )}
          </div>
          <div className="row">
            <div className="field">
              <label className="sr-only" htmlFor="search">Search</label>
              <input id="search" type="search" placeholder="Search symbol, name, sector…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="field">
              <label className="sr-only" htmlFor="sort">Sort</label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          {tab === 'OPTION' ? (
            <table className="table">
              <thead><tr><th>Underlying</th><th>Class</th><th className="num">Last</th><th className="num">Change</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.instrument.symbol}>
                    <td><Link to={`${r.instrument.symbol}#options`}>{r.instrument.symbol}</Link><span className="muted">{r.instrument.name}</span></td>
                    <td><span className="badge">{CLASS_LABELS[r.instrument.assetClass]}</span></td>
                    <td className="num">{fmt.price(r.quote.mid, r.instrument.decimals)}</td>
                    <td className={`num ${r.quote.changePct >= 0 ? 'up' : 'down'}`}>{fmt.pct(r.quote.changePct)}</td>
                    <td><Link className="btn btn--ghost btn--small" to={`${r.instrument.symbol}#options`}>Option chain →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th><span className="sr-only">Watch</span></th><th>Instrument</th><th>Category</th><th>Trend</th>
                  <th className="num">Bid</th><th className="num">Ask</th><th className="num">Spread</th><th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {instruments.isPending && [1, 2, 3, 4, 5, 6].map((i) => <tr key={i}><td colSpan={8}><div className="skeleton" /></td></tr>)}
                {rows.map((r) => (
                  <MarketRow key={r.instrument.symbol} watched={watchlist.has(r.instrument.symbol)} instrument={r.instrument}
                    quote={r.quote} spark={sparklines[r.instrument.symbol] ?? []} />
                ))}
                {!instruments.isPending && rows.length === 0 && <tr><td colSpan={8} className="muted">No instruments match.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

function MarketRow({ instrument: i, quote, spark, watched }: { instrument: InstrumentView; quote: Quote; spark: number[]; watched: boolean }) {
  const fmt = useFormat()
  const bidRef = useFlash<HTMLTableCellElement>(quote.bid)
  const askRef = useFlash<HTMLTableCellElement>(quote.ask)
  const spread = i.assetClass === 'FX' && i.pipSize ? `${spreadPips(quote, i.pipSize).toFixed(1)} pips` : `${spreadBps(quote).toFixed(1)} bps`
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
      <td><span className="badge">{CLASS_LABELS[i.assetClass]}</span> <span className="muted" style={{ fontSize: '.8rem' }}>{i.category}</span></td>
      <td><Sparkline values={spark} /></td>
      <td ref={bidRef} className="num">{fmt.price(quote.bid, i.decimals)}</td>
      <td ref={askRef} className="num">{fmt.price(quote.ask, i.decimals)}</td>
      <td className="num muted">{spread}</td>
      <td className={`num ${quote.changePct >= 0 ? 'up' : 'down'}`}>{fmt.pct(quote.changePct)}</td>
    </tr>
  )
}
