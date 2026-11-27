import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { api, ApiError, unwrap } from '../api/client'
import { queries } from '../api/queries'
import type { BrokerOverview, TenantSettings, Theme } from '../api/types'
import { buildMatrix, featureScore } from '../components/adminMatrix'
import {
  COLOR_FIELDS, FEATURE_FIELDS, LOCALES, changedFields, fieldError, parseLimit, radiusPx, toSettings, toggleClass,
} from '../components/adminSettings'
import { formatMoney } from '../core/format'
import { useTenant } from '../core/TenantProvider'
import { showToast } from '../core/toast'

/** Platform operator panel: all brokers side by side, differences highlighted, every setting editable. */
export default function Admin() {
  const { tenant } = useTenant()
  const { data: brokers = [] } = useQuery(queries.adminTenants())
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const all = buildMatrix(brokers, (v, c) => formatMoney(v, c, tenant.locale))
  const rows = onlyDifferences ? all.filter((r) => r.differs) : all
  const editing = brokers.find((b) => b.id === editingId) ?? null

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Admin · brokers</h1>
          <p className="muted">One code base, {brokers.length} brands. Configuration comes from the database; pick a broker to edit it.</p>
        </div>
        <label className="row">
          <input type="checkbox" checked={onlyDifferences} onChange={() => setOnlyDifferences(!onlyDifferences)} /> Show only differences
        </label>
      </div>

      <section className="admin-brands">
        {brokers.map((b) => (
          <article
            key={b.id}
            className={`admin-brand${editingId === b.id ? ' is-editing' : ''}`}
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
            <button type="button" className="edit" aria-pressed={editingId === b.id}
              onClick={() => setEditingId(editingId === b.id ? null : b.id)}>✎ Edit</button>
          </article>
        ))}
      </section>

      {/* key: a fresh editor (and draft) per broker */}
      {editing && <BrokerEditor key={editing.id} broker={editing} onClose={() => setEditingId(null)} />}

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

function Field({ id, label, error, hint, children }: { id?: string; label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

/** The form for one broker: a draft in state, a live preview, server-side validation errors per field. */
function BrokerEditor({ broker, onClose }: { broker: BrokerOverview; onClose(): void }) {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const { data: options } = useQuery(queries.adminSettingsOptions())
  const { data: changes = [] } = useQuery(queries.adminTenantChanges(broker.id))
  const [saved, setSaved] = useState(() => toSettings(broker))
  const [draft, setDraft] = useState(() => toSettings(broker))
  const dirty = changedFields(saved, draft)

  const save = useMutation({
    mutationFn: (settings: TenantSettings) =>
      unwrap(api.PUT('/api/admin/tenants/{id}', { params: { path: { id: broker.id } }, body: settings })),
    onSuccess: (updated) => {
      setSaved(toSettings(updated))
      setDraft(toSettings(updated))
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      // The audit entry is written asynchronously by an event listener: read it again shortly after.
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['admin', 'changes', broker.id] }), 800)
      // Editing the broker this tab belongs to: re-skin right away.
      if (tenant.id === broker.id) void queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] })
      showToast('success', `${updated.name} saved`, 'Changes are live for the next request.')
    },
    onError: (e) => showToast('error', e instanceof ApiError ? (e.problem.title ?? 'Saving failed') : 'Saving failed',
      e instanceof ApiError ? e.problem.detail : undefined),
  })
  const problem = save.error instanceof ApiError ? save.error.problem : null
  const err = (path: string) => fieldError(problem?.errors, path)

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setTheme = (key: keyof Theme, value: string) => setDraft((d) => ({ ...d, theme: { ...d.theme, [key]: value } }))
  const d = draft

  const previewStyle = {
    '--b-primary': d.theme.primary, '--b-on-primary': d.theme.onPrimary, '--b-accent': d.theme.accent,
    '--b-bg': d.theme.background, '--b-surface': d.theme.surface, '--b-text': d.theme.text, '--b-muted': d.theme.muted,
    '--b-positive': d.theme.positive, '--b-negative': d.theme.negative, '--b-radius': d.theme.radius,
    '--b-font': d.theme.fontBody, '--b-font-heading': d.theme.fontHeading,
  } as CSSProperties

  return (
    <section className="card" style={{ containerType: 'inline-size' }}>
      <div className="row spread">
        <h2>Edit {broker.name} <small className="muted">({broker.id})</small></h2>
        {dirty.length > 0 && <span className="badge">Unsaved: {dirty.join(', ')}</span>}
      </div>
      {problem?.detail && !problem.errors && <div className="alert alert--error">{problem.detail}</div>}

      <div className="broker-editor">
        <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(draft) }}>
          <fieldset>
            <legend>Brand</legend>
            <div className="grid">
              <Field id="ed-name" label="Name" error={err('name')}>
                <input id="ed-name" required maxLength={80} value={d.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field id="ed-tagline" label="Tagline" error={err('tagline')}>
                <input id="ed-tagline" maxLength={160} value={d.tagline} onChange={(e) => set('tagline', e.target.value)} />
              </Field>
              <Field id="ed-logo" label="Logo" error={err('logoShape')}>
                <select id="ed-logo" value={d.logoShape} onChange={(e) => set('logoShape', e.target.value)}>
                  {options?.logoShapes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field id="ed-locale" label="Locale" error={err('locale')}>
                <input id="ed-locale" list="ed-locales" value={d.locale} onChange={(e) => set('locale', e.target.value)} />
                <datalist id="ed-locales">{LOCALES.map((l) => <option key={l} value={l} />)}</datalist>
              </Field>
              <Field id="ed-currency" label="Currency" error={err('currency')} hint="Existing accounts keep their currency; limits use the new one.">
                <select id="ed-currency" value={d.currency} onChange={(e) => set('currency', e.target.value)}>
                  {options?.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Look</legend>
            <div className="colors">
              {COLOR_FIELDS.map((c) => (
                <label key={c.key} className="color">
                  <input type="color" value={d.theme[c.key]} onChange={(e) => setTheme(c.key, e.target.value)} />
                  <span>{c.label}<br /><code>{d.theme[c.key]}</code></span>
                </label>
              ))}
            </div>
            <div className="grid" style={{ marginTop: '0.75rem' }}>
              <Field id="ed-radius" label={`Corner radius: ${d.theme.radius}`} error={err('theme.radius')}>
                <input id="ed-radius" type="range" min={0} max={24} value={radiusPx(d.theme.radius)}
                  onChange={(e) => setTheme('radius', `${e.target.value}px`)} />
              </Field>
              <Field id="ed-scheme" label="Colour scheme">
                <select id="ed-scheme" value={d.theme.colorScheme} onChange={(e) => setTheme('colorScheme', e.target.value)}>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </Field>
              <Field id="ed-font" label="Body font" error={err('theme.fontBody')}>
                <input id="ed-font" value={d.theme.fontBody} onChange={(e) => setTheme('fontBody', e.target.value)} />
              </Field>
              <Field id="ed-hfont" label="Heading font" error={err('theme.fontHeading')}>
                <input id="ed-hfont" value={d.theme.fontHeading} onChange={(e) => setTheme('fontHeading', e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Asset classes</legend>
            <div className="checks">
              {options?.assetClasses.map((c) => (
                <label key={c} className="check">
                  <input type="checkbox" checked={d.allowedAssetClasses.includes(c)}
                    onChange={() => set('allowedAssetClasses', toggleClass(d.allowedAssetClasses, c, options.assetClasses))} /> {c}
                </label>
              ))}
            </div>
            {err('allowedAssetClasses') && <span className="field__error">{err('allowedAssetClasses')}</span>}
          </fieldset>

          <fieldset>
            <legend>Features</legend>
            <div className="checks">
              {FEATURE_FIELDS.map((f) => (
                <label key={f.key} className="check">
                  <input type="checkbox" checked={d.features[f.key]}
                    onChange={(e) => set('features', { ...d.features, [f.key]: e.target.checked })} />
                  <span>{f.label} {f.hint && <small>{f.hint}</small>}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Pricing and limits</legend>
            <div className="grid">
              <Field id="ed-markup" label="Spread markup (bps)" error={err('spreadMarkupBps')}>
                <input id="ed-markup" type="number" min={0} max={500} value={d.spreadMarkupBps}
                  onChange={(e) => set('spreadMarkupBps', Number(e.target.value))} />
              </Field>
              <Field id="ed-maxv" label={`Max order value (${d.currency})`} error={err('limits.maxOrderValue')}>
                <input id="ed-maxv" type="number" min={1} placeholder="unlimited" value={d.limits.maxOrderValue ?? ''}
                  onChange={(e) => set('limits', { ...d.limits, maxOrderValue: parseLimit(e.target.value) })} />
              </Field>
              <Field id="ed-maxo" label="Max pending orders per client" error={err('limits.maxOpenOrders')}>
                <input id="ed-maxo" type="number" min={0} max={1000} placeholder="unlimited" value={d.limits.maxOpenOrders ?? ''}
                  onChange={(e) => set('limits', { ...d.limits, maxOpenOrders: parseLimit(e.target.value) })} />
              </Field>
            </div>
          </fieldset>

          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={save.isPending || dirty.length === 0}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn btn--ghost" type="button" disabled={dirty.length === 0}
              onClick={() => { setDraft(structuredClone(saved)); save.reset() }}>Reset</button>
            <button className="btn btn--ghost" type="button" onClick={onClose}>Close</button>
            <span className="muted">Changes are live for the next request: spreads, limits, features and branding.</span>
          </div>
        </form>

        <div className="stack">
          <aside className="broker-preview" aria-label="Live preview" style={previewStyle}>
            <header><img src={broker.logoUrl} alt="" /> {d.name || '…'}</header>
            <span className="muted">{d.tagline}</span>
            <div className="panel">
              <div className="row spread"><span>NVDA</span><span className="up">+1.24%</span></div>
              <div className="row spread"><span>BTCUSD</span><span className="down">−0.87%</span></div>
              <span className="muted">{d.allowedAssetClasses.length} asset classes · {d.spreadMarkupBps} bps</span>
            </div>
            <div className="row">
              {FEATURE_FIELDS.filter((f) => d.features[f.key]).map((f) => <span key={f.key} className="chip">{f.label}</span>)}
            </div>
            <button type="button" tabIndex={-1}>{d.features.trading ? 'Buy' : 'View portfolio'}</button>
          </aside>
          <section className="card">
            <h3>Change log</h3>
            <ul className="audit">
              {changes.length === 0 && <li className="muted">No changes yet.</li>}
              {changes.map((c) => (
                <li key={c.changedAt}>
                  <strong>{c.changedBy}</strong> <span className="muted">{new Date(c.changedAt).toLocaleString(tenant.locale)}</span>
                  <ul>{c.changes.map((line, i) => <li key={i}>{line}</li>)}</ul>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  )
}
