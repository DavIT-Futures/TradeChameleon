import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { OptionChain } from '../../api/types';
import { PricePipe } from '../../core/format';
import { every } from '../../shared/polling';

type Greek = 'delta' | 'gamma' | 'theta' | 'vega';

/**
 * Option chain: calls | strike | puts for one expiry. Prices come from the backend's Black-Scholes model
 * on the live spot, so the chain is re-fetched every 3 seconds.
 */
@Component({
  selector: 'tc-option-chain-card',
  imports: [PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" id="options" aria-labelledby="options-title">
      <div class="toolbar">
        <h2 id="options-title">Option chain</h2>
        @if (chain.value(); as c) {
          <div class="segmented" role="group" aria-label="Expiry">
            @for (e of c.expiries; track e) {
              <button type="button" [attr.aria-pressed]="e === c.expiry" (click)="expiry.set(e)">{{ e.slice(5) }}</button>
            }
          </div>
          <div class="segmented" role="group" aria-label="Greek">
            @for (g of greeks; track g.key) {
              <button type="button" [attr.aria-pressed]="greek() === g.key" (click)="greek.set(g.key)" [title]="g.title">{{ g.label }}</button>
            }
          </div>
        }
      </div>
      @if (chain.value(); as c) {
        <p class="muted" style="font-size: .85rem">
          Spot {{ c.spot | price: 2 }} {{ c.currency }} · expiry {{ c.expiry }} ({{ c.daysToExpiry }} days) · r = {{ c.rate * 100 }}% ·
          1 contract = {{ c.contractSize }} × underlying · European, Black-Scholes, read-only
        </p>
        <div class="table-wrap">
          <table class="table chain">
            <thead>
              <tr><th colspan="4" style="text-align: center">Calls</th><th class="strike">Strike</th><th colspan="4" style="text-align: center">Puts</th></tr>
              <tr>
                <th>Bid</th><th>Ask</th><th>IV</th><th>{{ greekLabel() }}</th>
                <th class="strike"></th>
                <th>Bid</th><th>Ask</th><th>IV</th><th>{{ greekLabel() }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of c.rows; track r.strike) {
                <tr [class.atm]="r.strike === atm()">
                  <td [class.itm]="r.call.inTheMoney">{{ r.call.bid | price: 2 }}</td>
                  <td [class.itm]="r.call.inTheMoney">{{ r.call.ask | price: 2 }}</td>
                  <td [class.itm]="r.call.inTheMoney">{{ r.call.iv }}%</td>
                  <td [class.itm]="r.call.inTheMoney">{{ r.call[greek()] }}</td>
                  <td class="strike">{{ r.strike }}</td>
                  <td [class.itm]="r.put.inTheMoney">{{ r.put.bid | price: 2 }}</td>
                  <td [class.itm]="r.put.inTheMoney">{{ r.put.ask | price: 2 }}</td>
                  <td [class.itm]="r.put.inTheMoney">{{ r.put.iv }}%</td>
                  <td [class.itm]="r.put.inTheMoney">{{ r.put[greek()] }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (chain.error()) {
        <div class="alert alert--error">Option chain not available.</div>
      } @else {
        <div class="skeleton" style="block-size: 12rem"></div>
      }
    </section>
  `,
})
export class OptionChainCard {
  readonly symbol = input.required<string>();

  protected readonly greeks: { key: Greek; label: string; title: string }[] = [
    { key: 'delta', label: 'Δ', title: 'Delta: price change per 1 unit of the underlying' },
    { key: 'gamma', label: 'Γ', title: 'Gamma: change of delta per 1 unit of the underlying' },
    { key: 'theta', label: 'Θ', title: 'Theta: price change per calendar day' },
    { key: 'vega', label: 'ν', title: 'Vega: price change per 1 volatility point' },
  ];
  protected readonly expiry = signal<string | null>(null);
  protected readonly greek = signal<Greek>('delta');
  protected readonly greekLabel = computed(() => this.greeks.find((g) => g.key === this.greek())!.label);

  protected readonly chain = httpResource<OptionChain>(() => {
    const params: Record<string, string> = {};
    const expiry = this.expiry();
    if (expiry) params['expiry'] = expiry;
    return { url: `/api/market/instruments/${this.symbol()}/options`, params };
  });

  /** The strike closest to the spot price is highlighted. */
  protected readonly atm = computed(() => {
    const c = this.chain.value();
    if (!c) return null;
    return c.rows.reduce((best, r) => (Math.abs(r.strike - c.spot) < Math.abs(best.strike - c.spot) ? r : best)).strike;
  });

  constructor() {
    every(3_000, () => this.chain.reload());
  }
}
