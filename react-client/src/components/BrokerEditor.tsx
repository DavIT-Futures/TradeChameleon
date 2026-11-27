import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import type { BrokerOverview, SettingsOptions, TenantChange, TenantSettings, Theme } from '../api/types'
import { showToast } from '../core/toast'
import {
  COLOR_FIELDS, FEATURE_FIELDS, LOCALES, changedFields, fieldError, parseLimit, radiusPx, toSettings, toggleClass,
} from './adminSettings'

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

export interface BrokerEditorProps {
  broker: BrokerOverview
  heading: string
  /** PUT to /api/tenant-admin/broker (maintainer) or /api/platform/tenants/{id} (super admin). */
  saveSettings(settings: TenantSettings): Promise<BrokerOverview>
  changes: UseQueryOptions<TenantChange[], Error, TenantChange[], readonly unknown[]>
  options: UseQueryOptions<SettingsOptions, Error, SettingsOptions, readonly unknown[]>
  onSaved?(updated: BrokerOverview): void
  onClose?(): void
}

/**
 * The form for one broker: a draft in state, a live preview, server-side validation errors per field.
 * Used by a maintainer on their broker's Admin page and by the super admin in the platform console;
 * the props decide which API it talks to.
 */
export function BrokerEditor({ broker, heading, saveSettings, changes: changesQuery, options: optionsQuery, onSaved, onClose }: BrokerEditorProps) {
  const queryClient = useQueryClient()
  const { data: options } = useQuery(optionsQuery)
  const { data: changes = [] } = useQuery(changesQuery)
  const [saved, setSaved] = useState(() => toSettings(broker))
  const [draft, setDraft] = useState(() => toSettings(broker))
  const dirty = changedFields(saved, draft)

  const save = useMutation({
    mutationFn: saveSettings,
    onSuccess: (updated) => {
      setSaved(toSettings(updated))
      setDraft(toSettings(updated))
      // The audit entry is written asynchronously by an event listener: read it again shortly after.
      void queryClient.invalidateQueries({ queryKey: changesQuery.queryKey })
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: changesQuery.queryKey }), 800)
      showToast('success', `${updated.name} saved`, 'Changes are live for the next request.')
      onSaved?.(updated)
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
        <h2>{heading} <small className="muted">({broker.id})</small></h2>
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
            {onClose && <button className="btn btn--ghost" type="button" onClick={onClose}>Close</button>}
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
                  <strong>{c.changedBy}</strong> <span className="muted">{new Date(c.changedAt).toLocaleString(broker.locale)}</span>
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
