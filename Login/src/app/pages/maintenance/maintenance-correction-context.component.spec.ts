import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../admin/admin.service';
import { AuthService } from '../../auth/auth.service';
import { BiomedService } from '../../biomed/biomed.service';
import { MaintenanceService, MaintenanceReportDto } from '../../maintenance/maintenance.service';
import { ModuleTabsComponent } from '../../shared/module-tabs/module-tabs.component';
import { ActivityReportDialogComponent } from './activity-report-dialog.component';
import { MaintenanceComponent } from './maintenance.component';

const auth = {
  currentUser: () => ({ id: 'engineer', clientId: 'client' }),
  hasRole: (role: string | string[]) => Array.isArray(role) ? role.includes('ingeniero_biomedico') : role === 'ingeniero_biomedico',
  hasPermission: (permission: string) => permission === 'maintenance:report:create'
};
const route = { snapshot: { data: {} } };
const report = (type: MaintenanceReportDto['type'] = 'preventivo'): MaintenanceReportDto => ({
  id: 'report', request_id: 'request', client_id: 'client', asset_id: 'asset', created_by: 'engineer',
  created_at: '2026-09-20T15:00:00Z', type, request_status: 'correccion', correction_requested: true,
  correction_reason: 'Corregir el hallazgo del cable.\nDetallar las pruebas realizadas.',
  correction_requested_by_name: 'JEFE DE URGENCIAS', correction_requested_at: '2026-09-22T15:00:00Z',
  summary: 'Revision del equipo', findings: 'Cable desgastado', actions_taken: 'Revision de conexiones',
  maintenance_checks: ['revision_visual'], maintenance_activities: ['ajuste_conexiones'], maintenance_tests: ['encendido_apagado'],
  asset_status_after: 'operativo'
});

function prepare(c: MaintenanceComponent) {
  c.selectedClientId = 'client';
  c.assets = [{ id: 'asset', code: 'QA-001', name: 'MONITOR', status: 'operativo' }];
  c.assetMap = new Map(c.assets.map(asset => [asset.id, asset]));
  vi.spyOn(c as any, 'scrollToReportForm').mockImplementation(() => {});
  vi.spyOn(c as any, 'refreshViewSoon').mockImplementation(() => {});
  vi.spyOn(c, 'loadData').mockResolvedValue();
  vi.spyOn(c as any, 'showAlert').mockImplementation(() => {});
  return c;
}

async function render(type: MaintenanceReportDto['type'], overrides: Partial<MaintenanceReportDto> = {}) {
  vi.spyOn(MaintenanceComponent.prototype, 'ngOnInit').mockResolvedValue();
  await TestBed.configureTestingModule({
    imports: [MaintenanceComponent],
    providers: [
      { provide: AdminService, useValue: {} }, { provide: AuthService, useValue: auth },
      { provide: BiomedService, useValue: {} }, { provide: MaintenanceService, useValue: {} },
      { provide: ActivatedRoute, useValue: route }
    ]
  }).overrideComponent(MaintenanceComponent, {
    remove: { imports: [ModuleTabsComponent, ActivityReportDialogComponent] }, add: { schemas: [NO_ERRORS_SCHEMA] }
  }).compileComponents();
  const fixture = TestBed.createComponent(MaintenanceComponent);
  const c = prepare(fixture.componentInstance);
  c.startReportCorrection({ ...report(type), ...overrides });
  fixture.detectChanges(); await fixture.whenStable();
  return { fixture, c, element: fixture.nativeElement as HTMLElement };
}

afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

describe('report correction context', () => {
  it.each(['preventivo', 'correctivo'] as const)('shows reason, requester and date inside the %s editor', async type => {
    const { element } = await render(type);
    const modal = element.querySelector('.report-editor-modal')!;
    const context = modal.querySelector('.report-correction-context')!;
    expect(context.querySelector('h3')?.textContent).toContain('Motivo');
    expect(context.querySelector('.report-correction-reason')?.textContent).toBe(report(type).correction_reason);
    expect(context.textContent).toContain('JEFE DE URGENCIAS');
    expect(context.querySelector('time')?.textContent).toContain('22/09/2026');
    expect(context.querySelector('time')?.getAttribute('datetime')).toBe(report(type).correction_requested_at);
    expect(context.querySelector('textarea,input')).toBeNull();
  });

  it('keeps the reason available in every corrective section, without changing edits', async () => {
    const { fixture, c, element } = await render('correctivo');
    Object.defineProperty(element.querySelector('.report-editor-fields'), 'scrollTo', { value: vi.fn() });
    c.reportSummary = 'Resumen corregido';
    for (const section of ['attention', 'intervention', 'closure'] as const) {
      c.setCorrectiveEditorSection(section);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges(); await fixture.whenStable();
      const context = element.querySelector('.report-correction-context')!;
      expect(context.closest('[hidden]')).toBeNull();
      expect(context.textContent).toContain('Detallar las pruebas realizadas.');
      expect(c.reportSummary).toBe('Resumen corregido');
    }
  });

  it('renders long reasons as plain text and retains line breaks', async () => {
    const reason = '<img src=x onerror=alert(1)>\n' + 'OBSERVACION '.repeat(47);
    const { element } = await render('preventivo', { correction_reason: reason });
    const context = element.querySelector('.report-correction-reason')!;
    expect(context.textContent).toBe(reason.trim());
    expect(context.querySelector('img')).toBeNull();
  });

  it('handles older reports with no reason or requester without showing empty metadata', async () => {
    const { element } = await render('preventivo', { correction_reason: ' ', correction_requested_by_name: null, correction_requested_at: null });
    expect(element.querySelector('.report-correction-reason')?.textContent).toContain('No se registr');
    expect(element.querySelector('.report-correction-meta')).toBeNull();
  });

  it('clears context on cancel and does not reuse it for another report', async () => {
    const { fixture, c, element } = await render('preventivo');
    c.cancelReportWorkflow();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(); await fixture.whenStable();
    expect(c.reportCorrectionReport).toBeNull();
    expect(element.querySelector('.report-correction-context')).toBeNull();
    c.startReportCorrection({ ...report('correctivo'), id: 'other', correction_reason: 'Revisar el repuesto instalado.' });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(); await fixture.whenStable();
    expect(element.querySelector('.report-correction-reason')?.textContent).toBe('Revisar el repuesto instalado.');
  });

  it('retains context after a failed save and clears it after a successful correction', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const maintenance = { createReport: vi.fn().mockRejectedValueOnce({ error: { message: 'No disponible' } }).mockResolvedValueOnce({}) };
    const c = prepare(new MaintenanceComponent({} as never, auth as never, {} as never, maintenance as never, { detectChanges: vi.fn() } as never, route as never));
    c.startReportCorrection(report());
    await c.createReport();
    expect(maintenance.createReport).toHaveBeenCalledTimes(1);
    expect(c.reportCorrectionReport?.correction_reason).toBe(report().correction_reason);
    expect(c.reportFormActive).toBe(true);
    await c.createReport();
    expect(c.reportCorrectionReport).toBeNull();
    expect(c.reportFormActive).toBe(false);
  });

  it('does not open a correction belonging to a different engineer', () => {
    const c = prepare(new MaintenanceComponent({} as never, auth as never, {} as never, {} as never, {} as never, route as never));
    c.startReportCorrection({ ...report(), created_by: 'other-engineer' });
    expect(c.reportCorrectionReport).toBeNull();
    expect(c.reportFormActive).toBe(false);
  });
});
