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
});
