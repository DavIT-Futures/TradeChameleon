import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { InstrumentView, Order, PlaceOrderRequest, Problem, Quote } from '../../api/types';
import { AuthService } from '../../core/auth';
import { PricePipe } from '../../core/format';
import { toProblem } from '../../core/problem';
import { TenantService } from '../../core/tenant';
import { ToastService } from '../../core/toast';

type Side = PlaceOrderRequest['side'];
type OrderType = PlaceOrderRequest['type'];

const TYPE_LABELS: Record<OrderType, string> = { MARKET: 'Market', LIMIT: 'Limit', STOP: 'Stop', STOP_LIMIT: 'Stop limit' };

@Component({
  selector: 'tc-order-ticket',
  imports: [ReactiveFormsModule, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card order-ticket" aria-labelledby="ticket-title">
      <h2 id="ticket-title">Order ticket</h2>
      <div class="quote-box">
        <div><span class="muted">Bid</span><b class="down">{{ quote().bid | price: instrument().decimals }}</b></div>
        <div><span class="muted">Ask</span><b class="up">{{ quote().ask | price: instrument().decimals }}</b></div>
      </div>

      @if (!tenant.features()?.trading) {
        <div class="alert"><strong>Portfolio only</strong>{{ tenant.tenant()?.name }} does not offer trading.</div>
      } @else if (!auth.isTrader()) {
        <div class="alert"><strong>Read-only user</strong>Your role cannot place orders.</div>
      } @else {
        <form class="order-ticket" [formGroup]="form" (ngSubmit)="submit()">
          <div class="order-ticket__sides" role="group" aria-label="Side">
            <button type="button" class="btn btn--buy" [attr.aria-pressed]="side() === 'BUY'" (click)="side.set('BUY')">Buy</button>
            <button type="button" class="btn btn--sell" [attr.aria-pressed]="side() === 'SELL'" (click)="side.set('SELL')">Sell</button>
          </div>
          <div class="segmented" role="group" aria-label="Order type">
            @for (t of types; track t) {
              <button type="button" [attr.aria-pressed]="type() === t" (click)="type.set(t)"
                      [disabled]="t !== 'MARKET' && !tenant.features()?.limitOrders"
                      [title]="t === 'MARKET' || tenant.features()?.limitOrders ? '' : 'Not offered by this broker'">{{ labels[t] }}</button>
            }
          </div>
          <div class="field">
            <label for="qty">Quantity</label>
            <input id="qty" type="number" min="0" step="any" formControlName="quantity" required />
          </div>
          @if (type() === 'STOP' || type() === 'STOP_LIMIT') {
            <div class="field">
              <label for="stop">Stop price ({{ instrument().currency }}) · {{ side() === 'BUY' ? 'above ask' : 'below bid' }}</label>
              <input id="stop" type="number" min="0" step="any" formControlName="stopPrice" required />
            </div>
          }
          @if (type() === 'LIMIT' || type() === 'STOP_LIMIT') {
            <div class="field">
              <label for="limit">Limit price ({{ instrument().currency }})</label>
              <input id="limit" type="number" min="0" step="any" formControlName="limitPrice" required />
            </div>
          }
          @if (side() === 'BUY') {
            <details class="protection">
              <summary>Stop loss / Take profit</summary>
              <div class="form-row">
                <div class="field">
                  <label for="sl">Stop loss</label>
                  <input id="sl" type="number" min="0" step="any" formControlName="stopLoss" placeholder="optional" />
                </div>
                <div class="field">
                  <label for="tp">Take profit</label>
                  <input id="tp" type="number" min="0" step="any" formControlName="takeProfit" placeholder="optional" />
                </div>
              </div>
            </details>
          }
          <div class="row spread">
            <span class="muted">Estimated {{ side() === 'BUY' ? 'cost' : 'proceeds' }}</span>
            <strong class="num">{{ estimate() | price: 2 }} {{ instrument().currency }}</strong>
          </div>
          <div class="margin-hint">
            <span>As a CFD (1:{{ instrument().leverage }}) margin would be</span>
            <span class="num">{{ estimate() * instrument().marginRate | price: 2 }} {{ instrument().currency }}</span>
          </div>
          @if (problem(); as p) {
            <div class="alert alert--error" role="alert"><strong>{{ p.title }}</strong>{{ p.detail }}</div>
          }
          <button class="btn" [class.btn--buy]="side() === 'BUY'" [class.btn--sell]="side() === 'SELL'" type="submit"
                  [disabled]="!valid() || busy()">
            {{ busy() ? 'Sending…' : (side() === 'BUY' ? 'Buy ' : 'Sell ') + instrument().symbol + (type() === 'MARKET' ? '' : ' · ' + labels[type()]) }}
          </button>
        </form>
      }
    </section>
  `,
})
export class OrderTicket {
  readonly instrument = input.required<InstrumentView>();
  readonly quote = input.required<Quote>();

  protected readonly tenant = inject(TenantService);
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);

  protected readonly types: OrderType[] = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'];
  protected readonly labels = TYPE_LABELS;
  protected readonly side = signal<Side>('BUY');
  protected readonly type = signal<OrderType>('MARKET');
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  /** Typed form; optional prices are nullable controls. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    quantity: [1, [Validators.required, Validators.min(0.00000001)]],
    limitPrice: [null as number | null],
    stopPrice: [null as number | null],
    stopLoss: [null as number | null],
    takeProfit: [null as number | null],
  });

  /** Bridge from the RxJS world of reactive forms into signals. */
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly estimate = computed(() => {
    const v = this.values();
    const qty = Number(v.quantity ?? 0);
    const price = this.type() === 'LIMIT' || this.type() === 'STOP_LIMIT' ? Number(v.limitPrice ?? 0)
      : this.type() === 'STOP' ? Number(v.stopPrice ?? 0)
      : this.side() === 'BUY' ? this.quote().ask : this.quote().bid;
    return qty * price;
  });

  protected readonly valid = computed(() => {
    const v = this.values();
    const t = this.type();
    return Number(v.quantity) > 0
      && (t !== 'LIMIT' && t !== 'STOP_LIMIT' || Number(v.limitPrice) > 0)
      && (t !== 'STOP' && t !== 'STOP_LIMIT' || Number(v.stopPrice) > 0);
  });

  protected async submit(): Promise<void> {
    if (!this.valid()) return;
    const v = this.form.getRawValue();
    const t = this.type();
    const num = (x: number | null) => (x == null || String(x) === '' ? null : Number(x));
    const body: PlaceOrderRequest = {
      symbol: this.instrument().symbol,
      side: this.side(),
      type: t,
      quantity: Number(v.quantity),
      limitPrice: t === 'LIMIT' || t === 'STOP_LIMIT' ? num(v.limitPrice) : null,
      stopPrice: t === 'STOP' || t === 'STOP_LIMIT' ? num(v.stopPrice) : null,
      stopLoss: this.side() === 'BUY' ? num(v.stopLoss) : null,
      takeProfit: this.side() === 'BUY' ? num(v.takeProfit) : null,
    };
    this.busy.set(true);
    this.problem.set(null);
    try {
      const order = await firstValueFrom(this.http.post<Order>('/api/orders', body));
      const what = `${order.side} ${order.quantity} ${order.symbol}`;
      this.toasts.show('success', order.status === 'FILLED' ? 'Order filled' : `${TYPE_LABELS[order.type]} order placed`,
        order.status === 'FILLED' ? `${what} @ ${order.fillPrice}` : what);
    } catch (e) {
      this.problem.set(toProblem(e));
    } finally {
      this.busy.set(false);
    }
  }
}
