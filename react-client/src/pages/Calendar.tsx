import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { queries } from '../api/queries'
import type { EconomicEvent } from '../api/types'
import { useTenant } from '../core/TenantProvider'

const FLAGS: Record<string, string> = { US: '🇺🇸', EU: '🇪🇺', DE: '🇩🇪', GB: '🇬🇧', PL: '🇵🇱', JP: '🇯🇵', CN: '🇨🇳', AU: '🇦🇺' }

/** Economic calendar grouped by day, filtered by importance (server) and country (client). */
export default function Calendar() {
  const { tenant } = useTenant()
  const [minImportance, setMinImportance] = useState(1)
  const [country, setCountry] = useState<string | null>(null)
  const { data: events = [], isPending } = useQuery(queries.calendar(minImportance))

  const countries = [...new Set(events.map((e) => e.country))].sort()
  const fmt = new Intl.DateTimeFormat(tenant.locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const time = (iso: string) => new Date(iso).toLocaleTimeString(tenant.locale, { hour: '2-digit', minute: '2-digit' })
  const groups = new Map<string, EconomicEvent[]>()
  for (const e of events) {
    if (country !== null && e.country !== country) continue
    const key = new Date(e.time).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const today = new Date().toDateString()

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Economic calendar</h1>
          <p className="muted">Times in your time zone · simulated releases</p>
        </div>
        <div className="row">
          <div className="segmented" role="group" aria-label="Importance">
            {[1, 2, 3].map((i) => (
              <button key={i} type="button" aria-pressed={minImportance === i} onClick={() => setMinImportance(i)}>{'★'.repeat(i)}+</button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Country">
            <button className="chip" type="button" aria-pressed={country === null} onClick={() => setCountry(null)}>All</button>
            {countries.map((c) => (
              <button key={c} className="chip" type="button" aria-pressed={country === c} onClick={() => setCountry(c)}>{FLAGS[c]} {c}</button>
            ))}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Time</th><th>Event</th><th>Impact</th><th className="num">Actual</th><th className="num">Forecast</th><th className="num">Previous</th><th>Moves</th></tr></thead>
            <tbody>
              {[...groups.entries()].map(([date, dayEvents]) => [
                <tr key={date}><td colSpan={7} className="day-head">{(date === today ? 'Today · ' : '') + fmt.format(new Date(dayEvents[0].time))}</td></tr>,
                ...dayEvents.map((e) => (
                  <tr key={e.id} style={{ opacity: e.actual === null ? 1 : 0.85 }}>
                    <td>{time(e.time)}</td>
                    <td>{FLAGS[e.country]} <strong>{e.title}</strong> <span className="muted">{e.currency}</span></td>
                    <td className="stars" aria-label={`${e.importance} of 3`}>
                      {[1, 2, 3].map((s) => <span key={s} className={s > e.importance ? 'off' : ''}>★</span>)}
                    </td>
                    <td className={`num ${e.surprise === 'ABOVE' ? 'up' : e.surprise === 'BELOW' ? 'down' : ''}`}>
                      {e.actual === null ? '–' : `${e.actual}${e.unit}`}
                    </td>
                    <td className="num">{e.forecast}{e.unit}</td>
                    <td className="num muted">{e.previous}{e.unit}</td>
                    <td><div className="symbol-chips">{e.symbols.map((s) => <Link key={s} to={`/markets/${s}`}>{s}</Link>)}</div></td>
                  </tr>
                )),
              ])}
              {groups.size === 0 && <tr><td colSpan={7} className="muted">{isPending ? 'Loading…' : 'No events for this filter.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
