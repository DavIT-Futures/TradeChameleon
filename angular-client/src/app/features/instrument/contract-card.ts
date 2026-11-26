import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { InstrumentView, Quote } from '../../api/types';
import { formatPrice } from '../../core/format';
import { TenantService } from '../../core/tenant';
import { CLASS_LABELS, contractFacts } from '../../shared/market-browse';

/** Contract details that matter for the instrument's asset class (pips for FX, contract value for commodities…). */
@Component({
  selector: 'tc-contract-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-labelledby="contract-title">
      <h2 id="contract-title">{{ labels[instrument().assetClass] }} · contract</h2>
      @if (instrument().description) { <p class="muted">{{ instrument().description }}</p> }
      <dl class="facts">
        @for (f of facts(); track f.label) {
          <dt>{{ f.label }}</dt><dd>{{ f.value }}</dd>
        }
      </dl>
    </section>
  `,
})
export class ContractCard {
  readonly instrument = input.required<InstrumentView>();
  readonly quote = input.required<Quote>();
  private readonly tenant = inject(TenantService);
  protected readonly labels = CLASS_LABELS;

  /** Recomputed on every tick because quote() is a signal input fed by the SSE stream. */
  protected readonly facts = computed(() =>
    contractFacts(this.instrument(), this.quote(), (v, d = 2) => formatPrice(v, d, this.tenant.locale())));
}
