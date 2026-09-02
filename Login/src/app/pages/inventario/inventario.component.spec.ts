import { describe, expect, it, vi } from 'vitest';
import { InventarioComponent } from './inventario.component';

const qrToDataUrl = vi.hoisted(() => vi.fn().mockResolvedValue('data:image/png;base64,qr'));
const pdfMocks = vi.hoisted(() => {
  const instances: any[] = [];
  class FakePdf {
    readonly options: any;
    readonly texts: string[] = [];
    readonly textEntries: Array<{
      value: string;
      fontSize: number;
      x: number;
      y: number;
      options: any;
    }> = [];
    readonly addedPages: any[] = [];
    savedFilename = '';
    fontSize = 0;
    fontStyle = 'normal';
    internal: any;

    constructor(options: any) {
      this.options = options;
      const [width, height] = Array.isArray(options.format) ? options.format : [210, 297];
      this.internal = {
        pageSize: {
          getWidth: () => width,
          getHeight: () => height
        }
      };
      instances.push(this);
    }

    setFont(_: string, style = 'normal') { this.fontStyle = style; }
    setFontSize(value: number) { this.fontSize = value; }
    getTextWidth(value: string) {
      const weightFactor = this.fontStyle === 'bold' ? 1.04 : 1;
      return Array.from(value).length * this.fontSize * 0.19 * weightFactor;
    }
    setTextColor() {}
    setDrawColor() {}
    setFillColor() {}
    setLineWidth() {}
    setProperties() {}
    roundedRect() {}
    rect() {}
    addImage() {}
    line() {}
    text(value: string, x: number, y: number, options?: any) {
      this.texts.push(value);
      this.textEntries.push({ value, fontSize: this.fontSize, x, y, options });
    }
    addPage(...args: any[]) { this.addedPages.push(args); }
    save(filename: string) { this.savedFilename = filename; }
  }
  return { FakePdf, instances };
});

vi.mock('qrcode', () => ({
  toDataURL: qrToDataUrl,
  default: { toDataURL: qrToDataUrl }
}));

vi.mock('jspdf', () => ({
  jsPDF: pdfMocks.FakePdf
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
    expect(url.pathname).toBe('/q/001');
    expect(url.search).toBe('');
    expect(url.searchParams.has('area')).toBe(false);
    expect(url.searchParams.has('location')).toBe(false);
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

  it('ofrece formatos Brother compatibles y prioriza la cinta de 18 mm', () => {
    const component = createQrComponent();

    expect(component.qrExportFormat).toBe('brother-18');
    expect(component.qrExportFormats.map((format) => format.value)).toEqual([
      'a4',
      'brother-12',
      'brother-18',
      'brother-24'
    ]);
    expect(component.selectedQrExportFormat.tapeWidthMm).toBe(18);
    expect(component.selectedQrExportFormat.minLabelLengthMm).toBe(52);
    expect(component.selectedQrExportFormat.maxLabelLengthMm).toBe(92);
    expect(component.qrExportFormats.slice(1).map((format) => format.qrSizeMm)).toEqual([
      9.5,
      14.5,
      17.5
    ]);
    expect(component.qrExportFormats.find((format) => format.value === 'brother-12')?.description)
      .toContain('confirma la lectura');
  });

  it('genera etiquetas Brother con página exacta y sin ubicación impresa', async () => {
    qrToDataUrl.mockClear();
    pdfMocks.instances.length = 0;
    const component = createQrComponent();
    await component.init();
    component.items = [inventoryItem('001'), inventoryItem('002')];
    component.qrExportFormat = 'brother-18';

    await component.downloadQrPdf();

    const pdf = pdfMocks.instances.at(-1);
    const [labelLength, tapeWidth] = pdf.options.format;
    expect(pdf.options).toMatchObject({ orientation: 'landscape', unit: 'mm' });
    expect(tapeWidth).toBe(18);
    expect(labelLength).toBeGreaterThanOrEqual(52);
    expect(labelLength).toBeLessThan(68);
    expect(pdf.addedPages).toEqual([[[labelLength, 18], 'landscape']]);
    expect(pdf.texts.join(' ')).toContain('EQ-001');
    expect(pdf.texts.join(' ')).toContain('BIOMEDICAL SOLUTIONS BCH SAS');
    expect(pdf.texts.join(' ')).toContain('SOFTWARE BIOMÉDICO INBIHOSPITALARIO');
    expect(pdf.textEntries.find((entry: any) => entry.value === 'BIOMEDICAL SOLUTIONS BCH SAS')?.fontSize).toBe(4.2);
    expect(pdf.textEntries.find((entry: any) => entry.value === 'SOFTWARE BIOMÉDICO INBIHOSPITALARIO')?.fontSize).toBe(3);
    expect(pdf.texts.join(' ')).not.toContain('ÁREA');
    expect(pdf.texts.join(' ')).not.toContain('CUBÍCULO');
    expect(pdf.savedFilename).toContain('brother-18mm');
    expect(qrToDataUrl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 720
    }));
  });

  it('amplía solo la etiqueta que necesita espacio para un nombre extenso', async () => {
    qrToDataUrl.mockClear();
    pdfMocks.instances.length = 0;
    const component = createQrComponent();
    await component.init();
    const shortItem = inventoryItem('001');
    const longItem = {
      ...inventoryItem('002'),
      name: 'SISTEMA AUTOMATIZADO DE MONITORIZACIÓN MULTIPARAMÉTRICA PARA CUIDADO CRÍTICO'
    };
    component.items = [shortItem, longItem];
    component.qrExportFormat = 'brother-18';

    await component.downloadQrPdf();

    const pdf = pdfMocks.instances.at(-1);
    const shortLength = pdf.options.format[0];
    const longLength = pdf.addedPages[0][0][0];
    expect(longLength).toBeGreaterThan(shortLength);
    expect(longLength).toBeLessThanOrEqual(92);
    expect(pdf.texts).toContain(longItem.name.slice(0, 67) + '…');
  });

  it('mantiene el nombre y la marca modelo en líneas independientes sin superposición', async () => {
    qrToDataUrl.mockClear();
    pdfMocks.instances.length = 0;
    const component = createQrComponent();
    await component.init();
    const item = {
      ...inventoryItem('003'),
      name: 'EQUIPO DE ÓRGANOS DE PARED',
      brand: 'WELCH ALLYN',
      model: 'GREEN SERIES 777'
    };
    component.items = [item];
    component.qrExportFormat = 'brother-18';

    await component.downloadQrPdf();

    const pdf = pdfMocks.instances.at(-1);
    const nameLine = pdf.textEntries.find((entry: any) => entry.value === item.name);
    const modelLine = pdf.textEntries.find((entry: any) => entry.value === 'WELCH ALLYN / GREEN SERIES 777');
    expect(nameLine).toBeTruthy();
    expect(modelLine).toBeTruthy();
    expect(nameLine.options?.maxWidth).toBeUndefined();
    expect(modelLine.options?.maxWidth).toBeUndefined();
    expect(modelLine.y - nameLine.y).toBeGreaterThanOrEqual(2.4);
  });
});
