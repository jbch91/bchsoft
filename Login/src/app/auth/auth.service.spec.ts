import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const LOGIN_RESPONSE = {
  user: {
    sub: 'user-1',
    username: 'ingeniero',
    displayName: 'Ingeniero de prueba',
    clientId: 'client-1',
    roles: ['ingeniero_biomedico'],
    permissions: ['hb:view']
  },
  accessToken: 'access-1',
  refreshToken: 'refresh-1'
};

describe('AuthService session coordination', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    router.navigate.mockReset();
    router.navigateByUrl.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  async function login(): Promise<void> {
    const promise = auth.login('ingeniero', 'ClaveSegura1');
    http.expectOne((request) => request.url.endsWith('/auth/login')).flush(LOGIN_RESPONSE);
    expect(await promise).toEqual({ ok: true });
  }

  it('comparte una sola renovación entre solicitudes simultáneas', async () => {
    await login();

    const first = auth.refreshSession();
    const second = auth.refreshSession();
    const request = http.expectOne((item) => item.url.endsWith('/auth/refresh'));
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({
      ...LOGIN_RESPONSE,
      accessToken: 'access-2',
      refreshToken: 'refresh-2'
    });

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(auth.tokens()?.refreshToken).toBe('refresh-2');
    http.expectNone((item) => item.url.endsWith('/auth/refresh'));
  });

  it('conserva la sesión si el servidor está temporalmente fuera de línea', async () => {
    await login();

    const validation = auth.initializeSession(true);
    http.expectOne((item) => item.url.includes('/auth/me')).error(new ProgressEvent('network'));

    expect(await validation).toBe(false);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.sessionState()).toBe('connection-error');
    expect(auth.sessionValidationMessage()).toContain('se conservaron');
  });

  it('elimina únicamente la sesión local cuando el refresh fue revocado', async () => {
    await login();

    const refresh = auth.refreshSession();
    http.expectOne((item) => item.url.endsWith('/auth/refresh')).flush(
      { code: 'SESSION_REPLACED', message: 'Sesión revocada.' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(await refresh).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'replaced' },
      replaceUrl: true
    });
  });
});
