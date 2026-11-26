import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AlertNotifier } from '../../core/alerts';
import { AuthService } from '../../core/auth';
import { WatchlistService } from '../../core/watchlist';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';

/** Authenticated layout: brand, navigation, user menu and the live-price connection. */
@Component({
  selector: 'tc-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      @if (tenant.tenant(); as t) {
        <div class="shell__brand">
          <img [src]="t.logoUrl" alt="" />
          <div><strong>{{ t.name }}</strong><small>{{ t.locale }} · {{ t.currency }}</small></div>
        </div>
      }
      <header class="shell__top">
        <div class="row">
          <span class="status-dot" [class.live]="stream.status() === 'live'" [class.error]="stream.status() === 'error'"></span>
          <span class="muted">{{ stream.status() === 'live' ? 'Live prices' : stream.status() }}</span>
          @if (!tenant.features()?.trading) { <span class="badge badge--accent">Portfolio only</span> }
        </div>
        <div class="row">
          @if (auth.user(); as u) {
            <span>{{ u.name }} <span class="badge">{{ u.roles.join(', ') }}</span></span>
          }
          <button class="btn btn--ghost btn--small" (click)="logout()">Sign out</button>
        </div>
      </header>
      <nav class="shell__nav" aria-label="Main">
        <a routerLink="/dashboard" routerLinkActive="active">▦ Dashboard</a>
        <a routerLink="/markets" routerLinkActive="active">↗ Markets</a>
        <a routerLink="/portfolio" routerLinkActive="active">◔ Portfolio</a>
        <a routerLink="/account" routerLinkActive="active">≡ Account</a>
        <a routerLink="/alerts" routerLinkActive="active">🔔 Alerts</a>
        @if (tenant.features()?.simulatorPanel) {
          <a routerLink="/dev" routerLinkActive="active">⚙ Developer</a>
        }
      </nav>
      <main class="shell__main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected readonly tenant = inject(TenantService);
  protected readonly auth = inject(AuthService);
  protected readonly stream = inject(PriceStreamService);
  private readonly router = inject(Router);
  private readonly watchlist = inject(WatchlistService);
  private readonly alerts = inject(AlertNotifier);

  ngOnInit(): void {
    this.stream.connect();
    void this.watchlist.load();
    this.alerts.start();
  }

  ngOnDestroy(): void {
    this.stream.disconnect();
    this.alerts.stop();
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
