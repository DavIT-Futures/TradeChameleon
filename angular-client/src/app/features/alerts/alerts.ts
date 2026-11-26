import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { PriceAlert } from '../../api/types';
import { AlertNotifier } from '../../core/alerts';
import { PricePipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';

/** All price alerts of the user; create them from an instrument page. */
@Component({
  selector: 'tc-alerts',
  imports: [RouterLink, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Price alerts</h1>
        <span class="muted">Create alerts from an instrument page.</span>
      </div>
      <section class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Instrument</th><th>Condition</th><th class="num">Now</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              @for (a of alerts.value(); track a.id) {
                <tr>
                  <td><a [routerLink]="['/markets', a.symbol]">{{ a.symbol }}</a> <span class="muted">{{ a.note }}</span></td>
                  <td>{{ a.condition.toLowerCase() }} {{ a.price | price: 4 }}</td>
                  <td class="num">{{ stream.quotes().get(a.symbol)?.mid | price: 4 }}</td>
                  <td>
                    <span class="badge" [class.badge--up]="a.status === 'TRIGGERED'">{{ a.status }}</span>
                    @if (a.triggeredPrice) { <span class="muted"> at {{ a.triggeredPrice | price: 4 }}</span> }
                  </td>
                  <td>{{ a.createdAt.slice(11, 19) }}</td>
                  <td>
                    @if (a.status === 'ACTIVE') {
                      <button class="btn btn--ghost btn--small" (click)="cancel(a)">Cancel</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="muted">No alerts yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Alerts {
  protected readonly stream = inject(PriceStreamService);
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(AlertNotifier);

  protected readonly alerts = httpResource<PriceAlert[]>(() => '/api/alerts', { defaultValue: [] });

  constructor() {
    // reload when the notifier saw an alert fire
    effect(() => {
      if (this.notifier.version() > 0) this.alerts.reload();
    });
  }

  protected async cancel(alert: PriceAlert): Promise<void> {
    await firstValueFrom(this.http.delete<PriceAlert>(`/api/alerts/${alert.id}`));
    this.alerts.reload();
  }
}
