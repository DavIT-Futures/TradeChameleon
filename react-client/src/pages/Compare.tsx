import { useQueries, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { queries } from '../api/queries'
import { SERIES_COLORS, type Series, compareGeometry } from '../components/insights'
import { useFormat } from '../core/format'
import { useStream } from '../core/priceStream'

const WIDTH = 720
const HEIGHT = 300

/**
 * Relative performance of up to four instruments, rebased to 0%. useQueries() fetches one history per
 * symbol in parallel; the symbols live in the URL (?symbols=SPY,AAPL).
 */
export default function Compare() {
  const fmt = useFormat()
  const [params, setParams] = useSearchParams()
  const symbols = (params.get('symbols') ?? 'SPY,AAPL').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4)
  const instruments = useQuery(queries.instruments())
  const histories = useQueries({ queries: symbols.map((s) => queries.history(s, 600)) })
  const { quotes } = useStream()

  // cheap to compute (≤ 4 × 600 points), so no memoisation needed
  const series: Series[] = histories.flatMap((h, i) => {
    if (!h.data) return []
    const points = h.data.map((p) => ({ t: Date.parse(p.t), price: p.price }))
    const q = quotes.get(symbols[i])
    const t = q ? Date.parse(q.timestamp) : 0
    return [{ symbol: symbols[i], points: q && t > (points[points.length - 1]?.t ?? 0) ? [...points, { t, price: q.mid }] : points }]
  })
  const geometry = compareGeometry(series, WIDTH, HEIGHT)

  const update = (next: string[]) => setParams({ symbols: next.join(',') }, { replace: true })

  return (
    <div className="page">
      <div className="page__header">
        <h1>Compare</h1>
        <div className="row">
          <label className="sr-only" htmlFor="add">Add instrument</label>
          <select id="add" value="" disabled={symbols.length >= 4}
            onChange={(e) => e.target.value && update([...symbols, e.target.value])}>
            <option value="">+ Add instrument (max 4)</option>
            {instruments.data?.filter((i) => !symbols.includes(i.symbol)).map((i) => (
              <option key={i.symbol} value={i.symbol}>{i.symbol} · {i.name}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="card stack">
        <div className="legend">
          {geometry.lines.map((l, idx) => (
            <span key={l.symbol}>
              <i style={{ background: SERIES_COLORS[idx] }} /><strong>{l.symbol}</strong>{' '}
              <span className={l.last >= 0 ? 'up' : 'down'}>{fmt.pct(l.last)}</span>
              <button className="btn btn--ghost btn--small" type="button" aria-label={`Remove ${l.symbol}`}
                onClick={() => update(symbols.filter((s) => s !== l.symbol))}>×</button>
            </span>
          ))}
        </div>
        {geometry.lines.length ? (
          <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Relative performance">
            {geometry.yTicks.map((t, i) => (
              <g key={i}>
                <line className="chart__grid" x1={8} x2={WIDTH - 56} y1={t.y} y2={t.y} />
                <text className="chart__label" x={WIDTH - 50} y={t.y + 4}>{t.value.toFixed(2)}%</text>
              </g>
            ))}
            <line className="zero" x1={8} x2={WIDTH - 56} y1={geometry.zeroY} y2={geometry.zeroY} />
            {geometry.lines.map((l, idx) => <path key={l.symbol} className="series" d={l.d} style={{ stroke: SERIES_COLORS[idx] }} />)}
          </svg>
        ) : (
          <p className="muted">{histories.some((h) => h.isPending) ? 'Loading…' : 'Add instruments to compare them.'}</p>
        )}
        <p className="muted" style={{ fontSize: '.85rem' }}>Last ~10 minutes of ticks, each series rebased to 0% at the start; live ticks are appended.</p>
      </section>
    </div>
  )
}
