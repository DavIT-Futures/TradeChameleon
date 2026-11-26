import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast';

@Component({
  selector: 'tc-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="alert" [class.alert--error]="toast.kind === 'error'" [class.alert--success]="toast.kind === 'success'">
          <div class="row spread">
            <strong>{{ toast.title }}</strong>
            <button class="btn btn--ghost btn--small" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">×</button>
          </div>
          @if (toast.detail) { <div>{{ toast.detail }}</div> }
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
