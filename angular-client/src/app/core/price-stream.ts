import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Quote } from '../api/types';
import { TenantService } from './tenant';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'error';

const SPARK_POINTS = 60;

/**
 * Live prices over Server-Sent Events, exposed as signals.
 *
 * EventSource reconnects automatically; it cannot send custom headers, so the tenant travels as
 * ?tenant=. Market data is public, so no token is needed. With zoneless change detection nothing
 * else is required: writing a signal schedules a render of every view that reads it.
 */
@Injectable({ providedIn: 'root' })
export class PriceStreamService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantService);
  private source: EventSource | null = null;

  readonly status = signal<StreamStatus>('idle');
  readonly quotes = signal<ReadonlyMap<string, Quote>>(new Map());
  readonly sparklines = signal<Readonly<Record<string, number[] | undefined>>>({});
  readonly lastTick = signal<Date | null>(null);
  readonly quoteList = computed(() => [...this.quotes().values()]);

  connect(): void {
    if (this.source) return;
    this.status.set('connecting');
    this.http.get<Record<string, number[]>>('/api/market/sparklines', { params: { points: SPARK_POINTS } })
      .subscribe((history) =>
        // ticks that arrived before the history response are appended after it
        this.sparklines.update((live) => {
          const merged: Record<string, number[] | undefined> = {};
          for (const [symbol, line] of Object.entries(history)) {
            merged[symbol] = [...line, ...(live[symbol] ?? [])].slice(-SPARK_POINTS);
          }
          return merged;
        }),
      );

    const id = this.tenant.id();
    this.source = new EventSource(`/api/market/stream${id ? `?tenant=${encodeURIComponent(id)}` : ''}`);
    this.source.onopen = () => this.status.set('live');
    this.source.onerror = () => this.status.set(this.source?.readyState === EventSource.CLOSED ? 'error' : 'connecting');
    this.source.addEventListener('quotes', (event) => this.onQuotes(JSON.parse((event as MessageEvent<string>).data)));
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    this.status.set('idle');
  }

  quote(symbol: string): Quote | undefined {
    return this.quotes().get(symbol);
  }

  private onQuotes(list: Quote[]): void {
    this.status.set('live');
    this.quotes.set(new Map(list.map((q) => [q.symbol, q])));
    this.sparklines.update((lines) => {
      const next: Record<string, number[] | undefined> = { ...lines };
      for (const q of list) {
        const line = next[q.symbol] ?? [];
        next[q.symbol] = [...line.slice(-(SPARK_POINTS - 1)), q.mid];
      }
      return next;
    });
    this.lastTick.set(new Date());
  }
}
