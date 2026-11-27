import { useSyncExternalStore } from 'react'
import type { TokenResponse, UserProfile } from '../api/types'
import { createStore } from './externalStore'

export interface Session {
  token: string
  user: UserProfile
  expiresAt: number
}

const KEY = 'tc.session'

function restore(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as Session) : null
    return s && s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

/** The session lives outside React; components subscribe with useSyncExternalStore. */
export const sessionStore = createStore<Session | null>(restore())

export function saveSession(res: TokenResponse): void {
  const session: Session = { token: res.accessToken, user: res.user, expiresAt: Date.now() + res.expiresIn * 1000 }
  sessionStorage.setItem(KEY, JSON.stringify(session))
  sessionStore.set(session)
}

export function logout(): void {
  sessionStorage.removeItem(KEY)
  sessionStore.set(null)
}

export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

export function useAuth() {
  const session = useSession()
  return {
    session,
    user: session?.user ?? null,
    isLoggedIn: session !== null,
    isTrader: session?.user.roles.includes('TRADER') ?? false,
    isAdmin: session?.user.roles.includes('ADMIN') ?? false,
  }
}

/** Decoded JWT payload for the developer panel (display only, never for security decisions). */
export function decodeClaims(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}
