import { useQuery } from '@tanstack/react-query'
import { Fragment, useState, type CSSProperties } from 'react'
import { queries } from '../api/queries'
import { buildMatrix, featureScore } from '../components/adminMatrix'
import { formatMoney } from '../core/format'
import { useTenant } from '../core/TenantProvider'

/** Platform operator panel: all six brokers side by side, differences highlighted. */
export default function Admin() {
  const { tenant } = useTenant()
  const { data: brokers = [] } = useQuery(queries.adminTenants())
  const [onlyDifferences, setOnlyDifferences] = useState(false)

  const all = buildMatrix(brokers, (v, c) => formatMoney(v, c, tenant.locale))
  const rows = onlyDifferences ? all.filter((r) => r.differs) : all

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Admin · brokers</h1>
          <p className="muted">One code base, {brokers.length} brands. Configuration comes from the database; usage refreshes every 10 s.</p>
        </div>
        <label className="row">
          <input type="checkbox" checked={onlyDifferences} onChange={() => setOnlyDifferences(!onlyDifferences)} /> Show only differences
        </label>
      </div>

      <section className="admin-brands">
        {brokers.map((b) => (
          <article
            key={b.id}
            className="admin-brand"
            style={{
              '--b-primary': b.theme.primary, '--b-accent': b.theme.accent, '--b-bg': b.theme.background,
              '--b-surface': b.theme.surface, '--b-text': b.theme.text, '--b-radius': b.theme.radius,
              fontFamily: b.theme.fontHeading,
            } as CSSProperties}
          >
            <img src={b.logoUrl} alt="" />
            <div>
              <strong>{b.name}</strong>
              <small>{b.id} · {b.locale} · {b.currency}</small>
            </div>
            <span className="swatches" aria-hidden="true"><i className="p" /><i className="a" /><i className="bg" /></span>
            <span className="score" title="Enabled features + asset classes">{featureScore(b)}</span>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="table-wrap">
          <table className="table admin-matrix">
            <thead>
              <tr>
                <th>Setting</th>
                {brokers.map((b) => <th key={b.id}><img src={b.logoUrl} alt="" /> {b.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={r.group + r.label}>
                  {(i === 0 || rows[i - 1].group !== r.group) && (
                    <tr className="group"><td colSpan={brokers.length + 1}>{r.group}</td></tr>
                  )}
                  <tr className={r.differs ? undefined : 'same'}>
                    <th scope="row">{r.label}</th>
                    {r.cells.map((c, j) => (
                      <td key={j}>
                        {c === true ? <span className="yes" aria-label="yes">✓</span>
                          : c === false ? <span className="no" aria-label="no">✗</span> : c}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
