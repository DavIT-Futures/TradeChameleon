import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth';
import { authInterceptor, tenantInterceptor } from './interceptors';
import { TenantService } from './tenant';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([tenantInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(TenantService).requestedId.set('wisla');
  });

  afterEach(() => backend.verify());

  it('adds the tenant header', () => {
    http.get('/api/tenants/current').subscribe();
    const req = backend.expectOne('/api/tenants/current');
    expect(req.request.headers.get('X-Tenant-Id')).toBe('wisla');
    req.flush({});
  });

  it('adds the bearer token after login, but not to the login call itself', async () => {
    const auth = TestBed.inject(AuthService);
    const login = auth.login('trader@wisla.test', 'demo');
    const tokenReq = backend.expectOne('/api/auth/token');
    expect(tokenReq.request.headers.has('Authorization')).toBe(false);
    tokenReq.flush({ accessToken: 'abc', tokenType: 'Bearer', expiresIn: 60,
      user: { id: '1', name: 'T', email: 'trader@wisla.test', roles: ['TRADER'], tenant: 'wisla' } });
    await login;

    http.get('/api/portfolio').subscribe();
    expect(backend.expectOne('/api/portfolio').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('logs out on 401', async () => {
    const auth = TestBed.inject(AuthService);
    const login = auth.login('x', 'y');
    backend.expectOne('/api/auth/token').flush({ accessToken: 'abc', tokenType: 'Bearer', expiresIn: 60,
      user: { id: '1', name: 'T', email: null, roles: ['VIEWER'], tenant: 'wisla' } });
    await login;
    http.get('/api/portfolio').subscribe({ error: () => undefined });
    backend.expectOne('/api/portfolio').flush({ title: 'Authentication required' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBe(false);
  });
});
