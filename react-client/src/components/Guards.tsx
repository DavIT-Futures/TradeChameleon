import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Features } from '../api/types'
import { useAuth } from '../core/auth'
import { useTenant } from '../core/TenantProvider'

/** Route guard as a component: logged in AND logged in at this broker (tokens are tenant-bound). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { tenant } = useTenant()
  const location = useLocation()
  // A session of another broker is useless here: the API would answer 403 tenant-mismatch.
  if (!session || session.user.tenant !== tenant.id) {
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`} replace />
  }
  return children
}

/** The route exists only for brokers with the given feature flag. */
export function RequireFeature({ flag, children }: { flag: keyof Features; children: ReactNode }) {
  const { tenant } = useTenant()
  return tenant.features[flag] ? children : <Navigate to="/dashboard" replace />
}
