import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import { ApiError, unwrap } from '../api/client'
import { buildMatrix, featureScore } from '../components/adminMatrix'
import { BrokerEditor } from '../components/BrokerEditor'
import { UserManager } from '../components/UserManager'
import { formatMoney } from '../core/format'
import { platformApi, platformLogin, platformLogout, platformQueries, usePlatformSession } from './platformApi'

/** Root of the platform console application (admin.localhost): its own login, its own header. */
export default function PlatformApp() {
  const session = usePlatformSession()
  useEffect(() => {
    document.title = 'Platform console · TradeChameleon'
    document.documentElement.dataset.tenant = 'platform'
  }, [])

  if (!session) return <PlatformLogin />
  return (
    <div className="platform">
      <header className="platform__bar">
        <strong>🦎 TradeChameleon <span className="muted">· Platform console</span></strong>
        <span className="row">
          <span>{session.user.name}</span><span className="badge">SUPER ADMIN</span>
          <button className="btn btn--ghost btn--small" type="button" onClick={platformLogout}>Sign out</button>
        </span>
      </header>
      <main><PlatformConsole /></main>
    </div>
  )
}

/** pulse -> http://pulse.localhost:5173/login (same protocol and port as the console). */
const siteUrl = (id: string) => `${location.protocol}//${id}.localhost${location.port ? ':' + location.port : ''}/login`

function PlatformLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({ mutationFn: () => platformLogin(email, password) })
  const problem = login.error instanceof ApiError ? login.error.problem : null
  // Public list of brokers: links to each white-label site from the console's login screen.
  const { data: sites = [] } = useQuery({ queryKey: ['platform', 'sites'], queryFn: () => unwrap(platformApi.GET('/api/tenants')) })

  return (
    <main className="platform-login">
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); login.mutate() }}>
        <h1>🦎 Platform console</h1>
        <p className="muted">Super admin of all TradeChameleon brokers. Broker maintainers use the Admin page on their own site.</p>
        {problem && <div className="alert alert--error">{problem.detail ?? problem.title}</div>}
        <div className="field"><label htmlFor="p-email">E-mail</label>
          <input id="p-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="p-pass">Password</label>
          <input id="p-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn" type="submit" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button>
        <button className="btn btn--ghost btn--small" type="button"
          onClick={() => { setEmail('admin@tradechameleon.com'); setPassword('demo') }}>Demo: admin@tradechameleon.com / demo</button>
        <nav className="platform-sites" aria-label="Broker sites">
          <span className="muted">Broker sites</span>
          {sites.map((t) => (
            <a key={t.id} href={siteUrl(t.id)} style={{ '--b-primary': t.theme.primary } as CSSProperties} title={t.tagline}>
              <img src={t.logoUrl} alt="" /> <span>{t.name}<small>{t.id}.localhost</small></span>
            </a>
          ))}
        </nav>
      </form>
    </main>
  )
}

/** All brokers side by side, differences highlighted, each one editable (role ADMIN, platform token). */
function PlatformConsole() {
  const queryClient = useQueryClient()
  const { data: brokers = [] } = useQuery(platformQueries.tenants())
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const all = buildMatrix(brokers, (v, c) => formatMoney(v, c, 'en-GB'))
  const rows = onlyDifferences ? all.filter((r) => r.differs) : all
  const editing = brokers.find((b) => b.id === editingId) ?? null

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Brokers</h1>
          <p className="muted">One code base, {brokers.length} brands. Pick a broker to edit it; changes are live immediately.</p>
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

      {editing && (
        <>
        <BrokerEditor
          key={editing.id}
          broker={editing}
          heading={`Edit ${editing.name}`}
          saveSettings={(body) => unwrap(platformApi.PUT('/api/platform/tenants/{id}', { params: { path: { id: editing.id } }, body }))}
          changes={platformQueries.changes(editing.id)}
          options={platformQueries.options()}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: platformQueries.tenants().queryKey })}
          onClose={() => setEditingId(null)}
        />
        <UserManager
          key={`users-${editing.id}`}
          selfId={null}
          userApi={{
            list: platformQueries.users(editing.id),
            create: (body) => unwrap(platformApi.POST('/api/platform/tenants/{id}/users', { params: { path: { id: editing.id } }, body })),
            update: (userId, body) =>
              unwrap(platformApi.PUT('/api/platform/tenants/{id}/users/{userId}', { params: { path: { id: editing.id, userId } }, body })),
            remove: async (userId) => {
              await unwrap(platformApi.DELETE('/api/platform/tenants/{id}/users/{userId}', { params: { path: { id: editing.id, userId } } }))
            },
          }}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: platformQueries.changes(editing.id).queryKey })
            void queryClient.invalidateQueries({ queryKey: platformQueries.tenants().queryKey })
          }}
        />
        </>
      )}

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
