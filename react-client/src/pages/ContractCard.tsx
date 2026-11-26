import type { InstrumentView, Quote } from '../api/types'
import { CLASS_LABELS, contractFacts } from '../components/marketBrowse'
import { formatPrice } from '../core/format'
import { useTenant } from '../core/TenantProvider'

/** Contract details that matter for the instrument's asset class (pips for FX, contract value for commodities…). */
export default function ContractCard({ instrument, quote }: { instrument: InstrumentView; quote: Quote }) {
  const { tenant } = useTenant()
  const facts = contractFacts(instrument, quote, (v, d = 2) => formatPrice(v, d, tenant.locale))
  return (
    <section className="card stack" aria-labelledby="contract-title">
      <h2 id="contract-title">{CLASS_LABELS[instrument.assetClass]} · contract</h2>
      {instrument.description && <p className="muted">{instrument.description}</p>}
      <dl className="facts">
        {facts.map((f) => (
          <div key={f.label} style={{ display: 'contents' }}><dt>{f.label}</dt><dd>{f.value}</dd></div>
        ))}
      </dl>
    </section>
  )
}
