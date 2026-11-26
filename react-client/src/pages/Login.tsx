import { useMutation, useQuery } from '@tanstack/react-query'
import { useActionState, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import type { Problem } from '../api/types'
import { saveSession } from '../core/auth'
import { useTenant } from '../core/TenantProvider'

export default function Login() {
  const { tenant, switchTo } = useTenant()
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
    <main className="login">
      <div className="card login__card">
        <div className="login__brand">
          <img src={tenant.logoUrl} alt="" />
          <div>
            <h1>{tenant.name}</h1>
            <p className="muted">{tenant.tagline}</p>
          </div>
        </div>

        <section aria-labelledby="brand-title" className="stack">
          <h2 id="brand-title" className="muted" style={{ fontSize: '.85rem' }}>Choose a broker</h2>
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
    </main>
  )
}
