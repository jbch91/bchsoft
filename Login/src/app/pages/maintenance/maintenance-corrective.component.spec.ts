import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';
import { CORRECTIVE_FINDING_OPTIONS, CORRECTIVE_SUMMARY_OPTIONS } from './corrective-report.options';

function setup() {
  const auth = { currentUser: () => ({ id: 'engineer', clientId: 'client' }), hasRole: (role: string) => role === 'ingeniero_biomedico', hasPermission: () => true };
  const maintenance = { createReport: vi.fn(), createVerbalAttention: vi.fn().mockResolvedValue({ id: 'report', requestId: 'request' }) };
  const component = new MaintenanceComponent({} as never, auth as never, {} as never, maintenance as never, { detectChanges: vi.fn() } as never, { snapshot: { data: {} } } as never);
  component.assets = [{ id: 'asset', code: 'EQ001', name: 'MONITOR', status: 'operativo' }];
  component.assetMap = new Map(component.assets.map(asset => [asset.id, asset]));
  component.requests = [{ id: 'request', client_id: 'client', asset_id: 'asset', type: 'correctivo', status: 'en_proceso', source: 'qr', created_at: '2026-09-16', assigned_to: 'engineer', requested_by: 'chief' }];
  component.reportRequestId = 'request';
  component.reportFormActive = true;
  vi.spyOn(component as any, 'scrollToReportForm').mockImplementation(() => {});
  vi.spyOn(component as any, 'refreshViewSoon').mockImplementation(() => {});
  vi.spyOn(component as any, 'loadData').mockResolvedValue(undefined);
  vi.spyOn(component as any, 'showAlert').mockImplementation(() => {});
  return { component, maintenance };
}

function fill(c: MaintenanceComponent) {
  c.reportSummary = 'Revision de falla.';
  c.reportFindings = 'Cable deteriorado.';
  c.reportActions = 'Se ajustan conexiones.';
  c.reportMaintenanceChecks = ['revision_visual'];
  c.reportMaintenanceActivities = ['ajuste_conexiones'];
  c.reportMaintenanceTests = ['encendido_apagado'];
}

afterEach(() => vi.restoreAllMocks());

