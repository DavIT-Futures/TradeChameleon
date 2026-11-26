import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { InstrumentView, PricePoint } from '../../api/types';
import { PercentPipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { SERIES_COLORS, Series, compareGeometry } from '../../shared/insights';

const WIDTH = 720;
const HEIGHT = 300;

/**
 * Relative performance of up to four instruments, rebased to 0% at the start of the window.
 * Uses resource() with a custom loader to fetch several histories in parallel.
 */
@Component({
  selector: 'tc-compare',
  imports: [FormsModule, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Compare</h1>
        <div class="row">
          <label class="sr-only" for="add">Add instrument</label>
          <select id="add" [ngModel]="''" (ngModelChange)="add($event)" [disabled]="symbols().length >= 4">
            <option value="">+ Add instrument (max 4)</option>
            @for (i of instruments.value(); track i.symbol) {
              @if (!symbols().includes(i.symbol)) { <option [value]="i.symbol">{{ i.symbol }} · {{ i.name }}</option> }
            }
          </select>
        </div>
      </div>

      <section class="card stack">
        <div class="legend">
          @for (l of geometry().lines; track l.symbol; let idx = $index) {
            <span>
              <i [style.background]="colors[idx]"></i><strong>{{ l.symbol }}</strong>
              <span [class.up]="l.last >= 0" [class.down]="l.last < 0">{{ l.last | pct }}</span>
              <button class="btn btn--ghost btn--small" type="button" (click)="remove(l.symbol)" [attr.aria-label]="'Remove ' + l.symbol">×</button>
            </span>
          }
        </div>
        @if (geometry().lines.length) {
          <svg class="chart" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" aria-label="Relative performance">
            @for (t of geometry().yTicks; track $index) {
              <line class="chart__grid" x1="8" [attr.x2]="width - 56" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="chart__label" [attr.x]="width - 50" [attr.y]="t.y + 4">{{ t.value.toFixed(2) }}%</text>
            }
            <line class="zero" x1="8" [attr.x2]="width - 56" [attr.y1]="geometry().zeroY" [attr.y2]="geometry().zeroY" />
            @for (l of geometry().lines; track l.symbol; let idx = $index) {
              <path class="series" [attr.d]="l.d" [style.stroke]="colors[idx]" />
            }
          </svg>
        } @else {
          <p class="muted">{{ histories.isLoading() ? 'Loading…' : 'Add instruments to compare them.' }}</p>
        }
        <p class="muted" style="font-size: .85rem">Last ~10 minutes of ticks, each series rebased to 0% at the start; live ticks are appended.</p>
      </section>
    </div>
  `,
})
export class Compare {
  private readonly http = inject(HttpClient);
  private readonly stream = inject(PriceStreamService);
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly colors = SERIES_COLORS;

  /** ?symbols=AAPL,MSFT query parameter (withComponentInputBinding). */
  readonly symbolsParam = input<string>(undefined, { alias: 'symbols' });
  protected readonly symbols = linkedSignal(() =>
    (this.symbolsParam() ?? 'SPY,AAPL').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4));

  protected readonly instruments = httpResource<InstrumentView[]>(() => '/api/market/instruments', { defaultValue: [] });

  /** resource(): params is a signal-derived value; the loader runs again whenever it changes. */
  protected readonly histories = resource({
    params: () => ({ symbols: this.symbols() }),
    loader: ({ params }) => Promise.all(params.symbols.map(async (symbol) => ({
      symbol,
      points: (await firstValueFrom(this.http.get<PricePoint[]>(`/api/market/instruments/${symbol}/history`, { params: { points: 600 } })))
        .map((p) => ({ t: Date.parse(p.t), price: p.price })),
    }))),
  });

  protected readonly geometry = computed(() => {
    const live = this.stream.quotes();
    const series: Series[] = (this.histories.value() ?? []).map((s) => {
      const q = live.get(s.symbol);
      const t = q ? Date.parse(q.timestamp) : 0;
      return q && t > (s.points[s.points.length - 1]?.t ?? 0) ? { ...s, points: [...s.points, { t, price: q.mid }] } : s;
    });
    return compareGeometry(series, WIDTH, HEIGHT);
  });

  protected add(symbol: string): void {
    if (symbol && !this.symbols().includes(symbol) && this.symbols().length < 4) this.update([...this.symbols(), symbol]);
  }

  protected remove(symbol: string): void {
    this.update(this.symbols().filter((s) => s !== symbol));
  }

  private update(next: string[]): void {
    this.symbols.set(next);
    history.replaceState(null, '', `/compare?symbols=${next.join(',')}`);
  }
}
