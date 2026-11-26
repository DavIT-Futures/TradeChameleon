import type { Portfolio } from '../api/types'
import { useFormat } from '../core/format'

const COLORS: Record<string, string> = {
  CASH: 'var(--tc-muted)',
  STOCK: 'var(--tc-primary)',
  ETF: 'var(--tc-accent)',
  FX: 'color-mix(in oklab, var(--tc-primary) 50%, var(--tc-accent))',
  CRYPTO: 'color-mix(in oklab, var(--tc-negative) 70%, var(--tc-accent))',
  BOND: 'color-mix(in oklab, var(--tc-positive) 70%, var(--tc-primary))',
}

/** Allocation by asset class; loaded lazily by the dashboard. */
export default function Allocation({ portfolio }: { portfolio: Portfolio }) {
  const fmt = useFormat()
  const groups = new Map<string, number>([['CASH', portfolio.cash]])
  for (const pos of portfolio.positions) groups.set(pos.assetClass, (groups.get(pos.assetClass) ?? 0) + pos.marketValue)
  const total = [...groups.values()].reduce((a, b) => a + b, 0) || 1
  const slices = [...groups.entries()].map(([key, value]) => ({ key, value, pct: (value / total) * 100, color: COLORS[key] }))

  return (
    <section className="card stack">
      <h2>Allocation</h2>
      <div className="allocation" role="img" aria-label="Allocation by asset class">
        {slices.map((s) => <span key={s.key} style={{ inlineSize: `${s.pct}%`, background: s.color }} title={s.key} />)}
      </div>
      <div className="legend">
        {slices.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.key} {fmt.money(s.value, portfolio.currency)} ({s.pct.toFixed(1)}%)</span>
        ))}
      </div>
    </section>
  )
}
