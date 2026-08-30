import { describe, expect, it, vi } from 'vitest';
import { AssetMovementDto } from '../../biomed/biomed.service';
import { InventoryPanelComponent, InventoryPanelItem } from './inventory-panel.component';

function createComponent(biomed: Record<string, unknown> = {}): InventoryPanelComponent {
  return new InventoryPanelComponent(
    biomed as never,
    {} as never,
    {} as never,
    {} as never,
    { detectChanges: vi.fn() } as never
  );
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(blob);
  });
}

function readBlobBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

describe('InventoryPanelComponent operational conditions', () => {
  const items: InventoryPanelItem[] = [
    {
      id: 'operational',
      code: 'EQ-001',
      name: 'Monitor',
      brand: 'MARCA A',
      model: 'MODELO A',
      serial: 'SERIE A',
      siteName: 'SEDE CENTRAL',
      areaName: 'UCI',
      locationName: 'BOX 1',
      status: 'operativo'
    },
    {
      id: 'warranty',
      code: 'EQ-002',
      name: 'Desfibrilador',
      brand: 'MARCA B',
      model: 'MODELO B',
      serial: 'SERIE B',
      siteName: 'SEDE CENTRAL',
      areaName: 'UCI',
      locationName: 'BOX 2',
      status: 'operativo',
      acquisitionDate: '2099-01-01',
      warrantyYears: 2
    },
    {
      id: 'spare',
      code: 'EQ-003',
      name: 'Electrocardiógrafo',
      brand: 'MARCA C',
      model: 'MODELO C',
      serial: 'SERIE C',
      siteName: 'SEDE CENTRAL',
      areaName: 'URGENCIAS',
      locationName: 'REANIMACIÓN',
      status: 'operativo_observacion',
      hasPendingSpare: true
    },
    {
      id: 'out',
      code: 'EQ-004',
      name: 'Ventilador',
      brand: null,
      model: null,
      serial: null,
      siteName: 'SEDE NORTE',
      areaName: 'CONSULTA EXTERNA',
      locationName: 'CONSULTORIO 1',
      status: 'fuera_de_servicio'
    }
  ];

  it('filtra garantía y repuesto dentro del inventario', () => {
    const component = createComponent();
    component.items = items;
    component.showOperationalConditions = true;

    component.filterCondition = 'under_warranty';
    expect(component.filteredItems.map((item) => item.id)).toEqual(['warranty']);

    component.filterCondition = 'pending_spare';
    expect(component.filteredItems.map((item) => item.id)).toEqual(['spare']);
    expect(component.inventoryWarrantyCount).toBe(1);
    expect(component.inventoryPendingSpareCount).toBe(1);
    expect(component.inventoryOutOfServiceCount).toBe(1);
  });

  it('emite el equipo seleccionado para solicitar revisión', () => {
    const component = createComponent();
    const emitted = vi.fn();
    component.requestMaintenance.subscribe(emitted);

    component.requestMaintenance.emit(items[0]);

    expect(emitted).toHaveBeenCalledWith(items[0]);
  });

  it('limita áreas y ubicaciones de exportación al inventario disponible', () => {
    const component = createComponent();
    component.items = items;

    expect(component.exportSiteOptions).toEqual(['SEDE CENTRAL', 'SEDE NORTE']);
    component.exportSite = 'SEDE CENTRAL';
    expect(component.exportAreaOptions).toEqual(['UCI', 'URGENCIAS']);

    component.exportArea = 'UCI';
    expect(component.exportLocationOptions).toEqual(['BOX 1', 'BOX 2']);

    component.exportLocation = 'REANIMACIÓN';
    component.onExportAreaChange();
    expect(component.exportLocation).toBe('');
  });

  it('filtra dentro del modal sin modificar los filtros principales', () => {
    const component = createComponent();
    component.items = items;

    component.exportSite = 'SEDE CENTRAL';
    component.exportArea = 'UCI';
    component.exportCondition = 'under_warranty';

    expect(component.exportFilteredItems.map((item) => item.id)).toEqual(['warranty']);
    expect(component.exportItemCount).toBe(1);
    expect(component.filterArea).toBe('');
  });

  it('abre la exportación heredando la vista actual como punto de partida', () => {
    const component = createComponent();
    component.items = items;
    component.showOperationalConditions = true;
    component.searchTerm = 'Monitor';
    component.filterSite = 'SEDE CENTRAL';
    component.filterArea = 'UCI';
    component.filterCondition = 'operational';

    component.openExportModal();

    expect(component.exportModalOpen).toBe(true);
    expect(component.exportSearchTerm).toBe('Monitor');
    expect(component.exportSite).toBe('SEDE CENTRAL');
    expect(component.exportArea).toBe('UCI');
    expect(component.exportCondition).toBe('operational');
    expect(component.exportItemCount).toBe(1);
  });

  it('cierra el modal únicamente después de generar la exportación', async () => {
    const component = createComponent();
    component.items = items;
    component.exportModalOpen = true;
    component.exportSearchTerm = 'Monitor';
    const exportInventory = vi.spyOn(component, 'exportSelectedInventory').mockResolvedValue();

    await component.confirmExport();

    expect(exportInventory).toHaveBeenCalledOnce();
    expect(component.exportModalOpen).toBe(false);
    expect(component.exportLoading).toBe(false);
  });

  it('genera CSV, Excel y PDF con la interoperabilidad usada en el navegador', async () => {
    const component = createComponent();
    component.items = [items[0]];
    component.clientName = 'ESE CENTRO DE SALUD SAN JUAN DE DIOS';
    component.clientNit = '891234567-1';
    component.clientCity = 'TIMANÁ';
    component.exportedBy = 'INGENIERO BIOMÉDICO';
    component.exportArea = 'UCI';
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const blobs: Blob[] = [];
    const downloads: string[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:inventario-${blobs.length}`;
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    try {
      for (const format of ['csv', 'xlsx', 'pdf'] as const) {
        component.exportFormat = format;
        await component.exportSelectedInventory();
      }

      expect(createObjectURL).toHaveBeenCalledTimes(3);
      expect(click).toHaveBeenCalledTimes(3);
      expect(downloads).toHaveLength(3);
      expect(downloads.every((name) => (
        name.startsWith('inventario-biomedico-ese-centro-de-salud-san-juan-de-dios-uci-')
      ))).toBe(true);

      const csv = await readBlobText(blobs[0]);
      expect(csv).toContain('ESE CENTRO DE SALUD SAN JUAN DE DIOS');
      expect(csv).toContain('Área: UCI');
      expect(csv).toContain('INBIHOSPITALARIO');

      const xlsxModule = await import('xlsx');
      const XLSX = ((xlsxModule as any).utils ? xlsxModule : (xlsxModule as any).default) as typeof import('xlsx');
      const workbook = XLSX.read(await readBlobBuffer(blobs[1]), { type: 'array' });
      const worksheet = workbook.Sheets['Inventario biomédico'];
      expect(worksheet['A1'].v).toBe('INVENTARIO BIOMÉDICO');
      expect(worksheet['B2'].v).toBe('ESE CENTRO DE SALUD SAN JUAN DE DIOS');
      expect(worksheet['B4'].v).toContain('Área: UCI');
      expect(worksheet['A10'].v).toBe('SOFTWARE UTILIZADO');
      expect(worksheet['B10'].v).toBe('INBIHOSPITALARIO');
      expect(blobs[2].type).toBe('application/pdf');
    } finally {
      click.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL
      });
    }
  });

  it('abre la trazabilidad en modal y conserva el detalle estructurado del movimiento', async () => {
    const movement: AssetMovementDto = {
      id: 'movement-1',
      asset_id: 'operational',
      from_code: 'EQ-001',
      to_code: 'EQ-101',
      from_site_name: 'SEDE CENTRAL',
      to_site_name: 'SEDE CENTRAL',
      from_area_name: 'UCI',
      to_area_name: 'URGENCIAS',
      from_location_name: 'BOX 1',
      to_location_name: 'REANIMACIÓN',
      moved_by_name: 'INGENIERO LOCAL',
      moved_by_role: 'ingeniero_biomedico',
      notes: 'Traslado autorizado',
      pdf_path: '/movimiento.pdf',
      created_at: '2026-08-30T14:30:00.000Z',
      total_count: 1
    };
    const listAssetMovements = vi.fn().mockResolvedValue([movement]);
    const component = createComponent({ listAssetMovements });
    component.items = items;
    component.selectedClientId = 'client-1';

    await component.openTraceability(items[0]);

    expect(component.traceabilityModalOpen).toBe(true);
    expect(component.selectedHistoryAsset?.id).toBe('operational');
    expect(component.historyMovements).toEqual([movement]);
    expect(component.historyTotal).toBe(1);
    expect(component.movementTypeLabel(movement)).toBe('Traslado y cambio de código');
    expect(component.movementOrigin(movement)).toBe('SEDE CENTRAL / UCI / BOX 1');
    expect(component.movementDestination(movement)).toBe('SEDE CENTRAL / URGENCIAS / REANIMACIÓN');
    expect(component.movementRoleLabel(movement.moved_by_role)).toBe('Ingeniero biomédico');
    expect(listAssetMovements).toHaveBeenCalledWith('client-1', 'operational', {
      from: undefined,
      to: undefined,
      order: 'desc',
      limit: 10,
      offset: 0
    });
  });

  it('valida el rango de fechas antes de consultar la trazabilidad', async () => {
    const listAssetMovements = vi.fn().mockResolvedValue([]);
    const component = createComponent({ listAssetMovements });
    component.selectedClientId = 'client-1';
    component.historyAssetId = 'operational';
    component.historyFrom = '2026-08-31';
    component.historyTo = '2026-08-01';

    await component.loadHistory(true);

    expect(listAssetMovements).not.toHaveBeenCalled();
    expect(component.historyError).toContain('fecha inicial');
    expect(component.historyHasMore).toBe(false);
  });
});
