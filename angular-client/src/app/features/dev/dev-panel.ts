import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { SimulatorSettings } from '../../api/types';
import { AuthService } from '../../core/auth';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';
import { ToastService } from '../../core/toast';

/** Developer panel: drives the backend simulator and shows what the client knows. */
@Component({
  selector: 'tc-dev-panel',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Developer panel</h1>
        <div class="row">
          <span class="status-dot" [class.live]="stream.status() === 'live'"></span>
          <span class="muted">SSE {{ stream.status() }} · last tick {{ stream.lastTick()?.toLocaleTimeString() ?? '–' }}</span>
        </div>
      </div>

      <div class="grid grid--2">
        <section class="card stack">
          <h2>Simulator</h2>
          @if (draft(); as d) {
            <div class="range">
              <label for="lat">Latency <output>{{ d.latencyMs }} ms</output></label>
              <input id="lat" type="range" min="0" max="3000" step="50" [value]="d.latencyMs" (input)="patch('latencyMs', $event)" />
            </div>
            <div class="range">
              <label for="jit">Jitter <output>{{ d.jitterMs }} ms</output></label>
              <input id="jit" type="range" min="0" max="2000" step="50" [value]="d.jitterMs" (input)="patch('jitterMs', $event)" />
            </div>
            <div class="range">
              <label for="fail">Failure rate <output>{{ (d.failureRate * 100).toFixed(0) }} %</output></label>
              <input id="fail" type="range" min="0" max="1" step="0.05" [value]="d.failureRate" (input)="patch('failureRate', $event)" />
            </div>
            <div class="range">
              <label for="vol">Volatility <output>× {{ d.volatilityMultiplier }}</output></label>
              <input id="vol" type="range" min="0" max="10" step="0.5" [value]="d.volatilityMultiplier" (input)="patch('volatilityMultiplier', $event)" />
            </div>
            <label class="row"><input type="checkbox" [checked]="d.paused" (change)="togglePaused()" /> Pause price engine</label>
            <div class="row">
              <button class="btn" (click)="save()" [disabled]="saving()">Apply</button>
              <button class="btn btn--ghost" (click)="reset()">Reset</button>
            </div>
          } @else {
            <div class="skeleton" style="block-size: 12rem"></div>
          }
        </section>

        <section class="card stack">
          <h2>Session</h2>
          <div><span class="muted">Tenant</span> <code>{{ tenant.id() }}</code></div>
          <div><span class="muted">Features</span> <pre class="token">{{ tenant.features() | json }}</pre></div>
          <div><span class="muted">JWT claims</span> <pre class="token">{{ auth.claims() | json }}</pre></div>
        </section>
      </div>
    </div>
  `,
})
export class DevPanel {
  protected readonly tenant = inject(TenantService);
  protected readonly auth = inject(AuthService);
  protected readonly stream = inject(PriceStreamService);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);

  private readonly settings = httpResource<SimulatorSettings>(() => '/api/simulator');
  /** Editable copy of the server settings; resets whenever the server value changes. */
  protected readonly draft = linkedSignal(() => this.settings.value());
  protected readonly saving = signal(false);

  protected patch(key: 'latencyMs' | 'jitterMs' | 'failureRate' | 'volatilityMultiplier', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
  }

  protected togglePaused(): void {
    this.draft.update((d) => (d ? { ...d, paused: !d.paused } : d));
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    try {
      this.settings.set(await firstValueFrom(this.http.put<SimulatorSettings>('/api/simulator', d)));
      this.toasts.show('success', 'Simulator updated');
    } finally {
      this.saving.set(false);
    }
  }

  protected async reset(): Promise<void> {
    this.settings.set(await firstValueFrom(this.http.post<SimulatorSettings>('/api/simulator/reset', {})));
    this.toasts.show('info', 'Simulator reset');
  }
}
