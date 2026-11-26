import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AssetClass, NewsItem } from '../../api/types';
import { TenantService } from '../../core/tenant';
import { CLASS_LABELS } from '../../shared/market-browse';
import { every } from '../../shared/polling';

/** News feed of the last 24 hours, filterable by asset class. */
@Component({
  selector: 'tc-news',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Market news</h1>
        <div class="chips" role="group" aria-label="Asset class">
          <button class="chip" type="button" [attr.aria-pressed]="assetClass() === null" (click)="assetClass.set(null)">All</button>
          @for (c of tenant.tenant()?.allowedAssetClasses ?? []; track c) {
            @if (c !== 'OPTION') {
              <button class="chip" type="button" [attr.aria-pressed]="assetClass() === c" (click)="assetClass.set(c)">{{ labels[c] }}</button>
            }
          }
        </div>
      </div>
      <section class="card">
        <ul class="news">
          @for (n of news.value(); track n.id) {
            <li>
              <span class="news__meta">
                <span class="badge" [class.badge--up]="n.sentiment === 'POSITIVE'" [class.badge--down]="n.sentiment === 'NEGATIVE'">{{ n.sentiment.toLowerCase() }}</span>
                <a [routerLink]="['/markets', n.symbol]">{{ n.symbol }}</a> · {{ ago(n.time) }} · {{ n.source }}
              </span>
              <span class="news__title">{{ n.headline }}</span>
              <span class="news__summary">{{ n.summary }}</span>
            </li>
          } @empty {
            <li class="muted">{{ news.isLoading() ? 'Loading…' : 'No headlines in the last 24 hours.' }}</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class News {
  protected readonly tenant = inject(TenantService);
  protected readonly labels = CLASS_LABELS;
  protected readonly assetClass = signal<AssetClass | null>(null);

  protected readonly news = httpResource<NewsItem[]>(() => {
    const params: Record<string, string | number> = { limit: 60 };
    const c = this.assetClass();
    if (c) params['assetClass'] = c;
    return { url: '/api/market/news', params };
  }, { defaultValue: [] });

  constructor() {
    every(60_000, () => this.news.reload());
  }

  protected ago(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
    return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  }
}
