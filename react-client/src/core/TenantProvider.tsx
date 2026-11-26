import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { api, unwrap } from '../api/client'
import type { Tenant } from '../api/types'
import { applyTheme, getRequestedTenant, setRequestedTenant } from './tenant'

interface TenantContextValue {
  tenant: Tenant
  switchTo(id: string): void
}

const TenantContext = createContext<TenantContextValue | null>(null)

/** Loads the broker, applies its theme and only then renders the app (no flash of the wrong brand). */
export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [requested, setRequested] = useState(getRequestedTenant)
  const { data: tenant, error } = useQuery({
    queryKey: ['tenant', 'current', requested],
    queryFn: () => unwrap(api.GET('/api/tenants/current')),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!tenant) return
    applyTheme(tenant)
    document.title = `${tenant.name} · React`
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) icon.href = tenant.logoUrl
  }, [tenant])

  if (error) return <div className="login"><div className="alert alert--error">The API is not reachable. Is the backend running?</div></div>
  if (!tenant) return null

  const switchTo = (id: string) => {
    const { protocol, hostname, port } = window.location
    if (hostname.endsWith('.localhost')) {
      window.location.href = `${protocol}//${id}.localhost${port ? ':' + port : ''}/login`
      return
    }
    setRequestedTenant(id)
    queryClient.clear() // every cached response belongs to the previous broker
    setRequested(id)
  }

  return <TenantContext value={{ tenant, switchTo }}>{children}</TenantContext>
}

/** React 19 `use()` reads context (and could read promises) - even conditionally. */
export function useTenant(): TenantContextValue {
  const ctx = use(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>')
  return ctx
}
