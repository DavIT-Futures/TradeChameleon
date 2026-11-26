import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import type { SimulatorSettings } from '../api/types'
import { decodeClaims, useSession } from '../core/auth'
import { useStream } from '../core/priceStream'
import { useTenant } from '../core/TenantProvider'
import { showToast } from '../core/toast'

type NumericKey = 'latencyMs' | 'jitterMs' | 'failureRate' | 'volatilityMultiplier'

export default function DevPanel() {
  const { tenant } = useTenant()
  const session = useSession()
  const { status, lastTick } = useStream()
  const queryClient = useQueryClient()
  const settings = useQuery(queries.simulator())

  // Editable draft, re-synced whenever the server value changes.
  const [draft, setDraft] = useState<SimulatorSettings | undefined>(settings.data)
  const [synced, setSynced] = useState(settings.data)
  if (synced !== settings.data) {
    setSynced(settings.data)
    setDraft(settings.data)
  }

  const save = useMutation({
    mutationFn: (body: SimulatorSettings) => unwrap(api.PUT('/api/simulator', { body })),
    onSuccess: (s) => { queryClient.setQueryData(queries.simulator().queryKey, s); showToast('success', 'Simulator updated') },
  })
  const reset = useMutation({
    mutationFn: () => unwrap(api.POST('/api/simulator/reset')),
    onSuccess: (s) => { queryClient.setQueryData(queries.simulator().queryKey, s); showToast('info', 'Simulator reset') },
  })

  const slider = (key: NumericKey, label: string, max: number, step: number, show: (v: number) => string) =>
    draft && (
      <div className="range">
        <label htmlFor={key}>{label} <output>{show(draft[key])}</output></label>
        <input id={key} type="range" min={0} max={max} step={step} value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} />
      </div>
    )

  return (
    <div className="page">
      <div className="page__header">
        <h1>Developer panel</h1>
        <div className="row">
          <span className={`status-dot ${status === 'live' ? 'live' : ''}`} />
          <span className="muted">SSE {status} · last tick {lastTick?.toLocaleTimeString() ?? '–'}</span>
        </div>
      </div>
      <div className="grid grid--2">
        <section className="card stack">
          <h2>Simulator</h2>
          {draft ? (
            <>
              {slider('latencyMs', 'Latency', 3000, 50, (v) => `${v} ms`)}
              {slider('jitterMs', 'Jitter', 2000, 50, (v) => `${v} ms`)}
              {slider('failureRate', 'Failure rate', 1, 0.05, (v) => `${(v * 100).toFixed(0)} %`)}
              {slider('volatilityMultiplier', 'Volatility', 10, 0.5, (v) => `× ${v}`)}
              <label className="row">
                <input type="checkbox" checked={draft.paused} onChange={() => setDraft({ ...draft, paused: !draft.paused })} /> Pause price engine
              </label>
              <div className="row">
                <button className="btn" disabled={save.isPending} onClick={() => save.mutate(draft)}>Apply</button>
                <button className="btn btn--ghost" onClick={() => reset.mutate()}>Reset</button>
              </div>
            </>
          ) : <div className="skeleton" style={{ blockSize: '12rem' }} />}
        </section>
        <section className="card stack">
          <h2>Session</h2>
          <div><span className="muted">Tenant</span> <code>{tenant.id}</code></div>
          <div><span className="muted">Features</span><pre className="token">{JSON.stringify(tenant.features, null, 2)}</pre></div>
          <div><span className="muted">JWT claims</span><pre className="token">{JSON.stringify(decodeClaims(session?.token), null, 2)}</pre></div>
        </section>
      </div>
    </div>
  )
}
