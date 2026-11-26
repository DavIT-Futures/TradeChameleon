import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { sparklinePoints } from './chart-geometry';

/** Inline SVG sparkline. Pure presentational component: signal input in, SVG out. */
@Component({
  selector: 'tc-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="sparkline" [class.up]="rising()" [class.down]="!rising()" viewBox="0 0 100 28" preserveAspectRatio="none"
         role="img" [attr.aria-label]="rising() ? 'Rising' : 'Falling'">
      <polyline [attr.points]="points()" vector-effect="non-scaling-stroke" />
    </svg>
  `,
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  protected readonly points = computed(() => sparklinePoints(this.values()));
  protected readonly rising = computed(() => {
    const v = this.values();
    return v.length < 2 || v[v.length - 1] >= v[0];
  });
}
