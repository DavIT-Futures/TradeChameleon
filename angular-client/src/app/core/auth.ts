import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { TokenResponse, UserProfile } from '../api/types';

interface Session {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

const KEY = 'tc.session';

/**
 * Holds the access token in memory (signal) and in sessionStorage so a page refresh keeps you logged in
 * but closing the tab logs you out. Tokens are tenant-bound: a session of another tenant is ignored.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = signal<Session | null>(this.restore());

  readonly token = computed(() => this.session()?.token ?? null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly isTrader = computed(() => this.user()?.roles.includes('TRADER') ?? false);
  readonly isAdmin = computed(() => this.user()?.roles.includes('ADMIN') ?? false);
  readonly tenantId = computed(() => this.user()?.tenant ?? null);

  async login(username: string, password: string): Promise<UserProfile> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>('/api/auth/token', { username, password }),
    );
    const session: Session = { token: res.accessToken, user: res.user, expiresAt: Date.now() + res.expiresIn * 1000 };
    sessionStorage.setItem(KEY, JSON.stringify(session));
    this.session.set(session);
    return res.user;
  }

  logout(): void {
    sessionStorage.removeItem(KEY);
    this.session.set(null);
  }

  /** Decoded JWT payload, for the developer panel. Never trust this for security decisions. */
  claims(): Record<string, unknown> | null {
    const token = this.token();
    if (!token) return null;
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Session) : null;
      return s && s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}
