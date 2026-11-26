import type { Tenant, Theme } from '../api/types'

const STORAGE_KEY = 'tc.tenant'

/**
 * Which broker does this tab belong to? Same order as the backend:
 * 1. *.localhost subdomain  2. ?tenant=  3. last choice (localStorage)  4. null = backend default.
 */
export function resolveTenantFromLocation(
  location: Pick<Location, 'hostname' | 'search'>,
  storage?: Storage,
): string | null {
  const host = location.hostname
  if (host.endsWith('.localhost')) {
    const labels = host.slice(0, -'.localhost'.length).split('.')
    return labels[labels.length - 1]
  }
  const fromQuery = new URLSearchParams(location.search).get('tenant')
  if (fromQuery) {
    storage?.setItem(STORAGE_KEY, fromQuery)
    return fromQuery
  }
  return storage?.getItem(STORAGE_KEY) ?? null
}

/** Module-level value read by the API client middleware (no React needed there). */
let requestedTenant: string | null =
  typeof window === 'undefined' ? null : resolveTenantFromLocation(window.location, window.localStorage)

export function getRequestedTenant(): string | null {
  return requestedTenant
}

export function setRequestedTenant(id: string): void {
  requestedTenant = id
  localStorage.setItem(STORAGE_KEY, id)
}

/** Writes the tenant theme into CSS custom properties. */
export function applyTheme(tenant: Tenant, root: HTMLElement = document.documentElement, theme: Theme = tenant.theme): void {
  const t = theme
  const vars: Record<string, string> = {
    '--tc-primary': t.primary,
    '--tc-on-primary': t.onPrimary,
    '--tc-accent': t.accent,
    '--tc-bg': t.background,
    '--tc-surface': t.surface,
    '--tc-text': t.text,
    '--tc-muted': t.muted,
    '--tc-positive': t.positive,
    '--tc-negative': t.negative,
    '--tc-radius': t.radius,
    '--tc-font-body': t.fontBody,
    '--tc-font-heading': t.fontHeading,
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  root.style.colorScheme = t.colorScheme
  root.lang = tenant.locale
  root.dataset.tenant = tenant.id
}
