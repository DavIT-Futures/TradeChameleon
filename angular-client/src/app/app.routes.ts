import { Routes } from '@angular/router';
import { authGuard, featureGuard } from './core/guards';

/** Every page is lazy-loaded with loadComponent: one JS chunk per screen. */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.Login), title: 'Sign in' },
  {
    path: '',
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard), title: 'Dashboard' },
      { path: 'markets', loadComponent: () => import('./features/markets/markets').then((m) => m.Markets), title: 'Markets' },
      { path: 'markets/:symbol', loadComponent: () => import('./features/instrument/instrument').then((m) => m.Instrument), title: 'Instrument' },
      { path: 'portfolio', loadComponent: () => import('./features/portfolio/portfolio').then((m) => m.Portfolio), title: 'Portfolio' },
      { path: 'account', loadComponent: () => import('./features/account/account').then((m) => m.Account), title: 'Account' },
      { path: 'alerts', loadComponent: () => import('./features/alerts/alerts').then((m) => m.Alerts), title: 'Alerts' },
      {
        path: 'dev',
        canActivate: [featureGuard('simulatorPanel')],
        loadComponent: () => import('./features/dev/dev-panel').then((m) => m.DevPanel),
        title: 'Developer',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
