import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { normalizeActivityReportFilters, buildActivityReport, activityReportAccessError, activityReportOptions } from './maintenance-activity-reports.js';
import { createMaintenanceActivityReportPdf } from './maintenance-activity-report-pdf.js';
import { createActivityReportRouter } from './maintenance-activity-report-routes.js';
import express from 'express';

const filters=(extra={})=>normalizeActivityReportFilters({from:'2026-08-01',to:'2026-08-31',...extra});
const row=(extra={})=>({id:randomUUID(),request_id:randomUUID(),asset_id:'equipment-1',asset_code:'EQ-001',asset_name:'MONITOR',brand:'QA',model:'MODELO',serial:'SERIE',
  type:'preventivo',closure_kind:'maintenance',attention_date:'2026-08-10',planned_date:'2026-08-01',created_at:'2026-08-10T16:00:00Z',
  signatures:[{role:'ingeniero_biomedico'},{role:'responsable_area'}],area_responsible_required:true,asset_status_after:'operativo',
  requires_spare_parts:false,spare_parts_status:'no_aplica',site_name:'SEDE',area_name:'URGENCIAS',...extra});

test('filters reject invalid dates, injection, arrays, reversed and unbounded ranges',()=>{
  assert.equal(filters({from:'2024-02-29',to:'2024-03-01'}).from,'2024-02-29');
  for(const extra of [{from:'2026-02-30'},{from:['2026-08-01']},{to:'2026-07-01'},{to:'2027-09-30'},{category:'all'},{areaId:"x' OR 1=1"},{kind:['general']},{backlog:'maybe'},{search:['name']}])assert.throws(()=>filters(extra),{status:400});
});
test('counts interventions separately from distinct equipment, signatures, historical PDFs and non-execution',()=>{
  const data=buildActivityReport([row(),row({type:'correctivo',signatures:[]}),row({closure_kind:'not_located',asset_status_after:'no_verificado'}),row({correction_requested:true})],[],filters());
  assert.equal(data.summary.interventions,3);assert.equal(data.summary.equipment,1);assert.equal(data.summary.notLocated,1);
  assert.equal(data.summary.signed,1);assert.equal(data.summary.pendingSignature,1);assert.equal(data.summary.corrections,1);
});
test('late August preventives belong to September by attention and August by schedule without moving correctives',()=>{
  const rows=[row({attention_date:'2026-09-10'}),row({type:'correctivo',attention_date:'2026-09-10'})];
  assert.equal(buildActivityReport(rows,[],filters()).activities.length,0);
  assert.equal(buildActivityReport(rows,[],filters({dateBasis:'scheduled'})).activities.length,1);
});
test('spares resolve by request as of cutoff, including unsigned installations and prior backlog',()=>{
  const request=randomUUID();
  const pending=row({request_id:request,attention_date:'2026-07-01',requires_spare_parts:true,spare_parts_status:'solicitado'});
  const installed=row({request_id:request,type:'correctivo',attention_date:'2026-09-03',requires_spare_parts:true,spare_parts_status:'recibido',signatures:[]});
  const august=buildActivityReport([pending,installed],[],filters());
  assert.equal(august.summary.pendingSpares,1);assert.equal(august.summary.carriedOver,1);assert.equal(august.summary.installed,0);
  const september=buildActivityReport([pending,installed],[],filters({from:'2026-09-01',to:'2026-09-30'}));
  assert.equal(september.summary.pendingSpares,0);assert.equal(september.summary.installed,1);
  assert.equal(buildActivityReport([pending],[],filters({backlog:'false'})).summary.pendingSpares,0);
});
test('later corrective resolves the case even when the preventive or author filter excludes it',()=>{
  const request=randomUUID();
  const rows=[row({request_id:request,requires_spare_parts:true,spare_parts_status:'solicitado'}),
    row({request_id:request,type:'correctivo',attention_date:'2026-08-20',created_at:'2026-08-20T12:00:00Z',requires_spare_parts:true,spare_parts_status:'recibido'})];
  const result=buildActivityReport(rows,[],filters({type:'preventivo'}));
  assert.equal(result.summary.pendingSpares,0);assert.equal(result.summary.installed,0);
});
test('multiple pending reports in one request are one case, separate requests are not erased',()=>{
  const request=randomUUID();const spare={requires_spare_parts:true,spare_parts_status:'solicitado'};
  assert.equal(buildActivityReport([row({...spare,request_id:request}),row({...spare,request_id:request}),row(spare)],[],filters()).summary.pendingSpares,2);
});
test('spare-only report does not expose unrelated activities and has exact installed/pending totals',()=>{
  const result=buildActivityReport([row(),row({requires_spare_parts:true,spare_parts_status:'recibido'})],[],filters({kind:'spares',spareStatus:'installed'}));
  assert.equal(result.activities.length,0);assert.equal(result.summary.installed,1);assert.equal(result.summary.pendingSpares,0);
});
test('historic PDF is separate and never fabricates spare quantities, signatures or equipment condition',()=>{
  const historic={id:'h',asset_id:'a',asset_code:'H-1',asset_name:'MONITOR',attention_date:'2026-08-01',document_type:'maintenance_preventive',title:'PROTOCOLO'};
  const result=buildActivityReport([], [historic],filters());assert.equal(result.summary.historical,1);assert.equal(result.summary.interventions,0);assert.equal(result.summary.installed,0);
  assert.equal(buildActivityReport([],[historic],filters({signature:'signed'})).historical.length,0);
});
test('matching supports accents and result/signature filters without counting non-matching rows',()=>{
  assert.equal(buildActivityReport([row({asset_name:'BÁSCULA',asset_status_after:'fuera_de_servicio'})],[],filters({search:'bascula',status:'fuera_de_servicio',signature:'signed'})).activities.length,1);
});
test('tenant, permission and scoped options fail closed',async()=>{
  const client=randomUUID(),user={sub:randomUUID(),clientId:client,roles:['responsable_area'],permissions:['maintenance:report:sign']};
  assert.equal(activityReportAccessError(user,client),'');
  for(const invalid of [{...user,clientId:randomUUID()},{...user,permissions:[]},{...user,roles:['lector']},{...user,roles:['superuser']},{...user,clientId:null}])assert.ok(activityReportAccessError(invalid,client));
  const calls=[];
  await activityReportOptions(user,client,'biomedical',async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{schema_name:'tenant_qa'}]:[]};});
  assert.match(calls[1].sql,/EXISTS \(SELECT 1 FROM reader_access/);assert.match(calls[1].sql,/access.location_id IS NULL/);assert.ok(calls[1].args.includes(user.sub));
});
test('PDF is paginated and tolerates long equipment names, narrative and client name',async()=>{
  const result=buildActivityReport(Array.from({length:4},()=>row({asset_name:'EQUIPO DE ÓRGANOS DE PARED '.repeat(4),summary:'ACTIVIDAD TÉCNICA '.repeat(140),findings:'HALLAZGO '.repeat(80),actions_taken:'ACCIÓN '.repeat(90)})),[],filters({kind:'activities'}));
  const buffer=await createMaintenanceActivityReportPdf({...result,title:'INFORME DE ACTIVIDADES',client:{name:'HOSPITAL DE PRUEBA',nit:'QA',city:'QA'},filters:filters({kind:'activities'}),generatedBy:'INGENIERO QA',generatedAt:'2026-09-21T12:00:00Z',scopeLabels:[],notes:['DATOS DE PRUEBA']});
  const pdf=await PDFDocument.load(buffer);assert.ok(pdf.getPageCount()>1);assert.ok(pdf.getPageCount()<20);
});
test('HTTP router denies cross-client/disabled-module and preserves filters for PDF and preview', {skip:process.env.RUN_REPORT_HTTP_TESTS!=='1'},async()=>{
  const clientId=randomUUID();let enabled=true,seen=[];
  const app=express();app.use(express.json({limit:'2mb'}));app.use((req,res,next)=>{req.user={sub:randomUUID(),clientId,roles:['ingeniero_biomedico'],permissions:['maintenance:report:create']};next();});
  app.use('/reports',createActivityReportRouter({modules:async()=>[{key:'reportes_mantenimiento',enabled}],
    load:async(user,id,f)=>{seen.push(f);return {client:{name:'QA'},filters:f,activities:Array(20).fill({}),spares:[],historical:[]};},pdf:async()=>Buffer.from('%PDF-1.4 QA'),word:async()=>Buffer.from('PK QA')}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/reports`;const suffix='?from=2026-08-01&to=2026-08-31';
  try{
    assert.equal((await fetch(`${base}/${randomUUID()}${suffix}`)).status,403);
    enabled=false;assert.equal((await fetch(`${base}/${clientId}${suffix}`)).status,403);enabled=true;
    const preview=await (await fetch(`${base}/${clientId}${suffix}&preview=true`)).json();assert.equal(preview.activities.length,12);assert.equal(preview.counts.activities,20);
    const pdf=await fetch(`${base}/${clientId}${suffix}&format=pdf`);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(seen.length,2);
    assert.deepEqual(seen[0],seen[1]);assert.equal((await fetch(`${base}/${clientId}${suffix}&format=exe`)).status,400);
    const body={filters:{from:'2026-08-01',to:'2026-08-31',backlog:true},presentation:{mode:'external',providerName:'EMPRESA QA'},format:'docx'};
    const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const word=await fetch(`${base}/${clientId}/export`,options);assert.equal(word.status,200);assert.match(word.headers.get('content-type'),/wordprocessingml/);assert.match(word.headers.get('content-disposition'),/\.docx/);
    assert.equal((await fetch(`${base}/${randomUUID()}/export`,options)).status,403);
    enabled=false;assert.equal((await fetch(`${base}/${clientId}/export`,options)).status,403);enabled=true;
    assert.equal((await fetch(`${base}/${clientId}/export`,{...options,body:JSON.stringify({...body,presentation:{mode:'external'}})})).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
