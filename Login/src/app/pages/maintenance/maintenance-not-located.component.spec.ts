import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';
import { PreventiveProgressItemDto, PreventiveProgressSummaryDto } from '../../maintenance/maintenance.service';
import { HojasDeVidaComponent } from '../hojas-de-vida/hojas-de-vida.component';
import { InventoryPanelComponent } from '../../shared/inventory-panel/inventory-panel.component';

function setup() {
  const auth = { currentUser: () => ({ id: 'engineer', clientId: 'client' }),
    hasRole: (role: string) => role === 'ingeniero_biomedico', hasPermission: () => true };
  const maintenance = { closeNotLocatedPreventive: vi.fn().mockResolvedValue({ id: 'report', pdfAvailable: true, message: 'Constancia firmada.' }) };
  const component = new MaintenanceComponent({} as never, auth as never, {} as never, maintenance as never,
    { detectChanges: vi.fn() } as never, { snapshot: { data: {} } } as never);
  component.selectedClientId = 'client';
  const item: PreventiveProgressItemDto = { id: 'item', asset_id: 'asset', asset_code: 'QA', asset_name: 'EQUIPO QA',
    planned_date: '2026-01-01', deadline_date: '2026-12-31', phase: 'not_started', is_overdue: false,
    can_perform_protocol: true, pdf_available: false, request_status: 'abierto' };
  const reload = vi.spyOn(component, 'loadData').mockResolvedValue();
  vi.spyOn(component as any, 'refreshViewSoon').mockImplementation(() => {});
  const fill = () => { component.openNotLocated(item); component.notLocatedLocation = 'URGENCIAS';
    component.notLocatedReason = 'Se revisaron las salas y no se encontro el equipo.'; component.notLocatedConfirmed = true; };
  return { component, maintenance, item, reload, fill };
}

afterEach(() => vi.restoreAllMocks());

describe('constancia de equipo no localizado', () => {
  it('identifies the certificate in both history views without calling it maintenance', () => {
    const item = { item_type: 'maintenance_report', subtype: 'not_located' } as never;
    expect(HojasDeVidaComponent.prototype.assetHistoryTypeLabel(item)).toBe('Constancia de equipo no localizado');
    expect(InventoryPanelComponent.prototype.historyTypeLabel(item)).toBe('Constancia de equipo no localizado');
  });
  it('only offers reportless, available activities assigned to this engineer', () => {
    const { component, item } = setup();
    expect(component.canCloseNotLocated(item)).toBe(true);
    for (const change of [{ report_id: 'existing' }, { assigned_to: 'other' }, { is_under_warranty: true },
      { can_perform_protocol: false }, { has_pending_spare: true }, { completion_source: 'historical_pdf' },
      { phase: 'pending_signature' }, { phase: 'completed' }, { request_status: 'espera_repuesto' }]) {
      expect(component.canCloseNotLocated({ ...item, ...change } as PreventiveProgressItemDto)).toBe(false);
    }
    component.selectedClientId = 'other';
    expect(component.canCloseNotLocated(item)).toBe(false);
  });

  it('shows validation inside modal and never signs without explicit confirmation', async () => {
    const { component, maintenance, item, fill } = setup();
    component.openNotLocated(item); await component.submitNotLocated();
    expect(component.notLocatedError).toContain('20 caracteres');
    fill(); component.notLocatedConfirmed = false; await component.submitNotLocated();
    expect(component.notLocatedError).toContain('Confirma');
    expect(maintenance.closeNotLocatedPreventive).not.toHaveBeenCalled();
  });

  it('closes and releases busy state before refreshing without changing filters or tab', async () => {
    const { component, maintenance, reload, fill } = setup(); fill();
    component.preventiveAreaFilter = 'NO SE ENCUENTRA EN EL AREA'; component.preventivePhaseView = 'work';
    reload.mockImplementation(async () => {
      expect(component.notLocatedSaving).toBe(false); expect(component.notLocatedItem).toBeNull();
    });
    await component.submitNotLocated();
    expect(maintenance.closeNotLocatedPreventive).toHaveBeenCalledTimes(1);
    expect(component.successMessage).toContain('Constancia firmada');
    expect(component.preventivePhaseView).toBe('work'); expect(component.preventiveAreaFilter).toBe('NO SE ENCUENTRA EN EL AREA');
  });

  it('prevents duplicate clicks and escape while saving; errors retain the form', async () => {
    const { component, maintenance, fill } = setup(); fill();
    let reject!: (value: unknown) => void;
    maintenance.closeNotLocatedPreventive.mockReturnValue(new Promise((_, no) => { reject = no; }));
    const task = component.submitNotLocated(); await component.submitNotLocated();
    const cancel = new Event('cancel', { cancelable: true }); component.closeNotLocated(cancel);
    expect(cancel.defaultPrevented).toBe(true); expect(component.notLocatedItem).not.toBeNull();
    expect(maintenance.closeNotLocatedPreventive).toHaveBeenCalledTimes(1);
    reject({ error: { message: 'La actividad ya tiene reporte.' } }); await task;
    expect(component.notLocatedError).toContain('ya tiene reporte'); expect(component.notLocatedSaving).toBe(false);
    expect(component.notLocatedReason).not.toBe(''); component.closeNotLocated(); expect(component.notLocatedItem).toBeNull();
  });

  it('keeps non-execution separate in progress but includes it in Finalizados', () => {
    const { component, item } = setup();
    const summary: PreventiveProgressSummaryDto = { total: 3, completed: 1, warranty: 1, not_located: 1,
      not_started: 0, in_progress: 0, pending_signature: 0, waiting_spare: 0, overdue: 0, completion_percent: 50 };
    component.preventiveProgress = { asset_category: 'biomedical', year: 2026, month: 9,
      monthly: summary, annual: summary, items: [], generated_at: '' };
    expect(component.preventiveManagedPercent(summary)).toBe(100);
    expect(component.preventiveProgressSegments.find(row => row.key === 'completed')?.count).toBe(1);
    expect(component.preventivePhaseTabs.find(row => row.value === 'completed')?.count).toBe(2);
    component.preventivePhaseView = 'completed';
    expect((component as any).preventiveItemMatchesActivePhase({ ...item, phase: 'not_located' })).toBe(true);
  });
});
