import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SessionTimeoutService } from './session-timeout.service';

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
  const router = {
    navigate: vi.fn(), navigateByUrl: vi.fn(), currentNavigation: vi.fn(),
    url: '/', navigated: false
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    router.navigate.mockReset();
    router.navigateByUrl.mockReset();
    router.currentNavigation.mockReset();
    router.url = '/';
    router.navigated = false;
    window.history.replaceState({}, '', '/');
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
    window.history.replaceState({}, '', '/');
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

  it('conserva temporalmente una ruta interna para continuar después del login', () => {
    expect(auth.rememberPostLoginRoute('/q/asset-1')).toBe('/q/asset-1');
    expect(auth.pendingPostLoginRoute()).toBe('/q/asset-1');

    auth.clearPostLoginRoute();

    expect(auth.pendingPostLoginRoute()).toBeNull();
  });

  it('rechaza retornos externos o hacia el propio login', () => {
    expect(auth.rememberPostLoginRoute('//example.com/steal-session')).toBeNull();
    expect(auth.rememberPostLoginRoute('/login?returnUrl=%2Fq%2Fasset-1')).toBeNull();
    expect(auth.pendingPostLoginRoute()).toBeNull();
  });

  it('conserva el QR antes del guard al cerrar por inactividad una sesión de ayer', async () => {
    await login();
    auth.ngOnDestroy();
    window.history.replaceState({}, '', '/q/asset-1');
    localStorage.setItem('auth_last_activity_v1', String(Date.now() - 24 * 60 * 60 * 1000));
    const restored = new AuthService(TestBed.inject(HttpClient), router as never);
    const timeout = new SessionTimeoutService(restored);
    try {
      timeout.start();
      http.expectOne((item) => item.url.endsWith('/auth/logout')).flush({ ok: true });
      await Promise.resolve();

      expect(restored.isAuthenticated()).toBe(false);
      expect(restored.pendingPostLoginRoute()).toBe('/q/asset-1');
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'inactive', returnUrl: '/q/asset-1' }, replaceUrl: true
      });
      restored.handleSessionFailure('SESSION_REPLACED');
      expect(router.navigate).toHaveBeenLastCalledWith(['/login'], {
        queryParams: { reason: 'replaced', returnUrl: '/q/asset-1' }, replaceUrl: true
      });
    } finally {
      timeout.stop();
      restored.ngOnDestroy();
    }
  });

  it('prioriza el nuevo QR en navegación sobre el equipo que estaba abierto', () => {
    router.url = '/q/asset-1';
    router.navigated = true;
    router.currentNavigation.mockReturnValue({ extractedUrl: { toString: () => '/q/asset-2' } });

    auth.handleSessionFailure();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'expired', returnUrl: '/q/asset-2' }, replaceUrl: true
    });
  });

  it('descarta el destino pendiente al cerrar sesión voluntariamente', () => {
    auth.rememberPostLoginRoute('/q/asset-1');
    auth.logout(true);
    expect(auth.pendingPostLoginRoute()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: undefined, replaceUrl: true
    });
  });

  it('no cierra el nuevo login si termina tarde la validación de la sesión anterior', async () => {
    await login();
    const validation = auth.initializeSession(true);
    const stale = http.expectOne((item) => item.url.includes('/auth/me'));
    const signingIn = auth.login('ingeniero', 'ClaveSegura1');
    http.expectOne((item) => item.url.endsWith('/auth/login')).flush({
      ...LOGIN_RESPONSE, accessToken: 'new-access', refreshToken: 'new-refresh'
    });
    await signingIn;
    stale.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(await validation).toBe(true);
    expect(auth.tokens()?.refreshToken).toBe('new-refresh');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ignora una renovación rechazada de la sesión anterior después de un nuevo login', async () => {
    await login();
    const refresh = auth.refreshSession();
    const stale = http.expectOne((item) => item.url.endsWith('/auth/refresh'));
    const signingIn = auth.login('ingeniero', 'ClaveSegura1');
    http.expectOne((item) => item.url.endsWith('/auth/login')).flush({
      ...LOGIN_RESPONSE, accessToken: 'new-access', refreshToken: 'new-refresh'
    });
    await signingIn;
    stale.flush({ code: 'SESSION_REPLACED' }, { status: 401, statusText: 'Unauthorized' });

    expect(await refresh).toBe(false);
    expect(auth.tokens()?.refreshToken).toBe('new-refresh');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
