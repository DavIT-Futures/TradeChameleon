import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { Order, Portfolio as PortfolioDto } from '../../api/types';
import { AuthService } from '../../core/auth';
import { MoneyPipe, PercentPipe, PricePipe, QuantityPipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast';

type StatusFilter = Order['status'] | 'ALL';

@Component({
  selector: 'tc-portfolio',
  imports: [RouterLink, MoneyPipe, PercentPipe, PricePipe, QuantityPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Portfolio</h1>
        <button class="btn btn--ghost" (click)="reload()" [disabled]="portfolio.isLoading()">â†» Refresh</button>
      </div>

      @if (portfolio.value(); as p) {
        <section class="grid grid--kpi">
          <div class="card kpi"><div class="kpi__label">Total (live)</div><div class="kpi__value">{{ liveTotal() | money: p.currency }}</div></div>
          <div class="card kpi"><div class="kpi__label">Cash</div><div class="kpi__value">{{ p.cash | money: p.currency }}</div></div>
          <div class="card kpi"><div class="kpi__label">Unrealised P&amp;L</div>
            <div class="kpi__value" [class.up]="p.unrealizedPnl >= 0" [class.down]="p.unrealizedPnl < 0">{{ p.unrealizedPnl | money: p.currency }}</div></div>
        </section>

        <section class="card">
          <h2>Positions</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>Instrument</th><th class="num">Quantity</th><th class="num">Avg price</th><th class="num">Last</th>
                <th class="num">Value ({{ p.currency }})</th><th class="num">P&amp;L</th>
              </tr></thead>
              <tbody>
                @for (pos of positions(); track pos.symbol) {
                  <tr>
                    <td><a [routerLink]="['/markets', pos.symbol]">{{ pos.symbol }}</a> <span class="muted">{{ pos.name }}</span></td>
                    <td class="num">{{ pos.quantity | qty }}</td>
                    <td class="num">{{ pos.avgPrice | price }} <span class="muted">{{ pos.currency }}</span></td>
                    <td class="num">{{ pos.live | price }}</td>
                    <td class="num">{{ pos.liveValue | money: p.currency }}</td>
                    <td class="num" [class.up]="pos.pnl >= 0" [class.down]="pos.pnl < 0">{{ pos.pnlPct | pct }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="muted">No positions.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (portfolio.isLoading()) {
        <div class="card"><div class="skeleton" style="block-size: 8rem"></div></div>
      }

      <section class="card">
        <div class="row spread">
          <h2>Orders</h2>
          <div class="segmented" role="group" aria-label="Order status">
            @for (s of statuses; track s) {
              <button type="button" [attr.aria-pressed]="status() === s" (click)="status.set(s)">{{ s }}</button>
            }
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Created</th><th>Order</th><th class="num">Qty</th><th class="num">Limit</th><th class="num">Fill</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (o of orders.value(); track o.id) {
                <tr>
                  <td>{{ o.createdAt.slice(11, 19) }}</td>
                  <td>{{ o.side }} {{ o.symbol }} <span class="muted">{{ o.type }}</span></td>
                  <td class="num">{{ o.quantity | qty }}</td>
                  <td class="num">{{ o.limitPrice | price }}</td>
                  <td class="num">{{ o.fillPrice | price }}</td>
                  <td><span class="badge" [title]="o.rejectReason ?? ''">{{ o.status }}</span></td>
                  <td>
                    @if (o.status === 'OPEN' && auth.isTrader()) {
                      <button class="btn btn--ghost btn--small" (click)="cancel(o)">Cancel</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="muted">No orders.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Portfolio {
  protected readonly auth = inject(AuthService);
  private readonly stream = inject(PriceStreamService);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);

  protected readonly statuses: StatusFilter[] = ['ALL', 'OPEN', 'FILLED', 'CANCELLED', 'REJECTED'];
  protected readonly status = signal<StatusFilter>('ALL');

  protected readonly portfolio = httpResource<PortfolioDto>(() => '/api/portfolio');
  /** Re-fetches automatically whenever status() changes: the request is a function of signals. */
  protected readonly orders = httpResource<Order[]>(
    () => {
      const params: Record<string, string | number> = { limit: 50 };
      if (this.status() !== 'ALL') params['status'] = this.status();
      return { url: '/api/orders', params };
    },
    { defaultValue: [] },
  );

  /** Revalue positions with streamed mids: value_now = value_at_load * mid_now / mid_at_load. */
  protected readonly positions = computed(() => {
    const quotes = this.stream.quotes();
    return (this.portfolio.value()?.positions ?? []).map((p) => {
      const live = quotes.get(p.symbol)?.mid ?? p.lastPrice;
      return { ...p, live, liveValue: (p.marketValue * live) / p.lastPrice };
    });
  });

  protected readonly liveTotal = computed(() =>
    (this.portfolio.value()?.cash ?? 0) + this.positions().reduce((sum, p) => sum + p.liveValue, 0));

  protected reload(): void {
    this.portfolio.reload();
    this.orders.reload();
  }

  protected async cancel(order: Order): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<Order>(`/api/orders/${order.id}`));
      this.toasts.show('info', 'Order cancelled', `${order.side} ${order.quantity} ${order.symbol}`);
    } catch (e) {
      const p = toProblem(e);
      this.toasts.show('error', p.title ?? 'Error', p.detail);
    }
    this.orders.reload();
  }
}
