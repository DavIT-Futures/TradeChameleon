import { useQuery } from '@tanstack/react-query'
import { queries } from '../api/queries'
import { CLASS_LABELS } from '../components/marketBrowse'
import { useFormat } from '../core/format'

/** CFD view of the portfolio: exposure, margin, margin level, leverage and concentration warnings. */
export default function RiskCard() {
  const fmt = useFormat()
  const { data: r } = useQuery(queries.risk()) // refetchInterval: 5 s
  // Gauge position: 50% → left edge, 100% → middle, ≥ 1000% → right edge (log scale).
  const gauge = Math.max(0, Math.min(100, (Math.log10((r?.marginLevelPct ?? 1000) / 50) / Math.log10(20)) * 100))

  return (
    <section className="card stack" aria-labelledby="risk-title">
      <h2 id="risk-title">Risk &amp; margin <span className="muted" style={{ fontWeight: 400, fontSize: '.85rem' }}>(if held as CFDs)</span></h2>
      {r ? (
        <>
          <div className="grid grid--kpi">
            <div className="kpi"><div className="kpi__label">Exposure</div><div className="kpi__value">{fmt.money(r.exposure, r.currency)}</div></div>
            <div className="kpi"><div className="kpi__label">Margin required</div><div className="kpi__value">{fmt.money(r.marginRequired, r.currency)}</div></div>
            <div className="kpi"><div className="kpi__label">Free margin</div><div className="kpi__value">{fmt.money(r.freeMargin, r.currency)}</div></div>
            <div className="kpi"><div className="kpi__label">Margin level · leverage</div>
              <div className="kpi__value">{r.marginLevelPct === null ? '–' : `${r.marginLevelPct}%`} · {r.leverage}×</div></div>
          </div>
          {r.marginLevelPct !== null && (
            <div className="stack" style={{ gap: '.2rem' }}>
              <div className="risk-gauge" aria-hidden="true"><i style={{ insetInlineStart: `${gauge}%` }} /></div>
              <div className="row spread muted" style={{ fontSize: '.75rem' }}><span>50% stop-out</span><span>100% margin call</span><span>healthy</span></div>
            </div>
          )}
          {r.warnings.length > 0 && <ul className="warning-list">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th className="num">Exposure</th><th className="num">Share</th><th className="num">Margin</th></tr></thead>
              <tbody>
                {r.byClass.map((c) => (
                  <tr key={c.assetClass}>
                    <td>{CLASS_LABELS[c.assetClass]}</td>
                    <td className="num">{fmt.money(c.exposure, r.currency)}</td>
                    <td className="num"><span className="meter"><span style={{ inlineSize: `${c.sharePct}%` }} /></span> {c.sharePct}%</td>
                    <td className="num">{fmt.money(c.margin, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <div className="skeleton" style={{ blockSize: '8rem' }} />}
    </section>
  )
}
