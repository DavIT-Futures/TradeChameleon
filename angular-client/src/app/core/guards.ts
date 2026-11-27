import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Features } from '../api/types';
import { AuthService } from './auth';
import { TenantService } from './tenant';

/** Functional guard: logged in AND logged in at this broker (tokens are tenant-bound). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const tenant = inject(TenantService);
  if (auth.isLoggedIn() && auth.tenantId() !== tenant.id()) {
    auth.logout();
  }
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** The broker's own admin page: maintainers only (role MAINTAINER). */
export const maintainerGuard: CanActivateFn = () =>
  inject(AuthService).isMaintainer() ? true : inject(Router).createUrlTree(['/dashboard']);

/** Guard factory: the route exists only for brokers with the given feature flag. */
export function featureGuard(flag: keyof Features): CanActivateFn {
  return () => (inject(TenantService).features()?.[flag] ? true : inject(Router).createUrlTree(['/dashboard']));
}
