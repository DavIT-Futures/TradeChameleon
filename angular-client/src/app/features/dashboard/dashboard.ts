import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { InstrumentView, Order, Portfolio } from '../../api/types';
import { AuthService } from '../../core/auth';
import { MoneyPipe, PercentPipe, PricePipe, QuantityPipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';
import { Allocation } from './allocation';

@Component({
  selector: 'tc-dashboard',
  imports: [RouterLink, PercentPipe, PricePipe, QuantityPipe, Allocation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Hello, {{ auth.user()?.name }}</h1>
          <p class="muted">{{ tenant.tenant()?.tagline }}</p>
        </div>
      </div>

      @if (portfolio.error()) {
        <div class="alert alert--error">Could not load the portfolio.</div>
      }
      <section class="grid grid--kpi" aria-label="Key figures">
        @for (kpi of kpis(); track kpi.label) {
          <div class="card kpi">
            <div class="kpi__label">{{ kpi.label }}</div>
            @if (portfolio.hasValue()) {
              <div class="kpi__value" [class.up]="kpi.tone === 'up'" [class.down]="kpi.tone === 'down'">{{ kpi.value }}</div>
            } @else {
              <div class="skeleton" style="block-size: 2rem"></div>
            }
          </div>
        }
      </section>

      <div class="grid grid--2">
        <section class="card">
          <h2>Top movers</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Symbol</th><th class="num">Last</th><th class="num">Change</th></tr></thead>
              <tbody>
                @for (m of movers(); track m.symbol) {
                  <tr>
                    <td><a [routerLink]="['/markets', m.symbol]">{{ m.symbol }}</a> <span class="muted">{{ m.name }}</span></td>
                    <td class="num">{{ m.mid | price: m.decimals }}</td>
                    <td class="num"><span class="badge" [class.badge--up]="m.changePct >= 0" [class.badge--down]="m.changePct < 0">{{ m.changePct | pct }}</span></td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="muted">Waiting for live prices…</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2>Recent orders</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Order</th><th class="num">Qty</th><th>Status</th></tr></thead>
              <tbody>
                @for (o of orders.value() ?? []; track o.id) {
                  <tr>
                    <td>{{ o.side }} {{ o.symbol }} <span class="muted">{{ o.type }}</span></td>
                    <td class="num">{{ o.quantity | qty }}</td>
                    <td><span class="badge">{{ o.status }}</span></td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="muted">No orders yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- @defer: the allocation card's code is split into its own chunk and only loaded when scrolled into view -->
      @defer (on viewport) {
        @if (portfolio.value(); as p) {
          <tc-allocation [portfolio]="p" />
        }
      } @placeholder {
        <div class="card"><div class="skeleton" style="block-size: 6rem"></div></div>
      } @loading (minimum 300ms) {
        <div class="card"><div class="skeleton" style="block-size: 6rem"></div></div>
      }
    </div>
  `,
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  protected readonly tenant = inject(TenantService);
  private readonly stream = inject(PriceStreamService);
  private readonly money = new MoneyPipe();
  private readonly pct = new PercentPipe();

  protected readonly portfolio = httpResource<Portfolio>(() => '/api/portfolio');
  protected readonly orders = httpResource<Order[]>(() => ({ url: '/api/orders', params: { limit: 5 } }));
  private readonly instruments = httpResource<InstrumentView[]>(() => '/api/market/instruments');

  protected readonly kpis = computed(() => {
    const p = this.portfolio.value();
    if (!p) return [{ label: 'Total value' }, { label: 'Cash' }, { label: 'Invested' }, { label: 'Unrealised P&L' }].map((k) => ({ ...k, value: '', tone: '' }));
    const tone = p.unrealizedPnl >= 0 ? 'up' : 'down';
    return [
      { label: 'Total value', value: this.money.transform(p.totalValue, p.currency), tone: '' },
      { label: 'Cash', value: this.money.transform(p.cash, p.currency), tone: '' },
      { label: 'Invested', value: this.money.transform(p.positionsValue, p.currency), tone: '' },
      { label: 'Unrealised P&L', value: `${this.money.transform(p.unrealizedPnl, p.currency)} (${this.pct.transform(p.unrealizedPnlPct)})`, tone },
    ];
  });

  /** Derived from the live stream: recomputed on every tick, no subscriptions to manage. */
  protected readonly movers = computed(() => {
    const meta = new Map((this.instruments.value() ?? []).map((i) => [i.symbol, i]));
    return this.stream.quoteList()
      .map((q) => ({ ...q, name: meta.get(q.symbol)?.name ?? '', decimals: meta.get(q.symbol)?.decimals ?? 2 }))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 6);
  });
}
