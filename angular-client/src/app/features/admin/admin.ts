import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { BrokerOverview } from '../../api/types';
import { formatMoney } from '../../core/format';
import { TenantService } from '../../core/tenant';
import { buildMatrix, featureScore } from '../../shared/admin-matrix';
import { every } from '../../shared/polling';

/** Platform operator panel: all six brokers side by side, differences highlighted. */
@Component({
  selector: 'tc-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Admin · brokers</h1>
          <p class="muted">One code base, {{ brokers.value().length }} brands. Configuration comes from the database; usage refreshes every 10 s.</p>
        </div>
        <label class="row"><input type="checkbox" [checked]="onlyDifferences()" (change)="onlyDifferences.set(!onlyDifferences())" /> Show only differences</label>
      </div>

      <section class="admin-brands">
        @for (b of brokers.value(); track b.id) {
          <article class="admin-brand" [style.--b-primary]="b.theme.primary" [style.--b-accent]="b.theme.accent"
                   [style.--b-bg]="b.theme.background" [style.--b-surface]="b.theme.surface" [style.--b-text]="b.theme.text"
                   [style.--b-radius]="b.theme.radius" [style.font-family]="b.theme.fontHeading">
            <img [src]="b.logoUrl" alt="" />
            <div>
              <strong>{{ b.name }}</strong>
              <small>{{ b.id }} · {{ b.locale }} · {{ b.currency }}</small>
            </div>
            <span class="swatches" aria-hidden="true"><i class="p"></i><i class="a"></i><i class="bg"></i></span>
            <span class="score" [title]="'Enabled features + asset classes'">{{ score(b) }}</span>
          </article>
        }
      </section>

      <section class="card">
        <div class="table-wrap">
          <table class="table admin-matrix">
            <thead>
              <tr>
                <th>Setting</th>
                @for (b of brokers.value(); track b.id) { <th><img [src]="b.logoUrl" alt="" /> {{ b.name }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.group + r.label; let i = $index) {
                @if (i === 0 || rows()[i - 1].group !== r.group) {
                  <tr class="group"><td [attr.colspan]="brokers.value().length + 1">{{ r.group }}</td></tr>
                }
                <tr [class.same]="!r.differs">
                  <th scope="row">{{ r.label }}</th>
                  @for (c of r.cells; track $index) {
                    <td>
                      @if (c === true) { <span class="yes" aria-label="yes">✓</span> }
                      @else if (c === false) { <span class="no" aria-label="no">✗</span> }
                      @else { {{ c }} }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Admin {
  private readonly tenant = inject(TenantService);
  protected readonly brokers = httpResource<BrokerOverview[]>(() => '/api/admin/tenants', { defaultValue: [] });
  protected readonly onlyDifferences = signal(false);

  protected readonly rows = computed(() => {
    const all = buildMatrix(this.brokers.value(), (v, c) => formatMoney(v, c, this.tenant.locale()));
    return this.onlyDifferences() ? all.filter((r) => r.differs) : all;
  });

  constructor() {
    every(10_000, () => this.brokers.reload());
  }

  protected score(b: BrokerOverview): number {
    return featureScore(b);
  }
}
