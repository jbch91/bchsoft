import { describe, expect, it, vi } from 'vitest';
import { AssetQrComponent } from './asset-qr.component';

function periodInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}`;
}

function assetDto(status = 'operativo') {
  return {
    id: 'asset-1',
    asset_category: 'biomedical',
    code: 'EQ-001',
    name: 'MONITOR DE SIGNOS VITALES',
    brand: 'MARCA',
    model: 'MODELO',
    serial: 'SERIE-001',
    status,
    photo_path: null,
    site_name: 'SEDE PRINCIPAL',
    area_name: 'URGENCIAS',
    location_name: 'OBSERVACIÓN'
  };
}

function request(
  id: string,
  type: 'preventivo' | 'correctivo',
  status = 'abierto'
) {
  return {
    id,
    client_id: 'client-1',
    asset_id: 'asset-1',
    type,
    description: type === 'correctivo' ? 'El equipo no enciende correctamente.' : 'Preventivo programado.',
    requested_by: 'user-1',
    status,
    source: type === 'preventivo' ? 'cronograma' : null,
    created_at: '2026-09-01T10:00:00.000Z'
  };
}

function report(requestId: string, type: 'preventivo' | 'correctivo' = 'correctivo') {
  return {
    id: `report-${requestId}`,
    client_id: 'client-1',
    request_id: requestId,
    asset_id: 'asset-1',
    type,
    created_by: 'engineer-1',
    created_at: '2026-09-01T12:00:00.000Z'
  };
}

function createComponent(options: {
  roles: string[];
  permissions: string[];
  requests?: any[];
  reports?: any[];
  progress?: any;
  asset?: any;
  assetError?: any;
}) {
  const route = {
    snapshot: { paramMap: { get: (name: string) => name === 'assetId' ? 'asset-1' : null } }
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const auth = {
    currentUser: () => ({ id: 'user-1', clientId: 'client-1', roles: options.roles }),
    hasRole: (role: string | string[]) => Array.isArray(role)
      ? role.some((item) => options.roles.includes(item))
      : options.roles.includes(role),
    hasPermission: (permission: string) => options.permissions.includes(permission)
  };
  const context = {
    asset: options.asset ?? assetDto(),
    requests: options.requests ?? [],
    reports: options.reports ?? [],
    preventive_progress: options.progress ?? null
  };
  const maintenance = {
    getAssetQrContext: options.assetError
      ? vi.fn().mockRejectedValue(options.assetError)
      : vi.fn().mockResolvedValue(context),
    listRequests: vi.fn().mockResolvedValue(options.requests ?? []),
    listReports: vi.fn().mockResolvedValue(options.reports ?? []),
    getPreventiveProgress: vi.fn().mockResolvedValue(options.progress ?? null),
    createRequest: vi.fn().mockResolvedValue(undefined)
  };
  const component = new AssetQrComponent(
    route as never,
    router as never,
    auth as never,
    maintenance as never
  );
  return { component, router, maintenance };
}

describe('AssetQrComponent role-aware flow', () => {
  it('prioriza el correctivo activo sobre el preventivo para el ingeniero', async () => {
    const period = periodInBogota();
    const corrective = request('corrective-1', 'correctivo');
    const preventive = request('preventive-1', 'preventivo');
    const { component, router } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create'],
      requests: [preventive, corrective],
      progress: {
        items: [{
          id: 'item-1',
          asset_id: 'asset-1',
          planned_date: `${period}-05`,
          deadline_date: `${period}-12`,
          phase: 'not_started',
          request_id: 'preventive-1'
        }]
      }
    });

    await component.ngOnInit();
    component.openExistingCorrective();

    expect(component.activeCorrectiveRequest?.id).toBe('corrective-1');
    expect(component.actionablePreventiveItem?.request_id).toBe('preventive-1');
    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: {
        view: 'reportes',
        requestId: 'corrective-1',
        assetId: 'asset-1',
        source: 'qr'
      }
    });
  });

  it('abre el preventivo vigente cuando no existe un correctivo activo', async () => {
    const period = periodInBogota();
    const preventive = request('preventive-1', 'preventivo');
    const { component, router } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create'],
      requests: [preventive],
      progress: {
        items: [{
          id: 'item-1',
          asset_id: 'asset-1',
          planned_date: `${period}-05`,
          deadline_date: `${period}-12`,
          phase: 'in_progress',
          request_id: 'preventive-1'
        }]
      }
    });

    await component.ngOnInit();
    component.openPreventive();

    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: {
        view: 'preventivos',
        requestId: 'preventive-1',
        assetId: 'asset-1',
        qrAction: 'preventive'
      }
    });
    expect(component.formatDate(`${period}-05`)).toBe(`05/${period.slice(5, 7)}/${period.slice(0, 4)}`);
  });

  it('abre el reporte existente cuando el correctivo está en corrección', async () => {
    const corrective = request('corrective-correction', 'correctivo', 'correccion');
    const correctiveReport = report('corrective-correction');
    const { component, router } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create'],
      requests: [corrective],
      reports: [correctiveReport]
    });

    await component.ngOnInit();
    component.openExistingCorrective();

    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: {
        view: 'reportes',
        reportId: correctiveReport.id,
        assetId: 'asset-1',
        source: 'qr'
      }
    });
  });

  it('abre el repuesto desde un preventivo del periodo que está esperando suministro', async () => {
    const period = periodInBogota();
    const preventive = request('preventive-spare', 'preventivo', 'espera_repuesto');
    const preventiveReport = {
      ...report('preventive-spare', 'preventivo'),
      requires_spare_parts: true,
      spare_parts_status: 'solicitado'
    };
    const { component, router } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create'],
      requests: [preventive],
      reports: [preventiveReport],
      progress: {
        items: [{
          id: 'item-spare',
          asset_id: 'asset-1',
          planned_date: `${period}-05`,
          deadline_date: `${period}-12`,
          phase: 'waiting_spare',
          request_id: 'preventive-spare',
          report_id: preventiveReport.id
        }]
      }
    });

    await component.ngOnInit();
    component.openSpareCase(component.currentPreventiveRequest);

    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: {
        view: 'repuestos',
        requestId: 'preventive-spare',
        assetId: 'asset-1',
        source: 'qr'
      }
    });
  });

  it('permite al responsable crear un correctivo sin duplicar equipos ni clientes', async () => {
    const createdRequest = request('corrective-new', 'correctivo');
    const { component, maintenance } = createComponent({
      roles: ['responsable_area'],
      permissions: ['maintenance:request:create']
    });
    maintenance.getAssetQrContext
      .mockResolvedValueOnce({
        asset: assetDto(),
        requests: [],
        reports: [],
        preventive_progress: null
      })
      .mockResolvedValueOnce({
        asset: assetDto(),
        requests: [createdRequest],
        reports: [],
        preventive_progress: null
      });

    await component.ngOnInit();
    component.openRequestForm();
    component.requestDescription = 'El monitor presenta una alarma y no permite iniciar la medición.';
    await component.createCorrectiveRequest();

    expect(maintenance.createRequest).toHaveBeenCalledWith({
      clientId: 'client-1',
      assetId: 'asset-1',
      assetCategory: 'biomedical',
      type: 'correctivo',
      description: 'El monitor presenta una alarma y no permite iniciar la medición.'
    });
    expect(component.activeCorrectiveRequest?.id).toBe('corrective-new');
    expect(component.canCreateCorrective).toBe(false);
    expect(component.successMessage).toContain('ingeniería biomédica');
  });

  it('lleva al almacenista directamente al repuesto pendiente del equipo', async () => {
    const waitingRequest = request('preventive-spare', 'preventivo', 'espera_repuesto');
    const waitingReport = {
      ...report('preventive-spare', 'preventivo'),
      requires_spare_parts: true,
      spare_parts_status: 'solicitado'
    };
    const { component, router } = createComponent({
      roles: ['almacenista'],
      permissions: ['maintenance:request:create'],
      asset: assetDto('pendiente_repuesto'),
      requests: [waitingRequest],
      reports: [waitingReport]
    });

    await component.ngOnInit();
    component.openSpareCase();

    expect(component.hasPendingSpare).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
      queryParams: {
        view: 'repuestos',
        requestId: 'preventive-spare',
        assetId: 'asset-1',
        source: 'qr'
      }
    });
  });

  it('no revela un equipo fuera del alcance del responsable de área', async () => {
    const { component } = createComponent({
      roles: ['responsable_area'],
      permissions: ['maintenance:request:create'],
      assetError: { status: 403 }
    });

    await component.ngOnInit();

    expect(component.asset).toBeNull();
    expect(component.errorMessage).toContain('áreas o ubicaciones autorizadas');
  });

  it('consulta un único contexto liviano sin cargar listados completos del cliente', async () => {
    const { component, maintenance } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create']
    });

    await component.ngOnInit();

    expect(maintenance.getAssetQrContext).toHaveBeenCalledOnce();
    expect(maintenance.getAssetQrContext).toHaveBeenCalledWith('client-1', 'asset-1');
    expect(maintenance.listRequests).not.toHaveBeenCalled();
    expect(maintenance.listReports).not.toHaveBeenCalled();
    expect(maintenance.getPreventiveProgress).not.toHaveBeenCalled();
    expect(component.loading).toBe(false);
  });

  it('sale del estado de consulta y permite reintentar cuando el servidor tarda demasiado', async () => {
    vi.useFakeTimers();
    try {
      const { component, maintenance } = createComponent({
        roles: ['ingeniero_biomedico'],
        permissions: ['maintenance:report:create']
      });
      maintenance.getAssetQrContext.mockReturnValue(new Promise(() => {}));

      const load = component.ngOnInit();
      await vi.advanceTimersByTimeAsync(12000);
      await load;

      expect(component.loading).toBe(false);
      expect(component.asset).toBeNull();
      expect(component.errorMessage).toContain('Reintenta sin volver a escanear');
    } finally {
      vi.useRealTimers();
    }
  });

  it('prioriza un preventivo atrasado cuando conserva una apertura temporal activa', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T15:00:00.000Z'));
    try {
      const latePreventive = request('preventive-august', 'preventivo');
      const { component, router } = createComponent({
        roles: ['ingeniero_biomedico'],
        permissions: ['maintenance:report:create'],
        requests: [latePreventive],
        progress: {
          items: [{
            id: 'item-august',
            asset_id: 'asset-1',
            planned_date: '2026-08-17',
            deadline_date: '2026-08-31',
            phase: 'not_started',
            is_overdue: true,
            can_perform_protocol: true,
            late_execution_authorization_active: true,
            late_execution_authorized_until: '2026-09-21T21:26:00.000Z',
            request_id: latePreventive.id
          }]
        }
      });

      await component.ngOnInit();
      component.openPreventive(component.actionablePreventiveItem);

      expect(component.actionablePreventiveItem?.id).toBe('item-august');
      expect(component.preventiveContextLabel(component.actionablePreventiveItem!))
        .toBe('PREVENTIVO ATRASADO HABILITADO');
      expect(router.navigate).toHaveBeenCalledWith(['/mantenimiento'], {
        queryParams: {
          view: 'preventivos',
          requestId: latePreventive.id,
          assetId: 'asset-1',
          qrAction: 'preventive'
        }
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('no permite abrir un preventivo vencido cuando la autorización ya no está activa', async () => {
    const overdueRequest = request('preventive-expired', 'preventivo', 'vencido');
    const { component } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['maintenance:report:create'],
      requests: [],
      progress: {
        items: [{
          id: 'item-expired',
          asset_id: 'asset-1',
          planned_date: '2026-08-17',
          deadline_date: '2026-08-31',
          phase: 'not_started',
          is_overdue: true,
          can_perform_protocol: false,
          late_execution_authorization_active: false,
          request_id: overdueRequest.id
        }]
      }
    });

    await component.ngOnInit();

    expect(component.actionablePreventiveItems).toHaveLength(0);
    expect(component.informativePreventiveItem?.id).toBe('item-expired');
    expect(component.preventiveStateActionLabel(component.informativePreventiveItem!))
      .toBe('Revisar apertura');
  });

  it('no ofrece por QR un preventivo de un mes futuro', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T15:00:00.000Z'));
    try {
      const futurePreventive = request('preventive-october', 'preventivo');
      const { component } = createComponent({
        roles: ['ingeniero_biomedico'],
        permissions: ['maintenance:report:create'],
        requests: [futurePreventive],
        progress: {
          items: [{
            id: 'item-october',
            asset_id: 'asset-1',
            planned_date: '2026-10-05',
            deadline_date: '2026-10-31',
            phase: 'not_started',
            is_overdue: false,
            can_perform_protocol: true,
            request_id: futurePreventive.id
          }]
        }
      });

      await component.ngOnInit();

      expect(component.actionablePreventiveItems).toHaveLength(0);
      expect(component.informativePreventiveItem).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('abre la hoja de vida del equipo desde la salida segura del QR', async () => {
    const { component, router } = createComponent({
      roles: ['ingeniero_biomedico'],
      permissions: ['hb:view']
    });

    await component.ngOnInit();
    component.openAssetRecord();

    expect(router.navigate).toHaveBeenCalledWith(['/hojas-de-vida'], {
      queryParams: { assetId: 'asset-1', source: 'qr' }
    });
  });
});
