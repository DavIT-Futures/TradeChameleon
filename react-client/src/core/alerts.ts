import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api, unwrap } from '../api/client'
import { showToast } from './toast'

/**
 * Polls GET /api/alerts/notifications while mounted, turns triggered alerts into toasts and
 * acknowledges them, then invalidates the cached alert list.
 */
export function useAlertNotifications(enabled = true, intervalMs = 4000): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const check = async () => {
      try {
        const fired = await unwrap(api.GET('/api/alerts/notifications'))
        for (const alert of fired) {
          if (cancelled) return
          showToast('info', `🔔 ${alert.symbol} ${alert.condition.toLowerCase()} ${alert.price}`,
            `Triggered at ${alert.triggeredPrice}${alert.note ? ' · ' + alert.note : ''}`, 10_000)
          await api.POST('/api/alerts/{id}/ack', { params: { path: { id: alert.id } } })
        }
        if (fired.length) void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === 'alerts' })
      } catch {
        /* reported globally */
      }
    }
    void check()
    const id = setInterval(() => void check(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, intervalMs, queryClient])
}
