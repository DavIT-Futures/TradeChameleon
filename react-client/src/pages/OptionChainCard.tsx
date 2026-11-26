import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { queries } from '../api/queries'
import { useFormat } from '../core/format'

type Greek = 'delta' | 'gamma' | 'theta' | 'vega'
const GREEKS: { key: Greek; label: string; title: string }[] = [
  { key: 'delta', label: 'Δ', title: 'Delta: price change per 1 unit of the underlying' },
  { key: 'gamma', label: 'Γ', title: 'Gamma: change of delta per 1 unit of the underlying' },
  { key: 'theta', label: 'Θ', title: 'Theta: price change per calendar day' },
  { key: 'vega', label: 'ν', title: 'Vega: price change per 1 volatility point' },
]

/** Option chain: calls | strike | puts for one expiry, priced by the backend's Black-Scholes model (read-only). */
export default function OptionChainCard({ symbol }: { symbol: string }) {
  const fmt = useFormat()
  const [expiry, setExpiry] = useState<string | undefined>()
  const [greek, setGreek] = useState<Greek>('delta')
  // refetchInterval (3 s) and placeholderData live in the query options
  const { data: chain, isError } = useQuery(queries.options(symbol, expiry))
  const label = GREEKS.find((g) => g.key === greek)!.label
  const atm = chain?.rows.reduce((best, r) => (Math.abs(r.strike - chain.spot) < Math.abs(best.strike - chain.spot) ? r : best)).strike

  return (
    <section className="card stack" id="options" aria-labelledby="options-title">
      <div className="toolbar">
        <h2 id="options-title">Option chain</h2>
        {chain && (
          <>
            <div className="segmented" role="group" aria-label="Expiry">
              {chain.expiries.map((e) => (
                <button key={e} type="button" aria-pressed={e === chain.expiry} onClick={() => setExpiry(e)}>{e.slice(5)}</button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Greek">
              {GREEKS.map((g) => (
                <button key={g.key} type="button" aria-pressed={greek === g.key} title={g.title} onClick={() => setGreek(g.key)}>{g.label}</button>
              ))}
            </div>
          </>
        )}
      </div>
      {chain ? (
        <>
          <p className="muted" style={{ fontSize: '.85rem' }}>
            Spot {fmt.price(chain.spot, 2)} {chain.currency} · expiry {chain.expiry} ({chain.daysToExpiry} days) · r = {chain.rate * 100}% ·
            1 contract = {chain.contractSize} × underlying · European, Black-Scholes, read-only
          </p>
          <div className="table-wrap">
            <table className="table chain">
              <thead>
                <tr><th colSpan={4} style={{ textAlign: 'center' }}>Calls</th><th className="strike">Strike</th><th colSpan={4} style={{ textAlign: 'center' }}>Puts</th></tr>
                <tr><th>Bid</th><th>Ask</th><th>IV</th><th>{label}</th><th className="strike" /><th>Bid</th><th>Ask</th><th>IV</th><th>{label}</th></tr>
              </thead>
              <tbody>
                {chain.rows.map((r) => (
                  <tr key={r.strike} className={r.strike === atm ? 'atm' : ''}>
                    {[r.call.bid, r.call.ask].map((v, idx) => <td key={idx} className={r.call.inTheMoney ? 'itm' : ''}>{fmt.price(v, 2)}</td>)}
                    <td className={r.call.inTheMoney ? 'itm' : ''}>{r.call.iv}%</td>
                    <td className={r.call.inTheMoney ? 'itm' : ''}>{r.call[greek]}</td>
                    <td className="strike">{r.strike}</td>
                    {[r.put.bid, r.put.ask].map((v, idx) => <td key={idx} className={r.put.inTheMoney ? 'itm' : ''}>{fmt.price(v, 2)}</td>)}
                    <td className={r.put.inTheMoney ? 'itm' : ''}>{r.put.iv}%</td>
                    <td className={r.put.inTheMoney ? 'itm' : ''}>{r.put[greek]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : isError ? <div className="alert alert--error">Option chain not available.</div>
        : <div className="skeleton" style={{ blockSize: '12rem' }} />}
    </section>
  )
}
