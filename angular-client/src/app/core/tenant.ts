import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Tenant, Theme } from '../api/types';
import { SchemePreference, themeFor } from '../shared/insights';

const STORAGE_KEY = 'tc.tenant';
const SCHEME_KEY = 'tc.scheme';

function storedScheme(): SchemePreference {
  try {
    const v = localStorage.getItem(SCHEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'brand';
  } catch {
    return 'brand';
  }
}

/**
 * Which broker does this browser tab belong to? Mirrors the backend's resolution order:
 * 1. subdomain of *.localhost (kestrel.localhost:4200)  2. ?tenant=  3. last choice (localStorage)
 * 4. nothing: the backend picks its default tenant.
 */
export function resolveTenantFromLocation(location: Pick<Location, 'hostname' | 'search'>, storage?: Storage): string | null {
  const host = location.hostname;
  if (host.endsWith('.localhost')) {
    const labels = host.slice(0, -'.localhost'.length).split('.');
    return labels[labels.length - 1];
  }
  const fromQuery = new URLSearchParams(location.search).get('tenant');
  if (fromQuery) {
    storage?.setItem(STORAGE_KEY, fromQuery);
    return fromQuery;
  }
  return storage?.getItem(STORAGE_KEY) ?? null;
}

/** Writes the tenant theme into CSS custom properties; the whole UI re-skins instantly. */
export function applyTheme(tenant: Tenant, root: HTMLElement = document.documentElement, theme: Theme = tenant.theme): void {
  const t = theme;
  const vars: Record<string, string> = {
    '--tc-primary': t.primary,
    '--tc-on-primary': t.onPrimary,
    '--tc-accent': t.accent,
    '--tc-bg': t.background,
    '--tc-surface': t.surface,
    '--tc-text': t.text,
    '--tc-muted': t.muted,
    '--tc-positive': t.positive,
    '--tc-negative': t.negative,
    '--tc-radius': t.radius,
    '--tc-font-body': t.fontBody,
    '--tc-font-heading': t.fontHeading,
  };
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = t.colorScheme;
  root.lang = tenant.locale;
  root.dataset['tenant'] = tenant.id;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);

  /** The id the user asked for (may be null = backend default). Read by the tenant interceptor. */
  readonly requestedId = signal<string | null>(resolveTenantFromLocation(window.location, localStorage));
  private readonly loaded = signal<Tenant | null>(null);

  readonly tenant = this.loaded.asReadonly();
  readonly id = computed(() => this.loaded()?.id ?? this.requestedId());
  readonly locale = computed(() => this.loaded()?.locale ?? 'en-GB');
  readonly currency = computed(() => this.loaded()?.currency ?? 'GBP');
  readonly features = computed(() => this.loaded()?.features);
  /** User override of the broker's colour scheme: 'brand' (default), 'light' or 'dark'. */
  readonly scheme = signal<SchemePreference>(storedScheme());

  constructor() {
    // Re-skin whenever the broker or the user's scheme preference changes.
    effect(() => {
      const tenant = this.loaded();
      if (tenant) applyTheme(tenant, document.documentElement, themeFor(tenant.theme, this.scheme()));
    });
    // An admin may change this broker at any time: pick it up when the tab regains focus and every 30 s.
    const refresh = () => void this.refresh();
    window.addEventListener('focus', refresh);
    setInterval(refresh, 30_000);
  }

  /** Re-reads the broker; only a real change touches the signal (so nothing re-renders needlessly). */
  async refresh(): Promise<void> {
    try {
      const fresh = await firstValueFrom(this.http.get<Tenant>('/api/tenants/current'));
      if (JSON.stringify(fresh) !== JSON.stringify(this.loaded())) await this.load();
    } catch {
      /* offline or backend restarting: keep the current brand */
    }
  }

  /** brand → dark → light → brand */
  cycleScheme(): void {
    const next: SchemePreference = this.scheme() === 'brand' ? 'dark' : this.scheme() === 'dark' ? 'light' : 'brand';
    this.scheme.set(next);
    try {
      localStorage.setItem(SCHEME_KEY, next);
    } catch {
      /* private mode: the choice simply is not remembered */
    }
  }

  /** Called by provideAppInitializer: the app renders only once the brand is known (no flash of wrong theme). */
  async load(): Promise<Tenant> {
    const tenant = await firstValueFrom(this.http.get<Tenant>('/api/tenants/current'));
    this.loaded.set(tenant);
    applyTheme(tenant, document.documentElement, themeFor(tenant.theme, this.scheme()));
    document.title = tenant.name;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = tenant.logoUrl;
    return tenant;
  }

  /** Brand switcher. On a *.localhost subdomain we move to the other subdomain, otherwise we reload in place. */
  async switchTo(id: string): Promise<void> {
    const { protocol, hostname, port } = window.location;
    if (hostname.endsWith('.localhost')) {
      window.location.href = `${protocol}//${id}.localhost${port ? ':' + port : ''}/login`;
      return;
    }
    localStorage.setItem(STORAGE_KEY, id);
    this.requestedId.set(id);
    await this.load();
  }
}
