import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import bcrypt from 'bcrypt';
import { query,pool } from './db.js';
import { createClient } from './clients.js';
import { authenticateUser } from './auth.js';
import { loadActivityReport,activityReportOptions,activityReportIdentity,normalizeActivityReportFilters } from './maintenance-activity-reports.js';
import { createMaintenanceActivityReportPdf } from './maintenance-activity-report-pdf.js';
import { createActivityReportRouter } from './maintenance-activity-report-routes.js';
import { requireAuth } from './middleware.js';
import express from 'express';

test('integration: report data, tenant isolation, area/location scope and actual PDF export', {skip:process.env.RUN_ACTIVITY_REPORT_INTEGRATION!=='1'},async()=>{
  assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST),'Local database only');
  const tenants=[];let server,passed=false;const users=[];
  try{
    for(let index=0;index<2;index++){
      const tag=`qa_activity_${Date.now()}_${index}`;
      const tenant=await createClient({name:tag,nit:tag,email:`${tag}@example.invalid`,city:'QA'});tenants.push(tenant);
      await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status) VALUES ($1,'biomedico',true,'active')
        ON CONFLICT(client_id,suite_key) DO UPDATE SET enabled=true`,[tenant.id]);
      await query(`INSERT INTO client_modules(client_id,module_key,enabled) SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`,[tenant.id]);
      for(const role of index===0?['ingeniero_biomedico','responsable_area']:['ingeniero_biomedico']){
        const username=`${tag}_${role}`,password=randomUUID();
        const id=(await query(`INSERT INTO users(username,password_hash,client_id,display_name,email) VALUES ($1,$2,$3,$4,$1||'@example.invalid') RETURNING id`,
          [username,await bcrypt.hash(password,4),tenant.id,role==='responsable_area'?'RESPONSABLE QA':'INGENIERO QA'])).rows[0].id;
        await query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);
        users.push({id,username,password,role,clientId:tenant.id});
      }
    }
    const tenant=tenants[0],schema=tenant.schema_name,engineer=users[0],chief=users[1];
    const site=(await query(`SELECT id FROM "${schema}".sites LIMIT 1`)).rows[0].id;
    const area=(await query(`INSERT INTO "${schema}".areas(name,site_id) VALUES ('URGENCIAS QA',$1) RETURNING id`,[site])).rows[0].id;
    const otherArea=(await query(`INSERT INTO "${schema}".areas(name,site_id) VALUES ('CONSULTA EXTERNA QA',$1) RETURNING id`,[site])).rows[0].id;
    const location=(await query(`INSERT INTO "${schema}".locations(name,area_id) VALUES ('OBSERVACION QA',$1) RETURNING id`,[area])).rows[0].id;
    const otherLocation=(await query(`INSERT INTO "${schema}".locations(name,area_id) VALUES ('SALA RESTRINGIDA QA',$1) RETURNING id`,[area])).rows[0].id;
    await query('INSERT INTO reader_access(user_id,client_id,area_id,location_id) VALUES ($1,$2,$3,$4)',[chief.id,tenant.id,area,location]);
    const assets=[];
    for(let n=0;n<4;n++)assets.push((await query(`INSERT INTO "${schema}".assets(code,name,brand,model,serial,site_id,area_id,location_id,asset_category)
      VALUES ($1,$2,'MARCA QA','MODELO QA',$1,$3,$4,$5,$6) RETURNING id`,
      [`QA-00${n}`,n===0?'EQUIPO DE ÓRGANOS DE PARED CON UN NOMBRE EXTENSO':'MONITOR QA',site,n===2?otherArea:area,n===2?null:n===1?otherLocation:location,n===3?'industrial':'biomedical'])).rows[0].id);
    async function report(asset,extra={}){
      const request=extra.request||(await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,status,source,requested_by,planned_date)
        VALUES ($1,$2,'preventivo','reportado','manual',$3,'2026-08-03') RETURNING id`,[tenant.id,asset,engineer.id])).rows[0].id;
      const id=(await query(`INSERT INTO maintenance_reports(client_id,request_id,asset_id,type,summary,findings,actions_taken,created_by,created_at,performed_on,
        requires_spare_parts,spare_parts_status,spare_parts_needed,asset_status_after,area_responsible_required)
        VALUES ($1,$2,$3,$4,$5,'Inspección, pruebas funcionales y verificación de condiciones.','Limpieza general, ajustes y verificación final.',$6,$7,$8,$9,$10,$11,$12,true) RETURNING id`,
        [tenant.id,request,asset,extra.type||'preventivo',extra.summary||'Mantenimiento efectuado. Equipo entregado en condiciones funcionales.',engineer.id,
          `${extra.date||'2026-08-03'}T14:00:00Z`,extra.date||'2026-08-03',!!extra.spare,extra.spareState||'no_aplica',extra.spare||null,extra.status||'operativo'])).rows[0].id;
      await query(`INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name)
        VALUES ($1,$2,'ingeniero_biomedico','/qa-only.png','INGENIERO QA')`,[id,engineer.id]);
      if(extra.signed)await query(`INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name)
        VALUES ($1,$2,'responsable_area','/qa-only.png','RESPONSABLE QA')`,[id,chief.id]);
      return request;
    }
    const repaired=await report(assets[0],{date:'2026-07-03',spare:'BATERÍA',spareState:'solicitado'});
    await report(assets[0],{request:repaired,date:'2026-08-05',type:'correctivo',spare:'BATERÍA 12 V',spareState:'recibido',signed:true});
    await report(assets[0],{spare:'CABLE DE ALIMENTACIÓN',spareState:'solicitado',status:'fuera_de_servicio'});
    await report(assets[1],{signed:true});await report(assets[2]);await report(assets[3]);
    await query(`INSERT INTO "${schema}".asset_history_files(asset_id,title,document_date,file_path,document_type)
      VALUES ($1,'PROTOCOLO HISTÓRICO AGOSTO','2026-08-02','/qa-only.pdf','maintenance_preventive')`,[assets[0]]);
    const engineerSession=await authenticateUser(engineer.username,engineer.password);
    const chiefSession=await authenticateUser(chief.username,chief.password);
    const actor=engineerSession.user,chiefActor=chiefSession.user;
    const filters=normalizeActivityReportFilters({from:'2026-08-01',to:'2026-08-31'});
    const result=await loadActivityReport(actor,tenant.id,filters);
    assert.equal(result.summary.interventions,4);assert.equal(result.summary.equipment,3);assert.equal(result.summary.installed,1);assert.equal(result.summary.pendingSpares,1);assert.equal(result.summary.historical,1);
    const chiefResult=await loadActivityReport(chiefActor,tenant.id,filters);
    assert.equal(chiefResult.summary.interventions,2);assert.equal(chiefResult.summary.equipment,1);
    assert.ok(chiefResult.activities.every(row=>row.assetId===assets[0]));
    const opts=await activityReportOptions(chiefActor,tenant.id,'biomedical');assert.equal(opts.length,1);assert.equal(opts[0].location_id,location);
    const identity=await activityReportIdentity(chiefActor,tenant.id,'biomedical');assert.equal(identity.client.id,tenant.id);assert.deepEqual(identity.engineers.map(r=>r.id),[engineer.id]);assert.equal(identity.client.schema_name,undefined);
    assert.equal((await loadActivityReport(chiefActor,tenant.id,{...filters,locationId:otherLocation})).activities.length,0);
    await assert.rejects(loadActivityReport(actor,tenants[1].id,filters),{status:403});
    assert.equal((await loadActivityReport(actor,tenant.id,{...filters,category:'industrial'})).summary.interventions,1);
    await fs.writeFile('/private/tmp/inbi-activity-report-qa.pdf',await createMaintenanceActivityReportPdf(result));
    const long=structuredClone(result);long.filters.kind='activities';long.activities=Array.from({length:4},(_,n)=>({...result.activities[0],id:`QA-LONG-${n}`,summary:'DESCRIPCIÓN TÉCNICA LARGA '.repeat(100),findings:'HALLAZGOS VERIFICADOS '.repeat(70),actions:'ACCIONES REALIZADAS '.repeat(70)}));
    await fs.writeFile('/private/tmp/inbi-activity-report-long-qa.pdf',await createMaintenanceActivityReportPdf(long));
    const app=express();app.use(express.json({limit:'2mb'}));app.use('/reports',requireAuth,createActivityReportRouter());
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/reports/${tenant.id}?from=2026-08-01&to=2026-08-31`;
    assert.equal((await fetch(base)).status,401);
    const response=await fetch(`${base}&format=pdf`,{headers:{Authorization:`Bearer ${chiefSession.accessToken}`}});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.ok((await response.arrayBuffer()).byteLength>1000);
    const wordResponse=await fetch(`${base.split('?')[0]}/export`,{method:'POST',headers:{Authorization:`Bearer ${chiefSession.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({format:'docx',filters:{from:'2026-08-01',to:'2026-08-31'},presentation:{mode:'external',providerName:'PRESTADOR QA'}})});
    assert.equal(wordResponse.status,200);assert.match(wordResponse.headers.get('content-type'),/wordprocessingml/);assert.ok((await wordResponse.arrayBuffer()).byteLength>1000);
    await query("UPDATE client_modules SET enabled=false WHERE client_id=$1 AND module_key='reportes_mantenimiento'",[tenant.id]);
    assert.equal((await fetch(base,{headers:{Authorization:`Bearer ${engineerSession.accessToken}`}})).status,403);
    await query("UPDATE client_modules SET enabled=true WHERE client_id=$1 AND module_key='reportes_mantenimiento'",[tenant.id]);
    if(process.env.KEEP_ACTIVITY_QA==='1')await fs.writeFile('/private/tmp/inbi-activity-qa.json',JSON.stringify({tenants,users,site,area,location,otherLocation}),{mode:0o600});
    passed=true;
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(!passed||process.env.KEEP_ACTIVITY_QA!=='1')for(const tenant of tenants){
      await query('DELETE FROM users WHERE client_id=$1',[tenant.id]);await query('DELETE FROM clients WHERE id=$1',[tenant.id]);
      assert.ok(tenant.schema_name.startsWith('cliente_qa_activity_'));await query(`DROP SCHEMA "${tenant.schema_name}" CASCADE`);
    }
    await pool.end();
  }
});
