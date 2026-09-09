import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';
import type { MaintenanceReportDto, MaintenanceSignatureResult } from '../../maintenance/maintenance.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const report: MaintenanceReportDto = {
    id: 'report-1', client_id: 'client-1', request_id: 'request-1', asset_id: 'asset-1',
    created_by: 'engineer-1', created_at: '2026-09-09', type: 'preventivo',
    request_status: 'reportado', signed_by_me: false, is_fully_signed: false,
    area_responsible_required: true
  };
  const confirmed: MaintenanceSignatureResult = {
    id: 'signature-1', reportId: report.id, signed_by_me: true,
    is_fully_signed: true, request_status: 'firmado'
  };
  const auth = {
    hasRole: (role: string | string[]) => Array.isArray(role) ? role.includes('responsable_area') : role === 'responsable_area',
    hasPermission: (permission: string) => permission === 'maintenance:report:sign',
    currentUser: () => ({ id: 'chief-1', clientId: 'client-1' })
  };
  const maintenance = { signReport: vi.fn().mockResolvedValue(confirmed), listReports: vi.fn().mockResolvedValue([{ ...report, ...confirmed, id: report.id }]) };
  const cdr = { detectChanges: vi.fn() };
  const component = new MaintenanceComponent(
    {} as never, auth as never, {} as never, maintenance as never,
    cdr as never, { snapshot: { data: {} } } as never
  );
  component.selectedClientId = 'client-1';
  component.viewMode = 'reportes';
  component.reports = [report];
  component.openSignConfirmation(report);
  const load = vi.spyOn(component, 'loadData').mockResolvedValue();
  return { component, maintenance, report, confirmed, cdr, load };
}

describe('signature confirmation modal', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('closes immediately after confirmation even if refreshing the list has not finished', async () => {
    vi.useFakeTimers();
    const state = setup();
    const refresh = deferred<MaintenanceReportDto[]>();
    state.maintenance.listReports.mockReturnValue(refresh.promise);
    state.component.reportSearchTerm = 'monitor';
    state.component.reportAreaFilter = 'Urgencias';
    await state.component.confirmSignReport();
    expect(state.component.signConfirmationReport).toBeNull();
    expect(state.component.signingReport).toBe(false);
    expect(state.component.reports[0].signed_by_me).toBe(true);
    expect(state.component.reports[0].is_fully_signed).toBe(true);
    expect(state.component.reportSearchTerm).toBe('monitor');
    expect(state.component.reportAreaFilter).toBe('Urgencias');
    expect(state.component.areaResponsibleReportView).toBe('pending');
    expect(state.load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(state.cdr.detectChanges).toHaveBeenCalled();
    refresh.resolve([{ ...state.report, ...state.confirmed, id: state.report.id }]);
  });

  it('prevents double clicks and closing while the signature is being confirmed', async () => {
    vi.useFakeTimers();
    const state = setup();
    const signing = deferred<MaintenanceSignatureResult>();
    state.maintenance.signReport.mockReturnValue(signing.promise);
    const pending = state.component.confirmSignReport();
    await state.component.confirmSignReport();
    state.component.closeSignConfirmation();
    expect(state.component.signConfirmationReport).toBe(state.report);
    expect(state.maintenance.signReport).toHaveBeenCalledTimes(1);
    signing.resolve(state.confirmed);
    await pending;
    expect(state.component.signConfirmationReport).toBeNull();
  });

  for (const failure of [{ status: 502 }, { status: 0 }, { name: 'TimeoutError' }, { status: 409 }]) {
    it(`reconciles a saved signature after ${JSON.stringify(failure)} without resubmitting`, async () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = setup();
      state.maintenance.signReport.mockRejectedValue(failure);
      await state.component.confirmSignReport();
      expect(state.maintenance.signReport).toHaveBeenCalledTimes(1);
      expect(state.maintenance.listReports).toHaveBeenCalledWith('client-1', { assetId: 'asset-1', assetCategory: 'biomedical' });
      expect(state.component.signConfirmationReport).toBeNull();
      expect(state.component.reports[0].signed_by_me).toBe(true);
      expect(state.component.signingReport).toBe(false);
      expect(state.component.verifyingSignature).toBe(false);
      expect(state.component.successMessage).toContain('sin duplicarla');
    });
  }

  it('shows a validation error inside the modal and allows closing or retrying', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = setup();
    state.maintenance.signReport.mockRejectedValue({ status: 400, error: { message: 'Firma no registrada.' } });
    await state.component.confirmSignReport();
    expect(state.component.signErrorMessage).toBe('Firma no registrada.');
    expect(state.component.signingReport).toBe(false);
    expect(state.component.signConfirmationReport).toBe(state.report);
    expect(state.maintenance.listReports).not.toHaveBeenCalled();
    state.component.closeSignConfirmation();
    expect(state.component.signConfirmationReport).toBeNull();
  });

  it('does not report success or lock the modal if both signing and verification lose connectivity', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = setup();
    state.maintenance.signReport.mockRejectedValue({ status: 0 });
    state.maintenance.listReports.mockRejectedValue({ status: 0 });
    await state.component.confirmSignReport();
    expect(state.component.reports[0].signed_by_me).toBe(false);
    expect(state.component.signingReport).toBe(false);
    expect(state.component.verifyingSignature).toBe(false);
    expect(state.component.signErrorMessage).toContain('No se pudo confirmar');
    expect(state.component.successMessage).toBe('');
    state.component.closeSignConfirmation();
    expect(state.component.signConfirmationReport).toBeNull();
  });

  it('keeps a confirmed signature if the background refresh fails', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = setup();
    state.maintenance.listReports.mockRejectedValue(new Error('Network failed'));
    await state.component.confirmSignReport();
    expect(state.component.reports[0].signed_by_me).toBe(true);
    expect(state.component.signConfirmationReport).toBeNull();
    expect(state.component.errorMessage).toBe('');
  });

  it('moves a signed report with pending spares to completed without closing its spare request', async () => {
    vi.useFakeTimers();
    const state = setup();
    state.report.requires_spare_parts = true;
    state.report.spare_parts_status = 'solicitado';
    state.maintenance.signReport.mockResolvedValue({ ...state.confirmed, request_status: 'espera_repuesto' });
    state.maintenance.listReports.mockResolvedValue([{ ...state.report, ...state.confirmed, id: state.report.id, request_status: 'espera_repuesto' }]);
    await state.component.confirmSignReport();
    expect(state.component.areaResponsiblePendingReports).toHaveLength(0);
    expect(state.component.areaResponsibleCompletedReports).toHaveLength(1);
    expect(state.component.reports[0].request_status).toBe('espera_repuesto');
  });

  it('shows saved state plus a warning if PDF or notification processing failed', async () => {
    vi.useFakeTimers();
    const state = setup();
    state.maintenance.signReport.mockResolvedValue({ ...state.confirmed, warnings: ['pdf'] });
    await state.component.confirmSignReport();
    expect(state.component.signConfirmationReport).toBeNull();
    expect(state.component.successMessage).toContain('no se completaron');
    expect(state.component.reports[0].signed_by_me).toBe(true);
  });
});
