import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceComponent } from './maintenance.component';
import { convertToParamMap } from '@angular/router';
import type { MaintenanceReportDto } from '../../maintenance/maintenance.service';

function setup(role='almacenista') {
  const auth = {
    hasRole: (roles:string|string[]) => Array.isArray(roles) ? roles.includes(role) : roles===role,
    hasPermission: () => true,
    currentUser: () => ({id:'me',clientId:'client'})
  };
  const maintenance = {
    listAcceptanceDelegates: vi.fn().mockResolvedValue([{id:'store',name:'ALMACENISTA',hasSignature:true}]),
    setAcceptanceDelegate: vi.fn().mockResolvedValue({warnings:[]}),
    requestReportCorrection: vi.fn().mockResolvedValue({})
  };
  const component = new MaintenanceComponent({} as never,auth as never,{} as never,maintenance as never,
    {detectChanges:vi.fn()} as never,{snapshot:{data:{}}} as never);
  vi.spyOn(component,'loadData').mockResolvedValue();
  const report:MaintenanceReportDto = {id:'report',client_id:'client',asset_id:'asset',request_id:'request',created_by:'engineer',
    created_at:'2026-09-28',type:'preventivo',request_status:'reportado',area_responsible_required:true,
    acceptance_delegate_user_id:'me',can_delegate_acceptance:true};
  component.reports=[report];
  return {component,report,maintenance};
}

describe('storekeeper assigned signatures',()=>{
  afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
  it('does not open the general work queues through an old link or tab action',async()=>{
    const {component}=setup();
    component.viewMode='reportes';
    await component.switchView('preventivos');expect(component.viewMode).toBe('reportes');
    for(const view of ['solicitudes','preventivos','reportes']) {
      await component.applyRouteIntent(convertToParamMap({view,requestId:'request'}));
      expect(component.viewMode).toBe('reportes');
    }
  });
  it('shows only explicitly assigned or previously signed reports, excluding unrelated spare cases',()=>{
    const {component,report}=setup();
    component.reports=[report,{...report,id:'spare',acceptance_delegate_user_id:null,requires_spare_parts:true,request_status:'espera_repuesto'},
      {...report,id:'other',acceptance_delegate_user_id:'another'},
      {...report,id:'signed',acceptance_delegate_user_id:null,signed_by_me:true,is_fully_signed:true},
      {...report,id:'correction',correction_requested:true,request_status:'correccion'}];
    expect(component.isStorekeeper).toBe(true);
    expect(component.areaResponsiblePendingReports.map(r=>r.id)).toEqual(['report']);
    expect(component.areaResponsibleCorrectionReports.map(r=>r.id)).toEqual(['correction']);
    expect(component.areaResponsibleCompletedReports.map(r=>r.id)).toEqual(['signed']);
    expect(component.canSignReport(report)).toBe(true);
  });
  it('moves a returned protocol into correction without getting stuck in submitting state',async()=>{
    vi.useFakeTimers();
    const {component,report,maintenance}=setup();
    component.openCorrectionDialog(report);
    component.correctionReason='Por favor corregir el número de serie.';
    await component.requestReportCorrection();
    expect(maintenance.requestReportCorrection).toHaveBeenCalledWith(report.id,component.correctionReason || 'Por favor corregir el número de serie.');
    expect(component.areaResponsibleReportView).toBe('correction');
    expect(component.correctionSubmitting).toBe(false);
    expect(component.correctionDialogReport).toBeNull();
  });
  it('sends the selected recipient and mandatory reason then closes the modal',async()=>{
    vi.useFakeTimers();
    const {component,report,maintenance}=setup('ingeniero_biomedico');
    component.reportDetail=report;
    await component.openAcceptanceDelegate(report);
    expect(component.reportDetail).toBeNull();
    expect(component.acceptanceDelegates).toHaveLength(1);
    component.acceptanceDelegateId='store';component.acceptanceDelegateReason=' El jefe de área está ausente. ';
    await component.saveAcceptanceDelegate();
    expect(maintenance.setAcceptanceDelegate).toHaveBeenCalledWith('report','store','El jefe de área está ausente.');
    expect(component.acceptanceDelegateReport).toBeNull();expect(component.acceptanceDelegateSaving).toBe(false);
  });
  it('validates the reason and keeps errors inside the modal with retry enabled',async()=>{
    vi.useFakeTimers();
    const {component,report,maintenance}=setup('ingeniero_biomedico');
    await component.openAcceptanceDelegate(report);
    component.acceptanceDelegateReason='corto';await component.saveAcceptanceDelegate();
    expect(maintenance.setAcceptanceDelegate).not.toHaveBeenCalled();
    maintenance.setAcceptanceDelegate.mockRejectedValue({status:409,error:{message:'El protocolo ya fue firmado.'}});
    component.acceptanceDelegateReason='Motivo de sustitución.';await component.saveAcceptanceDelegate();
    expect(component.acceptanceDelegateError).toBe('El protocolo ya fue firmado.');
    expect(component.acceptanceDelegateSaving).toBe(false);expect(component.acceptanceDelegateReport).toBe(report);
  });
  it('allows restoring the usual recipient before acceptance',async()=>{
    vi.useFakeTimers();
    const {component,report,maintenance}=setup('ingeniero_biomedico');
    await component.openAcceptanceDelegate(report);
    component.acceptanceDelegateReason='Ya está disponible el responsable del área.';
    await component.saveAcceptanceDelegate(true);
    expect(maintenance.setAcceptanceDelegate).toHaveBeenCalledWith('report',null,component.acceptanceDelegateReason);
  });
});
