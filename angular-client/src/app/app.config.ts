import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor, problemInterceptor, tenantInterceptor } from './core/interceptors';
import { TenantService } from './core/tenant';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No zone.js: change detection is driven by signals (and events/async pipe).
    provideZonelessChangeDetection(),
    // Route params and query params arrive as component inputs (symbol = input.required<string>()).
    provideRouter(routes, withComponentInputBinding()),
    // Functional interceptors run in this order for requests (and in reverse for responses).
    provideHttpClient(withFetch(), withInterceptors([tenantInterceptor, authInterceptor, problemInterceptor])),
    // Resolve the broker (and apply its theme) before the first render.
    provideAppInitializer(() => inject(TenantService).load()),
  ],
};
