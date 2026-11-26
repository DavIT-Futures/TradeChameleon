import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { CashTransaction, ClosedTrade, Portfolio, Problem } from '../../api/types';
import { AuthService } from '../../core/auth';
import { MoneyPipe, PricePipe, QuantityPipe } from '../../core/format';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast';

/** Account: deposits/withdrawals, the cash statement and closed trades with realised P&L. */
@Component({
  selector: 'tc-account',
  imports: [FormsModule, MoneyPipe, PricePipe, QuantityPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header"><h1>Account</h1></div>

      @if (portfolio.value(); as p) {
        <section class="grid grid--kpi">
          <div class="card kpi"><div class="kpi__label">Cash</div><div class="kpi__value">{{ p.cash | money: p.currency }}</div></div>
          <div class="card kpi"><div class="kpi__label">Realised P&amp;L</div>
            <div class="kpi__value" [class.up]="p.realizedPnl >= 0" [class.down]="p.realizedPnl < 0">{{ p.realizedPnl | money: p.currency }}</div></div>
          <div class="card kpi"><div class="kpi__label">Unrealised P&amp;L</div>
            <div class="kpi__value" [class.up]="p.unrealizedPnl >= 0" [class.down]="p.unrealizedPnl < 0">{{ p.unrealizedPnl | money: p.currency }}</div></div>
        </section>
      }

      @if (auth.isTrader()) {
        <section class="card stack">
          <h2>Deposit / withdraw</h2>
          <form class="form-row" (ngSubmit)="move('deposits')">
            <div class="field">
              <label for="amount">Amount ({{ portfolio.value()?.currency }})</label>
              <input id="amount" name="amount" type="number" min="0" step="any" [ngModel]="amount()" (ngModelChange)="amount.set($event)" />
            </div>
            <button class="btn" type="submit" [disabled]="!amount() || busy()">Deposit</button>
            <button class="btn btn--ghost" type="button" [disabled]="!amount() || busy()" (click)="move('withdrawals')">Withdraw</button>
          </form>
          @if (problem(); as pr) {
            <div class="alert alert--error" role="alert"><strong>{{ pr.title }}</strong>{{ pr.detail }}</div>
          }
        </section>
      }

      <div class="grid grid--2">
        <section class="card">
          <h2>Statement</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead>
              <tbody>
                @for (t of statement.value(); track t.id) {
                  <tr>
                    <td>{{ t.createdAt.slice(0, 10) }} {{ t.createdAt.slice(11, 19) }}</td>
                    <td><span class="badge">{{ t.type }}</span> {{ t.description }}</td>
                    <td class="num" [class.up]="t.amount > 0" [class.down]="t.amount < 0">{{ t.amount | money: portfolio.value()?.currency }}</td>
                    <td class="num">{{ t.balanceAfter | money: portfolio.value()?.currency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2>Closed trades</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Closed</th><th>Symbol</th><th class="num">Qty</th><th class="num">Open → Close</th><th class="num">P&amp;L</th></tr></thead>
              <tbody>
                @for (c of closed.value(); track c.id) {
                  <tr>
                    <td>{{ c.closedAt.slice(11, 19) }}</td>
                    <td>{{ c.symbol }}</td>
                    <td class="num">{{ c.quantity | qty }}</td>
                    <td class="num">{{ c.openPrice | price }} → {{ c.closePrice | price }} <span class="muted">{{ c.currency }}</span></td>
                    <td class="num" [class.up]="c.realizedPnl >= 0" [class.down]="c.realizedPnl < 0">{{ c.realizedPnl | money: portfolio.value()?.currency }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="muted">No closed trades yet. Sell something!</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class Account {
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);

  protected readonly portfolio = httpResource<Portfolio>(() => '/api/portfolio');
  protected readonly statement = httpResource<CashTransaction[]>(() => ({ url: '/api/portfolio/transactions', params: { limit: 100 } }), { defaultValue: [] });
  protected readonly closed = httpResource<ClosedTrade[]>(() => ({ url: '/api/portfolio/closed-trades', params: { limit: 100 } }), { defaultValue: [] });

  protected readonly amount = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected async move(kind: 'deposits' | 'withdrawals'): Promise<void> {
    const amount = Number(this.amount());
    if (!(amount > 0)) return;
    this.busy.set(true);
    this.problem.set(null);
    try {
      const tx = await firstValueFrom(this.http.post<CashTransaction>(`/api/portfolio/${kind}`, { amount }));
      this.toasts.show('success', kind === 'deposits' ? 'Deposit booked' : 'Withdrawal booked', `New balance ${tx.balanceAfter}`);
      this.amount.set(null);
      this.portfolio.reload();
      this.statement.reload();
    } catch (e) {
      this.problem.set(toProblem(e));
    } finally {
      this.busy.set(false);
    }
  }
}
