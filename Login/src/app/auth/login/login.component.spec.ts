import { describe, expect, it } from 'vitest';
import { LoginComponent } from './login.component';

function createComponent(returnUrl: string | null) {
  const auth = {
    currentUser: () => ({ clientId: 'client-1' }),
    hasRole: () => false,
    hasPermission: () => false,
    consumeLogoutReason: () => ''
  };
  const route = {
    snapshot: {
      queryParamMap: {
        get: (key: string) => key === 'returnUrl' ? returnUrl : null
      }
    }
  };
  return new LoginComponent(
    auth as never,
    route as never,
    { navigate: () => undefined, navigateByUrl: () => undefined } as never,
    { detectChanges: () => undefined } as never
  );
}

describe('LoginComponent return URL', () => {
  it('conserva el equipo de un código QR después del inicio de sesión', () => {
    const returnUrl = '/mantenimiento?clientId=client-1&assetId=asset-1&source=qr';
    const component = createComponent(returnUrl);

    expect((component as any).postLoginRoute()).toBe(returnUrl);
  });

  it('rechaza destinos externos y conserva la ruta normal del cliente', () => {
    const component = createComponent('//example.com/steal-session');

    expect((component as any).postLoginRoute()).toBe('/dashboard');
  });

  it('evita un ciclo de retorno hacia el mismo login', () => {
    const component = createComponent('/login?returnUrl=%2Flogin');

    expect((component as any).postLoginRoute()).toBe('/dashboard');
  });
});
