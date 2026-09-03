import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SessionTimeoutService } from './session-timeout.service';

describe('SessionTimeoutService', () => {
  let authenticated = true;
  let auth: Pick<AuthService, 'isAuthenticated' | 'logout'>;
  let service: SessionTimeoutService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    localStorage.clear();
    authenticated = true;
    auth = {
      isAuthenticated: () => authenticated,
      logout: vi.fn(() => {
        authenticated = false;
      })
    };
    service = new SessionTimeoutService(auth as AuthService);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('cierra la sesión después de 30 minutos reales sin actividad', () => {
    service.start();
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(auth.logout).toHaveBeenCalledWith(true, 'inactive');
  });

  it('reinicia el plazo cuando el usuario interactúa', () => {
    service.start();
    vi.advanceTimersByTime(20 * 60 * 1000);
    window.dispatchEvent(new Event('click'));
    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(auth.logout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(auth.logout).toHaveBeenCalledWith(true, 'inactive');
  });

  it('expulsa antes de procesar el primer clic tras una suspensión prolongada', () => {
    service.start();
    vi.setSystemTime(new Date('2026-09-02T12:31:00.000Z'));

    window.dispatchEvent(new Event('click'));

    expect(auth.logout).toHaveBeenCalledWith(true, 'inactive');
    expect(localStorage.getItem('auth_last_activity_v1')).toBe('1788350400000');
  });
});
