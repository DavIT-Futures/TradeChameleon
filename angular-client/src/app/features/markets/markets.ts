import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AssetClass, ClassOverview, InstrumentView } from '../../api/types';
import { PercentPipe, PricePipe } from '../../core/format';
import { PriceStreamService } from '../../core/price-stream';
import { TenantService } from '../../core/tenant';
import { WatchlistService } from '../../core/watchlist';
import { Flash } from '../../shared/flash';
import { CLASS_LABELS, SORTS, SortKey, matches, sortRows, spreadBps, spreadPips } from '../../shared/market-browse';
import { Sparkline } from '../../shared/sparkline';

type Tab = 'ALL' | 'WATCH' | AssetClass;

/**
 * Market browser: overview cards per asset class, class tabs, sub-category chips, search and sorting.
 * The selected tab is a query parameter (?class=FX), so links and the back button work.
 */
@Component({
  selector: 'tc-markets',
  imports: [RouterLink, FormsModule, PricePipe, PercentPipe, Sparkline, Flash],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header"><h1>Markets</h1></div>

      <section class="overview" aria-label="Market overview">
        @for (o of overview.value(); track o.assetClass) {
          <button type="button" [attr.aria-pressed]="tab() === o.assetClass" (click)="select(o.assetClass)">
            <span class="ov-title">{{ labels[o.assetClass] }}
              @if (o.assetClass !== 'OPTION') {
                <span [class.up]="o.avgChangePct >= 0" [class.down]="o.avgChangePct < 0">{{ o.avgChangePct | pct }}</span>
              }
            </span>
            @if (o.assetClass === 'OPTION') {
              <span class="ov-meta">{{ o.instruments }} underlyings with option chains</span>
            } @else {
              <span class="breadth" aria-hidden="true">
                <span class="g" [style.flex]="o.gainers"></span><span class="l" [style.flex]="o.losers"></span>
              </span>
              <span class="ov-meta">{{ o.instruments }} · ▲ {{ o.best?.symbol }} {{ o.best?.changePct | pct }} · ▼ {{ o.worst?.symbol }} {{ o.worst?.changePct | pct }}</span>
            }
          </button>
        }
      </section>

      <section class="card stack">
        <div class="tabs" role="tablist" aria-label="Asset class">
          <button role="tab" [attr.aria-selected]="tab() === 'ALL'" (click)="select('ALL')">All<small>{{ all().length }}</small></button>
          <button role="tab" [attr.aria-selected]="tab() === 'WATCH'" (click)="select('WATCH')">★ Watchlist<small>{{ watchlist.symbols().size }}</small></button>
          @for (c of classes(); track c.assetClass) {
            <button role="tab" [attr.aria-selected]="tab() === c.assetClass" (click)="select(c.assetClass)">{{ labels[c.assetClass] }}<small>{{ c.count }}</small></button>
          }
        </div>

        <div class="toolbar">
          <div class="chips" role="group" aria-label="Category">
            @if (categories().length > 1) {
              <button class="chip" type="button" [attr.aria-pressed]="category() === null" (click)="category.set(null)">All</button>
              @for (c of categories(); track c) {
                <button class="chip" type="button" [attr.aria-pressed]="category() === c" (click)="category.set(c)">{{ c }}</button>
              }
            }
          </div>
          <div class="row">
            <div class="field">
              <label class="sr-only" for="search">Search</label>
              <input id="search" type="search" placeholder="Search symbol, name, sector…" [ngModel]="search()" (ngModelChange)="search.set($event)" />
            </div>
            <div class="field">
              <label class="sr-only" for="sort">Sort</label>
              <select id="sort" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
                @for (s of sorts; track s.key) { <option [value]="s.key">{{ s.label }}</option> }
              </select>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          @if (tab() === 'OPTION') {
            <table class="table">
              <thead><tr><th>Underlying</th><th>Class</th><th class="num">Last</th><th class="num">Change</th><th></th></tr></thead>
              <tbody>
                @for (r of rows(); track r.instrument.symbol) {
                  <tr>
                    <td><a [routerLink]="[r.instrument.symbol]" fragment="options">{{ r.instrument.symbol }}</a><span class="muted">{{ r.instrument.name }}</span></td>
                    <td><span class="badge">{{ labels[r.instrument.assetClass] }}</span></td>
                    <td class="num">{{ r.quote.mid | price: r.instrument.decimals }}</td>
                    <td class="num" [class.up]="r.quote.changePct >= 0" [class.down]="r.quote.changePct < 0">{{ r.quote.changePct | pct }}</td>
                    <td><a class="btn btn--ghost btn--small" [routerLink]="[r.instrument.symbol]" fragment="options">Option chain →</a></td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <table class="table">
              <thead>
                <tr>
                  <th><span class="sr-only">Watch</span></th><th>Instrument</th><th>Category</th><th>Trend</th>
                  <th class="num">Bid</th><th class="num">Ask</th><th class="num">Spread</th><th class="num">Change</th>
                </tr>
              </thead>
              <tbody>
                @if (instruments.isLoading()) {
                  @for (i of [1, 2, 3, 4, 5, 6]; track i) { <tr><td colspan="8"><div class="skeleton"></div></td></tr> }
                }
                @for (r of rows(); track r.instrument.symbol) {
                  <tr>
                    <td><button class="star" type="button" [attr.aria-pressed]="watchlist.symbols().has(r.instrument.symbol)"
                                [attr.aria-label]="'Watch ' + r.instrument.symbol" (click)="watchlist.toggle(r.instrument.symbol)">★</button></td>
                    <td>
                      <a [routerLink]="[r.instrument.symbol]">{{ r.instrument.symbol }}</a>
                      <div class="muted" style="font-size: .8rem">{{ r.instrument.name }} · {{ r.instrument.exchange }}</div>
                    </td>
                    <td><span class="badge">{{ labels[r.instrument.assetClass] }}</span> <span class="muted" style="font-size: .8rem">{{ r.instrument.category }}</span></td>
                    <td><tc-sparkline [values]="stream.sparklines()[r.instrument.symbol] ?? []" /></td>
                    <td class="num" [tcFlash]="r.quote.bid">{{ r.quote.bid | price: r.instrument.decimals }}</td>
                    <td class="num" [tcFlash]="r.quote.ask">{{ r.quote.ask | price: r.instrument.decimals }}</td>
                    <td class="num muted">{{ spread(r.instrument, r.quote) }}</td>
                    <td class="num" [class.up]="r.quote.changePct >= 0" [class.down]="r.quote.changePct < 0">{{ r.quote.changePct | pct }}</td>
                  </tr>
                } @empty {
                  @if (!instruments.isLoading()) { <tr><td colspan="8" class="muted">No instruments match.</td></tr> }
                }
              </tbody>
            </table>
          }
        </div>
      </section>
    </div>
  `,
})
export class Markets {
  protected readonly tenant = inject(TenantService);
  protected readonly stream = inject(PriceStreamService);
  protected readonly watchlist = inject(WatchlistService);

  /** ?class=FX query parameter, bound by withComponentInputBinding(). */
  readonly class = input<string>();

  protected readonly labels = CLASS_LABELS;
  protected readonly sorts = SORTS;
  protected readonly instruments = httpResource<InstrumentView[]>(() => '/api/market/instruments', { defaultValue: [] });
  protected readonly overview = httpResource<ClassOverview[]>(() => '/api/market/overview', { defaultValue: [] });

  /** Writable, but follows the query parameter whenever it changes. */
  protected readonly tab = linkedSignal<Tab>(() => (this.class() as Tab | undefined) ?? 'ALL');
  /** Resets to "all categories" whenever the tab changes. */
  protected readonly category = linkedSignal<Tab, string | null>({ source: this.tab, computation: () => null });
  protected readonly search = signal('');
  protected readonly sort = signal<SortKey>('symbol');

  /** Static data merged with the latest streamed quotes. */
  protected readonly all = computed(() => {
    const live = this.stream.quotes();
    return this.instruments.value().map((i) => ({ instrument: i, quote: live.get(i.symbol) ?? i.quote }));
  });

  protected readonly classes = computed(() => {
    const counts = new Map<AssetClass, number>();
    for (const r of this.all()) counts.set(r.instrument.assetClass, (counts.get(r.instrument.assetClass) ?? 0) + 1);
    const order = Object.keys(CLASS_LABELS);
    const result = [...counts.entries()]
      .map(([assetClass, count]) => ({ assetClass, count }))
      .sort((a, b) => order.indexOf(a.assetClass) - order.indexOf(b.assetClass));
    const optionable = this.all().filter((r) => r.instrument.optionChain).length;
    if (optionable) result.push({ assetClass: 'OPTION', count: optionable });
    return result;
  });

  private readonly inTab = computed(() => {
    const tab = this.tab();
    return this.all().filter((r) =>
      tab === 'ALL' ? true
        : tab === 'WATCH' ? this.watchlist.symbols().has(r.instrument.symbol)
        : tab === 'OPTION' ? r.instrument.optionChain
        : r.instrument.assetClass === tab);
  });

  protected readonly categories = computed(() =>
    this.tab() === 'ALL' || this.tab() === 'WATCH' || this.tab() === 'OPTION'
      ? [] : [...new Set(this.inTab().map((r) => r.instrument.category))].sort());

  protected readonly rows = computed(() => sortRows(
    this.inTab()
      .filter((r) => this.category() === null || r.instrument.category === this.category())
      .filter((r) => matches(r.instrument, this.search())),
    this.sort()));

  protected select(tab: Tab): void {
    this.tab.set(tab);
    history.replaceState(null, '', tab === 'ALL' ? '/markets' : `/markets?class=${tab}`);
  }

  protected spread(i: InstrumentView, q: { bid: number; ask: number; mid: number }): string {
    return i.assetClass === 'FX' && i.pipSize ? `${spreadPips(q, i.pipSize).toFixed(1)} pips` : `${spreadBps(q).toFixed(1)} bps`;
  }
}
