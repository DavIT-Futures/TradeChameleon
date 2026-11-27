import { queryOptions } from '@tanstack/react-query'
import createClient, { type Middleware } from 'openapi-fetch'
import { useSyncExternalStore } from 'react'
import { unwrap } from '../api/client'
import type { paths } from '../api/schema'
import type { TokenResponse, UserProfile } from '../api/types'
import { createStore } from '../core/externalStore'

/**
 * Session and HTTP client of the platform console (super admin). Separate from the broker site on
 * purpose: different login endpoint, different token kind (no tenant, platform=true), no X-Tenant-Id,
 * different storage key.
 */
interface PlatformSession {
  token: string
  user: UserProfile
  expiresAt: number
}

const KEY = 'tc.platform-session'

function restore(): PlatformSession | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as PlatformSession | null
    return s && s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

export const platformSession = createStore<PlatformSession | null>(restore())

export function usePlatformSession(): PlatformSession | null {
  return useSyncExternalStore(platformSession.subscribe, platformSession.get)
}

export function platformLogout(): void {
  sessionStorage.removeItem(KEY)
  platformSession.set(null)
}

const bearer: Middleware = {
  onRequest({ request }) {
    const token = platformSession.get()?.token
    if (token && !new URL(request.url).pathname.startsWith('/api/platform/auth/')) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
  onResponse({ response, request }) {
    if (response.status === 401 && !new URL(request.url).pathname.startsWith('/api/platform/auth/')) platformLogout()
    return response
  },
}

export const platformApi = createClient<paths>({ baseUrl: window.location.origin })
platformApi.use(bearer)

export async function platformLogin(username: string, password: string): Promise<void> {
  const res: TokenResponse = await unwrap(platformApi.POST('/api/platform/auth/token', { body: { username, password } }))
  const s: PlatformSession = { token: res.accessToken, user: res.user, expiresAt: Date.now() + res.expiresIn * 1000 }
  sessionStorage.setItem(KEY, JSON.stringify(s))
  platformSession.set(s)
}

export const platformQueries = {
  tenants: () =>
    queryOptions({ queryKey: ['platform', 'tenants'], queryFn: () => unwrap(platformApi.GET('/api/platform/tenants')), refetchInterval: 10_000 }),
  options: () =>
    queryOptions({ queryKey: ['platform', 'options'], queryFn: () => unwrap(platformApi.GET('/api/platform/settings-options')), staleTime: Infinity }),
  users: (id: string) =>
    queryOptions({
      queryKey: ['platform', 'users', id],
      queryFn: () => unwrap(platformApi.GET('/api/platform/tenants/{id}/users', { params: { path: { id } } })),
    }),
  changes: (id: string) =>
    queryOptions({
      queryKey: ['platform', 'changes', id],
      queryFn: () => unwrap(platformApi.GET('/api/platform/tenants/{id}/changes', { params: { path: { id }, query: { limit: 20 } } })),
    }),
}
