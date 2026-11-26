import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthService } from './auth';
import { problemSlug, toProblem } from './problem';
import { TenantService } from './tenant';
import { ToastService } from './toast';

/** Adds X-Tenant-Id so the backend serves the right broker even though the dev proxy rewrites Host. */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const id = inject(TenantService).requestedId();
  return next(id ? req.clone({ setHeaders: { 'X-Tenant-Id': id } }) : req);
};

/** Attaches the bearer token; a 401 on a protected call means the token is gone or expired. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authReq = token && !req.url.startsWith('/api/auth/') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.startsWith('/api/auth/')) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { reason: 'expired' } });
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Resilience + global error reporting.
 * - GET requests failing with 503 (e.g. the simulator's injected failures) are retried twice with backoff.
 * - 5xx and network errors become a toast; 4xx are left to the calling component (forms show them inline).
 */
export const problemInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ToastService);
  return next(req).pipe(
    retry({
      count: req.method === 'GET' ? 2 : 0,
      delay: (error: unknown, attempt) =>
        error instanceof HttpErrorResponse && error.status === 503 ? timer(250 * attempt) : throwError(() => error),
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500)) {
        const problem = toProblem(error);
        toasts.show('error', problem.title ?? 'Error', `${problem.detail ?? ''} [${problemSlug(problem)}]`);
      }
      return throwError(() => error);
    }),
  );
};
