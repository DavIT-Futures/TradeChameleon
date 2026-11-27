import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { BrokerOverview } from '../../api/types';
import { TenantService } from '../../core/tenant';
import { AuthService } from '../../core/auth';
import { BrokerEditor } from './broker-editor';
import { UserManager } from './user-manager';

/**
 * The maintainer's Admin page on their broker's own site: this broker and nothing else. The API
 * (/api/tenant-admin/**) takes the broker from the request, so there is no id to tamper with.
 */
@Component({
  selector: 'tc-admin',
  imports: [BrokerEditor, UserManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Admin · {{ tenant.tenant()?.name }}</h1>
          <p class="muted">You maintain this broker: its branding, catalogue, tools, limits and users. Other brokers are managed in the platform console.</p>
        </div>
      </div>
      @if (broker.value(); as b) {
        <section class="card">
          <div class="row">
            <span class="badge">{{ b.users }} users</span>
            <span class="badge">{{ b.traders }} traders</span>
            <span class="badge">{{ b.instruments }} instruments</span>
            <span class="badge">{{ b.openOrders }} open orders</span>
            <span class="badge">{{ b.filledOrders }} filled orders</span>
          </div>
        </section>
        <tc-broker-editor #editor [broker]="b" heading="Settings" [closable]="false"
                          saveUrl="/api/tenant-admin/broker" changesUrl="/api/tenant-admin/changes"
                          optionsUrl="/api/tenant-admin/settings-options" (saved)="onSaved()" />
        <tc-user-manager baseUrl="/api/tenant-admin/users" [selfId]="auth.user()?.id ?? null" (changed)="editor.reloadChanges(); broker.reload()" />
      }
    </div>
  `,
})
export class Admin {
  protected readonly tenant = inject(TenantService);
  protected readonly auth = inject(AuthService);
  protected readonly broker = httpResource<BrokerOverview>(() => '/api/tenant-admin/broker');

  /** The maintainer is looking at their own broker: re-skin the site right away. */
  protected async onSaved(): Promise<void> {
    this.broker.reload();
    await this.tenant.load();
  }
}
