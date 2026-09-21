import { describe,it,expect,vi } from 'vitest';
import { ActivityReportDialogComponent,activityMonthRange } from './activity-report-dialog.component';
import { activityReportExcel } from '../../maintenance/activity-report-excel';
import * as XLSX from 'xlsx';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../auth/auth.service';
import { ActivityReportService } from '../../maintenance/activity-report.service';

function setup(){
  const auth:any={currentUser:()=>({clientId:'client',permissions:['maintenance:report:create'],roles:['ingeniero_biomedico']})};
  const reports:any={options:vi.fn().mockResolvedValue([]),identity:vi.fn().mockResolvedValue({client:{name:'HOSPITAL'},engineers:[]}),report:vi.fn(),pdf:vi.fn(),exportData:vi.fn()};
  const cdr:any={detectChanges:vi.fn()};const component=new ActivityReportDialogComponent(auth,reports,cdr);
  component.clientId='client';component.dialog={nativeElement:{showModal:vi.fn(),close:vi.fn()}} as any;
  return {component,reports,auth,cdr};
}
const sample:any={title:'INFORME',client:{name:'HOSPITAL QA',nit:'123'},generatedBy:'INGENIERO',generatedAt:'2026-09-21T12:00:00Z',
  filters:{from:'2026-08-01',to:'2026-08-31',kind:'spares',dateBasis:'attention',type:'all',status:'all',signature:'all',spareStatus:'all',search:''},
  scopeLabels:['ÁREA: URGENCIAS'],notes:['REPUESTOS SON CASOS, NO UNIDADES'],summary:{installed:1,pendingSpares:0,carriedOver:0},counts:{activities:0,spares:1,historical:0},activities:[],historical:[],
  spares:[{id:'r',code:'0001',equipment:'=HYPERLINK("bad")',spare:'FUSIBLE',date:'2026-08-03',spareResult:'installed',signature:'signed'}]};
