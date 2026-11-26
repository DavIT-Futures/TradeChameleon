import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { PortfolioRisk } from '../../api/types';
import { MoneyPipe } from '../../core/format';
import { CLASS_LABELS } from '../../shared/market-browse';
import { every } from '../../shared/polling';

/** CFD view of the portfolio: exposure, margin, margin level, leverage and concentration warnings. */
@Component({
  selector: 'tc-risk-card',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-labelledby="risk-title">
      <h2 id="risk-title">Risk &amp; margin <span class="muted" style="font-weight: 400; font-size: .85rem">(if held as CFDs)</span></h2>
      @if (risk.value(); as r) {
        <div class="grid grid--kpi">
          <div class="kpi"><div class="kpi__label">Exposure</div><div class="kpi__value">{{ r.exposure | money: r.currency }}</div></div>
          <div class="kpi"><div class="kpi__label">Margin required</div><div class="kpi__value">{{ r.marginRequired | money: r.currency }}</div></div>
          <div class="kpi"><div class="kpi__label">Free margin</div><div class="kpi__value">{{ r.freeMargin | money: r.currency }}</div></div>
          <div class="kpi"><div class="kpi__label">Margin level · leverage</div>
            <div class="kpi__value">{{ r.marginLevelPct === null ? '–' : r.marginLevelPct + '%' }} · {{ r.leverage }}×</div></div>
        </div>
        @if (r.marginLevelPct !== null) {
          <div class="stack" style="gap: .2rem">
            <div class="risk-gauge" aria-hidden="true"><i [style.inset-inline-start.%]="gauge()"></i></div>
            <div class="row spread muted" style="font-size: .75rem"><span>50% stop-out</span><span>100% margin call</span><span>healthy</span></div>
          </div>
        }
        @if (r.warnings.length) {
          <ul class="warning-list">@for (w of r.warnings; track w) { <li>{{ w }}</li> }</ul>
        }
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Class</th><th class="num">Exposure</th><th class="num">Share</th><th class="num">Margin</th></tr></thead>
            <tbody>
              @for (c of r.byClass; track c.assetClass) {
                <tr>
                  <td>{{ labels[c.assetClass] }}</td>
                  <td class="num">{{ c.exposure | money: r.currency }}</td>
                  <td class="num"><span class="meter"><span [style.inline-size.%]="c.sharePct"></span></span> {{ c.sharePct }}%</td>
                  <td class="num">{{ c.margin | money: r.currency }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="skeleton" style="block-size: 8rem"></div>
      }
    </section>
  `,
})
export class RiskCard {
  protected readonly labels = CLASS_LABELS;
  protected readonly risk = httpResource<PortfolioRisk>(() => '/api/portfolio/risk');

  /** Gauge position: 50% → left edge, 100% → middle, ≥ 1000% → right edge (log scale). */
  protected readonly gauge = computed(() => {
    const level = this.risk.value()?.marginLevelPct ?? 1000;
    return Math.max(0, Math.min(100, (Math.log10(level / 50) / Math.log10(20)) * 100));
  });

  constructor() {
    every(5_000, () => this.risk.reload());
  }
}
