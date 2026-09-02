import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { MaintenanceComponent } from './maintenance.component';

describe('area responsible maintenance type selector', () => {
  const auth = {
    hasRole: (role: string | string[]) => Array.isArray(role)
      ? role.includes('responsable_area')
      : role === 'responsable_area',
    hasPermission: (permission: string) => permission === 'maintenance:report:sign',
    currentUser: () => ({ id: 'responsable-1', clientId: 'client-1' })
  };
  const route = { snapshot: { data: { assetCategory: 'biomedical' } } };

  function createComponent(): MaintenanceComponent {
    const component = new MaintenanceComponent(
      {} as never, auth as never, {} as never, {} as never, {} as never, route as never
    );
    component.viewMode = 'reportes';
    component.reports = (['preventivo', 'correctivo'] as const).flatMap((type) =>
      (['pending', 'correction', 'completed'] as const).map((state) => ({
        id: `${type}-${state}`,
        client_id: 'client-1',
        request_id: `${type}-${state}-request`,
        asset_id: 'asset-a',
        created_by: 'engineer-1',
        created_at: '2026-08-27T10:00:00.000Z',
        area_responsible_required: true,
        type,
        request_status: state === 'completed' ? 'firmado' : state === 'correction' ? 'correccion' : 'reportado',
        correction_requested: state === 'correction',
        is_fully_signed: state === 'completed',
        asset_status_after: 'operativo'
      }))
    );
    component.reports = [
      ...component.reports,
      { ...component.reports[0], id: 'other-area', asset_id: 'asset-b' }
    ];
    component.assetMap = new Map([
      ['asset-a', {
        id: 'asset-a', code: 'A-1', name: 'Monitor', brand: 'Marca', model: 'Modelo', serial: 'Serie A',
        siteName: 'Sede Norte', areaName: 'Urgencias', locationName: 'Observación'
      }],
      ['asset-b', {
        id: 'asset-b', code: 'B-1', name: 'Bomba', siteName: 'Sede Sur',
        areaName: 'Hospitalización', locationName: 'Piso 2'
      }]
    ]);
    return component;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('filtra todos los estados y sus contadores por el tipo seleccionado', () => {
    const component = createComponent();
    expect(component.areaResponsibleReportCount('pending')).toBe(3);
    component.setAreaResponsibleReportType('preventivo');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['preventivo-pending', 'other-area']);
    expect(component.areaResponsibleReportCount('pending')).toBe(2);
    expect(component.areaResponsibleReportCount('correction')).toBe(1);
    expect(component.areaResponsibleReportCount('completed')).toBe(1);

    component.setAreaResponsibleReportType('correctivo');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['correctivo-pending']);
    for (const state of ['pending', 'correction', 'completed'] as const) {
      component.setAreaResponsibleReportView(state);
      expect(component.filteredReports.map((report) => report.id)).toEqual([`correctivo-${state}`]);
      expect(component.areaResponsibleReportCount(state)).toBe(component.filteredReports.length);
    }
  });

  it('conserva búsqueda, alcance y estado al cambiar el tipo, reiniciando solo la página', () => {
    const component = createComponent();
    component.reportSearchTerm = 'móNITOR';
    component.reportSiteFilter = 'Sede Norte';
    component.reportAreaFilter = 'Urgencias';
    component.reportLocationFilter = 'Observación';
    component.setAreaResponsibleReportView('completed');
    component.reportPage = 5;
    component.setAreaResponsibleReportType('preventivo');

    expect(component.reportPage).toBe(1);
    expect(component.areaResponsibleReportView).toBe('completed');
    expect(component.reportSearchTerm).toBe('móNITOR');
    expect(component.reportSiteFilter).toBe('Sede Norte');
    expect(component.reportAreaFilter).toBe('Urgencias');
    expect(component.reportLocationFilter).toBe('Observación');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['preventivo-completed']);
    expect(component.areaResponsibleReportCount('pending')).toBe(1);

    component.setAreaResponsibleReportView('correction');
    expect(component.reportTypeFilter).toBe('preventivo');
    expect(component.reportLocationFilter).toBe('Observación');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['preventivo-correction']);
  });

  it('mantiene coherentes los ceros y permite limpiar filtros sin cambiar de estado', () => {
    const component = createComponent();
    component.setAreaResponsibleReportType('correctivo');
    component.setAreaResponsibleReportView('correction');
    component.reportAreaFilter = 'Hospitalización';
    expect(component.filteredReports).toEqual([]);
    expect(component.areaResponsibleReportCount('pending')).toBe(0);
    expect(component.areaResponsibleReportCount('correction')).toBe(0);
    expect(component.areaResponsibleReportCount('completed')).toBe(0);

    component.clearReportFilters();
    expect(component.reportTypeFilter).toBe('');
    expect(component.areaResponsibleReportView).toBe('correction');
    expect(component.filteredReports).toHaveLength(2);
    expect(component.hasActiveReportFilters).toBe(false);
  });

  it('actualiza los contadores y la lista cuando llegan nuevos reportes', () => {
    const component = createComponent();
    component.setAreaResponsibleReportType('correctivo');
    expect(component.filteredReports).toHaveLength(1);
    component.reports = [...component.reports, {
      ...component.reports.find((report) => report.id === 'correctivo-pending')!,
      id: 'new-corrective'
    }];
    expect(component.filteredReports).toHaveLength(2);
    expect(component.areaResponsibleReportCount('pending')).toBe(2);
  });

  it('muestra el selector compacto sin duplicar Tipo y permite cambiarlo desde la plantilla', async () => {
    vi.spyOn(MaintenanceComponent.prototype, 'ngOnInit').mockResolvedValue();
    await TestBed.configureTestingModule({
      imports: [MaintenanceComponent],
      providers: [
        { provide: AdminService, useValue: {} },
        { provide: AuthService, useValue: auth },
        { provide: BiomedService, useValue: {} },
        { provide: MaintenanceService, useValue: {} },
        { provide: ActivatedRoute, useValue: route }
      ]
    }).overrideComponent(MaintenanceComponent, {
      remove: { imports: [ModuleTabsComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] }
    }).compileComponents();
    const fixture = TestBed.createComponent(MaintenanceComponent);
    const data = createComponent();
    fixture.componentInstance.viewMode = 'reportes';
    fixture.componentInstance.reports = data.reports;
    fixture.componentInstance.assetMap = data.assetMap;
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const typeButtons = element.querySelectorAll<HTMLButtonElement>('.area-report-types button');
    expect(Array.from(typeButtons, (button) => button.textContent?.trim())).toEqual(['Todos', 'Preventivos', 'Correctivos']);
    expect(element.querySelector('.area-approval-heading h2')?.textContent).toBe('Mantenimiento');
    expect(element.querySelectorAll('.area-approval-toolbar select')).toHaveLength(3);
    expect(element.querySelector('.maintenance-workspace-bar')).toBeNull();
    expect(element.querySelectorAll('.area-report-card')).toHaveLength(3);

    typeButtons[2].click();
    fixture.detectChanges();
    expect(typeButtons[2].getAttribute('aria-pressed')).toBe('true');
    expect(typeButtons[0].getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelectorAll('.area-report-card')).toHaveLength(1);
    const states = element.querySelectorAll<HTMLButtonElement>('.area-approval-tabs button');
    states[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.areaResponsibleReportView).toBe('completed');
    expect(typeButtons[2].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelectorAll('.area-report-card')).toHaveLength(1);
  });
});

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
    expect(component.areaResponsibleCorrectionReports.map((report) => report.id)).toEqual([
      'correction'
    ]);
    expect(component.areaResponsibleCompletedReports.map((report) => report.id)).toEqual([
      'already-signed',
      'completed'
    ]);
    expect(component.actionablePendingReportCount).toBe(2);
    expect(component.areaResponsibleReportCount('pending')).toBe(2);
    expect(component.areaResponsibleReportCount('correction')).toBe(1);
    expect(component.areaResponsibleReportCount('completed')).toBe(2);

    component.setAreaResponsibleReportView('correction');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['correction']);
    component.setAreaResponsibleReportView('completed');
    expect(component.filteredReports.map((report) => report.id)).toEqual([
      'already-signed',
      'completed'
    ]);
  });

  it('encadena sede, área y ubicación dentro del alcance del responsable', () => {
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
    const reportBase = {
      client_id: 'client-1',
      request_id: 'request-1',
      type: 'preventivo',
      created_by: 'engineer-1',
      created_at: '2026-08-27T10:00:00.000Z',
      request_status: 'firmado',
      is_fully_signed: true
    } as const;
    component.reports = [
      { ...reportBase, id: 'report-a', asset_id: 'asset-a' },
      { ...reportBase, id: 'report-b', asset_id: 'asset-b' }
    ];
    component.assetMap = new Map([
      ['asset-a', {
        id: 'asset-a', code: 'A-1', name: 'Monitor', siteName: 'Sede Norte',
        areaName: 'Urgencias', locationName: 'Observación'
      }],
      ['asset-b', {
        id: 'asset-b', code: 'B-1', name: 'Bomba', siteName: 'Sede Sur',
        areaName: 'Hospitalización', locationName: 'Piso 2'
      }]
    ]);
    component.setAreaResponsibleReportView('completed');

    expect(component.reportSiteOptions).toEqual(['Sede Norte', 'Sede Sur']);
    component.reportSiteFilter = 'Sede Norte';
    component.onReportSiteFilterChange();
    expect(component.reportAreaOptions).toEqual(['Urgencias']);
    component.reportAreaFilter = 'Urgencias';
    component.onReportAreaFilterChange();
    expect(component.reportLocationOptions).toEqual(['Observación']);
    component.reportLocationFilter = 'Observación';
    expect(component.filteredReports.map((report) => report.id)).toEqual(['report-a']);
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

  it('abre el equipo desde la ruta QR compacta', async () => {
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('ingeniero_biomedico')
        : role === 'ingeniero_biomedico',
      hasPermission: () => true,
      currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      { detectChanges: vi.fn() } as never,
      {
        snapshot: {
          data: { assetCategory: 'biomedical' },
          paramMap: { get: (name: string) => name === 'assetId' ? 'asset-qr' : null }
        }
      } as never
    );
    component.selectedClientId = 'client-1';
    component.assets = [{
      id: 'asset-qr',
      code: 'EQ-QR-001',
      name: 'MONITOR',
      serial: 'SERIE-QR',
      status: 'operativo'
    }];

    await component.applyRouteIntent({ get: () => null } as never);

    expect(component.requestAssetId).toBe('asset-qr');
    expect(component.viewMode).toBe('crear_solicitud');
    expect(component.successMessage).toContain('EQ-QR-001');
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

  it('reserva la pestaña Reportes del ingeniero para mantenimientos correctivos', () => {
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('ingeniero_biomedico')
        : role === 'ingeniero_biomedico',
      hasPermission: (permission: string) => permission === 'maintenance:report:create',
      currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' })
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
      created_at: '2026-08-28T10:00:00.000Z',
      request_status: 'reportado',
      correction_requested: false
    } as const;
    component.reports = [
      { ...baseReport, id: 'preventive-pending', type: 'preventivo', is_fully_signed: false },
      { ...baseReport, id: 'corrective-pending', type: 'correctivo', is_fully_signed: false },
      { ...baseReport, id: 'preventive-completed', type: 'preventivo', is_fully_signed: true },
      { ...baseReport, id: 'corrective-completed', type: 'correctivo', is_fully_signed: true }
    ];

    expect(component.engineerReportsOnlyCorrectives).toBe(true);
    expect(component.pendingSignatureReports.map((report) => report.id)).toEqual(['corrective-pending']);
    expect(component.reportHistory.map((report) => report.id)).toEqual(['corrective-completed']);
    expect(component.actionablePendingReportCount).toBe(1);
    expect(component.filteredReports.map((report) => report.id)).toEqual(['corrective-pending']);

    component.setReportSubView('historial');
    expect(component.filteredReports.map((report) => report.id)).toEqual(['corrective-completed']);
  });

  it('mantiene en Repuestos un preventivo en corrección mientras el repuesto siga pendiente', () => {
    const auth = {
      hasRole: () => false,
      hasPermission: (permission: string) => permission === 'maintenance:report:create',
      currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      {} as never,
      {} as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    const asset = {
      id: 'asset-1',
      code: '10003',
      name: 'ANALIZADOR DE HEMATOLOGÍA',
      status: 'pendiente_repuesto'
    };
    component.assets = [asset];
    component.assetMap = new Map([[asset.id, asset]]);
    component.reports = [{
      id: 'report-1',
      client_id: 'client-1',
      request_id: 'request-1',
      asset_id: asset.id,
      type: 'preventivo',
      created_by: 'engineer-1',
      created_at: '2026-08-28T10:00:00.000Z',
      request_status: 'correccion',
      requires_spare_parts: true,
      spare_parts_needed: 'Celda de lectura de hemoglobina',
      spare_parts_status: 'solicitado'
    }];

    expect(component.sparePartReports.map((report) => report.id)).toEqual(['report-1']);
    expect(component.pendingSpareCount).toBe(1);

    component.requests = [{
      id: 'request-1',
      client_id: 'client-1',
      asset_id: asset.id,
      type: 'preventivo',
      status: 'correccion',
      description: 'Mantenimiento preventivo',
      requested_by: 'user-1',
      assigned_to: 'engineer-1',
      created_at: '2026-08-28T09:00:00.000Z'
    }];
    expect(component.canContinueSpareCase(component.reports[0])).toBe(false);
    expect(component.spareCaseActionNotice(component.reports[0])).toContain('corrección pendiente');
    expect(component.canContinueSpareCase({
      ...component.reports[0],
      request_status: 'espera_repuesto'
    })).toBe(true);

    component.reports = [{ ...component.reports[0], spare_parts_status: 'recibido' }];
    expect(component.sparePartReports).toEqual([]);
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
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('responsable_area')
        : role === 'responsable_area',
      hasPermission: (permission: string) => permission === 'maintenance:report:sign',
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
    component.reports = [
      {
        id: 'report-1',
        client_id: 'client-1',
        request_id: 'request-1',
        asset_id: 'asset-1',
        type: 'preventivo',
        created_by: 'engineer-1',
        created_at: '2026-08-26T10:00:00.000Z',
        correction_requested: true,
        request_status: 'correccion'
      }
    ];
    const values: Record<string, string> = { view: 'reportes', reportId: 'report-1' };
    const params = {
      get: (name: string) => values[name] ?? null
    };

    await component.applyRouteIntent(params as never);

    expect(component.viewMode).toBe('reportes');
    expect(component.areaResponsibleReportView).toBe('correction');
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

describe('late preventive period opening', () => {
  function createLateOpeningComponent(hasTemporaryPermission = true) {
    const maintenance = {
      openLatePreventivePeriod: vi.fn().mockResolvedValue({
        ok: true,
        opened: 1,
        period: '2026-08',
        authorizedUntil: '2026-09-06T12:00:00.000Z',
        message: '1 preventivo de 2026-08 quedó habilitado temporalmente.'
      })
    };
    const auth = {
      hasRole: (role: string | string[]) => Array.isArray(role)
        ? role.includes('ingeniero_biomedico')
        : role === 'ingeniero_biomedico',
      hasPermission: (permission: string) => hasTemporaryPermission
        && permission === 'maintenance:preventive:late_execution',
      currentUser: () => ({ id: 'engineer-1', clientId: 'client-1' })
    };
    const component = new MaintenanceComponent(
      {} as never,
      auth as never,
      {} as never,
      maintenance as never,
      { detectChanges: vi.fn() } as never,
      { snapshot: { data: { assetCategory: 'biomedical' } } } as never
    );
    component.selectedClientId = 'client-1';
    component.preventivePeriod = '2026-08';
    component.preventiveProgress = {
      schedule_id: 'schedule-1',
      schedule_status: 'approved',
      asset_category: 'biomedical',
      year: 2026,
      month: 8,
      monthly: {
        total: 4, not_started: 2, in_progress: 0, pending_signature: 0,
        waiting_spare: 0, warranty: 1, completed: 1, overdue: 2, completion_percent: 25
      },
      annual: {
        total: 4, not_started: 2, in_progress: 0, pending_signature: 0,
        waiting_spare: 0, warranty: 1, completed: 1, overdue: 2, completion_percent: 25
      },
      items: [
        {
          id: 'expired-available', asset_id: 'asset-1', asset_code: 'EQ-001',
          asset_name: 'Monitor', planned_date: '2026-08-05', deadline_date: '2026-08-31',
          phase: 'not_started', is_overdue: true, can_perform_protocol: false,
          pdf_available: false
        },
        {
          id: 'already-authorized', asset_id: 'asset-2', asset_code: 'EQ-002',
          asset_name: 'Bomba', planned_date: '2026-08-10', deadline_date: '2026-08-31',
          phase: 'not_started', is_overdue: true, can_perform_protocol: true,
          is_late_execution: true, late_execution_authorization_active: true,
          pdf_available: false
        },
        {
          id: 'warranty', asset_id: 'asset-3', asset_code: 'EQ-003',
          asset_name: 'Ventilador', planned_date: '2026-08-15', deadline_date: '2026-08-31',
          phase: 'warranty', is_overdue: false, can_perform_protocol: false,
          pdf_available: false
        },
        {
          id: 'completed', asset_id: 'asset-4', asset_code: 'EQ-004',
          asset_name: 'Desfibrilador', planned_date: '2026-08-20', deadline_date: '2026-08-31',
          phase: 'completed', is_overdue: false, can_perform_protocol: false,
          report_id: 'report-1', pdf_available: true
        }
      ],
      generated_at: '2026-09-01T12:00:00.000Z'
    };
    return { component, maintenance };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('identifica agosto como periodo anterior y cuenta solo vencidos disponibles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T15:00:00.000Z'));
    const { component } = createLateOpeningComponent();

    expect(component.currentPreventivePeriodValue).toBe('2026-09');
    expect(component.isPreviousPreventivePeriod).toBe(true);
    expect(component.latePreventiveCandidateCount).toBe(1);
    expect(component.canOpenLatePreventivePeriod).toBe(true);

    component.preventivePeriod = '2026-07';
    expect(component.isPreviousPreventivePeriod).toBe(false);
    expect(component.latePreventiveCandidateCount).toBe(0);
    expect(component.canOpenLatePreventivePeriod).toBe(false);
  });

  it('no habilita la apertura sin el permiso temporal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T15:00:00.000Z'));
    const { component } = createLateOpeningComponent(false);

    component.openLatePreventiveDialog();

    expect(component.canOpenLatePreventivePeriod).toBe(false);
    expect(component.lateOpeningDialog).toBe(false);
  });

  it('envía periodo, categoría y justificación sin cambiar las fechas originales', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T15:00:00.000Z'));
    const { component, maintenance } = createLateOpeningComponent();
    const loadData = vi.spyOn(component, 'loadData').mockResolvedValue();
    component.openLatePreventiveDialog();
    component.lateOpeningReason = 'Cierre operativo de agosto autorizado por el cliente.';

    await component.submitLatePreventiveOpening();

    expect(maintenance.openLatePreventivePeriod).toHaveBeenCalledWith('client-1', {
      year: 2026,
      month: 8,
      assetCategory: 'biomedical',
      reason: 'Cierre operativo de agosto autorizado por el cliente.'
    });
    expect(loadData).toHaveBeenCalledOnce();
    expect(component.lateOpeningDialog).toBe(false);
    expect(component.preventivePeriod).toBe('2026-08');
    expect(component.successMessage).toContain('habilitado temporalmente');
  });
});
