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

describe('UsersComponent temporary permission renewal', () => {
  it('permite extender a veinte días y comunica las actividades ya abiertas', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00.000Z'));
    const grantTemporaryPermission = vi.fn().mockResolvedValue({
      updatedLateActivities: 79,
      lateAuthorizationUntil: '2026-09-21T12:00:00.000Z'
    });
    const component = new UsersComponent(
      { grantTemporaryPermission } as never,
      {
        hasRole: () => false,
        currentUser: () => ({ clientId: 'client-1', roles: ['client_admin'] })
      } as never,
      { url: '/usuarios' } as never,
      { detectChanges: vi.fn() } as never
    );
    const user = {
      id: 'engineer-1',
      username: 'ingeniero',
      displayName: 'Ingeniero',
      email: 'ingeniero@example.test',
      isActive: true,
      roles: ['ingeniero_biomedico'],
      clientId: 'client-1',
      temporaryPermissions: [{
        permission: 'maintenance:preventive:late_execution',
        expiresAt: '2026-09-08T12:00:00.000Z',
        reason: 'Autorización institucional para cierre de agosto.'
      }]
    };
    component.users = [user] as never;
    component.load = vi.fn().mockResolvedValue(undefined);
    (component as unknown as { requestSecurityCode: ReturnType<typeof vi.fn> })
      .requestSecurityCode = vi.fn().mockResolvedValue('123456');

    component.prepareTemporaryPermissionRenewal(user.temporaryPermissions[0]);
    const selectedExpiry = new Date(component.temporaryPermissionForm.expiresAt).getTime();
    expect(selectedExpiry - Date.now()).toBe(20 * 24 * 60 * 60 * 1000);

    await component.grantTemporaryPermission(user as never);

    expect(grantTemporaryPermission).toHaveBeenCalledOnce();
    expect(grantTemporaryPermission.mock.calls[0][1].permission)
      .toBe('maintenance:preventive:late_execution');
    expect(component.successMessage).toContain('79 actividades abiertas');
    expect(component.temporaryPermissionRenewal).toBeNull();
    vi.useRealTimers();
  });
});
