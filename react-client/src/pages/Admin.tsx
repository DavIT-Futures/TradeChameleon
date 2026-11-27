import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../api/client'
import { queries } from '../api/queries'
import { BrokerEditor } from '../components/BrokerEditor'
import { UserManager } from '../components/UserManager'
import { useAuth } from '../core/auth'
import { useTenant } from '../core/TenantProvider'

/**
 * The maintainer's Admin page on their broker's own site: this broker and nothing else. The API
 * (/api/tenant-admin/**) takes the broker from the request, so there is no id to tamper with.
 */
export default function Admin() {
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: broker } = useQuery(queries.tenantAdminBroker())

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1>Admin · {tenant.name}</h1>
          <p className="muted">You maintain this broker: its branding, catalogue, tools, limits and users. Other brokers are managed in the platform console.</p>
        </div>
      </div>
      {broker && (
        <>
          <section className="card">
            <div className="row">
              <span className="badge">{broker.users} users</span>
              <span className="badge">{broker.traders} traders</span>
              <span className="badge">{broker.instruments} instruments</span>
              <span className="badge">{broker.openOrders} open orders</span>
              <span className="badge">{broker.filledOrders} filled orders</span>
            </div>
          </section>
          <BrokerEditor
            key={broker.id}
            broker={broker}
            heading="Settings"
            saveSettings={(body) => unwrap(api.PUT('/api/tenant-admin/broker', { body }))}
            changes={queries.tenantAdminChanges()}
            options={queries.tenantAdminOptions()}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: queries.tenantAdminBroker().queryKey })
              // The maintainer is looking at their own broker: re-skin the site right away.
              void queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] })
            }}
          />
          <UserManager
            selfId={user?.id ?? null}
            userApi={{
              list: queries.tenantAdminUsers(),
              create: (body) => unwrap(api.POST('/api/tenant-admin/users', { body })),
              update: (userId, body) => unwrap(api.PUT('/api/tenant-admin/users/{userId}', { params: { path: { userId } }, body })),
              remove: async (userId) => { await unwrap(api.DELETE('/api/tenant-admin/users/{userId}', { params: { path: { userId } } })) },
            }}
            onChanged={() => {
              void queryClient.invalidateQueries({ queryKey: queries.tenantAdminChanges().queryKey })
              void queryClient.invalidateQueries({ queryKey: queries.tenantAdminBroker().queryKey })
            }}
          />
        </>
      )}
    </div>
  )
}