describe('shared corrective report editor', () => {
  it('uses the corrective editor for normal, QR, verbal and spare follow-ups, without changing preventive editors', () => {
    const { component: c } = setup();
    expect(c.isCorrectiveReportEditor).toBe(true);
    expect(c.correctiveEditorSource).toBe('Solicitud desde QR');
    c.requests[0].type = 'preventivo';
    expect(c.isCorrectiveReportEditor).toBe(false);
    c.reportFlowMode = 'install_spare';
    expect(c.isCorrectiveReportEditor).toBe(true);
    expect(c.correctiveEditorSource).toBe('Instalación de repuesto');
    c.reportFlowMode = 'normal'; c.verbalAttentionMode = true;
    expect(c.isCorrectiveReportEditor).toBe(true);
    expect(c.correctiveEditorSource).toBe('Aviso verbal');
  });

  it('preserves entered data between sections and locks navigation during submission', () => {
    const { component: c } = setup(); fill(c);
    c.setCorrectiveEditorSection('intervention');
    c.setCorrectiveEditorSection('closure');
    expect(c.reportSummary).toBe('Revision de falla.');
    expect(c.reportMaintenanceChecks).toEqual(['revision_visual']);
    c.reportSaving = true; c.setCorrectiveEditorSection('attention');
    expect(c.correctiveEditorSection).toBe('closure');
  });

  it('preserves custom narrative text and does not duplicate selected suggestions', () => {
    const { component: c } = setup(); c.reportSummary = 'Detalle particular.';
    const option = CORRECTIVE_SUMMARY_OPTIONS[0];
    c.toggleCorrectiveNarrativeOption('summary', option, true);
    c.toggleCorrectiveNarrativeOption('summary', option, true);
    expect(c.reportSummary).toBe(`Detalle particular.\n${option.text}`);
    c.toggleCorrectiveNarrativeOption('summary', option, false);
    expect(c.reportSummary).toBe('Detalle particular.');
  });

  it('makes failure not reproduced exclusive with identified faults, preserving engineer notes', () => {
    const { component: c } = setup(); c.reportFindings = 'Nota de la revision.';
    const noFault = CORRECTIVE_FINDING_OPTIONS[0], fault = CORRECTIVE_FINDING_OPTIONS[1];
    c.toggleCorrectiveNarrativeOption('findings', noFault, true);
    c.toggleCorrectiveNarrativeOption('findings', fault, true);
    expect(c.reportFindings).toBe(`Nota de la revision.\n${fault.text}`);
    c.toggleCorrectiveNarrativeOption('findings', noFault, true);
    expect(c.reportFindings).toBe(`Nota de la revision.\n${noFault.text}`);
  });

  it.each([
    ['attention', 'reportSummary', ''],
    ['attention', 'reportFindings', ''],
    ['intervention', 'reportActions', ''],
    ['intervention', 'reportMaintenanceChecks', []],
    ['intervention', 'reportMaintenanceActivities', []],
    ['intervention', 'reportMaintenanceTests', []]
  ])('opens %s when %s is missing, without discarding the draft', async (section, field, value) => {
    const { component: c, maintenance } = setup(); fill(c);
    (c as any)[field] = value;
    c.correctiveEditorSection = 'closure';
    await c.submitReportEditor();
    expect(c.correctiveEditorSection).toBe(section);
    expect(c.errorMessage).not.toBe('');
    expect(c.reportFormActive).toBe(true);
    expect(maintenance.createReport).not.toHaveBeenCalled();
  });

  it('keeps closure visible when final condition or spare details are incomplete', async () => {
    const { component: c, maintenance } = setup(); fill(c);
    c.reportAssetStatus = 'fuera_de_servicio'; c.correctiveEditorSection = 'closure';
    await c.submitReportEditor();
    expect(c.correctiveEditorSection).toBe('closure');
    expect(maintenance.createReport).not.toHaveBeenCalled();
  });

  it('starts each workflow in Attention without inheriting verbal mode', () => {
    const { component: c } = setup();
    vi.spyOn(c, 'canContinueSpareCase').mockReturnValue(true);
    c.correctiveEditorSection = 'closure'; c.verbalAttentionMode = true;
    const report = { id: 'report', request_id: 'request', asset_id: 'asset', spare_parts_needed: 'Cable' } as any;
    c.startSpareInstallation(report);
    expect(c.correctiveEditorSection).toBe('attention');
    expect(c.verbalAttentionMode).toBe(false);
    expect(c.reportFlowMode).toBe('install_spare');
    c.correctiveEditorSection = 'closure';
    vi.spyOn(c, 'canCorrectReport').mockReturnValue(true);
    c.startReportCorrection(report);
    expect(c.correctiveEditorSection).toBe('attention');
    expect(c.reportCorrectionMode).toBe(true);
    expect(c.reportFlowMode).toBe('normal');
  });

  it('does not claim delivery automatically for a corrective on a preventive spare case', () => {
    const { component: c } = setup();
    c.requests[0].type = 'preventivo'; c.reportFlowMode = 'install_spare';
    c.reportAssetStatus = 'operativo'; c.reportMaintenanceTests = [];
    c.onReportAssetStatusChange();
    expect(c.reportMaintenanceTests).not.toContain('equipo_operativo_entregado');
  });

  it('keeps a corrective correction as corrective even when its original request was preventive', () => {
    const { component: c } = setup();
    c.requests[0].type = 'preventivo';
    vi.spyOn(c, 'canCorrectReport').mockReturnValue(true);
    c.startReportCorrection({ type: 'correctivo', request_id: 'request', asset_id: 'asset' } as any);
    expect(c.isCorrectiveReportEditor).toBe(true);
    expect(c.reportTypeLabel()).toBe('Reporte correctivo');
    expect(c.correctiveEditorSource).toBe('Corrección solicitada');
  });
});

describe('compact report filters', () => {
  it('shows locations only in the selected area and clears incompatible selections', () => {
    const { component: c } = setup();
    c.assetMap = new Map([
      ['a', { id: 'a', name: 'A', code: 'A', siteName: 'Sede', areaName: 'Urgencias', locationName: 'Consultorio' }],
      ['b', { id: 'b', name: 'B', code: 'B', siteName: 'Sede', areaName: 'Laboratorio', locationName: 'Procesamiento' }]
    ]);
    c.reports = ['a', 'b'].map(id => ({ id, asset_id: id, type: 'correctivo' })) as any;
    c.reportAreaFilter = 'Laboratorio'; c.reportLocationFilter = 'Consultorio'; c.reportPage = 4;
    c.onReportAreaFilterChange();
    expect(c.reportLocationOptions).toEqual(['Procesamiento']);
    expect(c.reportLocationFilter).toBe(''); expect(c.reportPage).toBe(1);
  });

  it('retains extra filters when collapsed and clears all filters explicitly', () => {
    const { component: c } = setup();
    c.reportSpareFilter = 'con_repuesto'; c.reportDateFrom = '2026-09-01'; c.reportLocationFilter = 'Consultorio';
    c.reportAdvancedFiltersOpen = true; c.reportAdvancedFiltersOpen = false;
    expect(c.reportAdvancedFilterCount).toBe(2); expect(c.hasActiveReportFilters).toBe(true);
    c.clearReportFilters();
    expect(c.reportAdvancedFilterCount).toBe(0); expect(c.reportLocationFilter).toBe(''); expect(c.hasActiveReportFilters).toBe(false);
  });
});
