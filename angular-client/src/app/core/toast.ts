import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'error' | 'success' | 'info';
  title: string;
  detail?: string;
}

/** Tiny notification store: a signal holding the visible toasts. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(kind: Toast['kind'], title: string, detail?: string, ttlMs = 5000): void {
    const toast: Toast = { id: this.nextId++, kind, title, detail };
    this.toasts.update((list) => [...list.slice(-3), toast]);
    setTimeout(() => this.dismiss(toast.id), ttlMs);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
