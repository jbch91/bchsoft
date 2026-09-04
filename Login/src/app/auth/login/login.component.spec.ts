import { describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';

function createComponent(returnUrl: string | null, login = vi.fn()) {
  let currentReturnUrl = returnUrl;
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
    consumeLogoutReason: () => '',
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
        get: (key: string) => key === 'returnUrl' ? currentReturnUrl : null
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
    router,
    setReturnUrl: (value: string | null) => {
      currentReturnUrl = value;
    }
  };
}

describe('LoginComponent return URL', () => {
  it('conserva el equipo de un código QR después del inicio de sesión', () => {
    const returnUrl = '/q/asset-1';
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