describe('Activity reports',()=>{
  it('uses correct leap month and rejects invalid months',()=>{expect(activityMonthRange('2024-02')?.to).toBe('2024-02-29');expect(activityMonthRange('2026-13')).toBeNull();});
  it('limits visibility to a permitted tenant user',()=>{const {component,auth}=setup();expect(component.allowed).toBe(true);component.clientId='other';expect(component.allowed).toBe(false);component.clientId='client';auth.currentUser=()=>({clientId:'client',permissions:['read:all'],roles:['lector']});expect(component.allowed).toBe(false);});
  it('cascades site then area then location and clears obsolete selection',()=>{
    const {component:c}=setup();c.locations=[{site_id:'s1',site_name:'S1',area_id:'a1',area_name:'A1',location_id:'l1',location_name:'L1'},{site_id:'s2',site_name:'S2',area_id:'a2',area_name:'A2',location_id:'l2',location_name:'L2'}];
    c.filters.siteId='s1';c.filters.areaId='a2';c.filters.locationId='l2';c.changeSite();expect(c.areas.map(a=>a.id)).toEqual(['a1']);expect(c.filters.locationId).toBe('');c.filters.areaId='a1';expect(c.places.map(a=>a.id)).toEqual(['l1']);
  });
  it('clears old preview after any filter change',()=>{const {component:c}=setup();c.preview=sample;c.invalidate();expect(c.preview).toBeNull();});
  it('does not retain generating state on server error and decodes PDF errors',async()=>{
    const {component:c,reports,cdr}=setup();c.preview=sample;
    const errorBlob=new Blob([]);Object.defineProperty(errorBlob,'text',{value:async()=>JSON.stringify({message:'Sin permiso'})});
    reports.pdf.mockRejectedValue({error:errorBlob});await c.download();expect(c.error).toBe('Sin permiso');expect(c.busy).toBe(false);expect(c.downloading).toBe(false);expect(cdr.detectChanges).toHaveBeenCalled();
  });
  it('ignores responses after closing or changing client',async()=>{
    const {component:c,reports}=setup();let resolve:any;reports.report.mockImplementation(()=>new Promise(r=>resolve=r));const pending=c.review();c.close();resolve(sample);await pending;expect(c.preview).toBeNull();expect(c.busy).toBe(false);
  });
  it('validates dates before a request',async()=>{const {component:c,reports}=setup();c.filters.from='2026-09-01';c.filters.to='2026-08-01';await c.review();expect(reports.report).not.toHaveBeenCalled();expect(c.error).toContain('rango válido');});
  it('loads the institutional identity without changing the client',async()=>{const {component:c}=setup();await c.open();expect(c.identity?.client.name).toBe('HOSPITAL');expect(c.busy).toBe(false);});
  it('requires external provider name before exporting and keeps the preview',async()=>{const {component:c,reports}=setup();c.preview=sample;c.presentation.mode='external';await c.download();expect(reports.pdf).not.toHaveBeenCalled();expect(c.error).toContain('razón social');expect(c.preview).toBe(sample);});
  it('sends Word format with the selected provider and clears busy after failure',async()=>{
    const {component:c,reports}=setup();c.preview=sample;c.format='docx';c.presentation.mode='external';c.presentation.providerName='EMPRESA';reports.pdf.mockRejectedValue(new Error('Error de prueba'));
    await c.download();expect(reports.pdf).toHaveBeenCalledWith('client',expect.anything(),expect.objectContaining({providerName:'EMPRESA'}),'docx');expect(c.busy).toBe(false);
  });
  it('includes the hospital in the Word filename when response headers are not exposed',async()=>{
    const {component:c,reports}=setup();c.preview=sample;c.format='docx';
    reports.pdf.mockResolvedValue({body:new Blob(['word']),headers:{get:()=>null}});
    vi.useFakeTimers();vi.stubGlobal('URL',{createObjectURL:vi.fn().mockReturnValue('blob:report'),revokeObjectURL:vi.fn()});
    let filename='';const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download;});
    try{await c.download();expect(filename).toContain('-HOSPITAL-QA-');expect(filename).toMatch(/\.docx$/);expect(c.success).toContain('descarga');}
    finally{vi.runOnlyPendingTimers();vi.useRealTimers();click.mockRestore();vi.unstubAllGlobals();}
  });
  it('clears company and logo when the client context changes',()=>{const {component:c}=setup();c.presentation.providerName='EMPRESA';c.presentation.providerLogo='data:logo';c.ngOnChanges();expect(c.presentation.providerName).toBe('');expect(c.presentation.providerLogo).toBe('');});
  it('keeps filter option nodes stable across change detection',async()=>{
    const {auth,reports}=setup();
    await TestBed.configureTestingModule({imports:[ActivityReportDialogComponent],providers:[
      {provide:AuthService,useValue:auth},{provide:ActivityReportService,useValue:reports}
    ]}).compileComponents();
    const fixture=TestBed.createComponent(ActivityReportDialogComponent);
    fixture.componentInstance.clientId='client';
    fixture.componentInstance.locations=[{site_id:'s1',site_name:'SEDE',area_id:'a1',area_name:'AREA',location_id:'l1',location_name:'UBICACION'}];
    fixture.detectChanges();await fixture.whenStable();
    const option=fixture.nativeElement.querySelector('select[name="site"] option[value="s1"]');
    expect(option).not.toBeNull();
    fixture.detectChanges();await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select[name="site"] option[value="s1"]')).toBe(option);
    fixture.destroy();TestBed.resetTestingModule();
  });
  it('Excel preserves code, text and criteria without spreadsheet formula injection',async()=>{
    const blob=await activityReportExcel(sample);
    const content=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob);});
    const book=XLSX.read(content,{type:'array'});
    expect(book.SheetNames).toEqual(['Resumen y criterios','Repuestos']);
    const sheet=book.Sheets['Repuestos'];const cells=Object.values(sheet).filter((v:any)=>v?.v==='=HYPERLINK("bad")') as any[];
    expect(cells[0].t).toBe('s');expect(cells[0].f).toBeUndefined();expect(XLSX.utils.sheet_to_csv(sheet)).toContain('0001');
  },15000);
});
