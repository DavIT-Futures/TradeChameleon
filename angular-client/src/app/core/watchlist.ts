import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * The user's watchlist as a signal of symbols. Toggling is optimistic: the star changes at once and
 * rolls back if the server says no.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly http = inject(HttpClient);
  readonly symbols = signal<ReadonlySet<string>>(new Set());

  async load(): Promise<void> {
    this.symbols.set(new Set(await firstValueFrom(this.http.get<string[]>('/api/watchlist'))));
  }

  has(symbol: string): boolean {
    return this.symbols().has(symbol);
  }

  async toggle(symbol: string): Promise<void> {
    const watched = this.has(symbol);
    const next = new Set(this.symbols());
    if (watched) next.delete(symbol);
    else next.add(symbol);
    const previous = this.symbols();
    this.symbols.set(next);
    try {
      await firstValueFrom(watched
        ? this.http.delete<void>(`/api/watchlist/${symbol}`)
        : this.http.put<void>(`/api/watchlist/${symbol}`, null));
    } catch {
      this.symbols.set(previous);
    }
  }
}
