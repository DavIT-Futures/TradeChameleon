import { DestroyRef, inject } from '@angular/core';

/**
 * Calls `fn` every `ms` while the calling component/service lives. Must run in an injection context
 * (field initializer or constructor); DestroyRef clears the timer automatically.
 */
export function every(ms: number, fn: () => void): void {
  const id = setInterval(fn, ms);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
}
