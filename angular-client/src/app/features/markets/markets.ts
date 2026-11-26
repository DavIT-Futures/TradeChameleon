import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AssetClass, InstrumentView } from '../../api/types';
import { PercentPipe, PricePipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';
import { Flash } from '../../shared/flash';
import { Sparkline } from '../../shared/sparkline';

@Component({
  selector: 'tc-markets',
  imports: [RouterLink, PricePipe, PercentPipe, Sparkline, Flash],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Markets</h1>
        <div class="row">
          <div class="segmented" role="group" aria-label="Asset class">
            <button type="button" [attr.aria-pressed]="filter() === null" (click)="filter.set(null)">All</button>
            @for (c of tenant.tenant()?.allowedAssetClasses ?? []; track c) {
              <button type="button" [attr.aria-pressed]="filter() === c" (click)="filter.set(c)">{{ c }}</button>
            }
          </div>
          <div class="field">
            <label class="sr-only" for="search">Search</label>
            <input id="search" type="search" placeholder="Search…" [value]="search()" (input)="search.set($any($event.target).value)" />
          </div>
        </div>
      </div>

      <section class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Instrument</th><th>Class</th><th>Trend</th>
                <th class="num">Bid</th><th class="num">Ask</th><th class="num">Change</th>
              </tr>
            </thead>
            <tbody>
              @if (instruments.isLoading()) {
                @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                  <tr><td colspan="6"><div class="skeleton"></div></td></tr>
                }
              }
              @for (row of rows(); track row.symbol) {
                <tr>
                  <td>
                    <a [routerLink]="[row.symbol]">{{ row.symbol }}</a>
                    <div class="muted" style="font-size: .8rem">{{ row.name }} · {{ row.exchange }}</div>
                  </td>
                  <td><span class="badge">{{ row.assetClass }}</span></td>
                  <td><tc-sparkline [values]="stream.sparklines()[row.symbol] ?? []" /></td>
                  <td class="num" [tcFlash]="row.quote.bid">{{ row.quote.bid | price: row.decimals }}</td>
                  <td class="num" [tcFlash]="row.quote.ask">{{ row.quote.ask | price: row.decimals }}</td>
                  <td class="num" [class.up]="row.quote.changePct >= 0" [class.down]="row.quote.changePct < 0">
                    {{ row.quote.changePct | pct }}
                  </td>
                </tr>
              } @empty {
                @if (!instruments.isLoading()) { <tr><td colspan="6" class="muted">No instruments match.</td></tr> }
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Markets {
  protected readonly tenant = inject(TenantService);
  protected readonly stream = inject(PriceStreamService);

  protected readonly instruments = httpResource<InstrumentView[]>(() => '/api/market/instruments');
  protected readonly filter = signal<AssetClass | null>(null);
  protected readonly search = signal('');

  /** Static instrument data merged with the latest streamed quote. */
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const live = this.stream.quotes();
    return (this.instruments.value() ?? [])
      .filter((i) => this.filter() === null || i.assetClass === this.filter())
      .filter((i) => !q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      .map((i) => ({ ...i, quote: live.get(i.symbol) ?? i.quote }));
  });
}
