import { describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';

describe('maintenance report modal flow', () => {
  it('muestra al jefe de área solo reportes que todavía puede firmar', () => {
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('responsable_area')
        : role === 'responsable_area',
      hasPermission: (permission: string) => permission === 'maintenance:report:sign',
      currentUser: () => ({ id: 'responsable-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const baseReport = {
      client_id: 'client-1',
      request_id: 'request-1',
      asset_id: 'asset-1',
      created_by: 'engineer-1',
      created_at: '2026-08-27T10:00:00.000Z',
      request_status: 'reportado',
      area_responsible_required: true,
      is_fully_signed: false,
      signed_by_me: false,
      correction_requested: false
    } as const;
    component.reports = [
      { ...baseReport, id: 'preventive', type: 'preventivo' },
      { ...baseReport, id: 'corrective', type: 'correctivo' },
      { ...baseReport, id: 'already-signed', type: 'preventivo', signed_by_me: true },
      { ...baseReport, id: 'correction', type: 'correctivo', correction_requested: true },
      { ...baseReport, id: 'completed', type: 'preventivo', is_fully_signed: true }
    ];

    expect(component.areaResponsiblePendingReports.map((report) => report.id)).toEqual([
      'preventive',
      'corrective'
    ]);
    expect(component.actionablePendingReportCount).toBe(2);
  });

  it('mantiene al jefe de área en la bandeja de avales aunque reciba una ruta operativa', async () => {
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('responsable_area')
        : role === 'responsable_area',
      hasPermission: () => false,
      currentUser: () => ({ id: 'responsable-1', clientId: 'client-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.viewMode = 'reportes';
    const params = { get: (name: string) => name === 'view' ? 'repuestos' : null };

    await component.applyRouteIntent(params as never);

    expect(component.viewMode).toBe('reportes');
  });

  it('permite al ingeniero autor corregir un preventivo mientras sigue pendiente de firma', () => {
    const auth = {
      hasRole: (role: string) => role === 'ingeniero_biomedico',
      hasPermission: (permission: string) => permission === 'maintenance:report:create',
      currentUser: () => ({ id: 'engineer-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const report = {
      id: 'report-1',
      client_id: 'client-1',
      request_id: 'request-1',
      asset_id: 'asset-1',
      type: 'preventivo',
      created_by: 'engineer-1',
      created_at: '2026-08-27T10:00:00.000Z',
      request_status: 'reportado',
      correction_requested: false,
      is_fully_signed: false
    } as const;

    expect(component.canReopenOwnPreventiveReport(report)).toBe(true);
    expect(component.canReopenOwnPreventiveReport({ ...report, created_by: 'engineer-2' })).toBe(false);
    expect(component.canReopenOwnPreventiveReport({ ...report, request_status: 'firmado' })).toBe(false);
    expect(component.canReopenOwnPreventiveReport({ ...report, is_fully_signed: true })).toBe(false);
    expect(component.canReopenOwnPreventiveReport({ ...report, type: 'correctivo' })).toBe(false);
  });

  it('usa la autorización calculada por la API para mostrar la corrección', () => {
    const auth = {
      hasRole: () => false,
      hasPermission: () => false,
      currentUser: () => ({ id: 'stale-user' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const report = {
      id: 'report-1',
      client_id: 'client-1',
      request_id: 'request-1',
      asset_id: 'asset-1',
      type: 'preventivo',
      created_by: 'engineer-1',
      created_at: '2026-08-27T10:00:00.000Z',
      request_status: 'reportado',
      can_reopen_by_me: true
    } as const;

    expect(component.canReopenOwnPreventiveReport(report)).toBe(true);
    expect(component.canReopenOwnPreventiveReport({ ...report, can_reopen_by_me: false })).toBe(false);
  });

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
        total: 11,
        not_started: 4,
        in_progress: 1,
        pending_signature: 2,
        waiting_spare: 1,
        warranty: 1,
        completed: 3,
        overdue: 1,
        completion_percent: 30
      },
      annual: {
        total: 41,
        not_started: 30,
        in_progress: 1,
        pending_signature: 2,
        waiting_spare: 1,
        warranty: 1,
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
        },
        {
          id: 'item-5',
          asset_id: 'asset-5',
          asset_code: 'EQ-005',
          asset_name: 'Monitor en garantía',
          planned_date: '2026-08-24',
          deadline_date: '2026-08-31',
          phase: 'warranty',
          is_overdue: false,
          warranty_release_date: '2027-02-15',
          can_perform_protocol: true,
          pdf_available: false
        }
      ],
      generated_at: '2026-08-26T10:00:00.000Z'
    };

    expect(component.activePreventiveProgress?.completion_percent).toBe(30);
    expect(component.preventiveManagedTotal(component.preventiveProgress.monthly)).toBe(4);
    expect(component.preventiveManagedPercent(component.preventiveProgress.monthly)).toBe(36);
    expect(component.preventiveProgressShare(component.preventiveProgress.monthly, 'completed')).toBeCloseTo(27.27, 2);
    expect(component.preventiveProgressShare(component.preventiveProgress.monthly, 'warranty')).toBeCloseTo(9.09, 2);
    expect(component.preventiveProgressSegments.map((segment) => segment.count)).toEqual([
      4, 1, 2, 1, 3
    ]);
    expect(component.preventivePhaseTabs.map((tab) => tab.count)).toEqual([5, 1, 2, 1, 3]);
    expect(component.filteredPreventiveItems.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    component.setPreventivePhaseView('warranty');
    expect(component.filteredPreventiveItems.map((item) => item.id)).toEqual(['item-5']);
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

  it('abre el PDF preventivo final en una pestaña nueva usando el visor del navegador', async () => {
    vi.useFakeTimers();
    const maintenance = {
      downloadReportPdf: vi.fn().mockResolvedValue(
        new Blob(['pdf'], { type: 'application/pdf' })
      )
    };
    const popupDocument = document.implementation.createHTMLDocument('');
    const popup = {
      opener: window,
      document: popupDocument,
      location: { href: '' },
      close: vi.fn()
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:preventive-report')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      maintenance as never,
      { detectChanges: vi.fn() } as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );

    try {
      await component.openPreventiveFinalPdf({
        id: 'item-1',
        asset_id: 'asset-1',
        asset_code: 'EQ-001',
        asset_name: 'Monitor',
        planned_date: '2026-08-20',
        deadline_date: '2026-08-31',
        phase: 'completed',
        is_overdue: false,
        report_id: 'report-1',
        pdf_available: true
      });

      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      expect(maintenance.downloadReportPdf).toHaveBeenCalledWith('report-1');
      expect(popup.location.href).toBe('blob:preventive-report');
      expect(popup.opener).toBeNull();
      expect(component.preventivePdfLoadingId).toBe('');
      vi.runAllTimers();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preventive-report');
    } finally {
      openSpy.mockRestore();
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
      } else {
        delete (URL as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL;
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
      } else {
        delete (URL as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL;
      }
      vi.useRealTimers();
    }
  });

  it('abre el PDF desde la bandeja del jefe de área sin entrar al modal de firma', async () => {
    const reportBlob = new Blob(['pdf'], { type: 'application/pdf' });
    const maintenance = {
      downloadReportPdf: vi.fn().mockResolvedValue(reportBlob)
    };
    const component = new MaintenanceComponent(
      {} as never,
      {} as never,
      {} as never,
      maintenance as never,
      { detectChanges: vi.fn() } as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const previewWindow = { close: vi.fn() } as unknown as Window;
    const pdfPreview = component as unknown as {
      preparePdfTab: (title: string) => Window | null;
      presentPdfBlob: (blob: Blob, previewWindow: Window | null, filename: string) => void;
    };
    const prepareSpy = vi
      .spyOn(pdfPreview, 'preparePdfTab')
      .mockReturnValue(previewWindow);
    const presentSpy = vi
      .spyOn(pdfPreview, 'presentPdfBlob')
      .mockImplementation(() => {});

    await component.downloadReport('report-1');

    expect(prepareSpy).toHaveBeenCalledWith('Reporte de mantenimiento');
    expect(maintenance.downloadReportPdf).toHaveBeenCalledWith('report-1');
    expect(presentSpy).toHaveBeenCalledWith(
      reportBlob,
      previewWindow,
      'reporte-report-1.pdf'
    );
    expect(component.reportDetail).toBeNull();
    expect(component.reportPdfLoadingId).toBe('');
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
