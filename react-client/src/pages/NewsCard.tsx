import { useQuery } from '@tanstack/react-query'
import { queries } from '../api/queries'

/** Client sentiment (share of long positions) and the latest headlines for one instrument. */
export default function NewsCard({ symbol }: { symbol: string }) {
  const { data: news = [] } = useQuery(queries.news({ symbol, limit: 5 }))
  // select: derive one row from the cached stats list; re-renders only when that row changes
  const { data: sentiment } = useQuery({ ...queries.stats(), select: (stats) => stats.find((s) => s.symbol === symbol) })

  return (
    <section className="card stack" aria-labelledby="news-title">
      <h2 id="news-title">Sentiment &amp; news</h2>
      {sentiment && (
        <div className="stack" style={{ gap: '.3rem' }}>
          <div className="row spread" style={{ fontSize: '.85rem' }}>
            <span className="up">{sentiment.longPct}% long</span><span className="muted">clients of this broker</span><span className="down">{100 - sentiment.longPct}% short</span>
          </div>
          <div className="sentiment-bar" role="img" aria-label={`${sentiment.longPct}% of clients are long`}>
            <span className="long" style={{ flex: sentiment.longPct }} /><span className="short" style={{ flex: 100 - sentiment.longPct }} />
          </div>
        </div>
      )}
      <ul className="news">
        {news.map((n) => (
          <li key={n.id}>
            <span className="news__meta">
              <span className={`badge ${n.sentiment === 'POSITIVE' ? 'badge--up' : n.sentiment === 'NEGATIVE' ? 'badge--down' : ''}`}>{n.sentiment.toLowerCase()}</span>
              {n.time.slice(11, 16)} UTC · {n.source}
            </span>
            <span className="news__title">{n.headline}</span>
          </li>
        ))}
        {news.length === 0 && <li className="muted">No headlines in the last 24 hours.</li>}
      </ul>
    </section>
  )
}
