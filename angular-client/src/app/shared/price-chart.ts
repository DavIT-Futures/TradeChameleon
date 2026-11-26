import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PricePipe } from '../core/format';
import { ChartPoint, chartGeometry } from './chart-geometry';

/** Hand-made SVG line chart: no chart library, ~40 lines, scales with its container via viewBox. */
@Component({
  selector: 'tc-price-chart',
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
      <path class="chart__area" [attr.d]="g.area" />
      <path class="chart__line" [attr.d]="g.line" />
      @if (g.last; as last) {
        <circle class="chart__last" [attr.cx]="last.x" [attr.cy]="last.y" r="4" />
      }
    </svg>
  `,
})
export class PriceChart {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly decimals = input(2);
  readonly label = input('Price chart');
  protected readonly width = 720;
  protected readonly height = 280;
  protected readonly geometry = computed(() => chartGeometry(this.points(), this.width, this.height));
}
