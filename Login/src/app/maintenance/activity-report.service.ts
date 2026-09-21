import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { getApiBase } from '../core/api-base';

export interface ActivityReportFilters {
  from:string; to:string; kind:'general'|'activities'|'spares'; dateBasis:'attention'|'scheduled';
  category:'biomedical'|'industrial'; type:string; signature:string; status:string; spareStatus:string;
  backlog:boolean; siteId:string; areaId:string; locationId:string; search:string; engineerId?:string;
}
export interface ActivityReportPresentation {
  mode:'internal'|'external'; providerName:string; providerNit:string; providerContact:string;
  providerLogo:string; contract:string; recipient:string; observations:string;
}
export interface ActivityReportClient {name:string;nit:string;city:string;logoDataUrl?:string;}
export interface ActivityReportIdentity {client:ActivityReportClient;engineers:{id:string;name:string}[];}
export interface ActivityReportLocation {
  site_id:string|null; site_name:string|null; area_id:string|null; area_name:string|null;
  location_id:string|null; location_name:string|null;
}
export interface ActivityReportRow {
  id:string; assetId:string; code:string; equipment:string; brand:string|null; model:string|null; serial:string|null;
  site:string|null; area:string|null; location:string|null; date:string; plannedDate?:string; registeredAt?:string;
  type:string; kind?:string; signature?:string; status?:string; engineer?:string; summary?:string;
  findings?:string; actions?:string; observations?:string; reason?:string; spare?:string; spareResult?:string;
  carriedOver?:boolean; title?:string; description?:string;
}
export interface ActivityReport {
  title:string; generatedAt:string; generatedBy:string; client:ActivityReportClient; presentation?:ActivityReportPresentation;
  filters:ActivityReportFilters; scopeLabels:string[]; notes:string[];
  summary:{interventions:number;equipment:number;preventive:number;corrective:number;signed:number;pendingSignature:number;
    corrections:number;outOfService:number;observations:number;notLocated:number;historical:number;installed:number;pendingSpares:number;carriedOver:number};
  counts:{activities:number;spares:number;historical:number};
  activities:ActivityReportRow[]; spares:ActivityReportRow[]; historical:ActivityReportRow[];
}
export const activityReportLabel=(value:string|undefined):string => ({
  general:'Informe general', activities:'Actividades', spares:'Repuestos', attention:'Fecha de atención', scheduled:'Periodo programado',
  signed:'Firmado', pending:'Pendiente', correction:'En corrección', installed:'Instalado', all:'Todos',
  operativo:'Operativo', operativo_observacion:'Operativo con observaciones', fuera_de_servicio:'Fuera de servicio',
  no_verificado:'No verificado', preventivo:'Preventivo', correctivo:'Correctivo', not_located:'No localizado',
  historical:'PDF histórico', unknown:'No tabulado'
} as Record<string,string>)[value||''] || value || 'NR';

@Injectable({providedIn:'root'})
export class ActivityReportService {
  constructor(private http:HttpClient){}
  options(clientId:string, category:string){
    return firstValueFrom(this.http.get<ActivityReportLocation[]>(`${getApiBase()}/maintenance/activity-reports/${clientId}/options`,{params:{category}}).pipe(timeout(30000)));
  }
  identity(clientId:string,category:string){
    return firstValueFrom(this.http.get<ActivityReportIdentity>(`${getApiBase()}/maintenance/activity-reports/${clientId}/identity`,{params:{category}}).pipe(timeout(30000)));
  }
  query(filters:ActivityReportFilters){
    return Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,String(value)]));
  }
  report(clientId:string, filters:ActivityReportFilters, preview=false){
    return firstValueFrom(this.http.get<ActivityReport>(`${getApiBase()}/maintenance/activity-reports/${clientId}`,{params:{...this.query(filters),preview:String(preview)}}).pipe(timeout(60000)));
  }
  exportData(clientId:string,filters:ActivityReportFilters,presentation:ActivityReportPresentation){
    return firstValueFrom(this.http.post<ActivityReport>(`${getApiBase()}/maintenance/activity-reports/${clientId}/export`,{filters,presentation,format:'json'}).pipe(timeout(60000)));
  }
  pdf(clientId:string,filters:ActivityReportFilters,presentation?:ActivityReportPresentation,format:'pdf'|'docx'='pdf'){
    return firstValueFrom(this.http.post(`${getApiBase()}/maintenance/activity-reports/${clientId}/export`,{
      filters,presentation,format
    },{responseType:'blob',observe:'response'}).pipe(timeout(60000)));
  }
}
