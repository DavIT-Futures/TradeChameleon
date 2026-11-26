import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { InstrumentView, PricePoint } from '../../api/types';
import { PercentPipe, PricePipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { ChartPoint } from '../../shared/chart-geometry';
import { PriceChart } from '../../shared/price-chart';
import { OrderTicket } from './order-ticket';

@Component({
  selector: 'tc-instrument',
  imports: [RouterLink, PriceChart, PricePipe, PercentPipe, OrderTicket],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/markets">← Markets</a>
      @if (instrument.error()) {
        <div class="alert alert--error"><strong>Not available</strong>This broker does not offer {{ symbol() }}.</div>
      }
      @if (instrument.value(); as i) {
        <div class="page__header">
          <div>
            <h1>{{ i.symbol }} <span class="muted" style="font-weight: 400">{{ i.name }}</span></h1>
            <p class="muted">{{ i.exchange }} · {{ i.assetClass }} · {{ i.currency }}</p>
          </div>
          @if (quote(); as q) {
            <div style="text-align: end">
              <div class="kpi__value">{{ q.mid | price: i.decimals }} <small class="muted">{{ i.currency }}</small></div>
              <span class="badge" [class.badge--up]="q.changePct >= 0" [class.badge--down]="q.changePct < 0">{{ q.changePct | pct }}</span>
            </div>
          }
        </div>

        <div class="grid grid--2">
          <section class="card">
            <h2>Price</h2>
            @if (chart().length > 1) {
              <tc-price-chart [points]="chart()" [decimals]="i.decimals" [label]="i.symbol + ' price chart'" />
            } @else {
              <div class="skeleton" style="block-size: 260px"></div>
            }
          </section>
          @if (quote(); as q) {
            <tc-order-ticket [instrument]="i" [quote]="q" />
          }
        </div>
      }
    </div>
  `,
})
export class Instrument {
  private readonly stream = inject(PriceStreamService);

  /** Route parameter :symbol, bound by withComponentInputBinding(). */
  readonly symbol = input.required<string>();

  protected readonly instrument = httpResource<InstrumentView>(() => `/api/market/instruments/${this.symbol()}`);
  private readonly history = httpResource<PricePoint[]>(() => ({
    url: `/api/market/instruments/${this.symbol()}/history`,
    params: { points: 180 },
  }));

  protected readonly quote = computed(() => this.stream.quotes().get(this.symbol()) ?? this.instrument.value()?.quote);

  /**
   * linkedSignal: starts from the HTTP history whenever it (re)loads, then we append live ticks.
   * Navigating to another symbol resets it automatically because history() changes.
   */
  protected readonly chart = linkedSignal<PricePoint[] | undefined, ChartPoint[]>({
    source: () => this.history.value(),
    computation: (points) => (points ?? []).map((p) => ({ t: Date.parse(p.t), price: p.price })),
  });

  constructor() {
    // Append every streamed quote of this symbol to the chart, keeping the last 180 points.
    effect(() => {
      const live = this.stream.quotes().get(this.symbol());
      if (!live) return;
      const t = Date.parse(live.timestamp);
      untracked(() =>
        this.chart.update((points) =>
          points.length && points[points.length - 1].t >= t ? points : [...points.slice(-179), { t, price: live.mid }],
        ),
      );
    });
  }
}
