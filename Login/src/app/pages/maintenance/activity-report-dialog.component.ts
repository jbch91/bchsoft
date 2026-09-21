import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { ActivityReportService, ActivityReport, ActivityReportFilters, ActivityReportLocation, ActivityReportIdentity, ActivityReportPresentation, activityReportLabel } from '../../maintenance/activity-report.service';
import { activityReportExcel } from '../../maintenance/activity-report-excel';

export function activityMonthRange(value:string):{from:string;to:string}|null {
  if(!/^\d{4}-\d{2}$/.test(value))return null;
  const [year,month]=value.split('-').map(Number);
  if(year<1900||month<1||month>12)return null;
  return {from:`${value}-01`,to:`${value}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`};
}

@Component({selector:'app-activity-report-dialog',standalone:true,imports:[CommonModule,FormsModule],
  templateUrl:'./activity-report-dialog.component.html',styleUrl:'./activity-report-dialog.component.scss'})
export class ActivityReportDialogComponent implements OnChanges,OnDestroy {
  @Input() clientId='';
  @Input() category:'biomedical'|'industrial'='biomedical';
  @ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
  @ViewChild('trigger') trigger?:ElementRef<HTMLButtonElement>;
  opened=false; busy=false; downloading=false; error=''; success='';
  period:'month'|'range'='month'; format:'pdf'|'xlsx'|'docx'='pdf';
  month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
  filters:ActivityReportFilters={...activityMonthRange(this.month)!,kind:'general',dateBasis:'attention',category:'biomedical',
    type:'all',signature:'all',status:'all',spareStatus:'all',backlog:true,siteId:'',areaId:'',locationId:'',search:''};
  locations:ActivityReportLocation[]=[];
  identity:ActivityReportIdentity|null=null;
  logoName='';
  presentation:ActivityReportPresentation={mode:'internal',providerName:'',providerNit:'',providerContact:'',providerLogo:'',contract:'',recipient:'',observations:''};
  preview:ActivityReport|null=null;
  private version=0;
  label=activityReportLabel;
  trackOption=(_index:number,option:{id:string})=>option.id;
  trackGroup=(_index:number,group:{title:string})=>group.title;
  constructor(public auth:AuthService,private reports:ActivityReportService,private cdr:ChangeDetectorRef){}
  get allowed(){const user=this.auth.currentUser();return !!this.clientId && user?.clientId===this.clientId
    && !user.roles?.includes('lector') && !!user.permissions?.some(p=>['maintenance:report:create','maintenance:report:sign','read:all'].includes(p));}
  get reportDescription(){return this.filters.kind==='spares'?'Instalaciones del periodo y casos pendientes al cierre, con el equipo y el repuesto descrito.'
    :this.filters.kind==='activities'?'Detalle técnico de preventivos, correctivos y constancias. Los PDF históricos se presentan por separado.'
    :'Resumen de intervenciones, equipos, firmas, resultados y seguimiento de repuestos.';}
  private options(id:'site_id'|'area_id'|'location_id',name:'site_name'|'area_name'|'location_name',rows:ActivityReportLocation[]){
    return [...new Map(rows.filter(r=>r[id]).map(r=>[r[id]!,{id:r[id]!,name:r[name]||'Sin nombre'}])).values()]
      .sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  get sites(){return this.options('site_id','site_name',this.locations);}
  get areas(){return this.options('area_id','area_name',this.locations.filter(r=>!this.filters.siteId||r.site_id===this.filters.siteId));}
  get places(){return this.options('location_id','location_name',this.locations.filter(r=>(!this.filters.siteId||r.site_id===this.filters.siteId)&&(!this.filters.areaId||r.area_id===this.filters.areaId)));}
  get recordCount(){return this.preview?Object.values(this.preview.counts).reduce((a,b)=>a+b,0):0;}
  ngOnChanges(){if(this.opened)this.close();this.filters.category=this.category;this.identity=null;this.presentation={mode:'internal',providerName:'',providerNit:'',providerContact:'',providerLogo:'',contract:'',recipient:'',observations:''};this.logoName='';}
  ngOnDestroy(){this.version++;this.dialog?.nativeElement.close?.();}
  async open(){
    if(!this.allowed)return;
    this.opened=true;this.error='';this.success='';this.preview=null;this.filters.category=this.category;
    this.dialog.nativeElement.showModal();this.busy=true;const version=++this.version;
    try{const [rows,identity]=await Promise.all([this.reports.options(this.clientId,this.category),this.reports.identity(this.clientId,this.category)]);if(version!==this.version)return;this.locations=rows;this.identity=identity;}
    catch(error){if(version===this.version)this.error=await this.errorText(error);}
    finally{if(version===this.version){this.busy=false;this.cdr.detectChanges();}}
  }
  close(){this.version++;this.opened=false;this.busy=false;this.downloading=false;this.dialog.nativeElement.close();this.trigger?.nativeElement.focus();}
  invalidate(){this.preview=null;this.error='';this.success='';}
  changeSite(){this.filters.areaId='';this.filters.locationId='';this.invalidate();}
  changeArea(){this.filters.locationId='';this.invalidate();}
  setPeriod(){if(this.period==='month')this.setMonth();else this.invalidate();}
  setMonth(){const range=activityMonthRange(this.month);if(range)Object.assign(this.filters,range);this.invalidate();}
  presentationChanged(){this.error='';this.success='';}
  removeLogo(){this.presentation.providerLogo='';this.logoName='';this.presentationChanged();}
  async selectLogo(event:Event){
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
    this.error='';this.success='';
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>1024*1024){this.error='Selecciona un logo PNG o JPG de hasta 1 MB.';return;}
    const version=this.version;
    try{
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
      if(version!==this.version)return;this.presentation.providerLogo=data;this.logoName=file.name;
    }catch{if(version===this.version)this.error='No se pudo leer la imagen.';}
    finally{if(version===this.version)this.cdr.detectChanges();}
  }
  private valid(){
    const {from,to}=this.filters;
    if(!from||!to||from>to||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||(Date.parse(to)-Date.parse(from))/86400000>365){
      this.error='Selecciona un rango válido de hasta 366 días.';return false;
    }
    if(this.period==='month'&&!activityMonthRange(this.month)){this.error='Selecciona un mes válido.';return false;}
    return true;
  }
  async review(){
    if(this.busy||!this.allowed||!this.valid())return;
    this.busy=true;this.error='';this.success='';const version=++this.version;
    try{const report=await this.reports.report(this.clientId,{...this.filters},true);if(version===this.version)this.preview=report;}
    catch(error){if(version===this.version)this.error=await this.errorText(error);}
    finally{if(version===this.version){this.busy=false;this.cdr.detectChanges();}}
  }
  async download(){
    if(this.busy||!this.preview||!this.recordCount||!this.allowed||!this.valid())return;
    if(this.presentation.mode==='external'&&!this.presentation.providerName.trim()){this.error='Indica la razón social del prestador externo en Presentación del informe.';return;}
    this.busy=true;this.downloading=true;this.error='';this.success='';const version=++this.version;
    const filters={...this.filters}; const format=this.format;const presentation={...this.presentation};
    try{
      const clientName=this.preview.client.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,65);
      let blob:Blob;let filename=`informe-${filters.kind}-${clientName}-${filters.from}-${filters.to}.${format}`;
      if(format==='pdf'||format==='docx'){
        const response=await this.reports.pdf(this.clientId,filters,presentation,format);
        if(!response.body?.size)throw new Error('El informe está vacío.');
        blob=response.body;filename=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||filename;
      }else{
        const report=await this.reports.exportData(this.clientId,filters,presentation);
        blob=await activityReportExcel(report);
        const client=report.client.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,65);
        filename=`informe-${filters.kind}-${client}-${filters.from}-${filters.to}.xlsx`;
      }
      if(version!==this.version)return;
      const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);this.success='Informe generado. La descarga está lista.';
    }catch(error){if(version===this.version)this.error=await this.errorText(error);}
    finally{if(version===this.version){this.busy=false;this.downloading=false;this.cdr.detectChanges();}}
  }
  private async errorText(error:any):Promise<string>{
    if(error?.error instanceof Blob){try{return JSON.parse(await error.error.text()).message||'No se pudo generar el informe.';}catch{return 'No se pudo generar el informe.';}}
    return error?.error?.message||(error?.name==='TimeoutError'?'La consulta tardó demasiado. Reduce el rango o filtra por área.':error?.message)||'No se pudo generar el informe. Intenta nuevamente.';
  }
}
