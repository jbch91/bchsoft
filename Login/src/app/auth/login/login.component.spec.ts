import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';

function createComponent(returnUrl: string | null, login = vi.fn()) {
  let currentReturnUrl = returnUrl;
  let currentReason: string | null = null;
  let pendingRoute: string | null = null;
  const normalizeRoute = (value: string): string | null => {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname === '/login') return null;
    return `${target.pathname}${target.search}${target.hash}`;
  };
  const auth = {
    login,
    isAuthenticated: () => false,
    initializeSession: vi.fn().mockResolvedValue(false),
    currentUser: () => ({ clientId: 'client-1' }),
    hasRole: () => false,
    hasPermission: () => false,
    consumeLogoutReason: vi.fn((): string | null => null),
    rememberPostLoginRoute: vi.fn((value: string) => {
      const normalized = normalizeRoute(value);
      if (normalized) pendingRoute = normalized;
      return normalized;
    }),
    pendingPostLoginRoute: vi.fn(() => pendingRoute),
    clearPostLoginRoute: vi.fn(() => {
      pendingRoute = null;
    })
  };
  const route = {
    snapshot: {
      queryParamMap: {
        get: (key: string) => {
          if (key === 'returnUrl') return currentReturnUrl;
          if (key === 'reason') return currentReason;
          return null;
        }
      }
    }
  };
  const router = {
    navigate: vi.fn(),
    navigateByUrl: vi.fn().mockResolvedValue(true)
  };
  const component = new LoginComponent(
    auth as never,
    route as never,
    router as never,
    { detectChanges: () => undefined } as never
  );
  return {
    component,
    auth,
    route,
    router,
    setReason: (value: string | null) => {
      currentReason = value;
    },
    setReturnUrl: (value: string | null) => {
      currentReturnUrl = value;
    }
  };
}

describe('LoginComponent return URL', () => {
  it('conserva el equipo de un código QR después del inicio de sesión', () => {
    const returnUrl = '/mantenimiento?clientId=client-1&assetId=asset-1&source=qr';
    const { component } = createComponent(returnUrl);

    expect((component as any).postLoginRoute()).toBe(returnUrl);
  });

  it('rechaza destinos externos y conserva la ruta normal del cliente', () => {
    const { component } = createComponent('//example.com/steal-session');

    expect((component as any).postLoginRoute()).toBe('/dashboard');
  });

  it('evita un ciclo de retorno hacia el mismo login', () => {
    const { component } = createComponent('/login?returnUrl=%2Flogin');

    expect((component as any).postLoginRoute()).toBe('/dashboard');
  });

  it('continúa al equipo aunque la URL del login pierda el parámetro antes de autenticar', async () => {
    const login = vi.fn().mockResolvedValue({ ok: true });
    const { component, auth, router, setReturnUrl } = createComponent('/q/asset-1', login);
    component.ngOnInit();
    setReturnUrl(null);
    component.username = 'ingeniero';
    component.password = 'ClaveSegura1';

    await component.onSubmit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/q/asset-1', { replaceUrl: true });
    expect(auth.clearPostLoginRoute).toHaveBeenCalledOnce();
  });
});

describe('LoginComponent session notification', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('consume el aviso guardado y limpia el motivo de la URL conservando el destino QR', () => {
    const { component, auth, route, router, setReason } = createComponent('/q/asset-1');
    setReason('inactive');
    auth.consumeLogoutReason.mockReturnValueOnce('inactive');

    component.ngOnInit();

    expect(auth.consumeLogoutReason).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { reason: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: true
    });
    expect(component.sessionMessage).toContain('inactividad');
    expect(auth.pendingPostLoginRoute()).toBe('/q/asset-1');
    component.ngOnDestroy();
  });

  it('retira el aviso de inactividad automáticamente después de cinco segundos', () => {
    const { component, auth } = createComponent(null);
    auth.consumeLogoutReason.mockReturnValueOnce('inactive');

    component.ngOnInit();
    vi.advanceTimersByTime(4999);
    expect(component.sessionMessage).toContain('inactividad');

    vi.advanceTimersByTime(1);
    expect(component.sessionMessage).toBe('');
  });

  it('cancela el aviso pendiente al salir del login', () => {
    const { component, auth } = createComponent(null);
    auth.consumeLogoutReason.mockReturnValueOnce('inactive');
    component.ngOnInit();

    component.ngOnDestroy();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('LoginComponent credentials', () => {
  it('limpia el usuario sin modificar la contraseña', async () => {
    const login = vi.fn().mockResolvedValue({ ok: false, message: 'Credenciales inválidas' });
    const { component } = createComponent(null, login);
    component.username = '  LABORATORIO  ';
    component.password = ' ClaveConEspacio1 ';

    await component.onSubmit();

    expect(login).toHaveBeenCalledWith('LABORATORIO', ' ClaveConEspacio1 ');
  });
});
