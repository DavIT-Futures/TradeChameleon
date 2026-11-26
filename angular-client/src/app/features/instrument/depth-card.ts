import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OrderBook } from '../../api/types';
import { PricePipe, QuantityPipe } from '../../core/format';
import { every } from '../../shared/polling';

/** Market depth: 10 bid and ask levels with size bars, refreshed every second. */
@Component({
  selector: 'tc-depth-card',
  imports: [PricePipe, QuantityPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h2>Market depth</h2>
      @if (book.value(); as b) {
        <div class="book">
          <table class="bid" aria-label="Bids">
            <thead><tr><th class="num">Size</th><th class="num">Bid</th></tr></thead>
            <tbody>
              @for (l of b.bids; track $index) {
                <tr>
                  <td class="num"><span class="bar" [style.inline-size.%]="(l.size / maxSize()) * 100"></span><span>{{ l.size | qty }}</span></td>
                  <td class="num up"><span>{{ l.price | price: decimals() }}</span></td>
                </tr>
              }
            </tbody>
          </table>
          <table class="ask" aria-label="Asks">
            <thead><tr><th class="num">Ask</th><th class="num">Size</th></tr></thead>
            <tbody>
              @for (l of b.asks; track $index) {
                <tr>
                  <td class="num down"><span>{{ l.price | price: decimals() }}</span></td>
                  <td class="num"><span class="bar" [style.inline-size.%]="(l.size / maxSize()) * 100"></span><span>{{ l.size | qty }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="skeleton" style="block-size: 10rem"></div>
      }
    </section>
  `,
})
export class DepthCard {
  readonly symbol = input.required<string>();
  readonly decimals = input(2);

  protected readonly book = httpResource<OrderBook>(() => ({
    url: `/api/market/instruments/${this.symbol()}/depth`,
    params: { levels: 10 },
  }));
  protected readonly maxSize = computed(() => {
    const b = this.book.value();
    return b ? Math.max(...b.bids.map((l) => l.size), ...b.asks.map((l) => l.size)) : 1;
  });

  constructor() {
    every(1_000, () => this.book.reload());
  }
}
