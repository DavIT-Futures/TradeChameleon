import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import type { TokenResponse, UserProfile } from '../api/types';

interface PlatformSession {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

const KEY = 'tc.platform-session';

/**
 * Session of the platform console (super admin). Separate from the broker AuthService on purpose:
 * different login endpoint, different token kind (no tenant, platform=true), different storage key.
 */
@Injectable({ providedIn: 'root' })
export class PlatformAuth {
  private readonly http = inject(HttpClient);
  private readonly session = signal<PlatformSession | null>(this.restore());

  readonly token = computed(() => this.session()?.token ?? null);
  readonly user = computed(() => this.session()?.user ?? null);

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<TokenResponse>('/api/platform/auth/token', { username, password }));
    const s: PlatformSession = { token: res.accessToken, user: res.user, expiresAt: Date.now() + res.expiresIn * 1000 };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    this.session.set(s);
  }

  logout(): void {
    sessionStorage.removeItem(KEY);
    this.session.set(null);
  }

  private restore(): PlatformSession | null {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as PlatformSession | null;
      return s && s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}

/** Platform token on every call except the login itself; a 401 ends the session. */
export const platformInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(PlatformAuth);
  const token = auth.token();
  const isLogin = req.url.startsWith('/api/platform/auth/');
  const authReq = token && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLogin) auth.logout();
      return throwError(() => error);
    }),
  );
};
