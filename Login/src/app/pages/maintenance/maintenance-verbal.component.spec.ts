import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';

function setup() {
  const auth = { currentUser: () => ({ id: 'engineer', clientId: 'client' }), hasRole: (role: string) => role === 'ingeniero_biomedico', hasPermission: () => true };
  const maintenance = { createVerbalAttention: vi.fn().mockResolvedValue({ id: 'report', requestId: 'request', assetStatusApplied: true }), findVerbalAttention: vi.fn(), createReport: vi.fn() };
  const component = new MaintenanceComponent({} as never, auth as never, {} as never, maintenance as never, { detectChanges: vi.fn() } as never, { snapshot: { data: {} } } as never);
  component.assets = [{ id: 'asset', name: 'MONITOR', code: 'A001', serial: '123', status: 'operativo' }];
  vi.spyOn(component as any, 'scrollToReportForm').mockImplementation(() => {});
  vi.spyOn(component as any, 'loadData').mockResolvedValue(undefined);
  vi.spyOn(component as any, 'refreshViewSoon').mockImplementation(() => {});
  vi.spyOn(component as any, 'showAlert').mockImplementation(() => {});
  component.openVerbalAttention();
  return { component, maintenance, auth };
}
function fill(c: MaintenanceComponent) {
  c.verbalAssetId = 'asset'; c.verbalReporterName = 'Jefe de prueba'; c.verbalDescription = 'El equipo no enciende.';
  c.reportSummary = 'Atencion por aviso verbal.'; c.reportFindings = 'Cable deteriorado.'; c.reportActions = 'Se reemplaza el cable.';
  c.reportMaintenanceChecks = ['revision_visual']; c.reportMaintenanceActivities = ['limpieza_externa']; c.reportMaintenanceTests = ['encendido_apagado'];
}
afterEach(() => vi.restoreAllMocks());
describe('verbal corrective modal', () => {
  it('opens a new independent corrective without creating an earlier request', () => {
    const { component: c, maintenance } = setup();
    expect(c.reportFormActive).toBe(true); expect(c.reportRequestId).toBe(''); expect(c.verbalPerformedOn).toBe(c.verbalToday);
    expect(c.verbalSubmissionId).toMatch(/^[a-f0-9-]{36}$/);
    c.verbalAssetId = 'asset'; expect(c.selectedReportRequest?.type).toBe('correctivo');
    expect(maintenance.createReport).not.toHaveBeenCalled();
  });
  it('shows missing data in the same modal and preserves the draft', async () => {
    const { component: c, maintenance } = setup(); await c.createReport();
    expect(c.verbalErrorField).toBe('assetId'); expect(c.reportFormActive).toBe(true); expect(maintenance.createVerbalAttention).not.toHaveBeenCalled();
    c.verbalAssetId = 'asset'; c.clearVerbalFieldError('assetId');
    expect(c.errorMessage).toBe(''); expect(c.verbalErrorField).toBe('');
  });
  it('saves an installed spare without adding it to pending spares', async () => {
    const { component: c, maintenance } = setup(); fill(c);
    c.reportRequiresSpareParts = true; c.reportSparePartsNeeded = 'Cable de alimentacion'; c.setReportSparePartResolution('installed_now');
    await c.createReport();
    expect(maintenance.createVerbalAttention).toHaveBeenCalledWith(expect.objectContaining({ sparePartsInstalledNow: true, requiresSpareParts: true, assetId: 'asset', reporterName: 'Jefe de prueba' }));
    expect(maintenance.createReport).not.toHaveBeenCalled(); expect(c.reportFormActive).toBe(false); expect(c.reportSaving).toBe(false);
  });
  it('blocks duplicate clicks and closing while the same submission is pending', async () => {
    const { component: c, maintenance } = setup(); fill(c);
    let finish!: (data: unknown) => void; maintenance.createVerbalAttention.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = c.createReport(); await c.createReport(); c.cancelReportWorkflow();
    expect(c.reportFormActive).toBe(true); expect(maintenance.createVerbalAttention).toHaveBeenCalledTimes(1);
    finish({ id: 'report', requestId: 'request', assetStatusApplied: true }); await pending;
  });
  it('recovers a committed response after a network error without saving twice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { component: c, maintenance } = setup(); fill(c);
    maintenance.createVerbalAttention.mockRejectedValue({ status: 0 }); maintenance.findVerbalAttention.mockResolvedValue({ id: 'report', requestId: 'request' });
    const key = c.verbalSubmissionId; await c.createReport();
    expect(maintenance.findVerbalAttention).toHaveBeenCalledWith(key); expect(c.reportFormActive).toBe(false); expect(c.loading).toBe(false);
  });
  it('keeps the same id and the error visible for a safe retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { component: c, maintenance } = setup(); fill(c); const key = c.verbalSubmissionId;
    maintenance.createVerbalAttention.mockRejectedValue({ status: 403, error: { message: 'Sin permiso.' } }); await c.createReport();
    expect(c.errorMessage).toBe('Sin permiso.'); expect(c.verbalSubmissionId).toBe(key); expect(c.reportFormActive).toBe(true); expect(c.reportSaving).toBe(false);
  });
});
