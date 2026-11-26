import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Flashes green/red when the bound value goes up/down. Demonstrates an attribute directive built
 * with a signal input and an effect (no ngOnChanges, no zone).
 */
@Directive({ selector: '[tcFlash]' })
export class Flash {
  readonly tcFlash = input<number | undefined>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous: number | undefined;

  constructor() {
    effect(() => {
      const value = this.tcFlash();
      const prev = this.previous;
      this.previous = value;
      if (value == null || prev == null || value === prev) return;
      const el = this.el.nativeElement;
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add(value > prev ? 'flash-up' : 'flash-down');
    });
  }
}
