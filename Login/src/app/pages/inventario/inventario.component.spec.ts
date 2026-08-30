import { describe, expect, it, vi } from 'vitest';
import { InventarioComponent } from './inventario.component';

describe('InventarioComponent area responsible flow', () => {
  it('carga estados operativos y crea la solicitud correctiva desde el equipo', async () => {
    const biomed = {
      listAssets: vi.fn().mockResolvedValue([{
        id: 'asset-1',
        code: 'EQ-001',
        name: 'MONITOR',
        brand: 'MARCA',
        model: 'MODELO',
        serial: 'SERIE',
        site_id: 'site-1',
        site_name: 'SEDE',
        area_id: 'area-1',
        area_name: 'URGENCIAS',
        location_id: 'location-1',
        location_name: 'CUBÍCULO 1',
        status: 'operativo_observacion',
        acquisition_date: '2026-01-01',
        warranty_years: 2,
        has_pending_spare: true
      }])
    };
    const admin = {
      getMyClient: vi.fn().mockResolvedValue({
        id: 'client-1',
        name: 'ESE CENTRO DE SALUD SAN JUAN DE DIOS',
        nit: '891234567-1',
        city: 'TIMANÁ',
        email: 'contacto@example.test',
        address: 'CALLE 1',
        logo_path: null
      })
    };
    const maintenance = { createRequest: vi.fn().mockResolvedValue(undefined) };
    const auth = {
      currentUser: () => ({ id: 'responsable-1', clientId: 'client-1' }),
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('responsable_area')
        : role === 'responsable_area',
      hasPermission: (permission: string) => permission === 'maintenance:request:create'
    };
    const component = new InventarioComponent(
      biomed as never,
      admin as never,
      maintenance as never,
      auth as never,
      { detectChanges: vi.fn() } as never
    );
    await component.init();

    expect(component.items).toHaveLength(1);
    expect(component.selectedClientInfo?.name).toBe('ESE CENTRO DE SALUD SAN JUAN DE DIOS');
    expect(component.canManageQr).toBe(false);
    expect(component.items[0]).toMatchObject({
      acquisitionDate: '2026-01-01',
      warrantyYears: 2,
      hasPendingSpare: true
    });

    component.openMaintenanceRequest(component.items[0]);
    component.requestDescription = 'El equipo presenta una alarma intermitente durante el uso.';
    await component.submitMaintenanceRequest();

    expect(maintenance.createRequest).toHaveBeenCalledWith({
      clientId: 'client-1',
      assetId: 'asset-1',
      assetCategory: 'biomedical',
      type: 'correctivo',
      description: 'El equipo presenta una alarma intermitente durante el uso.'
    });
    expect(component.requestSuccess).toContain('EQ-001 - MONITOR');
    expect(component.requestModalItem).toBeNull();
  });
});
