import { dismissToast, useToasts } from '../core/toast'

export function Toasts() {
  const toasts = useToasts()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`alert ${t.kind === 'error' ? 'alert--error' : t.kind === 'success' ? 'alert--success' : ''}`}>
          <div className="row spread">
            <strong>{t.title}</strong>
            <button className="btn btn--ghost btn--small" onClick={() => dismissToast(t.id)} aria-label="Dismiss">×</button>
          </div>
          {t.detail && <div>{t.detail}</div>}
        </div>
      ))}
    </div>
  )
}
