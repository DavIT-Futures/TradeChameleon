import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { InstrumentStats } from '../../api/types';
import { PercentPipe, PricePipe } from '../../core/format';
import { TenantService } from '../../core/tenant';
import { NO_FILTERS, PRESETS, Preset, ScreenFilters, runPreset, screen } from '../../shared/insights';
import { CLASS_LABELS } from '../../shared/market-browse';
import { every } from '../../shared/polling';

/** Screener: one-click presets or custom filters over the backend's per-instrument statistics. */
@Component({
  selector: 'tc-screener',
  imports: [RouterLink, FormsModule, PricePipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header"><h1>Screener</h1><span class="muted">Refreshes every 5 s</span></div>

      <section class="presets" aria-label="Preset screens">
        @for (p of presets; track p.id) {
          <button type="button" [attr.aria-pressed]="preset()?.id === p.id" (click)="preset.set(preset()?.id === p.id ? null : p)">
            {{ p.label }}<small>{{ p.description }}</small>
          </button>
        }
      </section>

      <section class="card stack">
        <h2>Custom filters</h2>
        <form class="form-row" (input)="preset.set(null)">
          <div class="field"><label for="f-class">Class</label>
            <select id="f-class" name="assetClass" [ngModel]="filters().assetClass" (ngModelChange)="patch('assetClass', $event)">
              <option [ngValue]="null">All</option>
              @for (c of classes(); track c) { <option [ngValue]="c">{{ labels[c] }}</option> }
            </select>
          </div>
          <div class="field"><label for="f-minc">Change ≥ %</label>
            <input id="f-minc" name="minChange" type="number" step="0.1" [ngModel]="filters().minChange" (ngModelChange)="patch('minChange', $event)" /></div>
          <div class="field"><label for="f-maxc">Change ≤ %</label>
            <input id="f-maxc" name="maxChange" type="number" step="0.1" [ngModel]="filters().maxChange" (ngModelChange)="patch('maxChange', $event)" /></div>
          <div class="field"><label for="f-minr">RSI ≥</label>
            <input id="f-minr" name="minRsi" type="number" min="0" max="100" [ngModel]="filters().minRsi" (ngModelChange)="patch('minRsi', $event)" /></div>
          <div class="field"><label for="f-maxr">RSI ≤</label>
            <input id="f-maxr" name="maxRsi" type="number" min="0" max="100" [ngModel]="filters().maxRsi" (ngModelChange)="patch('maxRsi', $event)" /></div>
          <div class="field"><label for="f-vol">Volatility ≥ %</label>
            <input id="f-vol" name="minVolatility" type="number" step="0.1" [ngModel]="filters().minVolatility" (ngModelChange)="patch('minVolatility', $event)" /></div>
          <div class="field"><label for="f-spr">Spread ≤ bps</label>
            <input id="f-spr" name="maxSpreadBps" type="number" step="1" [ngModel]="filters().maxSpreadBps" (ngModelChange)="patch('maxSpreadBps', $event)" /></div>
          <button class="btn btn--ghost" type="button" (click)="reset()">Reset</button>
        </form>
      </section>

      <section class="card">
        <h2>{{ preset()?.label ?? 'Results' }} <span class="muted" style="font-weight: 400">({{ results().length }})</span></h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Instrument</th><th>Class</th><th class="num">Price</th><th class="num">Change</th><th class="num">RSI 14</th>
              <th class="num">Volatility 1h</th><th>Range (2h)</th><th class="num">Spread</th><th>Clients long</th>
            </tr></thead>
            <tbody>
              @for (s of results(); track s.symbol) {
                <tr>
                  <td><a [routerLink]="['/markets', s.symbol]">{{ s.symbol }}</a><span class="muted">{{ s.name }}</span></td>
                  <td><span class="badge">{{ labels[s.assetClass] }}</span></td>
                  <td class="num">{{ s.mid | price: s.decimals }}</td>
                  <td class="num" [class.up]="s.changePct >= 0" [class.down]="s.changePct < 0">{{ s.changePct | pct }}</td>
                  <td class="num" [class.up]="(s.rsi14 ?? 50) < 30" [class.down]="(s.rsi14 ?? 50) > 70">{{ s.rsi14 ?? '–' }}</td>
                  <td class="num">{{ s.volatilityPct }}%</td>
                  <td><span class="meter" [title]="s.rangePct + '% of the range'"><span [style.inline-size.%]="s.rangePct"></span></span></td>
                  <td class="num muted">{{ s.spreadBps }} bps</td>
                  <td><span class="sentiment-bar" style="inline-size: 80px" [title]="s.longPct + '% long'">
                    <span class="long" [style.flex]="s.longPct"></span><span class="short" [style.flex]="100 - s.longPct"></span></span></td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="muted">{{ stats.isLoading() ? 'Loading…' : 'Nothing matches right now.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Screener {
  protected readonly tenant = inject(TenantService);
  protected readonly labels = CLASS_LABELS;
  protected readonly presets = PRESETS;

  protected readonly stats = httpResource<InstrumentStats[]>(() => '/api/market/stats', { defaultValue: [] });
  protected readonly preset = signal<Preset | null>(PRESETS[0]);
  protected readonly filters = signal<ScreenFilters>(NO_FILTERS);

  protected readonly classes = computed(() => [...new Set(this.stats.value().map((s) => s.assetClass))]);
  protected readonly results = computed(() => {
    const p = this.preset();
    return p ? runPreset(this.stats.value(), p) : screen(this.stats.value(), this.filters());
  });

  constructor() {
    every(5_000, () => this.stats.reload());
  }

  protected patch<K extends keyof ScreenFilters>(key: K, value: ScreenFilters[K] | '' | undefined): void {
    this.preset.set(null);
    const normalized = value === '' || value === undefined ? null : value;
    this.filters.update((f) => ({ ...f, [key]: normalized }));
  }

  protected reset(): void {
    this.filters.set(NO_FILTERS);
  }
}
