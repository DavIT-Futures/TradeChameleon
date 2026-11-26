import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { InstrumentStats, NewsItem } from '../../api/types';

/** Client sentiment (share of long positions) and the latest headlines for one instrument. */
@Component({
  selector: 'tc-news-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-labelledby="news-title">
      <h2 id="news-title">Sentiment &amp; news</h2>
      @if (sentiment(); as s) {
        <div class="stack" style="gap: .3rem">
          <div class="row spread" style="font-size: .85rem">
            <span class="up">{{ s.longPct }}% long</span><span class="muted">clients of this broker</span><span class="down">{{ 100 - s.longPct }}% short</span>
          </div>
          <div class="sentiment-bar" role="img" [attr.aria-label]="s.longPct + '% of clients are long'">
            <span class="long" [style.flex]="s.longPct"></span><span class="short" [style.flex]="100 - s.longPct"></span>
          </div>
        </div>
      }
      <ul class="news">
        @for (n of news.value(); track n.id) {
          <li>
            <span class="news__meta">
              <span class="badge" [class.badge--up]="n.sentiment === 'POSITIVE'" [class.badge--down]="n.sentiment === 'NEGATIVE'">{{ n.sentiment.toLowerCase() }}</span>
              {{ n.time.slice(11, 16) }} UTC · {{ n.source }}
            </span>
            <span class="news__title">{{ n.headline }}</span>
          </li>
        } @empty {
          <li class="muted">No headlines in the last 24 hours.</li>
        }
      </ul>
    </section>
  `,
})
export class NewsCard {
  readonly symbol = input.required<string>();

  protected readonly news = httpResource<NewsItem[]>(
    () => ({ url: '/api/market/news', params: { symbol: this.symbol(), limit: 5 } }),
    { defaultValue: [] },
  );
  private readonly stats = httpResource<InstrumentStats[]>(() => '/api/market/stats', { defaultValue: [] });
  protected readonly sentiment = computed(() => this.stats.value().find((s) => s.symbol === this.symbol()));
}
