import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { queries } from '../api/queries'
import { NO_FILTERS, PRESETS, type Preset, type ScreenFilters, runPreset, screen } from '../components/insights'
import { CLASS_LABELS } from '../components/marketBrowse'
import { useFormat } from '../core/format'

/** Screener: one-click presets or custom filters over the backend's per-instrument statistics. */
export default function Screener() {
  const fmt = useFormat()
  const { data: stats = [], isPending } = useQuery(queries.stats()) // refetchInterval: 5 s
  const [preset, setPreset] = useState<Preset | null>(PRESETS[0])
  const [filters, setFilters] = useState<ScreenFilters>(NO_FILTERS)
  const classes = [...new Set(stats.map((s) => s.assetClass))]
  const results = preset ? runPreset(stats, preset) : screen(stats, filters)

  const patch = (key: keyof ScreenFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPreset(null)
    const raw = e.target.value
    setFilters((f) => ({ ...f, [key]: raw === '' ? null : key === 'assetClass' ? raw : Number(raw) }))
  }
  const value = (v: number | string | null) => (v === null ? '' : v)

  return (
    <div className="page">
      <div className="page__header"><h1>Screener</h1><span className="muted">Refreshes every 5 s</span></div>

      <section className="presets" aria-label="Preset screens">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset?.id === p.id} onClick={() => setPreset(preset?.id === p.id ? null : p)}>
            {p.label}<small>{p.description}</small>
          </button>
        ))}
      </section>

      <section className="card stack">
        <h2>Custom filters</h2>
        <form className="form-row" onSubmit={(e) => e.preventDefault()}>
          <div className="field"><label htmlFor="f-class">Class</label>
            <select id="f-class" value={value(filters.assetClass)} onChange={patch('assetClass')}>
              <option value="">All</option>
              {classes.map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="f-minc">Change ≥ %</label><input id="f-minc" type="number" step="0.1" value={value(filters.minChange)} onChange={patch('minChange')} /></div>
          <div className="field"><label htmlFor="f-maxc">Change ≤ %</label><input id="f-maxc" type="number" step="0.1" value={value(filters.maxChange)} onChange={patch('maxChange')} /></div>
          <div className="field"><label htmlFor="f-minr">RSI ≥</label><input id="f-minr" type="number" min="0" max="100" value={value(filters.minRsi)} onChange={patch('minRsi')} /></div>
          <div className="field"><label htmlFor="f-maxr">RSI ≤</label><input id="f-maxr" type="number" min="0" max="100" value={value(filters.maxRsi)} onChange={patch('maxRsi')} /></div>
          <div className="field"><label htmlFor="f-vol">Volatility ≥ %</label><input id="f-vol" type="number" step="0.1" value={value(filters.minVolatility)} onChange={patch('minVolatility')} /></div>
          <div className="field"><label htmlFor="f-spr">Spread ≤ bps</label><input id="f-spr" type="number" step="1" value={value(filters.maxSpreadBps)} onChange={patch('maxSpreadBps')} /></div>
          <button className="btn btn--ghost" type="button" onClick={() => setFilters(NO_FILTERS)}>Reset</button>
        </form>
      </section>

      <section className="card">
        <h2>{preset?.label ?? 'Results'} <span className="muted" style={{ fontWeight: 400 }}>({results.length})</span></h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Instrument</th><th>Class</th><th className="num">Price</th><th className="num">Change</th><th className="num">RSI 14</th>
              <th className="num">Volatility 1h</th><th>Range (2h)</th><th className="num">Spread</th><th>Clients long</th>
            </tr></thead>
            <tbody>
              {results.map((s) => (
                <tr key={s.symbol}>
                  <td><Link to={`/markets/${s.symbol}`}>{s.symbol}</Link><span className="muted">{s.name}</span></td>
                  <td><span className="badge">{CLASS_LABELS[s.assetClass]}</span></td>
                  <td className="num">{fmt.price(s.mid, s.decimals)}</td>
                  <td className={`num ${s.changePct >= 0 ? 'up' : 'down'}`}>{fmt.pct(s.changePct)}</td>
                  <td className={`num ${(s.rsi14 ?? 50) < 30 ? 'up' : (s.rsi14 ?? 50) > 70 ? 'down' : ''}`}>{s.rsi14 ?? '–'}</td>
                  <td className="num">{s.volatilityPct}%</td>
                  <td><span className="meter" title={`${s.rangePct}% of the range`}><span style={{ inlineSize: `${s.rangePct}%` }} /></span></td>
                  <td className="num muted">{s.spreadBps} bps</td>
                  <td>
                    <span className="sentiment-bar" style={{ inlineSize: 80 }} title={`${s.longPct}% long`}>
                      <span className="long" style={{ flex: s.longPct }} /><span className="short" style={{ flex: 100 - s.longPct }} />
                    </span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && <tr><td colSpan={9} className="muted">{isPending ? 'Loading…' : 'Nothing matches right now.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
