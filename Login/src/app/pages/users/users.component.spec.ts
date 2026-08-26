import { describe, expect, it, vi } from 'vitest';
import { UsersComponent } from './users.component';

function buildComponent(createUser: ReturnType<typeof vi.fn>): {
  component: UsersComponent;
  requestActionConfirmation: ReturnType<typeof vi.fn>;
} {
  const requestActionConfirmation = vi.fn();
  const admin = {
    createUser,
    requestActionConfirmation
  };
  const auth = {
    hasRole: () => false,
    currentUser: () => ({ clientId: 'client-1', roles: ['client_admin'] })
  };
  const component = new UsersComponent(
    admin as never,
    auth as never,
    { url: '/usuarios' } as never,
    { detectChanges: vi.fn() } as never
  );
  component.roles = ['calibracion'];
  component.username = 'responsablelocal';
  component.displayName = 'Responsable Local';
  component.email = 'responsablelocal@example.test';
  component.role = 'calibracion';
  component.clientId = 'client-1';
  component.documentType = 'cedula_ciudadania';
  component.documentNumber = '1000000001';
  component.createUserModalOpen = true;
  component.load = vi.fn().mockResolvedValue(undefined);
  return { component, requestActionConfirmation };
}

describe('UsersComponent user creation', () => {
  it('cierra y limpia el modal solo cuando el servidor confirma la creación', async () => {
    const createUser = vi.fn().mockResolvedValue({
      id: 'user-1',
      invitation_sent: true
    });
    const { component, requestActionConfirmation } = buildComponent(createUser);

    await component.onCreateUser();

    expect(requestActionConfirmation).not.toHaveBeenCalled();
    expect(createUser).toHaveBeenCalledOnce();
    expect(component.createUserModalOpen).toBe(false);
    expect(component.username).toBe('');
    expect(component.successMessage).toContain('Usuario creado correctamente');
  });

  it('mantiene el modal y los datos cuando el servidor rechaza el usuario', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const createUser = vi.fn().mockRejectedValue({
      error: { message: 'Ese usuario ya está registrado.' }
    });
    const { component, requestActionConfirmation } = buildComponent(createUser);

    await component.onCreateUser();

    consoleError.mockRestore();
    expect(requestActionConfirmation).not.toHaveBeenCalled();
    expect(component.createUserModalOpen).toBe(true);
    expect(component.username).toBe('responsablelocal');
    expect(component.displayName).toBe('Responsable Local');
    expect(component.email).toBe('responsablelocal@example.test');
    expect(component.errorMessage).toBe('Ese usuario ya está registrado.');
  });
});
