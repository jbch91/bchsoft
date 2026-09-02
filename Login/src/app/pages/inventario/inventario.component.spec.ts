import { describe, expect, it, vi } from 'vitest';
import { InventarioComponent } from './inventario.component';

const qrToDataUrl = vi.hoisted(() => vi.fn().mockResolvedValue('data:image/png;base64,qr'));

vi.mock('qrcode', () => ({
  toDataURL: qrToDataUrl,
  default: { toDataURL: qrToDataUrl }
}));

function inventoryItem(id: string, areaName = 'URGENCIAS') {
  return {
    id,
    code: `EQ-${id}`,
    name: 'MONITOR DE SIGNOS VITALES',
    brand: 'MARCA',
    model: 'MODELO',
    serial: `SERIE-${id}`,
    siteName: 'SEDE PRINCIPAL',
    areaName,
    locationName: 'CUBÍCULO 1',
    status: 'operativo'
  };
}

function createQrComponent() {
  const biomed = { listAssets: vi.fn().mockResolvedValue([]) };
  const admin = {
    getMyClient: vi.fn().mockResolvedValue({
      id: 'client-1',
      name: 'BIOMEDICAL SOLUTIONS BCH SAS',
      nit: '900000000-1',
      city: 'NEIVA',
      email: 'local@example.test',
      address: 'CALLE 1',
      logo_path: null
    })
  };
  const auth = {
    currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' }),
    hasRole: (role: string | string[]) => Array.isArray(role)
      ? role.includes('ingeniero_biomedico')
      : role === 'ingeniero_biomedico',
    hasPermission: () => true
  };
  return new InventarioComponent(
    biomed as never,
    admin as never,
    { createRequest: vi.fn() } as never,
    auth as never,
    { detectChanges: vi.fn() } as never
  );
}

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

describe('InventarioComponent QR flow', () => {
  it('genera solo la vista previa inicial al abrir el modal', async () => {
    qrToDataUrl.mockClear();
    const component = createQrComponent();
    await component.init();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    component.items = [inventoryItem('001'), inventoryItem('002'), inventoryItem('003')];

    component.openQrModal();

    await vi.waitFor(() => expect(qrToDataUrl).toHaveBeenCalledTimes(1));
    expect(component.qrPreviewItemId).toBe('001');
    expect(component.qrPreviewUrl).toBe('data:image/png;base64,qr');
    expect(component.qrGenerating).toBe(false);
  });

  it('conserva la selección aunque cambien los filtros', () => {
    const component = createQrComponent();
    const first = inventoryItem('001', 'URGENCIAS');
    const second = inventoryItem('002', 'CONSULTA EXTERNA');
    component.items = [first, second];
    component.toggleQrSelection(first);
    component.toggleQrSelection(second);

    component.qrAreaFilter = 'URGENCIAS';
    component.onQrFiltersChanged();

    expect(component.qrFilteredItems.map((item) => item.id)).toEqual(['001']);
    expect(component.qrSelectedItems.map((item) => item.id)).toEqual(['001', '002']);
    expect(component.qrExportItems).toHaveLength(2);
    expect(component.qrExportScopeLabel).toBe('seleccionados');
  });

  it('codifica un destino identificable y usa margen de impresión seguro', async () => {
    qrToDataUrl.mockClear();
    const component = createQrComponent();
    const item = inventoryItem('001');
    component.items = [item];
    component.selectedClientId = 'client-1';

    await component.previewQr(item);

    const [payload, options] = qrToDataUrl.mock.calls[0];
    const url = new URL(payload);
    expect(url.pathname).toBe('/mantenimiento');
    expect(url.searchParams.get('clientId')).toBe('client-1');
    expect(url.searchParams.get('assetId')).toBe('001');
    expect(url.searchParams.get('source')).toBe('qr');
    expect(options).toMatchObject({
      errorCorrectionLevel: 'Q',
      margin: 3,
      width: 320
    });
  });

  it('pagina la lista sin limitar la selección de todos los resultados filtrados', () => {
    const component = createQrComponent();
    component.items = Array.from({ length: 65 }, (_, index) => inventoryItem(String(index + 1)));

    component.selectAllQrFiltered();

    expect(component.qrPagedItems).toHaveLength(30);
    expect(component.qrPageCount).toBe(3);
    expect(component.qrSelectedItems).toHaveLength(65);
    component.setQrPage(3);
    expect(component.qrPagedItems).toHaveLength(5);
  });
});
