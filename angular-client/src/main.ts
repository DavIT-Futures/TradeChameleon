import { bootstrapApplication } from '@angular/platform-browser';

/**
 * Two applications in one bundle, chosen by address:
 * - admin.localhost:4200      the platform console (super admin, all brokers)
 * - <broker>.localhost:4200   the white-label trading site of one broker
 * Dynamic imports keep each one's code out of the other's initial download.
 */
if (location.hostname.startsWith('admin.')) {
  const [{ PlatformApp }, { platformConfig }] = await Promise.all([
    import('./app/platform/platform'),
    import('./app/platform/platform.config'),
  ]);
  bootstrapApplication(PlatformApp, platformConfig).catch((err) => console.error(err));
} else {
  const [{ App }, { appConfig }] = await Promise.all([import('./app/app'), import('./app/app.config')]);
  bootstrapApplication(App, appConfig).catch((err) => console.error(err));
}
