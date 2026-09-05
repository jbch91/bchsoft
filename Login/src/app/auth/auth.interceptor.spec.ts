import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  const tokens = signal({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  const auth = {
    tokens,
    refreshSession: vi.fn(),
    handleSessionFailure: vi.fn()
  };
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    tokens.set({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    auth.refreshSession.mockReset();
    auth.handleSessionFailure.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth }
      ]
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('no intercepta el propio endpoint de renovación', () => {
    client.post('/api/auth/refresh', { refreshToken: 'refresh-1' }).subscribe();
    const request = http.expectOne('/api/auth/refresh');

    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ok: true });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('cierra localmente una sesión revocada sin intentar renovarla', () => {
    client.get('/api/private').subscribe({ error: () => undefined });
    const request = http.expectOne('/api/private');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush(
      { code: 'SESSION_REPLACED', message: 'Sesión revocada.' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(auth.handleSessionFailure).toHaveBeenCalledWith('SESSION_REPLACED');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('no expulsa el login nuevo por una respuesta tardía de la sesión anterior', () => {
    client.get('/api/private').subscribe({ error: () => undefined });
    const stale = http.expectOne('/api/private');
    tokens.set({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    stale.flush({ code: 'SESSION_REPLACED' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.handleSessionFailure).not.toHaveBeenCalled();
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
});
