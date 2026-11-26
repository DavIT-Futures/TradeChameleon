import createClient, { type Middleware } from 'openapi-fetch'
import { logout, sessionStore } from '../core/auth'
import { getRequestedTenant } from '../core/tenant'
import type { paths } from './schema'
import type { Problem } from './types'

/** Error carrying the RFC 9457 Problem Details body returned by the API. */
export class ApiError extends Error {
  readonly problem: Problem
  constructor(problem: Problem) {
    super(problem.detail ?? problem.title ?? 'Request failed')
    this.problem = problem
  }
  get status(): number {
    return this.problem.status ?? 0
  }
}

/** Equivalent of the Angular functional interceptors: tenant header, bearer token, 401 handling. */
const tenantAndAuth: Middleware = {
  onRequest({ request }) {
    const tenant = getRequestedTenant()
    if (tenant) request.headers.set('X-Tenant-Id', tenant)
    const token = sessionStore.get()?.token
    if (token && !new URL(request.url).pathname.startsWith('/api/auth/')) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
  onResponse({ response, request }) {
    if (response.status === 401 && !new URL(request.url).pathname.startsWith('/api/auth/')) {
      logout()
    }
    return response
  },
}

/**
 * Fully typed HTTP client generated from the OpenAPI document: paths, params, bodies and responses
 * are checked by the compiler. `GET('/api/market/instruments/{symbol}', { params: { path: { symbol } } })`.
 */
export const api = createClient<paths>({ baseUrl: window.location.origin })
api.use(tenantAndAuth)

/** Unwraps openapi-fetch's { data, error } into "data or throw ApiError" for TanStack Query. */
export async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await promise
  if (error !== undefined || !response.ok) {
    const problem: Problem =
      error && typeof error === 'object' ? (error as Problem) : { status: response.status, title: response.statusText }
    throw new ApiError({ status: response.status, ...problem })
  }
  return data as T
}
