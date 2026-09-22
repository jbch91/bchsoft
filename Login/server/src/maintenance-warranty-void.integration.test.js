import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import bcrypt from 'bcrypt';
import { query, pool, withTransaction } from './db.js';
import { createClient } from './clients.js';
import { authenticateUser } from './auth.js';
import { voidPreventiveForWarranty } from './maintenance-warranty-void.js';
import { getPreventiveMaintenanceProgress, listMaintenanceReports, createMaintenanceReport,
  updateMaintenanceReport, signMaintenanceReport, reopenMaintenanceReportForEngineer, deleteMaintenanceRequest } from './maintenance.js';
import { listAssetHistory } from './biomed.js';

test('warranty annulment: ownership, evidence preservation, accounting and HTTP workflow', {
  skip: process.env.RUN_WARRANTY_VOID_INTEGRATION !== '1'
}, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Local DB only');
  const tag = `qa_void_${Date.now()}`;
  const tenant = await createClient({name:tag,nit:tag,city:'QA',email:`${tag}@example.invalid`});
  const clientId = tenant.id, schema = tenant.schema_name;
  const uploadDir = `uploads/clients/${clientId}`;
  let api;
  try {
    await fs.mkdir(uploadDir, {recursive:true});
    const user = (await query(`INSERT INTO users(username,password_hash,client_id,display_name,email)
      VALUES ($1,'unusable',$2,'INGENIERO QA',$1||'@example.invalid') RETURNING id`, [tag,clientId])).rows[0].id;
    await query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='ingeniero_biomedico'", [user]);
    const actor = {sub:user,username:tag,clientId,roles:['ingeniero_biomedico'],permissions:['maintenance:report:create']};
    const area = (await query(`INSERT INTO "${schema}".areas(name) VALUES ('CONSULTA EXTERNA QA') RETURNING id`)).rows[0].id;
    const schedule = (await query(`INSERT INTO maintenance_schedules(client_id,year,start_date,status,created_by)
      VALUES ($1,2026,'2026-01-01','approved',$2) RETURNING id`, [clientId,user])).rows[0].id;
    async function fixture({warranty=1,acquisition='2026-02-26',status='correccion',spare=false,type='preventivo',signature=true}={}) {
      const asset = (await query(`INSERT INTO "${schema}".assets(code,name,brand,model,serial,area_id,status,warranty_years,acquisition_date)
        VALUES ($1,'ANALIZADOR DE LABORATORIO QA','MARCA QA','MODELO QA','SERIE QA',$2,'operativo',$3,$4) RETURNING id`,
        [randomUUID(),area,warranty,acquisition])).rows[0].id;
      const item = (await query(`INSERT INTO maintenance_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date,status,programming_confirmed)
        VALUES ($1,$2,'trimestral','2026-08-19','2026-08-31','done',true) RETURNING id`, [schedule,asset])).rows[0].id;
      const request = (await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,status,source,requested_by,schedule_id,schedule_item_id,planned_date,deadline_date)
        VALUES ($1,$2,$3,$4,'cronograma',$5,$6,$7,'2026-08-19','2026-08-31') RETURNING id`, [clientId,asset,type,status,user,schedule,item])).rows[0].id;
      const report = (await query(`INSERT INTO maintenance_reports(client_id,request_id,asset_id,type,created_by,requires_spare_parts,
        spare_parts_status,summary,findings,actions_taken,area_responsible_required)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'CONTENIDO ORIGINAL','HALLAZGO ORIGINAL','ACCIONES ORIGINALES',true) RETURNING id`,
        [clientId,request,asset,type,user,spare,spare?'solicitado':'no_aplica'])).rows[0].id;
      await query(`UPDATE maintenance_schedule_items SET report_id=$2,completion_source='software_report',completed_at=NOW() WHERE id=$1`, [item,report]);
      await query(`INSERT INTO maintenance_report_corrections(report_id,requested_by,reason) VALUES ($1,$2,'MOTIVO ORIGINAL CONSERVADO')`, [report,user]);
      if(signature) await query(`INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name,signature_sha256)
        VALUES ($1,$2,'ingeniero_biomedico','/qa-original-signature.png','INGENIERO QA','original-hash')`, [report,user]);
      return {asset,item,request,report};
    }
    const reason = 'Protocolo registrado por error. No hubo mantenimiento y la actividad está cubierta por garantía.';
    const annul = (f, extra={}, deps) => voidPreventiveForWarranty({clientId,reportId:f.report,actor,reason,confirmedNoExecution:true,...extra}, deps);
    await t.test('preserves original report, signature and asset; moves only the linked activity to warranty', async () => {
      const f = await fixture();
      const original = (await query('SELECT * FROM maintenance_reports WHERE id=$1', [f.report])).rows[0];
      const signatures = (await query('SELECT * FROM report_signatures WHERE report_id=$1', [f.report])).rows;
      const asset = (await query(`SELECT * FROM "${schema}".assets WHERE id=$1`, [f.asset])).rows[0];
      assert.deepEqual(await annul(f), {id:f.report,replayed:false});
      const result = (await query('SELECT * FROM maintenance_reports WHERE id=$1', [f.report])).rows[0];
      assert.ok(result.voided_at); assert.equal(result.void_reason,reason);
      const {voided_at,void_reason,void_details,...unchanged} = result;
      assert.deepEqual(unchanged, Object.fromEntries(Object.entries(original).filter(([key]) => !['voided_at','void_reason','void_details'].includes(key))));
      assert.deepEqual((await query('SELECT * FROM report_signatures WHERE report_id=$1', [f.report])).rows, signatures);
      assert.deepEqual((await query(`SELECT * FROM "${schema}".assets WHERE id=$1`, [f.asset])).rows[0],asset);
      assert.equal((await query('SELECT status FROM maintenance_requests WHERE id=$1',[f.request])).rows[0].status,'garantia');
      const item=(await query('SELECT * FROM maintenance_schedule_items WHERE id=$1',[f.item])).rows[0];
      assert.equal(item.status,'warranty'); assert.equal(item.warranty_resolution,'covered');
      assert.equal(item.report_id,null); assert.equal(item.completed_at,null);
      const progress=await getPreventiveMaintenanceProgress(clientId,{year:2026,month:8,assetId:f.asset});
      assert.equal(progress.items[0].phase,'warranty'); assert.equal(progress.monthly.completed,0);
      assert.equal(progress.items[0].voided_report_id,f.report); assert.equal(progress.items[0].can_perform_protocol,false);
      assert.equal((await listMaintenanceReports(clientId,{assetId:f.asset})).length,0);
      const history=await listAssetHistory(clientId,f.asset);
      assert.equal(history.find(row=>row.id===f.report)?.subtype,'voided_warranty');
      assert.equal(history.find(row=>row.id===f.report)?.pdf_path,null);
      const audit=(await query("SELECT details FROM audit_logs WHERE action='MAINTENANCE_REPORT_VOIDED_WARRANTY' AND details->>'reportId'=$1",[f.report])).rows;
      assert.equal(audit.length,1); assert.equal(audit[0].details.originalSignatures.length,1);
      assert.equal(audit[0].details.originalCorrections[0].reason,'MOTIVO ORIGINAL CONSERVADO');
      assert.deepEqual(await annul(f), {id:f.report,replayed:true});
      await assert.rejects(updateMaintenanceReport(f.report,{}),{status:409});
      await assert.rejects(signMaintenanceReport({reportId:f.report,userId:user}),{status:409});
      await assert.rejects(createMaintenanceReport({requestId:f.request}),{status:409});
      await assert.rejects(deleteMaintenanceRequest(f.request),{status:409});
      assert.equal((await reopenMaintenanceReportForEngineer({reportId:f.report,userId:user,reason})).error,'voided');
    });
    for(const [label,options] of [
      ['no warranty',{warranty:0}],['unknown acquisition',{acquisition:null}],
      ['expired warranty',{acquisition:'2024-01-01'}],['before acquisition',{acquisition:'2026-09-01'}],
      ['not in correction',{status:'reportado'}],['spare parts',{spare:true}],['corrective report',{type:'correctivo'}]
    ]) await t.test(`blocks ${label}`,async()=>{
      const f=await fixture(options); await assert.rejects(annul(f),{status:409});
      assert.equal((await query('SELECT voided_at FROM maintenance_reports WHERE id=$1',[f.report])).rows[0].voided_at,null);
    });
    await t.test('blocks acceptance signatures, other engineers and foreign tenants',async()=>{
      const f=await fixture();
      await assert.rejects(annul(f,{actor:{...actor,sub:randomUUID()}}),{status:403});
      await assert.rejects(annul(f,{actor:{...actor,clientId:randomUUID()}}),{status:403});
      await assert.rejects(annul(f,{actor:{...actor,roles:['responsable_area']}}),{status:403});
      await query("UPDATE report_signatures SET role='responsable_area' WHERE report_id=$1",[f.report]);
      await assert.rejects(annul(f),{status:409});
    });
    await t.test('requires reason, explicit no-execution statement, active author and open correction',async()=>{
      const f=await fixture();
      await assert.rejects(annul(f,{reason:'corto'}),{status:400});
      await assert.rejects(annul(f,{reason:'x'.repeat(601)}),{status:400});
      await assert.rejects(annul(f,{confirmedNoExecution:'true'}),{status:400});
      await query('UPDATE users SET is_active=false WHERE id=$1',[user]);
      try {await assert.rejects(annul(f),{status:403});}
      finally {await query('UPDATE users SET is_active=true WHERE id=$1',[user]);}
      await query('UPDATE maintenance_report_corrections SET resolved_at=NOW() WHERE report_id=$1',[f.report]);
      await assert.rejects(annul(f),{status:409});
    });
    await t.test('works after engineer reopening removed the signature, without fabricating another',async()=>{
      const f=await fixture({signature:false}); await annul(f);
      assert.equal((await query('SELECT id FROM report_signatures WHERE report_id=$1',[f.report])).rows.length,0);
      assert.ok((await listAssetHistory(clientId,f.asset)).some(row=>row.id===f.report));
    });
    await t.test('rollback and concurrent retries cannot partially close or duplicate audit',async()=>{
      const f=await fixture();
      await assert.rejects(annul(f,{}, {transactionRunner:cb=>withTransaction(async db=>{await cb(db);throw Error('QA rollback');})}),/QA rollback/);
      assert.equal((await query('SELECT status FROM maintenance_requests WHERE id=$1',[f.request])).rows[0].status,'correccion');
      assert.equal((await query('SELECT voided_at FROM maintenance_reports WHERE id=$1',[f.report])).rows[0].voided_at,null);
      const results=await Promise.all([annul(f),annul(f)]);
      assert.equal(results.filter(r=>r.replayed).length,1);
      assert.equal((await query("SELECT id FROM audit_logs WHERE details->>'reportId'=$1",[f.report])).rows.length,1);
    });
    await t.test('HTTP authorizes engineer only, ignores forged supportCase and returns an annulment PDF',async()=>{
      await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
        VALUES ($1,'biomedico',true,'active') ON CONFLICT (client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`,[clientId]);
      await query(`INSERT INTO client_modules(client_id,module_key,enabled)
        SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`,[clientId]);
      const password=randomUUID(); await query('UPDATE users SET password_hash=$2 WHERE id=$1',[user,await bcrypt.hash(password,4)]);
      const session=await authenticateUser(tag,password);
      const probe=createServer(); await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
      const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
      api=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:String(port),SMTP_HOST:'127.0.0.1',SMTP_PORT:'9',
        SMTP_USER:'qa',SMTP_PASS:'qa',ODONTOLOGY_REMINDERS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
      let logs='';api.stdout.on('data',d=>logs+=d);api.stderr.on('data',d=>logs+=d);
      const base=`http://127.0.0.1:${port}`;
      let ready=false;
      for(let n=0;n<600;n++){
        try{if((await fetch(`${base}/health`)).ok){ready=true;break;}}catch{}
        if(api.exitCode!==null) break;
        await new Promise(r=>setTimeout(r,100));
      }
      assert.ok(ready,logs || 'QA API did not start');
      assert.equal(api.exitCode,null,logs);
      const f=await fixture();
      const originalPath=`/${uploadDir}/original-${f.report}.pdf`;
      await fs.writeFile(originalPath.slice(1),'ORIGINAL QA DO NOT OVERWRITE');
      await query('UPDATE maintenance_reports SET pdf_path=$2 WHERE id=$1',[f.report,originalPath]);
      const headers={Authorization:`Bearer ${session.accessToken}`,'Content-Type':'application/json'};
      let response=await fetch(`${base}/maintenance/reports/${f.report}/void-warranty`,{method:'POST',headers,body:JSON.stringify({reason,confirmedNoExecution:true,clientId:randomUUID(),supportCase:'FORGED SUPPORT AUTHORIZATION MUST BE IGNORED'})});
      assert.equal(response.status,200,await response.text()+logs);
      const details=(await query('SELECT void_details FROM maintenance_reports WHERE id=$1',[f.report])).rows[0].void_details;
      assert.equal(details.supportCase,null); assert.equal(details.actorUserId,user);
      response=await fetch(`${base}/maintenance/reports/${f.report}/pdf`,{headers});
      assert.equal(response.status,200,logs);
      const pdf=Buffer.from(await response.arrayBuffer());assert.equal(pdf.subarray(0,4).toString(),'%PDF');
      if(process.env.QA_WARRANTY_VOID_PDF) await fs.writeFile(process.env.QA_WARRANTY_VOID_PDF,pdf);
      assert.equal(await fs.readFile(originalPath.slice(1),'utf8'),'ORIGINAL QA DO NOT OVERWRITE');
      assert.equal((await query('SELECT pdf_path FROM maintenance_reports WHERE id=$1',[f.report])).rows[0].pdf_path,originalPath);
      response=await fetch(`${base}/maintenance/reports/${f.report}/void-warranty`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,confirmedNoExecution:true})});
      assert.equal(response.status,401);
    });
  } finally {
    if(api?.exitCode===null){api.kill('SIGTERM');await new Promise(resolve=>api.once('exit',resolve));}
    await query("DELETE FROM audit_logs WHERE details->>'clientId'=$1::text OR actor_user_id IN (SELECT id FROM users WHERE client_id=$1::uuid)",[clientId]);
    await query('DELETE FROM users WHERE client_id=$1',[clientId]);
    await query('DELETE FROM clients WHERE id=$1',[clientId]);
    assert.ok(schema.startsWith('cliente_qa_void_'));await query(`DROP SCHEMA "${schema}" CASCADE`);
    await fs.rm(uploadDir,{recursive:true,force:true});await pool.end();
  }
});
