import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import sharp from 'sharp';
import bcrypt from 'bcrypt';
import { query, pool, withTransaction } from './db.js';
import { createClient } from './clients.js';
import { closeNotLocatedPreventive } from './maintenance-not-located.js';
import { createMaintenanceReport, getPreventiveMaintenanceProgress, listReportSignatures, signMaintenanceReport } from './maintenance.js';
import { listAssetHistory } from './biomed.js';
import { authenticateUser } from './auth.js';
import { createMaintenanceSignatureSnapshot } from './maintenance-signature-snapshots.js';
import { saveVerbalAttention } from './maintenance-verbal.js';

test('integration: non-execution closure is isolated, signed, atomic and auditable', {
  skip: process.env.RUN_NOT_LOCATED_INTEGRATION !== '1'
}, async t => {
  assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST),'Local database only');
  const tag=`qa_notloc_${Date.now()}`;
  const tenant=await createClient({name:tag,nit:tag,city:'QA',email:`${tag}@example.invalid`});
  const clientId=tenant.id, schema=tenant.schema_name;
  const uploadDir=path.join('uploads','clients',clientId);
  const signaturePath=`/${uploadDir}/qa-signature.png`;
  let api;
  try {
    await fs.mkdir(uploadDir,{recursive:true});
    await sharp(Buffer.from('<svg width="300" height="70"><rect width="300" height="70" fill="white"/><text x="12" y="44" font-size="22">FIRMA DE PRUEBA QA</text></svg>')).png().toFile(signaturePath.slice(1));
    const user=(await query(`INSERT INTO users(username,password_hash,client_id,display_name,email,signature_path)
      VALUES ($1,'unusable',$2,'INGENIERO DE PRUEBA QA',$1||'@example.invalid',$3) RETURNING id`,[tag,clientId,signaturePath])).rows[0].id;
    await query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='ingeniero_biomedico'",[user]);
    const area=(await query(`INSERT INTO "${schema}".areas(name) VALUES ('NO SE ENCUENTRA EN EL AREA') RETURNING id`)).rows[0].id;
    const schedule=(await query(`INSERT INTO maintenance_schedules(client_id,year,start_date,status,created_by)
      VALUES ($1,2026,'2026-09-01','approved',$2) RETURNING id`,[clientId,user])).rows[0].id;
    const actor={sub:user,clientId,roles:['ingeniero_biomedico']};
    const payload={verifiedOn:'2026-09-21',searchedLocation:'CONSULTORIOS Y ALMACEN',
      reason:'Se revisaron los consultorios y el almacen; no se encontro el equipo registrado.',confirmed:true};
    const close=(item,extra={},deps) => closeNotLocatedPreventive({clientId,itemId:item,payload,actor,today:'2026-09-21',...extra},deps);
    async function fixture({planned='2026-09-01',deadline='2026-09-30',warranty=null,acquisition=null,
      status='active',requestStatus='abierto',category='biomedical',assetStatus='activo',request=true}={}) {
      const asset=(await query(`INSERT INTO "${schema}".assets(code,name,brand,model,serial,area_id,asset_category,status,warranty_years,acquisition_date)
        VALUES ($1,'MONITOR QA','MARCA QA','MODELO QA','SERIE QA',$2,$3,$4,$5,$6) RETURNING id`,
        [randomUUID(),area,category,assetStatus,warranty,acquisition])).rows[0].id;
      const item=(await query(`INSERT INTO maintenance_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date,status,programming_confirmed)
        VALUES ($1,$2,'trimestral',$3,$4,$5,true) RETURNING id`,[schedule,asset,planned,deadline,status])).rows[0].id;
      const requestId=request ? (await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,status,source,requested_by,schedule_id,schedule_item_id,planned_date,deadline_date)
        VALUES ($1,$2,'preventivo',$3,'cronograma',$4,$5,$6,$7,$8) RETURNING id`,
        [clientId,asset,requestStatus,user,schedule,item,planned,deadline])).rows[0].id : null;
      return {asset,item,request:requestId};
    }
    let saved;
    await t.test('signs exactly once, preserves asset state, exposes history and progress separately',async()=>{
      const f=await fixture(); const before=(await query(`SELECT * FROM "${schema}".assets WHERE id=$1`,[f.asset])).rows[0];
      const result=await close(f.item); saved={...f,...result};
      const report=(await query('SELECT * FROM maintenance_reports WHERE id=$1',[result.id])).rows[0];
      assert.equal(report.closure_kind,'not_located'); assert.equal(report.asset_status_after,'no_verificado');
      assert.equal(report.area_responsible_required,false); assert.deepEqual(report.maintenance_checks,[]);
      const signatures=await listReportSignatures(result.id);
      assert.equal(signatures.length,1); assert.equal(signatures[0].role,'ingeniero_biomedico');
      assert.ok(signatures[0].signature_path.includes(`/maintenance/signatures/${result.id}/`));
      assert.deepEqual((await query(`SELECT * FROM "${schema}".assets WHERE id=$1`,[f.asset])).rows[0],before);
      assert.equal((await query('SELECT status FROM maintenance_requests WHERE id=$1',[f.request])).rows[0].status,'firmado');
      const item=(await query('SELECT * FROM maintenance_schedule_items WHERE id=$1',[f.item])).rows[0];
      assert.equal(item.status,'done'); assert.equal(item.historical_resolution,'not_performed');
      const progress=await getPreventiveMaintenanceProgress(clientId,{year:2026,month:9,assetId:f.asset});
      assert.equal(progress.monthly.not_located,1); assert.equal(progress.monthly.completed,0);
      assert.equal(progress.items[0].phase,'not_located'); assert.equal(progress.items[0].pdf_available,true);
      assert.equal(progress.items[0].can_perform_protocol,false);
      assert.ok((await listAssetHistory(clientId,f.asset)).some(row=>row.id===result.id && row.subtype==='not_located'));
      assert.equal((await query('SELECT id FROM notifications WHERE client_id=$1',[clientId])).rows.length,0);
      assert.equal((await query("SELECT id FROM audit_logs WHERE details->>'reportId'=$1",[result.id])).rows.length,1);
      const snapshot=await fs.readFile(signatures[0].signature_path.slice(1));
      await fs.writeFile(signaturePath.slice(1),'changed current signature');
      assert.deepEqual(await fs.readFile(signatures[0].signature_path.slice(1)),snapshot);
      await fs.writeFile(signaturePath.slice(1),snapshot);
      assert.deepEqual(await close(f.item),{id:result.id,replayed:true});
      await assert.rejects(close(f.item,{payload:{...payload,reason:'Un motivo diferente no debe reemplazar la constancia firmada.'}}),{status:409});
      await assert.rejects(signMaintenanceReport({reportId:result.id,userId:user,role:'responsable_area'}),{status:409});
      await assert.rejects(createMaintenanceReport({requestId:f.request}),{status:409});
    });
    await t.test('can close reportless activity without a request',async()=>{
      const f=await fixture({request:false}); await close(f.item);
      assert.equal((await query('SELECT id FROM maintenance_requests WHERE schedule_item_id=$1',[f.item])).rows.length,1);
    });
    await t.test('a constancia is not a later technical intervention when recording historical corrective work',async()=>{
      const chief=(await query(`INSERT INTO users(username,password_hash,client_id,display_name,email)
        VALUES ($1,'unusable',$2,'RESPONSABLE QA',$1||'@example.invalid') RETURNING id`,[`${tag}_chief`,clientId])).rows[0].id;
      const result=await saveVerbalAttention({submissionId:randomUUID(),assetId:saved.asset,assetCategory:'biomedical',
        performedOn:'2026-09-01',reporterName:'RESPONSABLE QA',reporterRole:'JEFE QA',description:'Falla de prueba informada verbalmente.',
        summary:'Correctivo de prueba anterior a la busqueda.',findings:'Equipo fuera de servicio por falla identificada.',
        actionsTaken:'Revision de prueba sin sustitucion de partes.',maintenanceChecks:['revision_visual'],
        maintenanceActivities:['limpieza_externa'],maintenanceTests:[],assetStatusAfter:'fuera_de_servicio',
        assetStatusObservations:'Falla de alimentacion confirmada.',requiresSpareParts:false,sparePartsInstalledNow:false},
        {...actor,permissions:['maintenance:report:create']}, {
          buildSigningPlan:async()=>({areaResponsibleRequired:true,users:[{id:chief}]}),
          listStorekeepers:async()=>[],maintenanceRoute:()=>'/mantenimiento'
        });
      assert.equal(result.assetStatusApplied,true);
      assert.equal((await query(`SELECT status FROM "${schema}".assets WHERE id=$1`,[saved.asset])).rows[0].status,'fuera_de_servicio');
      assert.equal((await query('SELECT asset_status_after FROM maintenance_reports WHERE id=$1',[saved.id])).rows[0].asset_status_after,'no_verificado');
    });
    for(const [label,options] of [
      ['warranty',{warranty:1,acquisition:'2026-01-01'}], ['unknown warranty',{warranty:1}],
      ['retired asset',{assetStatus:'dado_de_baja'}], ['category mismatch',{category:'industrial'}],
      ['future activity',{planned:'2026-10-01',deadline:'2026-10-31'}],
      ['expired without opening',{planned:'2026-08-01',deadline:'2026-08-31'}],
      ['completed',{status:'done'}], ['spare request',{requestStatus:'espera_repuesto'}]
    ]) await t.test(`blocks ${label}`,async()=>{
      const f=await fixture(options); await assert.rejects(close(f.item),{status:409});
      assert.equal((await query('SELECT id FROM maintenance_reports WHERE request_id=$1',[f.request])).rows.length,0);
    });
    await t.test('protects existing report even when schedule report link is missing',async()=>{
      const f=await fixture(); const report=(await query(`INSERT INTO maintenance_reports(client_id,request_id,asset_id,type,created_by,requires_spare_parts)
        VALUES ($1,$2,$3,'preventivo',$4,true) RETURNING *`,[clientId,f.request,f.asset,user])).rows[0];
      await assert.rejects(close(f.item),{status:409});
      assert.deepEqual((await query('SELECT * FROM maintenance_reports WHERE id=$1',[report.id])).rows[0],report);
    });
    await t.test('enforces tenant, engineer role, active user and ownership',async()=>{
      const f=await fixture();
      await assert.rejects(close(f.item,{actor:{...actor,clientId:randomUUID()}}),{status:403});
      await assert.rejects(close(f.item,{actor:{...actor,roles:['responsable_area']}}),{status:403});
      await assert.rejects(close(randomUUID()),{status:404});
      await assert.rejects(close('invalid'),{status:400});
      await query('UPDATE users SET is_active=false WHERE id=$1',[user]);
      try { await assert.rejects(close(f.item),{status:403}); }
      finally { await query('UPDATE users SET is_active=true WHERE id=$1',[user]); }
      await query('UPDATE maintenance_requests SET assigned_to=$1 WHERE id=$2',[user,f.request]);
      await assert.rejects(close(f.item,{actor:{...actor,sub:randomUUID()}}),{status:409});
    });
    await t.test('missing signature and transactional failure leave no partial closure',async()=>{
      const f=await fixture();
      await query('UPDATE users SET signature_path=NULL WHERE id=$1',[user]);
      try { await assert.rejects(close(f.item),{status:400}); }
      finally { await query('UPDATE users SET signature_path=$2 WHERE id=$1',[user,signaturePath]); }
      let snapshot;
      await assert.rejects(close(f.item,{}, {
        snapshotSignature: async value => { snapshot=await createMaintenanceSignatureSnapshot(value); return snapshot; },
        transactionRunner: cb=>withTransaction(async connection=>{await cb(connection); throw Error('QA rollback');})
      }),/QA rollback/);
      await assert.rejects(fs.access(snapshot.fullPath));
      assert.equal((await query('SELECT id FROM maintenance_reports WHERE request_id=$1',[f.request])).rows.length,0);
      assert.equal((await query('SELECT status FROM maintenance_requests WHERE id=$1',[f.request])).rows[0].status,'abierto');
    });
    await t.test('simultaneous identical closures produce one report and one signature',async()=>{
      const f=await fixture(); const results=await Promise.all([close(f.item),close(f.item)]);
      assert.equal(results[0].id,results[1].id); assert.equal(results.filter(r=>r.replayed).length,1);
      assert.equal((await listReportSignatures(results[0].id)).length,1);
    });
    await t.test('a normal report racing with closure cannot overwrite the finalized request',async()=>{
      const f=await fixture(); let ready,release;
      const locked=new Promise(resolve=>{ready=resolve;});
      const resume=new Promise(resolve=>{release=resolve;});
      const closing=close(f.item,{}, {snapshotSignature:async args=>{ready();await resume;return createMaintenanceSignatureSnapshot(args);}});
      await locked;
      const normal=createMaintenanceReport({clientId,requestId:f.request,assetId:f.asset,type:'preventivo',createdBy:user});
      const rejection=assert.rejects(normal,{status:409});
      release();await closing;await rejection;
      assert.equal((await query('SELECT id FROM maintenance_reports WHERE request_id=$1',[f.request])).rows.length,1);
      assert.equal((await query('SELECT status FROM maintenance_requests WHERE id=$1',[f.request])).rows[0].status,'firmado');
    });
    await t.test('active exceptional opening allows August, expiry and revocation block it',async()=>{
      const permission=(await query(`INSERT INTO user_temporary_permissions(user_id,permission_id,expires_at,granted_by,reason)
        SELECT $1,id,NOW()+INTERVAL '1 day',$1,'QA apertura autorizada' FROM permissions
        WHERE name='maintenance:preventive:late_execution' RETURNING id`,[user])).rows[0].id;
      const fixtures=[];
      for(let n=0;n<3;n++) {
        const f=await fixture({planned:'2026-08-01',deadline:'2026-08-31'}); fixtures.push(f);
        await query(`UPDATE maintenance_schedule_items SET late_execution_authorized_until=NOW()+INTERVAL '1 day',
          late_execution_temporary_permission_id=$2 WHERE id=$1`,[f.item,permission]);
      }
      await close(fixtures[0].item);
      await query("UPDATE user_temporary_permissions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[permission]);
      await assert.rejects(close(fixtures[1].item),{status:409});
      await query('DELETE FROM user_temporary_permissions WHERE id=$1',[permission]);
      await assert.rejects(close(fixtures[2].item),{status:409});
    });
    await t.test('HTTP closure returns a downloadable engineer-only PDF',async()=>{
      await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
        VALUES ($1,'biomedico',true,'active') ON CONFLICT (client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`,[clientId]);
      await query(`INSERT INTO client_modules(client_id,module_key,enabled)
        SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`,[clientId]);
      const password=randomUUID();
      await query('UPDATE users SET password_hash=$2 WHERE id=$1',[user,await bcrypt.hash(password,4)]);
      const session=await authenticateUser(tag,password);
      const probe=createServer(); await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
      const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
      api=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:String(port),SMTP_HOST:'127.0.0.1',SMTP_PORT:'9',
        SMTP_SECURE:'false',SMTP_USER:'qa',SMTP_PASS:'qa',ODONTOLOGY_REMINDERS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
      let logs='';api.stdout.on('data',data=>logs+=data);api.stderr.on('data',data=>logs+=data);
      const base=`http://127.0.0.1:${port}`;
      for(let n=0;n<80;n++) {try{if((await fetch(`${base}/health`)).ok)break;}catch{} await new Promise(resolve=>setTimeout(resolve,100));}
      assert.equal(api.exitCode,null,logs);
      const f=await fixture();
      const response=await fetch(`${base}/maintenance/preventive-progress/${clientId}/items/${f.item}/not-located`,{
        method:'POST',headers:{Authorization:`Bearer ${session.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json(); assert.equal(response.status,201,JSON.stringify(result)+' '+logs);
      assert.equal(result.pdfAvailable,true,logs);
      const report=(await query('SELECT pdf_path FROM maintenance_reports WHERE id=$1',[result.id])).rows[0];
      const pdf=await fs.readFile(report.pdf_path.replace(/^\//,''));
      assert.equal(pdf.subarray(0,4).toString(),'%PDF');
      if(process.env.QA_NOT_LOCATED_PDF) await fs.writeFile(process.env.QA_NOT_LOCATED_PDF,pdf);
    });
  } finally {
    if(api?.exitCode===null) {api.kill('SIGTERM');await new Promise(resolve=>api.once('exit',resolve));}
    await query('DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE client_id=$1)',[clientId]);
    await query('DELETE FROM users WHERE client_id=$1',[clientId]);
    await query('DELETE FROM clients WHERE id=$1',[clientId]);
    assert.ok(schema.startsWith('cliente_qa_notloc_'));await query(`DROP SCHEMA "${schema}" CASCADE`);
    await fs.rm(uploadDir,{recursive:true,force:true});await pool.end();
  }
});
