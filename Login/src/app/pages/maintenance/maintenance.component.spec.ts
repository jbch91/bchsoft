import { describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';

describe('maintenance report modal flow', () => {
  it('abre un reporte preventivo sin cambiar la pestaña activa', () => {
    vi.useFakeTimers();
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.viewMode = 'preventivos';
    component.requests = [{
      id: 'request-1',
      client_id: 'client-1',
      asset_id: 'asset-1',
      type: 'preventivo',
      status: 'en_proceso',
      description: 'Mantenimiento preventivo programado',
      requested_by: 'user-1',
      created_at: '2026-08-26T10:00:00.000Z'
    }];

    component.activateReportForm('request-1');
    vi.runAllTimers();
    vi.useRealTimers();

    expect(component.reportFormActive).toBe(true);
    expect(component.reportRequestId).toBe('request-1');
    expect(component.viewMode).toBe('preventivos');
  });

  it('abre directamente el reporte indicado por una notificación de aval', async () => {
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.reports = [
      {
        id: 'report-1',
        client_id: 'client-1',
        request_id: 'request-1',
        asset_id: 'asset-1',
        type: 'preventivo',
        created_by: 'engineer-1',
        created_at: '2026-08-26T10:00:00.000Z'
      }
    ];
    const values: Record<string, string> = { view: 'reportes', reportId: 'report-1' };
    const params = {
      get: (name: string) => values[name] ?? null
    };

    await component.applyRouteIntent(params as never);

    expect(component.viewMode).toBe('reportes');
    expect(component.reportDetail?.id).toBe('report-1');
  });

  it('muestra el avance mensual y permite consultar la vigencia anual', () => {
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.preventiveProgress = {
      schedule_id: 'schedule-1',
      schedule_status: 'approved',
      asset_category: 'biomedical',
      year: 2026,
      month: 8,
      monthly: {
        total: 10,
        not_started: 4,
        in_progress: 1,
        pending_signature: 2,
        waiting_spare: 1,
        completed: 3,
        overdue: 1,
        completion_percent: 30
      },
      annual: {
        total: 40,
        not_started: 30,
        in_progress: 1,
        pending_signature: 2,
        waiting_spare: 1,
        completed: 7,
        overdue: 4,
        completion_percent: 18
      },
      items: [
        {
          id: 'item-1',
          asset_id: 'asset-1',
          asset_code: 'EQ-001',
          asset_name: 'Monitor',
          planned_date: '2026-08-05',
          deadline_date: '2026-08-31',
          phase: 'not_started',
          is_overdue: false,
          pdf_available: false
        },
        {
          id: 'item-2',
          asset_id: 'asset-2',
          asset_code: 'EQ-002',
          asset_name: 'Desfibrilador',
          planned_date: '2026-08-12',
          deadline_date: '2026-08-31',
          phase: 'in_progress',
          is_overdue: false,
          pdf_available: false
        },
        {
          id: 'item-3',
          asset_id: 'asset-3',
          asset_code: 'EQ-003',
          asset_name: 'Electrocardiógrafo',
          planned_date: '2026-08-18',
          deadline_date: '2026-08-31',
          phase: 'pending_signature',
          is_overdue: false,
          report_id: 'report-3',
          has_pending_spare: true,
          pdf_available: true
        },
        {
          id: 'item-4',
          asset_id: 'asset-4',
          asset_code: 'EQ-004',
          asset_name: 'Ventilador',
          planned_date: '2026-08-20',
          deadline_date: '2026-08-31',
          phase: 'completed',
          is_overdue: false,
          report_id: 'report-4',
          pdf_available: true
        }
      ],
      generated_at: '2026-08-26T10:00:00.000Z'
    };

    expect(component.activePreventiveProgress?.completion_percent).toBe(30);
    expect(component.preventiveProgressSegments.map((segment) => segment.count)).toEqual([
      4, 1, 2, 3
    ]);
    expect(component.preventivePhaseTabs.map((tab) => tab.count)).toEqual([5, 2, 1, 3]);
    expect(component.filteredPreventiveItems.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    component.setPreventivePhaseView('pending_signature');
    expect(component.filteredPreventiveItems.map((item) => item.id)).toEqual(['item-3']);
    component.setPreventivePhaseView('waiting_spare');
    expect(component.filteredPreventiveItems.map((item) => item.id)).toEqual(['item-3']);
    component.setPreventivePhaseView('completed');
    expect(component.filteredPreventiveItems[0]?.pdf_available).toBe(true);
    component.preventiveProgressScope = 'year';
    expect(component.activePreventiveProgress?.completion_percent).toBe(18);
    expect(component.preventiveProgressPeriodLabel).toBe('Vigencia 2026');
  });

  it('aplica resultados rápidos coherentes al reporte preventivo', () => {
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.reportMaintenanceTests = ['encendido_apagado', 'equipo_operativo_entregado'];

    component.applyPreventiveOutcomePreset('conforme');

    expect(component.reportAssetStatus).toBe('operativo');
    expect(component.reportSummary).toContain('El equipo queda operativo y disponible para el servicio.');
    expect(component.reportFindings).toContain('No se identificaron hallazgos');

    component.reportAssetStatusObservations = 'Observación anterior que ya no corresponde.';
    component.applyPreventiveOutcomePreset('fuera_de_servicio');

    expect(component.reportAssetStatus).toBe('fuera_de_servicio');
    expect(component.reportSummary).not.toContain('El equipo queda operativo y disponible para el servicio.');
    expect(component.reportSummary).toContain('El equipo queda fuera de servicio');
    expect(component.reportAssetStatusObservations).toBe('');
    expect(component.reportMaintenanceTests).not.toContain('equipo_operativo_entregado');
  });

  it('limpia observaciones incompatibles y activa el flujo cuando el repuesto es indispensable', () => {
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.reportAssetStatus = 'operativo_observacion';
    const regularObservation = component.preventiveStatusObservationOptions[0];
    component.toggleNarrativeOption('statusObservations', regularObservation, true);
    expect(component.reportAssetStatusObservations).toContain('puede continuar en uso');

    component.reportAssetStatus = 'fuera_de_servicio';
    component.onReportAssetStatusChange();
    expect(component.reportAssetStatusObservations).toBe('');

    const requiredSpare = component.preventiveStatusObservationOptions.find(
      (option) => option.id === 'repuesto_indispensable'
    );
    expect(requiredSpare).toBeTruthy();
    component.toggleNarrativeOption('statusObservations', requiredSpare!, true);
    expect(component.reportRequiresSpareParts).toBe(true);
    expect(component.reportSparePartsStatus).toBe('solicitado');
  });

  it('evita combinar sin hallazgos con un hallazgo específico', () => {
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const noFindings = component.preventiveFindingOptions.find((option) => option.id === 'sin_hallazgos');
    const batteryFinding = component.preventiveFindingOptions.find((option) => option.id === 'bateria');
    expect(noFindings).toBeTruthy();
    expect(batteryFinding).toBeTruthy();

    component.reportFindings = 'Detalle especial escrito por el ingeniero.';
    component.toggleNarrativeOption('findings', noFindings!, true);
    component.toggleNarrativeOption('findings', batteryFinding!, true);

    expect(component.reportFindings).toContain('Detalle especial escrito por el ingeniero.');
    expect(component.reportFindings).toContain('La batería presenta autonomía reducida');
    expect(component.reportFindings).not.toContain('No se identificaron hallazgos');
  });
});
