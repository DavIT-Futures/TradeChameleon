import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Portfolio } from '../../api/types';
import { MoneyPipe } from '../../core/format';

const COLORS: Record<string, string> = {
  CASH: 'var(--tc-muted)',
  STOCK: 'var(--tc-primary)',
  ETF: 'var(--tc-accent)',
  FX: 'color-mix(in oklab, var(--tc-primary) 50%, var(--tc-accent))',
  CRYPTO: 'color-mix(in oklab, var(--tc-negative) 70%, var(--tc-accent))',
  BOND: 'color-mix(in oklab, var(--tc-positive) 70%, var(--tc-primary))',
  COMMODITY: 'color-mix(in oklab, var(--tc-accent) 60%, var(--tc-text))',
  INDEX: 'color-mix(in oklab, var(--tc-primary) 55%, var(--tc-text))',
};

/** Allocation by asset class. Loaded lazily by @defer in the dashboard. */
@Component({
  selector: 'tc-allocation',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack">
      <h2>Allocation</h2>
      <div class="allocation" role="img" aria-label="Allocation by asset class">
        @for (s of slices(); track s.key) {
          <span [style.inline-size.%]="s.pct" [style.background]="s.color" [title]="s.key"></span>
        }
      </div>
      <div class="legend">
        @for (s of slices(); track s.key) {
          <span><i [style.background]="s.color"></i>{{ s.key }} {{ s.value | money: portfolio().currency }} ({{ s.pct.toFixed(1) }}%)</span>
        }
      </div>
    </section>
  `,
})
export class Allocation {
  readonly portfolio = input.required<Portfolio>();

  protected readonly slices = computed(() => {
    const p = this.portfolio();
    const groups = new Map<string, number>([['CASH', p.cash]]);
    for (const pos of p.positions) {
      groups.set(pos.assetClass, (groups.get(pos.assetClass) ?? 0) + pos.marketValue);
    }
    const total = [...groups.values()].reduce((a, b) => a + b, 0) || 1;
    return [...groups.entries()].map(([key, value]) => ({ key, value, pct: (value / total) * 100, color: COLORS[key] }));
  });
}
