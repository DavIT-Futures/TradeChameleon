import '../../shared/styles/tradechameleon.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { Navigate, createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { ApiError } from './api/client'
import { RequireAuth, RequireFeature } from './components/Guards'
import { Toasts } from './components/Toasts'
import { TenantProvider } from './core/TenantProvider'
import { showToast } from './core/toast'

/**
 * TanStack Query = server-state cache. Retries 503s (the simulator's injected failures) twice,
 * never retries 4xx, and reports 5xx/network errors globally (like the Angular problem interceptor).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, error) => (error instanceof ApiError ? error.status === 503 && count < 2 : count < 1),
      retryDelay: (attempt) => 250 * (attempt + 1),
    },
  },
})
const report = (error: unknown) => {
  if (error instanceof ApiError && error.status >= 500) {
    showToast('error', error.problem.title ?? 'Error', error.problem.detail)
  } else if (!(error instanceof ApiError)) {
    showToast('error', 'Network error', 'The API is not reachable. Is the backend running?')
  }
}
queryClient.getQueryCache().config.onError = report
queryClient.getMutationCache().config.onError = (error) => {
  if (error instanceof ApiError && error.status >= 500) report(error)
}

/** Data router with lazy routes: each page is its own chunk (React.lazy under the hood). */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  { path: '/login', lazy: page(() => import('./pages/Login')) },
  {
    path: '/',
    element: <RequireAuth><ShellRoute /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', lazy: page(() => import('./pages/Dashboard')) },
      { path: 'markets', lazy: page(() => import('./pages/Markets')) },
      { path: 'markets/:symbol', lazy: page(() => import('./pages/Instrument')) },
      { path: 'screener', lazy: page(() => import('./pages/Screener')) },
      { path: 'compare', lazy: page(() => import('./pages/Compare')) },
      { path: 'calendar', lazy: page(() => import('./pages/Calendar')) },
      { path: 'news', lazy: page(() => import('./pages/News')) },
      { path: 'portfolio', lazy: page(() => import('./pages/Portfolio')) },
      { path: 'account', lazy: page(() => import('./pages/Account')) },
      { path: 'alerts', lazy: page(() => import('./pages/Alerts')) },
      { path: 'dev', element: <RequireFeature flag="simulatorPanel"><DevRoute /></RequireFeature> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

const Shell = lazy(() => import('./pages/Shell'))
const DevPanel = lazy(() => import('./pages/DevPanel'))
function ShellRoute() {
  return <Suspense fallback={null}><Shell /></Suspense>
}
function DevRoute() {
  return <Suspense fallback={null}><DevPanel /></Suspense>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <RouterProvider router={router} />
        <Toasts />
      </TenantProvider>
    </QueryClientProvider>
  </StrictMode>,
)
