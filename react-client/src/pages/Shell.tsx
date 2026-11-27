import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAlertNotifications } from '../core/alerts'
import { logout, useAuth } from '../core/auth'
import { loadWatchlist } from '../core/watchlist'
import { connectStream, useStream } from '../core/priceStream'
import { useTenant } from '../core/TenantProvider'

/** Authenticated layout: brand, navigation, user and the live-price connection. */
export default function Shell() {
  const { tenant, scheme, cycleScheme } = useTenant()
  const { user, isMaintainer } = useAuth()
  const f = tenant.features
  const { status } = useStream()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => connectStream(), [])
  useEffect(() => void loadWatchlist().catch(() => undefined), [])
  useAlertNotifications(tenant.features.alerts)

  const signOut = () => {
    logout()
    queryClient.clear()
    void navigate('/login')
  }

  return (
    <div className="shell">
      <div className="shell__brand">
        <img src={tenant.logoUrl} alt="" />
        <div><strong>{tenant.name}</strong><small>{tenant.locale} · {tenant.currency}</small></div>
      </div>
      <header className="shell__top">
        <div className="row">
          <span className={`status-dot ${status === 'live' ? 'live' : status === 'error' ? 'error' : ''}`} />
          <span className="muted">{status === 'live' ? 'Live prices' : status}</span>
          {!tenant.features.trading && <span className="badge badge--accent">Portfolio only</span>}
        </div>
        <div className="row">
          {user && <span>{user.name} <span className="badge">{user.roles.join(', ')}</span></span>}
          <button className="btn btn--ghost btn--small" type="button" onClick={cycleScheme}
            aria-label={`Colour scheme: ${scheme}`} title={`Colour scheme: ${scheme}`}>
            {scheme === 'dark' ? '☾' : scheme === 'light' ? '☀' : '◐'}
          </button>
          <button className="btn btn--ghost btn--small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <nav className="shell__nav" aria-label="Main">
        <NavLink to="/dashboard">▦ Dashboard</NavLink>
        <NavLink to="/markets" end={false}>↗ Markets</NavLink>
        {f.screener && <NavLink to="/screener">⌕ Screener</NavLink>}
        {f.compare && <NavLink to="/compare">⇄ Compare</NavLink>}
        {f.calendar && <NavLink to="/calendar">▤ Calendar</NavLink>}
        {f.news && <NavLink to="/news">✎ News</NavLink>}
        <NavLink to="/portfolio">◔ Portfolio</NavLink>
        <NavLink to="/account">≡ Account</NavLink>
        {f.alerts && <NavLink to="/alerts">🔔 Alerts</NavLink>}
        {f.simulatorPanel && <NavLink to="/dev">⚙ Developer</NavLink>}
        {isMaintainer && <NavLink to="/admin">🛠 Admin</NavLink>}
      </nav>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  )
}
