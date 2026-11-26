import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PricePipe } from '../core/format';
import { IndicatorFlags, OhlcCandle, candleGeometry } from './candle-geometry';

/** Candlestick chart with optional SMA/EMA overlays and an RSI pane. Pure SVG, no chart library. */
@Component({
  selector: 'tc-candle-chart',
  imports: [PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <svg class="chart" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="label()">
      @for (tick of g.yTicks; track $index) {
        <line class="chart__grid" x1="8" [attr.x2]="width - 64" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text class="chart__label" [attr.x]="width - 58" [attr.y]="tick.y + 4">{{ tick.value | price: decimals() }}</text>
      }
      @for (tick of g.xTicks; track $index) {
        <text class="chart__label" [attr.x]="tick.x" [attr.y]="height - 6" text-anchor="middle">{{ tick.label }}</text>
      }
      @for (w of g.wicks; track $index) {
        <line class="wick" [class.candle--up]="w.up" [class.candle--down]="!w.up" [attr.x1]="w.x" [attr.x2]="w.x" [attr.y1]="w.y1" [attr.y2]="w.y2" />
      }
      @for (b of g.bodies; track $index) {
        <rect [class.candle--up]="b.up" [class.candle--down]="!b.up" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" />
      }
      @if (g.sma) { <path class="ind-sma" [attr.d]="g.sma" /> }
      @if (g.ema) { <path class="ind-ema" [attr.d]="g.ema" /> }
      @if (g.last; as last) {
        <line class="chart__grid" x1="8" [attr.x2]="width - 64" [attr.y1]="last.y" [attr.y2]="last.y" style="stroke: var(--tc-accent)" />
        <text class="chart__label" [attr.x]="width - 58" [attr.y]="last.y + 4" style="fill: var(--tc-accent); font-weight: 700">{{ last.value | price: decimals() }}</text>
      }
      @if (indicators().rsi) {
        <line class="pane-sep" x1="8" [attr.x2]="width - 64" [attr.y1]="g.rsiTop - 6" [attr.y2]="g.rsiTop - 6" />
        <rect class="rsi-band" x="8" [attr.width]="width - 72" [attr.y]="g.rsiY(70)" [attr.height]="g.rsiY(30) - g.rsiY(70)" />
        <text class="chart__label" [attr.x]="width - 58" [attr.y]="g.rsiY(70) + 4">70</text>
        <text class="chart__label" [attr.x]="width - 58" [attr.y]="g.rsiY(30) + 4">30</text>
        <text class="chart__label" x="12" [attr.y]="g.rsiTop + 10">RSI 14</text>
        <path class="ind-rsi" [attr.d]="g.rsi" />
      }
    </svg>
  `,
})
export class CandleChart {
  readonly candles = input.required<readonly OhlcCandle[]>();
  readonly indicators = input<IndicatorFlags>({ sma: true, ema: false, rsi: true });
  readonly decimals = input(2);
  readonly label = input('Candlestick chart');
  protected readonly width = 720;
  protected readonly height = 340;
  protected readonly geometry = computed(() => candleGeometry(this.candles(), this.width, this.height, this.indicators()));
}
