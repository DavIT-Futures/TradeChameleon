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
    <main class="login">
      <div class="card login__card">
        @if (tenant.tenant(); as t) {
          <div class="login__brand">
            <img [src]="t.logoUrl" alt="" />
            <div>
              <h1>{{ t.name }}</h1>
              <p class="muted">{{ t.tagline }}</p>
            </div>
          </div>
        }

        <section aria-labelledby="brand-title" class="stack">
          <h2 id="brand-title" class="muted" style="font-size: .85rem">Choose a broker</h2>
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

  protected fill(role: 'trader' | 'viewer'): void {
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
