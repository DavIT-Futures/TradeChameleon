import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { CreateAlertRequest, PriceAlert, Problem } from '../../api/types';
import type { InstrumentView } from '../../api/types';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast';

/** "Notify me when…" form. Uses template-driven forms with signals, for contrast with the order ticket. */
@Component({
  selector: 'tc-alert-card',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-labelledby="alert-title">
      <div class="row spread">
        <h2 id="alert-title">Price alert</h2>
        <a routerLink="/alerts" style="font-size: .85rem">All alerts →</a>
      </div>
      <form class="form-row" (ngSubmit)="create()">
        <div class="field">
          <label for="alert-cond">When price is</label>
          <select id="alert-cond" name="condition" [ngModel]="condition()" (ngModelChange)="condition.set($event)">
            <option value="ABOVE">above</option>
            <option value="BELOW">below</option>
          </select>
        </div>
        <div class="field">
          <label for="alert-price">Price ({{ instrument().currency }})</label>
          <input id="alert-price" name="price" type="number" step="any" min="0" required
                 [ngModel]="price()" (ngModelChange)="price.set($event)" [placeholder]="mid()" />
        </div>
        <button class="btn" type="submit" [disabled]="!price() || busy()">Set alert</button>
      </form>
      @if (problem(); as p) {
        <div class="alert alert--error" role="alert"><strong>{{ p.title }}</strong>{{ p.detail }}</div>
      }
    </section>
  `,
})
export class AlertCard {
  readonly instrument = input.required<InstrumentView>();
  readonly mid = input.required<number>();

  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  protected readonly condition = signal<PriceAlert['condition']>('ABOVE');
  protected readonly price = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected async create(): Promise<void> {
    const price = this.price();
    if (!price) return;
    const body: CreateAlertRequest = { symbol: this.instrument().symbol, condition: this.condition(), price, note: null };
    this.busy.set(true);
    this.problem.set(null);
    try {
      const alert = await firstValueFrom(this.http.post<PriceAlert>('/api/alerts', body));
      this.toasts.show('success', 'Alert set', `${alert.symbol} ${alert.condition.toLowerCase()} ${alert.price}`);
      this.price.set(null);
    } catch (e) {
      this.problem.set(toProblem(e));
    } finally {
      this.busy.set(false);
    }
  }
}
