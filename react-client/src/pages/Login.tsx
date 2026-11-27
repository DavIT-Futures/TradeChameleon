import { useMutation, useQuery } from '@tanstack/react-query'
import { useActionState, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import type { Problem } from '../api/types'
import { saveSession } from '../core/auth'
import { useTenant } from '../core/TenantProvider'

export default function Login() {
  const { tenant, switchTo, scheme, cycleScheme } = useTenant()
  const stage = useRef<HTMLElement>(null)

  /** Pointer position → CSS variables: the stage tilts and the orbs drift (pure CSS does the rest). */
  const tilt = (event: React.PointerEvent) => {
    const el = stage.current
    if (!el || event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = (event.clientX / el.clientWidth) * 2 - 1
    const y = (event.clientY / el.clientHeight) * 2 - 1
    el.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-y * 4).toFixed(2)}deg`)
    el.style.setProperty('--px', x.toFixed(3))
    el.style.setProperty('--py', y.toFixed(3))
  }
  const level = () => {
    for (const v of ['--rx', '--ry', '--px', '--py']) stage.current?.style.removeProperty(v)
  }
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const brands = useQuery(queries.tenants())
  const [credentials, setCredentials] = useState({ username: '', password: '' })

  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) => unwrap(api.POST('/api/auth/token', { body })),
    onSuccess: (res) => {
      saveSession(res)
      void navigate(params.get('returnUrl') ?? '/dashboard')
    },
  })

  /** React 19 form Action: the function receives FormData; isPending is tracked for us. */
  const [, submit, isPending] = useActionState(async (_: null, form: FormData) => {
    await login.mutateAsync({ username: String(form.get('username')), password: String(form.get('password')) }).catch(() => undefined)
    return null
  }, null)

  const problem: Problem | null = login.error instanceof ApiError ? login.error.problem : login.error ? { title: 'Network error', detail: login.error.message } : null
  const fill = (role: string) => setCredentials({ username: `${role}@${tenant.id}.test`, password: 'demo' })

  return (
    <main className="login" ref={stage} onPointerMove={tilt} onPointerLeave={level}>
      <div className="login__orb login__orb--a" aria-hidden="true" />
      <div className="login__orb login__orb--b" aria-hidden="true" />
      <div className="login__orb login__orb--c" aria-hidden="true" />
      <button className="btn btn--ghost btn--small login__scheme" type="button" onClick={cycleScheme}
        aria-label={`Colour scheme: ${scheme}`} title={`Colour scheme: ${scheme}`}>
        {scheme === 'dark' ? '☾' : scheme === 'light' ? '☀' : '◐'}
      </button>

      <div className="login__stage">
      <section className="login__hero" aria-label="Broker">
        <div className="login__logo"><img src={tenant.logoUrl} alt={`${tenant.name} logo`} /></div>
        <div className="login__floor" aria-hidden="true" />
        <h1>{tenant.name}</h1>
        <p className="login__tagline">{tenant.tagline}</p>
        <ul className="login__facts">
          <li>{tenant.locale}</li>
          <li>{tenant.currency}</li>
          <li>{tenant.allowedAssetClasses.length} asset classes</li>
          <li>{tenant.features.trading ? 'Trading' : 'Portfolio only'}</li>
        </ul>
      </section>

      <div className="login__card">
        <h2>Sign in</h2>

        <section aria-labelledby="brand-title" className="stack">
          <h3 id="brand-title" className="muted" style={{ fontSize: '.85rem' }}>Choose a broker</h3>
          <div className="brand-switcher">
            {brands.isPending && [1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ blockSize: 64 }} />)}
            {brands.data?.map((b) => (
              <button key={b.id} type="button" aria-pressed={b.id === tenant.id} onClick={() => { login.reset(); switchTo(b.id) }}>
                <img src={b.logoUrl} alt="" />
                {b.name}
              </button>
            ))}
          </div>
        </section>

        {params.get('reason') === 'expired' && <div className="alert">Your session expired. Please sign in again.</div>}
        {problem && (
          <div className="alert alert--error" role="alert"><strong>{problem.title}</strong>{problem.detail}</div>
        )}

        <form className="stack" action={submit}>
          <div className="field">
            <label htmlFor="username">E-mail</label>
            <input id="username" name="username" type="email" autoComplete="username" required
              value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required
              value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={isPending}>{isPending ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="stack">
          <span className="muted" style={{ fontSize: '.85rem' }}>Demo users (password <code>demo</code>)</span>
          <div className="demo-users">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => fill('trader')}>trader@{tenant.id}.test</button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => fill('viewer')}>viewer@{tenant.id}.test</button>
          </div>
        </div>
      </div>
      </div>
    </main>
  )
}
