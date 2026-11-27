import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { problemInterceptor } from '../core/interceptors';
import { platformInterceptor } from './platform-auth';

/** The platform console is a separate application: no router, no tenant, no broker theme. */
export const platformConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([platformInterceptor, problemInterceptor])),
  ],
};
