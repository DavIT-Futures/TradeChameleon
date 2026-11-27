import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ManagedUser, NewUser, Problem, Role, UserUpdate } from '../../api/types';
import { ToastService } from '../../core/toast';
import { ROLES, selfLockout, sortUsers, summary, toggleRole } from '../../shared/user-admin';

interface RowDraft {
  name: string;
  roles: Role[];
  enabled: boolean;
  password: string;
}

/**
 * Users of one broker: create, change roles, disable, reset the password, delete. Used on the
 * maintainer's Admin page (/api/tenant-admin/users) and in the platform console
 * (/api/platform/tenants/{id}/users); the base URL is an input.
 */
@Component({
  selector: 'tc-user-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <div class="row spread">
        <h2>Users <small class="muted">{{ count() }}</small></h2>
        <button class="btn btn--small" type="button" (click)="creating.set(!creating())">{{ creating() ? 'Cancel' : '+ New user' }}</button>
      </div>

      @if (creating()) {
        <form class="user-new" novalidate (submit)="$event.preventDefault(); create(email.value, name.value, password.value)">
          <div class="field"><label for="u-email">E-mail</label><input #email id="u-email" type="email" />
            @if (err('email'); as e) { <span class="field__error">{{ e }}</span> }</div>
          <div class="field"><label for="u-name">Name</label><input #name id="u-name" />
            @if (err('name'); as e) { <span class="field__error">{{ e }}</span> }</div>
          <div class="field"><label for="u-pass">Password</label><input #password id="u-pass" type="password" autocomplete="new-password" />
            @if (err('password'); as e) { <span class="field__error">{{ e }}</span> }</div>
          <div class="field"><span class="label">Roles</span>
            <div class="row">
              @for (r of roles; track r.key) {
                <label class="check" [title]="r.hint"><input type="checkbox" [checked]="newRoles().includes(r.key)" (change)="newRoles.set(toggle(newRoles(), r.key))" /> {{ r.label }}</label>
              }
            </div>
            @if (err('roles'); as e) { <span class="field__error">{{ e }}</span> }</div>
          <button class="btn btn--primary" type="submit" [disabled]="busy()">Create user</button>
          @if (problem()?.detail && !problem()?.errors) { <div class="alert alert--error">{{ problem()?.detail }}</div> }
        </form>
      }

      <div class="table-wrap">
        <table class="table users-table">
          <thead><tr><th>User</th><th>Roles</th><th>Enabled</th><th>New password</th><th></th></tr></thead>
          <tbody>
            @for (u of sorted(); track u.id) {
              @let d = draftOf(u);
              <tr [class.is-disabled]="!u.enabled">
                <td>
                  <input class="inline" [value]="d.name" (input)="patch(u, { name: value($event) })" aria-label="Name" />
                  <small class="muted">{{ u.email }} @if (u.id === selfId()) { · you }</small>
                </td>
                <td>
                  <div class="row">
                    @for (r of roles; track r.key) {
                      <label class="check" [title]="r.hint"><input type="checkbox" [checked]="d.roles.includes(r.key)" (change)="patch(u, { roles: toggle(d.roles, r.key) })" /> {{ r.label }}</label>
                    }
                  </div>
                </td>
                <td><label class="check"><input type="checkbox" [checked]="d.enabled" (change)="patch(u, { enabled: checked($event) })" /> {{ d.enabled ? 'Active' : 'Disabled' }}</label></td>
                <td><input class="inline" type="password" placeholder="keep" autocomplete="new-password" [value]="d.password" (input)="patch(u, { password: value($event) })" aria-label="New password" /></td>
                <td class="actions-cell">
                  @if (lockReason(u, d); as why) { <small class="field__error">{{ why }}</small> }
                  @else if (dirty(u)) { <button class="btn btn--small" type="button" (click)="save(u)">Save</button> }
                  @if (confirmDelete() === u.id) {
                    <button class="btn btn--small btn--sell" type="button" (click)="remove(u)">Confirm delete</button>
                    <button class="btn btn--ghost btn--small" type="button" (click)="confirmDelete.set(null)">No</button>
                  } @else if (!selfLock(u)) {
                    <button class="btn btn--ghost btn--small" type="button" (click)="confirmDelete.set(u.id)" [attr.aria-label]="'Delete ' + u.email">🗑</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted" style="font-size: .8rem">Deleting a user cancels their open orders and removes alerts and watchlist; their account history is kept.
        A disabled user cannot sign in; a token issued earlier stays valid until it expires.</p>
    </section>
  `,
})
export class UserManager {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  /** /api/tenant-admin/users or /api/platform/tenants/{id}/users */
  readonly baseUrl = input.required<string>();
  /** The signed-in user's id (maintainer page) or null (platform console). */
  readonly selfId = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly users = httpResource<ManagedUser[]>(() => this.baseUrl(), { defaultValue: [] });
  protected readonly sorted = computed(() => sortUsers(this.users.value()));
  protected readonly count = computed(() => summary(this.users.value()));
  protected readonly roles = ROLES;

  protected readonly creating = signal(false);
  protected readonly newRoles = signal<Role[]>(['TRADER']);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);
  private readonly drafts = signal<Record<string, RowDraft>>({});

  protected draftOf(u: ManagedUser): RowDraft {
    return this.drafts()[u.id] ?? { name: u.name, roles: [...u.roles], enabled: u.enabled, password: '' };
  }

  protected patch(u: ManagedUser, change: Partial<RowDraft>): void {
    this.drafts.update((all) => ({ ...all, [u.id]: { ...this.draftOf(u), ...change } }));
  }

  protected dirty(u: ManagedUser): boolean {
    const d = this.drafts()[u.id];
    return !!d && (d.name !== u.name || d.enabled !== u.enabled || d.password !== '' || d.roles.join() !== u.roles.join());
  }

  protected lockReason(u: ManagedUser, d: RowDraft): string | null {
    return selfLockout(u, this.selfId(), d);
  }
  protected selfLock(u: ManagedUser): boolean {
    return selfLockout(u, this.selfId(), 'delete') !== null;
  }

  protected toggle(roles: readonly Role[], r: Role): Role[] {
    return toggleRole(roles, r);
  }
  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
  protected err(path: string): string | null {
    return this.problem()?.errors?.[path] ?? null;
  }

  protected async create(email: string, name: string, password: string): Promise<void> {
    this.busy.set(true);
    this.problem.set(null);
    try {
      const body: NewUser = { email, name, password, roles: this.newRoles() };
      const created = await firstValueFrom(this.http.post<ManagedUser>(this.baseUrl(), body));
      this.toast.show('success', 'User created', created.email);
      this.creating.set(false);
      this.newRoles.set(['TRADER']);
      this.done();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(u: ManagedUser): Promise<void> {
    const d = this.draftOf(u);
    const body: UserUpdate = { name: d.name, roles: d.roles, enabled: d.enabled, password: d.password || null };
    try {
      await firstValueFrom(this.http.put<ManagedUser>(`${this.baseUrl()}/${u.id}`, body));
      this.drafts.update(({ [u.id]: _, ...rest }) => rest);
      this.toast.show('success', 'User updated', u.email);
      this.done();
    } catch (e) {
      this.fail(e);
    }
  }

  protected async remove(u: ManagedUser): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl()}/${u.id}`));
      this.toast.show('success', 'User deleted', u.email);
      this.confirmDelete.set(null);
      this.done();
    } catch (e) {
      this.fail(e);
    }
  }

  private done(): void {
    this.users.reload();
    // audit entries are written asynchronously
    setTimeout(() => this.changed.emit(), 800);
  }

  private fail(e: unknown): void {
    const problem = e instanceof HttpErrorResponse ? (e.error as Problem) : { detail: String(e) };
    this.problem.set(problem);
    if (!problem?.errors) this.toast.show('error', problem?.title ?? 'Request failed', problem?.detail);
  }
}
