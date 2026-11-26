import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EconomicEvent } from '../../api/types';
import { TenantService } from '../../core/tenant';

const FLAGS: Record<string, string> = { US: '🇺🇸', EU: '🇪🇺', DE: '🇩🇪', GB: '🇬🇧', PL: '🇵🇱', JP: '🇯🇵', CN: '🇨🇳', AU: '🇦🇺' };

/** Economic calendar grouped by day, filtered by importance and country. */
@Component({
  selector: 'tc-calendar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Economic calendar</h1>
          <p class="muted">Times in your time zone · simulated releases</p>
        </div>
        <div class="row">
          <div class="segmented" role="group" aria-label="Importance">
            @for (i of [1, 2, 3]; track i) {
              <button type="button" [attr.aria-pressed]="minImportance() === i" (click)="minImportance.set(i)">{{ '★'.repeat(i) }}+</button>
            }
          </div>
          <div class="chips" role="group" aria-label="Country">
            <button class="chip" type="button" [attr.aria-pressed]="country() === null" (click)="country.set(null)">All</button>
            @for (c of countries(); track c) {
              <button class="chip" type="button" [attr.aria-pressed]="country() === c" (click)="country.set(c)">{{ flags[c] }} {{ c }}</button>
            }
          </div>
        </div>
      </div>

      <section class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Time</th><th>Event</th><th>Impact</th><th class="num">Actual</th><th class="num">Forecast</th><th class="num">Previous</th><th>Moves</th></tr></thead>
            <tbody>
              @for (day of days(); track day.date) {
                <tr><td colspan="7" class="day-head">{{ day.label }}</td></tr>
                @for (e of day.events; track e.id) {
                  <tr [style.opacity]="e.actual === null ? 1 : 0.85">
                    <td>{{ time(e.time) }}</td>
                    <td>{{ flags[e.country] }} <strong>{{ e.title }}</strong> <span class="muted">{{ e.currency }}</span></td>
                    <td class="stars" [attr.aria-label]="e.importance + ' of 3'">
                      @for (s of [1, 2, 3]; track s) { <span [class.off]="s > e.importance">★</span> }
                    </td>
                    <td class="num" [class.up]="e.surprise === 'ABOVE'" [class.down]="e.surprise === 'BELOW'">
                      {{ e.actual === null ? '–' : e.actual + e.unit }}
                    </td>
                    <td class="num">{{ e.forecast }}{{ e.unit }}</td>
                    <td class="num muted">{{ e.previous }}{{ e.unit }}</td>
                    <td><div class="symbol-chips">@for (s of e.symbols; track s) { <a [routerLink]="['/markets', s]">{{ s }}</a> }</div></td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="7" class="muted">{{ events.isLoading() ? 'Loading…' : 'No events for this filter.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Calendar {
  private readonly tenant = inject(TenantService);
  protected readonly flags = FLAGS;
  protected readonly minImportance = signal(1);
  protected readonly country = signal<string | null>(null);

  /** Re-fetched by the server when the importance filter changes; the country is filtered locally. */
  protected readonly events = httpResource<EconomicEvent[]>(
    () => ({ url: '/api/market/calendar', params: { minImportance: this.minImportance() } }),
    { defaultValue: [] },
  );

  protected readonly countries = computed(() => [...new Set(this.events.value().map((e) => e.country))].sort());

  protected readonly days = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.tenant.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
    const groups = new Map<string, EconomicEvent[]>();
    for (const e of this.events.value()) {
      if (this.country() !== null && e.country !== this.country()) continue;
      const key = new Date(e.time).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    const today = new Date().toDateString();
    return [...groups.entries()].map(([date, events]) => ({
      date,
      label: (date === today ? 'Today · ' : '') + fmt.format(new Date(events[0].time)),
      events,
    }));
  });

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString(this.tenant.locale(), { hour: '2-digit', minute: '2-digit' });
  }
}
