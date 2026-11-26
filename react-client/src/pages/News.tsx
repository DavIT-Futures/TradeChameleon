import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { queries } from '../api/queries'
import type { AssetClass } from '../api/types'
import { CLASS_LABELS } from '../components/marketBrowse'
import { useTenant } from '../core/TenantProvider'

const ago = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`
}

/** News feed of the last 24 hours, filterable by asset class. */
export default function News() {
  const { tenant } = useTenant()
  const [assetClass, setAssetClass] = useState<AssetClass | undefined>()
  const { data: news = [], isPending } = useQuery(queries.news({ assetClass, limit: 60 }))

  return (
    <div className="page">
      <div className="page__header">
        <h1>Market news</h1>
        <div className="chips" role="group" aria-label="Asset class">
          <button className="chip" type="button" aria-pressed={assetClass === undefined} onClick={() => setAssetClass(undefined)}>All</button>
          {tenant.allowedAssetClasses.filter((c) => c !== 'OPTION').map((c) => (
            <button key={c} className="chip" type="button" aria-pressed={assetClass === c} onClick={() => setAssetClass(c)}>{CLASS_LABELS[c]}</button>
          ))}
        </div>
      </div>
      <section className="card">
        <ul className="news">
          {news.map((n) => (
            <li key={n.id}>
              <span className="news__meta">
                <span className={`badge ${n.sentiment === 'POSITIVE' ? 'badge--up' : n.sentiment === 'NEGATIVE' ? 'badge--down' : ''}`}>{n.sentiment.toLowerCase()}</span>
                <Link to={`/markets/${n.symbol}`}>{n.symbol}</Link> · {ago(n.time)} · {n.source}
              </span>
              <span className="news__title">{n.headline}</span>
              <span className="news__summary">{n.summary}</span>
            </li>
          ))}
          {news.length === 0 && <li className="muted">{isPending ? 'Loading…' : 'No headlines in the last 24 hours.'}</li>}
        </ul>
      </section>
    </div>
  )
}
