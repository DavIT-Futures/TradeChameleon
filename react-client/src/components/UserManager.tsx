import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../api/client'
import type { ManagedUser, NewUser, Role, UserUpdate } from '../api/types'
import { showToast } from '../core/toast'
import { ROLES, selfLockout, sortUsers, summary, toggleRole } from './userAdmin'

/** The four calls of a user list; the maintainer page and the platform console pass their own API. */
export interface UserApi {
  list: UseQueryOptions<ManagedUser[], Error, ManagedUser[], readonly unknown[]>
  create(user: NewUser): Promise<ManagedUser>
  update(id: string, update: UserUpdate): Promise<ManagedUser>
  remove(id: string): Promise<void>
}

interface RowDraft {
  name: string
  roles: Role[]
  enabled: boolean
  password: string
}

/**
 * Users of one broker: create, change roles, disable, reset the password, delete.
 * `selfId` is the signed-in user's id on the maintainer page, null in the platform console.
 */
export function UserManager({ userApi, selfId, onChanged }: { userApi: UserApi; selfId: string | null; onChanged?(): void }) {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery(userApi.list)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<NewUser>({ email: '', name: '', password: '', roles: ['TRADER'] })
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const done = (title: string, detail: string) => {
    showToast('success', title, detail)
    void queryClient.invalidateQueries({ queryKey: userApi.list.queryKey })
    // audit entries are written asynchronously
    setTimeout(() => onChanged?.(), 800)
  }
  const fail = (e: unknown) => {
    if (e instanceof ApiError && !e.problem.errors) showToast('error', e.problem.title ?? 'Request failed', e.problem.detail)
  }

  const create = useMutation({
    mutationFn: userApi.create,
    onSuccess: (u) => {
      setCreating(false)
      setForm({ email: '', name: '', password: '', roles: ['TRADER'] })
      done('User created', u.email)
    },
    onError: fail,
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdate }) => userApi.update(id, body),
    onSuccess: (u) => {
      setDrafts(({ [u.id]: _, ...rest }) => rest)
      done('User updated', u.email)
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (u: ManagedUser) => userApi.remove(u.id),
    onSuccess: (_, u) => {
      setConfirmDelete(null)
      done('User deleted', u.email)
    },
    onError: fail,
  })

  const problem = create.error instanceof ApiError ? create.error.problem : null
  const err = (path: string) => problem?.errors?.[path] ?? null
  const draftOf = (u: ManagedUser): RowDraft => drafts[u.id] ?? { name: u.name, roles: [...u.roles], enabled: u.enabled, password: '' }
  const patch = (u: ManagedUser, change: Partial<RowDraft>) => setDrafts((all) => ({ ...all, [u.id]: { ...draftOf(u), ...change } }))
  const dirty = (u: ManagedUser) => {
    const d = drafts[u.id]
    return !!d && (d.name !== u.name || d.enabled !== u.enabled || d.password !== '' || d.roles.join() !== u.roles.join())
  }

  return (
    <section className="card">
      <div className="row spread">
        <h2>Users <small className="muted">{summary(users)}</small></h2>
        <button className="btn btn--small" type="button" onClick={() => setCreating(!creating)}>{creating ? 'Cancel' : '+ New user'}</button>
      </div>

      {creating && (
        <form className="user-new" noValidate onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}>
          <div className="field"><label htmlFor="u-email">E-mail</label>
            <input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {err('email') && <span className="field__error">{err('email')}</span>}</div>
          <div className="field"><label htmlFor="u-name">Name</label>
            <input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {err('name') && <span className="field__error">{err('name')}</span>}</div>
          <div className="field"><label htmlFor="u-pass">Password</label>
            <input id="u-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {err('password') && <span className="field__error">{err('password')}</span>}</div>
          <div className="field"><span className="label">Roles</span>
            <div className="row">
              {ROLES.map((r) => (
                <label key={r.key} className="check" title={r.hint}>
                  <input type="checkbox" checked={form.roles.includes(r.key)} onChange={() => setForm({ ...form, roles: toggleRole(form.roles, r.key) })} /> {r.label}
                </label>
              ))}
            </div>
            {err('roles') && <span className="field__error">{err('roles')}</span>}</div>
          <button className="btn btn--primary" type="submit" disabled={create.isPending}>Create user</button>
          {problem?.detail && !problem.errors && <div className="alert alert--error">{problem.detail}</div>}
        </form>
      )}

      <div className="table-wrap">
        <table className="table users-table">
          <thead><tr><th>User</th><th>Roles</th><th>Enabled</th><th>New password</th><th /></tr></thead>
          <tbody>
            {sortUsers(users).map((u) => {
              const d = draftOf(u)
              const why = selfLockout(u, selfId, d)
              return (
                <tr key={u.id} className={u.enabled ? undefined : 'is-disabled'}>
                  <td>
                    <input className="inline" value={d.name} onChange={(e) => patch(u, { name: e.target.value })} aria-label="Name" />
                    <small className="muted">{u.email}{u.id === selfId && ' · you'}</small>
                  </td>
                  <td>
                    <div className="row">
                      {ROLES.map((r) => (
                        <label key={r.key} className="check" title={r.hint}>
                          <input type="checkbox" checked={d.roles.includes(r.key)} onChange={() => patch(u, { roles: toggleRole(d.roles, r.key) })} /> {r.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={d.enabled} onChange={(e) => patch(u, { enabled: e.target.checked })} /> {d.enabled ? 'Active' : 'Disabled'}
                    </label>
                  </td>
                  <td>
                    <input className="inline" type="password" placeholder="keep" autoComplete="new-password" value={d.password}
                      onChange={(e) => patch(u, { password: e.target.value })} aria-label="New password" />
                  </td>
                  <td className="actions-cell">
                    {why ? <small className="field__error">{why}</small>
                      : dirty(u) && (
                        <button className="btn btn--small" type="button"
                          onClick={() => update.mutate({ id: u.id, body: { name: d.name, roles: d.roles, enabled: d.enabled, password: d.password || null } })}>Save</button>
                      )}
                    {confirmDelete === u.id ? (
                      <>
                        <button className="btn btn--small btn--sell" type="button" onClick={() => remove.mutate(u)}>Confirm delete</button>
                        <button className="btn btn--ghost btn--small" type="button" onClick={() => setConfirmDelete(null)}>No</button>
                      </>
                    ) : !selfLockout(u, selfId, 'delete') && (
                      <button className="btn btn--ghost btn--small" type="button" onClick={() => setConfirmDelete(u.id)} aria-label={`Delete ${u.email}`}>🗑</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: '.8rem' }}>
        Deleting a user cancels their open orders and removes alerts and watchlist; their account history is kept.
        A disabled user cannot sign in; a token issued earlier stays valid until it expires.
      </p>
    </section>
  )
}
