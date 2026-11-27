import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { BrokerOverview, Problem, Tenant } from '../api/types';
import { formatMoney } from '../core/format';
import { BrokerEditor } from '../features/admin/broker-editor';
import { UserManager } from '../features/admin/user-manager';
import { buildMatrix, featureScore } from '../shared/admin-matrix';
import { every } from '../shared/polling';
import { Toasts } from '../shared/toasts';
import { PlatformAuth } from './platform-auth';

/** All brokers side by side, differences highlighted, each one editable (role ADMIN, platform token). */
@Component({
  selector: 'tc-platform-console',
  imports: [BrokerEditor, UserManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Brokers</h1>
          <p class="muted">One code base, {{ brokers.value().length }} brands. Pick a broker to edit it; changes are live immediately.</p>
        </div>
        <label class="row"><input type="checkbox" [checked]="onlyDifferences()" (change)="onlyDifferences.set(!onlyDifferences())" /> Show only differences</label>
      </div>

      <section class="admin-brands">
        @for (b of brokers.value(); track b.id) {
          <article class="admin-brand" [class.is-editing]="editingId() === b.id"
                   [style.--b-primary]="b.theme.primary" [style.--b-accent]="b.theme.accent"
                   [style.--b-bg]="b.theme.background" [style.--b-surface]="b.theme.surface" [style.--b-text]="b.theme.text"
                   [style.--b-radius]="b.theme.radius" [style.font-family]="b.theme.fontHeading">
            <img [src]="b.logoUrl" alt="" />
            <div>
              <strong>{{ b.name }}</strong>
              <small>{{ b.id }} · {{ b.locale }} · {{ b.currency }}</small>
            </div>
            <span class="swatches" aria-hidden="true"><i class="p"></i><i class="a"></i><i class="bg"></i></span>
            <span class="score" [title]="'Enabled features + asset classes'">{{ score(b) }}</span>
            <button type="button" class="edit" [attr.aria-pressed]="editingId() === b.id"
                    (click)="editingId.set(editingId() === b.id ? null : b.id)">✎ Edit</button>
          </article>
        }
      </section>

      @if (editing(); as b) {
        <tc-broker-editor #editor [broker]="b" [heading]="'Edit ' + b.name"
                          [saveUrl]="'/api/platform/tenants/' + b.id" [changesUrl]="'/api/platform/tenants/' + b.id + '/changes'"
                          optionsUrl="/api/platform/settings-options" (saved)="brokers.reload()" (closed)="editingId.set(null)" />
        <tc-user-manager [baseUrl]="'/api/platform/tenants/' + b.id + '/users'" (changed)="editor.reloadChanges(); brokers.reload()" />
      }

      <section class="card">
        <div class="table-wrap">
          <table class="table admin-matrix">
            <thead>
              <tr>
                <th>Setting</th>
                @for (b of brokers.value(); track b.id) { <th><img [src]="b.logoUrl" alt="" /> {{ b.name }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.group + r.label; let i = $index) {
                @if (i === 0 || rows()[i - 1].group !== r.group) {
                  <tr class="group"><td [attr.colspan]="brokers.value().length + 1">{{ r.group }}</td></tr>
                }
                <tr [class.same]="!r.differs">
                  <th scope="row">{{ r.label }}</th>
                  @for (c of r.cells; track $index) {
                    <td>
                      @if (c === true) { <span class="yes" aria-label="yes">✓</span> }
                      @else if (c === false) { <span class="no" aria-label="no">✗</span> }
                      @else { {{ c }} }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class PlatformConsole {
  protected readonly brokers = httpResource<BrokerOverview[]>(() => '/api/platform/tenants', { defaultValue: [] });
  protected readonly onlyDifferences = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editing = computed(() => this.brokers.value().find((b) => b.id === this.editingId()) ?? null);
  protected readonly rows = computed(() => {
    const all = buildMatrix(this.brokers.value(), (v, c) => formatMoney(v, c, 'en-GB'));
    return this.onlyDifferences() ? all.filter((r) => r.differs) : all;
  });

  constructor() {
    every(10_000, () => this.brokers.reload());
  }

  protected score(b: BrokerOverview): number {
    return featureScore(b);
  }
}

/** Root of the platform console application (admin.localhost): its own login, its own header. */
@Component({
  selector: 'app-root',
  imports: [PlatformConsole, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <div class="platform">
        <header class="platform__bar">
          <strong>🦎 TradeChameleon <span class="muted">· Platform console</span></strong>
          <span class="row"><span>{{ user.name }}</span><span class="badge">SUPER ADMIN</span>
            <button class="btn btn--ghost btn--small" type="button" (click)="auth.logout()">Sign out</button></span>
        </header>
        <main><tc-platform-console /></main>
      </div>
    } @else {
      <main class="platform-login">
        <form class="card stack" (submit)="$event.preventDefault(); signIn(email.value, password.value)">
          <h1>🦎 Platform console</h1>
          <p class="muted">Super admin of all TradeChameleon brokers. Broker maintainers use the Admin page on their own site.</p>
          @if (problem(); as p) { <div class="alert alert--error">{{ p.detail ?? p.title }}</div> }
          <div class="field"><label for="p-email">E-mail</label><input #email id="p-email" type="email" autocomplete="username" required /></div>
          <div class="field"><label for="p-pass">Password</label><input #password id="p-pass" type="password" autocomplete="current-password" required /></div>
          <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
          <button class="btn btn--ghost btn--small" type="button" (click)="email.value = 'admin@tradechameleon.com'; password.value = 'demo'">
            Demo: admin&#64;tradechameleon.com / demo</button>
          <nav class="platform-sites" aria-label="Broker sites">
            <span class="muted">Broker sites</span>
            @for (t of sites.value(); track t.id) {
              <a [href]="siteUrl(t.id)" [style.--b-primary]="t.theme.primary" [title]="t.tagline">
                <img [src]="t.logoUrl" alt="" /> <span>{{ t.name }}<small>{{ t.id }}.localhost</small></span></a>
            }
          </nav>
        </form>
      </main>
    }
    <tc-toasts />
  `,
})
export class PlatformApp {
  protected readonly auth = inject(PlatformAuth);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  /** Public list of brokers: links to each white-label site from the console's login screen. */
  protected readonly sites = httpResource<Tenant[]>(() => '/api/tenants', { defaultValue: [] });

  /** pulse -> http://pulse.localhost:4200/login (same protocol and port as the console). */
  protected siteUrl(id: string): string {
    return `${location.protocol}//${id}.localhost${location.port ? ':' + location.port : ''}/login`;
  }

  constructor() {
    document.title = 'Platform console · TradeChameleon';
    document.documentElement.dataset['tenant'] = 'platform';
  }

  protected async signIn(email: string, password: string): Promise<void> {
    this.busy.set(true);
    this.problem.set(null);
    try {
      await this.auth.login(email, password);
    } catch (e) {
      this.problem.set(e instanceof HttpErrorResponse ? (e.error as Problem) : { detail: String(e) });
    } finally {
      this.busy.set(false);
    }
  }
}
