import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { Problem, Tenant } from '../../api/types';
import { AuthService } from '../../core/auth';
import { toProblem } from '../../core/problem';
import { TenantService } from '../../core/tenant';

@Component({
  selector: 'tc-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login" #stage (pointermove)="tilt($event, stage)" (pointerleave)="level(stage)">
      <div class="login__orb login__orb--a" aria-hidden="true"></div>
      <div class="login__orb login__orb--b" aria-hidden="true"></div>
      <div class="login__orb login__orb--c" aria-hidden="true"></div>
      <button class="btn btn--ghost btn--small login__scheme" type="button" (click)="tenant.cycleScheme()"
              [attr.aria-label]="'Colour scheme: ' + tenant.scheme()" [title]="'Colour scheme: ' + tenant.scheme()">
        {{ tenant.scheme() === 'dark' ? '☾' : tenant.scheme() === 'light' ? '☀' : '◐' }}
      </button>

      <div class="login__stage">
      @if (tenant.tenant(); as t) {
        <section class="login__hero" aria-label="Broker">
          <div class="login__logo"><img [src]="t.logoUrl" [alt]="t.name + ' logo'" /></div>
          <div class="login__floor" aria-hidden="true"></div>
          <h1>{{ t.name }}</h1>
          <p class="login__tagline">{{ t.tagline }}</p>
          <ul class="login__facts">
            <li>{{ t.locale }}</li>
            <li>{{ t.currency }}</li>
            <li>{{ t.allowedAssetClasses.length }} asset classes</li>
            <li>{{ t.features.trading ? 'Trading' : 'Portfolio only' }}</li>
          </ul>
        </section>
      }

      <div class="login__card">
        <h2>Sign in</h2>

        <section aria-labelledby="brand-title" class="stack">
          <h3 id="brand-title" class="muted" style="font-size: .85rem">Choose a broker</h3>
          <div class="brand-switcher">
            @if (brands.isLoading()) {
              @for (i of [1, 2, 3, 4]; track i) { <div class="skeleton" style="block-size: 64px"></div> }
            }
            @for (b of brands.value() ?? []; track b.id) {
              <button type="button" [attr.aria-pressed]="b.id === tenant.id()" (click)="switchBrand(b)">
                <img [src]="b.logoUrl" alt="" />{{ b.name }}
              </button>
            }
          </div>
        </section>

        @if (reason() === 'expired') {
          <div class="alert">Your session expired. Please sign in again.</div>
        }
        @if (problem(); as p) {
          <div class="alert alert--error" role="alert"><strong>{{ p.title }}</strong>{{ p.detail }}</div>
        }

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="username">E-mail</label>
            <input id="username" type="email" formControlName="username" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" autocomplete="current-password" required />
          </div>
          <button class="btn" type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <div class="stack">
          <span class="muted" style="font-size: .85rem">Demo users (password <code>demo</code>)</span>
          <div class="demo-users">
            <button type="button" class="btn btn--ghost btn--small" (click)="fill('trader')">trader&#64;{{ tenant.id() }}.test</button>
            <button type="button" class="btn btn--ghost btn--small" (click)="fill('viewer')">viewer&#64;{{ tenant.id() }}.test</button>
            @if (tenant.id() === 'aurora') {
              <button type="button" class="btn btn--ghost btn--small" (click)="fill('admin')">admin&#64;aurora.test</button>
            }
          </div>
        </div>
      </div>
      </div>
    </main>
  `,
})
export class Login {
  protected readonly tenant = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query params bound to inputs thanks to withComponentInputBinding(). */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  /** httpResource: a signal-based GET. value(), isLoading(), error() are all signals. */
  protected readonly brands = httpResource<Tenant[]>(() => '/api/tenants');

  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  /** Pointer position → CSS variables: the stage tilts and the orbs drift (pure CSS does the rest). */
  protected tilt(event: PointerEvent, stage: HTMLElement): void {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const x = (event.clientX / stage.clientWidth) * 2 - 1;
    const y = (event.clientY / stage.clientHeight) * 2 - 1;
    stage.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    stage.style.setProperty('--rx', `${(-y * 4).toFixed(2)}deg`);
    stage.style.setProperty('--px', x.toFixed(3));
    stage.style.setProperty('--py', y.toFixed(3));
  }

  protected level(stage: HTMLElement): void {
    for (const v of ['--rx', '--ry', '--px', '--py']) stage.style.removeProperty(v);
  }

  protected fill(role: 'trader' | 'viewer' | 'admin'): void {
    this.form.setValue({ username: `${role}@${this.tenant.id()}.test`, password: 'demo' });
  }

  protected async switchBrand(brand: Tenant): Promise<void> {
    this.problem.set(null);
    this.form.reset();
    await this.tenant.switchTo(brand.id);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.problem.set(null);
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username, password);
      await this.router.navigateByUrl(this.returnUrl() ?? '/dashboard');
    } catch (e) {
      this.problem.set(toProblem(e));
    } finally {
      this.busy.set(false);
    }
  }
}
