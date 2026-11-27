import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Candle, InstrumentView, PricePoint } from '../../api/types';
import { PercentPipe, PricePipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';
import { WatchlistService } from '../../core/watchlist';
import { CandleChart } from '../../shared/candle-chart';
import { IndicatorFlags, OhlcCandle } from '../../shared/candle-geometry';
import { ChartPoint } from '../../shared/chart-geometry';
import { every } from '../../shared/polling';
import { PriceChart } from '../../shared/price-chart';
import { AlertCard } from './alert-card';
import { ContractCard } from './contract-card';
import { NewsCard } from './news-card';
import { OptionChainCard } from './option-chain-card';
import { DepthCard } from './depth-card';
import { OrderTicket } from './order-ticket';

type Interval = '5s' | '15s' | '1m' | '5m';
const INTERVAL_MS: Record<Interval, number> = { '5s': 5_000, '15s': 15_000, '1m': 60_000, '5m': 300_000 };

@Component({
  selector: 'tc-instrument',
  imports: [RouterLink, PriceChart, CandleChart, PricePipe, PercentPipe, OrderTicket, DepthCard, AlertCard, ContractCard, OptionChainCard, NewsCard],
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
            <h1 class="row">
              <button class="star" type="button" [attr.aria-pressed]="watchlist.symbols().has(i.symbol)"
                      [attr.aria-label]="'Watch ' + i.symbol" (click)="watchlist.toggle(i.symbol)">★</button>
              {{ i.symbol }} <span class="muted" style="font-weight: 400">{{ i.name }}</span>
            </h1>
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
          <div class="stack">
            <section class="card">
              <div class="chart-toolbar">
                <div class="segmented" role="group" aria-label="Chart type">
                  <button type="button" [attr.aria-pressed]="chartType() === 'candles'" (click)="chartType.set('candles')">Candles</button>
                  <button type="button" [attr.aria-pressed]="chartType() === 'line'" (click)="chartType.set('line')">Line</button>
                </div>
                @if (chartType() === 'candles') {
                  <div class="segmented" role="group" aria-label="Interval">
                    @for (iv of intervals; track iv) {
                      <button type="button" [attr.aria-pressed]="interval() === iv" (click)="interval.set(iv)">{{ iv }}</button>
                    }
                  </div>
                  <div class="row">
                    <button type="button" class="toggle" [attr.aria-pressed]="indicators().sma" (click)="flip('sma')"><i style="background: var(--tc-accent)"></i>SMA 20</button>
                    <button type="button" class="toggle" [attr.aria-pressed]="indicators().ema" (click)="flip('ema')"><i style="background: var(--tc-primary)"></i>EMA 9</button>
                    <button type="button" class="toggle" [attr.aria-pressed]="indicators().rsi" (click)="flip('rsi')">RSI 14</button>
                  </div>
                }
              </div>
              @if (chartType() === 'candles') {
                @if (liveCandles().length) {
                  <tc-candle-chart [candles]="liveCandles()" [indicators]="indicators()" [decimals]="i.decimals" [label]="i.symbol + ' candles ' + interval()" />
                } @else {
                  <div class="skeleton" style="block-size: 300px"></div>
                }
              } @else if (line().length > 1) {
                <tc-price-chart [points]="line()" [decimals]="i.decimals" [label]="i.symbol + ' price chart'" />
              }
            </section>
            <tc-depth-card [symbol]="i.symbol" [decimals]="i.decimals" />
            @if (features()?.news) { <tc-news-card [symbol]="i.symbol" /> }
          </div>
          <div class="stack">
            @if (quote(); as q) {
              <tc-order-ticket [instrument]="i" [quote]="q" />
              <tc-contract-card [instrument]="i" [quote]="q" />
              @if (features()?.alerts) { <tc-alert-card [instrument]="i" [mid]="q.mid" /> }
            }
          </div>
        </div>
        @if (i.optionChain) {
          <!-- the chain's code is only downloaded when it scrolls into view -->
          @defer (on viewport) {
            <tc-option-chain-card [symbol]="i.symbol" />
          } @placeholder {
            <div class="card" id="options"><div class="skeleton" style="block-size: 12rem"></div></div>
          }
        }
      }
    </div>
  `,
})
export class Instrument {
  private readonly stream = inject(PriceStreamService);
  protected readonly watchlist = inject(WatchlistService);
  protected readonly features = inject(TenantService).features;

  /** Route parameter :symbol, bound by withComponentInputBinding(). */
  readonly symbol = input.required<string>();

  protected readonly intervals: Interval[] = ['5s', '15s', '1m', '5m'];
  protected readonly chartType = signal<'candles' | 'line'>('candles');
  protected readonly interval = signal<Interval>('15s');
  protected readonly indicators = signal<IndicatorFlags>({ sma: true, ema: false, rsi: true });

  protected readonly instrument = httpResource<InstrumentView>(() => `/api/market/instruments/${this.symbol()}`);
  private readonly history = httpResource<PricePoint[]>(() => ({
    url: `/api/market/instruments/${this.symbol()}/history`,
    params: { points: 180 },
  }));
  /** Re-fetches when the symbol or the interval changes, and every 5 s (see constructor). */
  private readonly candles = httpResource<Candle[]>(() => ({
    url: `/api/market/instruments/${this.symbol()}/candles`,
    params: { interval: this.interval(), limit: 90 },
  }));

  protected readonly quote = computed(() => this.stream.quotes().get(this.symbol()) ?? this.instrument.value()?.quote);

  /** Server candles with the last one updated (or a new one opened) from the live stream. */
  protected readonly liveCandles = computed<OhlcCandle[]>(() => {
    const base = (this.candles.value() ?? []).map((c) => ({ t: Date.parse(c.t), open: c.open, high: c.high, low: c.low, close: c.close }));
    const live = this.stream.quotes().get(this.symbol());
    if (!live || base.length === 0) return base;
    const size = INTERVAL_MS[this.interval()];
    const bucket = Math.floor(Date.parse(live.timestamp) / size) * size;
    const last = base[base.length - 1];
    if (bucket === last.t) {
      base[base.length - 1] = { ...last, high: Math.max(last.high, live.mid), low: Math.min(last.low, live.mid), close: live.mid };
    } else if (bucket > last.t) {
      base.push({ t: bucket, open: last.close, high: Math.max(last.close, live.mid), low: Math.min(last.close, live.mid), close: live.mid });
    }
    return base;
  });

  /** Line chart: HTTP history + streamed ticks (linkedSignal resets on a new symbol). */
  protected readonly line = linkedSignal<PricePoint[] | undefined, ChartPoint[]>({
    source: () => this.history.value(),
    computation: (points) => (points ?? []).map((p) => ({ t: Date.parse(p.t), price: p.price })),
  });

  constructor() {
    effect(() => {
      const live = this.stream.quotes().get(this.symbol());
      if (!live) return;
      const t = Date.parse(live.timestamp);
      untracked(() =>
        this.line.update((points) =>
          points.length && points[points.length - 1].t >= t ? points : [...points.slice(-179), { t, price: live.mid }],
        ),
      );
    });
    every(5_000, () => this.candles.reload());
    // Deep link /markets/AAPL#options: once the page has data, scroll the option chain into view
    // (the router's anchor scrolling runs before the content exists).
    effect(() => {
      if (this.instrument.value()?.optionChain && location.hash === '#options') {
        setTimeout(() => document.getElementById('options')?.scrollIntoView({ block: 'start' }));
      }
    });
  }

  protected flip(key: keyof IndicatorFlags): void {
    this.indicators.update((f) => ({ ...f, [key]: !f[key] }));
  }
}
