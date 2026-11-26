import { useQuery } from '@tanstack/react-query'
import { queries } from '../api/queries'
import { useFormat } from '../core/format'

/** Market depth: 10 bid and ask levels with size bars, refetched every second (refetchInterval). */
export default function DepthCard({ symbol, decimals }: { symbol: string; decimals: number }) {
  const fmt = useFormat()
  const { data: book } = useQuery(queries.depth(symbol))
  const max = book ? Math.max(...book.bids.map((l) => l.size), ...book.asks.map((l) => l.size)) : 1
  return (
    <section className="card">
      <h2>Market depth</h2>
      {book ? (
        <div className="book">
          <table className="bid" aria-label="Bids">
            <thead><tr><th className="num">Size</th><th className="num">Bid</th></tr></thead>
            <tbody>
              {book.bids.map((l, idx) => (
                <tr key={idx}>
                  <td className="num"><span className="bar" style={{ inlineSize: `${(l.size / max) * 100}%` }} /><span>{fmt.qty(l.size)}</span></td>
                  <td className="num up"><span>{fmt.price(l.price, decimals)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="ask" aria-label="Asks">
            <thead><tr><th className="num">Ask</th><th className="num">Size</th></tr></thead>
            <tbody>
              {book.asks.map((l, idx) => (
                <tr key={idx}>
                  <td className="num down"><span>{fmt.price(l.price, decimals)}</span></td>
                  <td className="num"><span className="bar" style={{ inlineSize: `${(l.size / max) * 100}%` }} /><span>{fmt.qty(l.size)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="skeleton" style={{ blockSize: '10rem' }} />}
    </section>
  )
}
