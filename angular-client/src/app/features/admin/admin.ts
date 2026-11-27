import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AssetClass, BrokerOverview, Problem, SettingsOptions, TenantChange, TenantSettings } from '../../api/types';
import { formatMoney } from '../../core/format';
import { TenantService } from '../../core/tenant';
import { ToastService } from '../../core/toast';
import { buildMatrix, featureScore } from '../../shared/admin-matrix';
import {
  COLOR_FIELDS, FEATURE_FIELDS, LOCALES, changedFields, fieldError, parseLimit, radiusPx, toSettings, toggleClass,
} from '../../shared/admin-settings';
import { every } from '../../shared/polling';

/** Platform operator panel: all brokers side by side, differences highlighted, every setting editable. */
@Component({
  selector: 'tc-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page__header">
        <div>
          <h1>Admin · brokers</h1>
          <p class="muted">One code base, {{ brokers.value().length }} brands. Configuration comes from the database; pick a broker to edit it.</p>
        </div>
        <label class="row"><input type="checkbox" [checked]="onlyDifferences()" (change)="onlyDifferences.set(!onlyDifferences())" /> Show only differences</label>
      </div>

      <section class="admin-brands">
        @for (b of brokers.value(); track b.id) {
          <article class="admin-brand" [class.is-editing]="editingId() === b.id"
                   [style.--b-primary]="b.theme.primary" [style.--b-accent]="b.theme.accent"
                   [style.--b-bg]="b.theme.background" [style.--b-surface]="b.theme.surface" [style.--b-text]="b.theme.text"
                   [style.--b-radius]="b.theme.radius" [style.font-family]="b.theme.fontHeading">
            <img [src]="b.logoUrl" alt="" />
            <div>
              <strong>{{ b.name }}</strong>
              <small>{{ b.id }} · {{ b.locale }} · {{ b.currency }}</small>
            </div>
            <span class="swatches" aria-hidden="true"><i class="p"></i><i class="a"></i><i class="bg"></i></span>
            <span class="score" [title]="'Enabled features + asset classes'">{{ score(b) }}</span>
            <button type="button" class="edit" [attr.aria-pressed]="editingId() === b.id" (click)="edit(b)">✎ Edit</button>
          </article>
        }
      </section>

      @if (draft(); as d) {
        <section class="card" style="container-type: inline-size">
          <div class="row spread">
            <h2>Edit {{ editing()?.name }} <small class="muted">({{ editingId() }})</small></h2>
            @if (dirty().length) { <span class="badge">Unsaved: {{ dirty().join(', ') }}</span> }
          </div>
          @if (problem()?.detail && !problem()?.errors) { <div class="alert alert--error">{{ problem()?.detail }}</div> }

          <div class="broker-editor">
            <form novalidate (submit)="$event.preventDefault(); save()">
              <fieldset>
                <legend>Brand</legend>
                <div class="grid">
                  <div class="field"><label for="ed-name">Name</label>
                    <input id="ed-name" required maxlength="80" [value]="d.name" (input)="set('name', value($event))" />
                    @if (err('name'); as e) { <span class="field__error">{{ e }}</span> }</div>
                  <div class="field"><label for="ed-tagline">Tagline</label>
                    <input id="ed-tagline" maxlength="160" [value]="d.tagline" (input)="set('tagline', value($event))" /></div>
                  <div class="field"><label for="ed-logo">Logo</label>
                    <select id="ed-logo" [value]="d.logoShape" (change)="set('logoShape', value($event))">
                      @for (s of options.value()?.logoShapes ?? []; track s) { <option [value]="s" [selected]="s === d.logoShape">{{ s }}</option> }
                    </select></div>
                  <div class="field"><label for="ed-locale">Locale</label>
                    <input id="ed-locale" list="ed-locales" [value]="d.locale" (input)="set('locale', value($event))" />
                    <datalist id="ed-locales">@for (l of locales; track l) { <option [value]="l"></option> }</datalist>
                    @if (err('locale'); as e) { <span class="field__error">{{ e }}</span> }</div>
                  <div class="field"><label for="ed-currency">Currency</label>
                    <select id="ed-currency" (change)="set('currency', value($event))">
                      @for (c of options.value()?.currencies ?? []; track c) { <option [value]="c" [selected]="c === d.currency">{{ c }}</option> }
                    </select>
                    <small class="muted">Existing accounts keep their currency; limits use the new one.</small></div>
                </div>
              </fieldset>

              <fieldset>
                <legend>Look</legend>
                <div class="colors">
                  @for (c of colorFields; track c.key) {
                    <label class="color">
                      <input type="color" [value]="d.theme[c.key]" (input)="set('theme.' + c.key, value($event))" />
                      <span>{{ c.label }}<br /><code>{{ d.theme[c.key] }}</code></span>
                    </label>
                  }
                </div>
                <div class="grid" style="margin-top: 0.75rem">
                  <div class="field"><label for="ed-radius">Corner radius: {{ d.theme.radius }}</label>
                    <input id="ed-radius" type="range" min="0" max="24" [value]="radius(d.theme.radius)" (input)="set('theme.radius', value($event) + 'px')" /></div>
                  <div class="field"><label for="ed-scheme">Colour scheme</label>
                    <select id="ed-scheme" (change)="set('theme.colorScheme', value($event))">
                      <option value="light" [selected]="d.theme.colorScheme === 'light'">light</option>
                      <option value="dark" [selected]="d.theme.colorScheme === 'dark'">dark</option>
                    </select></div>
                  <div class="field"><label for="ed-font">Body font</label>
                    <input id="ed-font" [value]="d.theme.fontBody" (input)="set('theme.fontBody', value($event))" />
                    @if (err('theme.fontBody'); as e) { <span class="field__error">{{ e }}</span> }</div>
                  <div class="field"><label for="ed-hfont">Heading font</label>
                    <input id="ed-hfont" [value]="d.theme.fontHeading" (input)="set('theme.fontHeading', value($event))" />
                    @if (err('theme.fontHeading'); as e) { <span class="field__error">{{ e }}</span> }</div>
                </div>
              </fieldset>

              <fieldset>
                <legend>Asset classes</legend>
                <div class="checks">
                  @for (c of options.value()?.assetClasses ?? []; track c) {
                    <label class="check"><input type="checkbox" [checked]="d.allowedAssetClasses.includes(c)" (change)="toggleClass(c)" /> {{ c }}</label>
                  }
                </div>
                @if (err('allowedAssetClasses'); as e) { <span class="field__error">{{ e }}</span> }
              </fieldset>

              <fieldset>
                <legend>Features</legend>
                <div class="checks">
                  @for (f of featureFields; track f.key) {
                    <label class="check"><input type="checkbox" [checked]="d.features[f.key]" (change)="set('features.' + f.key, checked($event))" />
                      <span>{{ f.label }} @if (f.hint) { <small>{{ f.hint }}</small> }</span></label>
                  }
                </div>
              </fieldset>

              <fieldset>
                <legend>Pricing and limits</legend>
                <div class="grid">
                  <div class="field"><label for="ed-markup">Spread markup (bps)</label>
                    <input id="ed-markup" type="number" min="0" max="500" [value]="d.spreadMarkupBps" (input)="set('spreadMarkupBps', +value($event))" />
                    @if (err('spreadMarkupBps'); as e) { <span class="field__error">{{ e }}</span> }</div>
                  <div class="field"><label for="ed-maxv">Max order value ({{ d.currency }})</label>
                    <input id="ed-maxv" type="number" min="1" placeholder="unlimited" [value]="d.limits.maxOrderValue ?? ''" (input)="set('limits.maxOrderValue', limit($event))" />
                    @if (err('limits.maxOrderValue'); as e) { <span class="field__error">{{ e }}</span> }</div>
                  <div class="field"><label for="ed-maxo">Max pending orders per client</label>
                    <input id="ed-maxo" type="number" min="0" max="1000" placeholder="unlimited" [value]="d.limits.maxOpenOrders ?? ''" (input)="set('limits.maxOpenOrders', limit($event))" />
                    @if (err('limits.maxOpenOrders'); as e) { <span class="field__error">{{ e }}</span> }</div>
                </div>
              </fieldset>

              <div class="actions">
                <button class="btn btn--primary" type="submit" [disabled]="saving() || !dirty().length">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
                <button class="btn btn--ghost" type="button" [disabled]="!dirty().length" (click)="reset()">Reset</button>
                <button class="btn btn--ghost" type="button" (click)="close()">Close</button>
                <span class="muted">Changes are live for the next request: spreads, limits, features and branding.</span>
              </div>
            </form>

            <div class="stack">
              <aside class="broker-preview" aria-label="Live preview"
                     [style.--b-primary]="d.theme.primary" [style.--b-on-primary]="d.theme.onPrimary" [style.--b-accent]="d.theme.accent"
                     [style.--b-bg]="d.theme.background" [style.--b-surface]="d.theme.surface" [style.--b-text]="d.theme.text"
                     [style.--b-muted]="d.theme.muted" [style.--b-positive]="d.theme.positive" [style.--b-negative]="d.theme.negative"
                     [style.--b-radius]="d.theme.radius" [style.--b-font]="d.theme.fontBody" [style.--b-font-heading]="d.theme.fontHeading">
                <header><img [src]="editing()?.logoUrl" alt="" /> {{ d.name || '…' }}</header>
                <span class="muted">{{ d.tagline }}</span>
                <div class="panel">
                  <div class="row spread"><span>NVDA</span><span class="up">+1.24%</span></div>
                  <div class="row spread"><span>BTCUSD</span><span class="down">−0.87%</span></div>
                  <span class="muted">{{ d.allowedAssetClasses.length }} asset classes · {{ d.spreadMarkupBps }} bps</span>
                </div>
                <div class="row">
                  @for (f of featureFields; track f.key) { @if (d.features[f.key]) { <span class="chip">{{ f.label }}</span> } }
                </div>
                <button type="button" tabindex="-1">{{ d.features.trading ? 'Buy' : 'View portfolio' }}</button>
              </aside>
              <section class="card">
                <h3>Change log</h3>
                <ul class="audit">
                  @for (c of changes.value(); track c.changedAt) {
                    <li><strong>{{ c.changedBy }}</strong> <span class="muted">{{ when(c.changedAt) }}</span>
                      <ul>@for (line of c.changes; track $index) { <li>{{ line }}</li> }</ul></li>
                  } @empty { <li class="muted">No changes yet.</li> }
                </ul>
              </section>
            </div>
          </div>
        </section>
      }

      <section class="card">
        <div class="table-wrap">
          <table class="table admin-matrix">
            <thead>
              <tr>
                <th>Setting</th>
                @for (b of brokers.value(); track b.id) { <th><img [src]="b.logoUrl" alt="" /> {{ b.name }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.group + r.label; let i = $index) {
                @if (i === 0 || rows()[i - 1].group !== r.group) {
                  <tr class="group"><td [attr.colspan]="brokers.value().length + 1">{{ r.group }}</td></tr>
                }
                <tr [class.same]="!r.differs">
                  <th scope="row">{{ r.label }}</th>
                  @for (c of r.cells; track $index) {
                    <td>
                      @if (c === true) { <span class="yes" aria-label="yes">✓</span> }
                      @else if (c === false) { <span class="no" aria-label="no">✗</span> }
                      @else { {{ c }} }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Admin {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantService);
  private readonly toast = inject(ToastService);

  protected readonly brokers = httpResource<BrokerOverview[]>(() => '/api/admin/tenants', { defaultValue: [] });
  protected readonly options = httpResource<SettingsOptions>(() => '/api/admin/settings-options');
  protected readonly onlyDifferences = signal(false);

  protected readonly editingId = signal<string | null>(null);
  protected readonly editing = computed(() => this.brokers.value().find((b) => b.id === this.editingId()) ?? null);
  /** The saved settings of the broker being edited, and the draft the form changes. */
  private readonly saved = signal<TenantSettings | null>(null);
  protected readonly draft = signal<TenantSettings | null>(null);
  protected readonly dirty = computed(() => {
    const s = this.saved();
    const d = this.draft();
    return s && d ? changedFields(s, d) : [];
  });
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly changes = httpResource<TenantChange[]>(
    () => (this.editingId() ? `/api/admin/tenants/${this.editingId()}/changes` : undefined),
    { defaultValue: [] },
  );

  protected readonly colorFields = COLOR_FIELDS;
  protected readonly featureFields = FEATURE_FIELDS;
  protected readonly locales = LOCALES;

  protected readonly rows = computed(() => {
    const all = buildMatrix(this.brokers.value(), (v, c) => formatMoney(v, c, this.tenant.locale()));
    return this.onlyDifferences() ? all.filter((r) => r.differs) : all;
  });

  constructor() {
    // Usage figures refresh; a draft being edited is never overwritten.
    every(10_000, () => this.brokers.reload());
  }

  protected score(b: BrokerOverview): number {
    return featureScore(b);
  }

  protected edit(b: BrokerOverview): void {
    if (this.editingId() === b.id) return this.close();
    this.editingId.set(b.id);
    this.saved.set(toSettings(b));
    this.draft.set(toSettings(b));
    this.problem.set(null);
  }

  protected close(): void {
    this.editingId.set(null);
    this.saved.set(null);
    this.draft.set(null);
    this.problem.set(null);
  }

  protected reset(): void {
    const s = this.saved();
    if (s) this.draft.set(structuredClone(s));
    this.problem.set(null);
  }

  /** Immutable update of one (possibly nested) field: set('theme.primary', '#ff0000'). */
  protected set(path: string, value: unknown): void {
    const d = this.draft();
    if (!d) return;
    const next = structuredClone(d) as unknown as Record<string, Record<string, unknown>>;
    const [head, leaf] = path.split('.');
    if (leaf) next[head][leaf] = value;
    else (next as Record<string, unknown>)[head] = value;
    this.draft.set(next as unknown as TenantSettings);
  }

  protected toggleClass(c: AssetClass): void {
    const d = this.draft();
    if (d) this.set('allowedAssetClasses', toggleClass(d.allowedAssetClasses, c, this.options.value()?.assetClasses ?? []));
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
  protected limit(e: Event): number | null {
    return parseLimit(this.value(e));
  }
  protected radius(r: string): number {
    return radiusPx(r);
  }
  protected err(path: string): string | null {
    return fieldError(this.problem()?.errors, path);
  }
  protected when(iso: string): string {
    return new Date(iso).toLocaleString(this.tenant.locale());
  }

  protected async save(): Promise<void> {
    const id = this.editingId();
    const d = this.draft();
    if (!id || !d) return;
    this.saving.set(true);
    this.problem.set(null);
    try {
      const updated = await firstValueFrom(this.http.put<BrokerOverview>(`/api/admin/tenants/${id}`, d));
      this.saved.set(toSettings(updated));
      this.draft.set(toSettings(updated));
      this.brokers.reload();
      // The audit entry is written asynchronously by an event listener: read it again shortly after.
      this.changes.reload();
      setTimeout(() => this.changes.reload(), 800);
      // Editing the broker this tab belongs to: re-skin right away.
      if (this.tenant.id() === id) await this.tenant.load();
      this.toast.show('success', `${updated.name} saved`, 'Changes are live for the next request.');
    } catch (e) {
      const problem = e instanceof HttpErrorResponse ? (e.error as Problem) : { detail: String(e) };
      this.problem.set(problem);
      this.toast.show('error', problem?.title ?? 'Saving failed', problem?.detail);
    } finally {
      this.saving.set(false);
    }
  }
}
