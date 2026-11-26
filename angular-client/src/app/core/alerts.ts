import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PriceAlert } from '../api/types';
import { ToastService } from './toast';

/**
 * Polls GET /api/alerts/notifications and turns triggered alerts into toasts, then acknowledges them.
 * Polling keeps the price SSE public and token-free; a per-user SSE channel would be the next step.
 */
@Injectable({ providedIn: 'root' })
export class AlertNotifier {
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Bumped whenever an alert fires, so alert lists can reload. */
  readonly version = signal(0);

  start(intervalMs = 4000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.check(), intervalMs);
    void this.check();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async check(): Promise<void> {
    try {
      const fired = await firstValueFrom(this.http.get<PriceAlert[]>('/api/alerts/notifications'));
      for (const alert of fired) {
        this.toasts.show('info', `🔔 ${alert.symbol} ${alert.condition.toLowerCase()} ${alert.price}`,
          `Triggered at ${alert.triggeredPrice}${alert.note ? ' · ' + alert.note : ''}`, 10_000);
        await firstValueFrom(this.http.post<void>(`/api/alerts/${alert.id}/ack`, null));
      }
      if (fired.length) this.version.update((v) => v + 1);
    } catch {
      /* the problem interceptor already reports server errors */
    }
  }
}
