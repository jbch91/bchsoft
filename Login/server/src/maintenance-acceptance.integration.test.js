import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import { query, pool } from './db.js';
import { createClient } from './clients.js';
import { authenticateUser, getCurrentSessionUser } from './auth.js';
import { setMaintenanceAcceptanceDelegate } from './maintenance-acceptance-delegation.js';
import { signMaintenanceReport, listMaintenanceReports, requestMaintenanceReportCorrection,
  getPreventiveMaintenanceProgress } from './maintenance.js';

test('storekeeper receipt delegation: isolated tenants, workflow, signatures and HTTP', {
  skip: process.env.RUN_ACCEPTANCE_INTEGRATION !== '1'
}, async t => {
  assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST),'Local database only');
  await query(await fs.readFile('sql/maintenance_acceptance_delegation.sql','utf8'));
  await query(await fs.readFile('sql/maintenance_report_request_description.sql','utf8'));
  const tag = `qa_accept_${Date.now()}`;
  const tenants = [];
  let api;
  try {
    for (const suffix of ['main','other']) tenants.push(await createClient({name:`${tag}_${suffix}`,nit:`${tag}_${suffix}`,city:'QA',email:`${suffix}@example.invalid`}));
    const clientId = tenants[0].id, schema = tenants[0].schema_name;
    const password = randomUUID();
    const signaturePath = `/uploads/clients/${clientId}/qa-signature.png`;
    await fs.mkdir(`uploads/clients/${clientId}`,{recursive:true});
    await sharp(Buffer.from('<svg width="300" height="70"><rect width="300" height="70" fill="white"/><text x="12" y="44" font-size="22">FIRMA DE PRUEBA QA</text></svg>')).png().toFile(signaturePath.slice(1));
    async function user(role, suffix, tenantId=clientId) {
      const username = `${tag}_${suffix}`;
      const id = (await query(`INSERT INTO users(username,password_hash,client_id,display_name,email,signature_path)
        VALUES ($1,$2,$3,$4,$1||'@example.invalid',$5) RETURNING id`,
      [username,await bcrypt.hash(password,4),tenantId,`${role.toUpperCase()} QA ${suffix}`,signaturePath])).rows[0].id;
      await query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2',[id,role]);
      return {...await getCurrentSessionUser(id),username};
    }
    const engineer = await user('ingeniero_biomedico','engineer');
    const store = await user('almacenista','store');
    const other = await user('almacenista','other');
    const foreign = await user('almacenista','foreign',tenants[1].id);
    const chief = await user('responsable_area','chief');
    assert.ok(store.permissions.includes('maintenance:report:sign'));
    await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
      VALUES ($1,'biomedico',true,'active') ON CONFLICT(client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`,[clientId]);
    await query(`INSERT INTO client_modules(client_id,module_key,enabled) SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`,[clientId]);
    const area=(await query(`INSERT INTO "${schema}".areas(name) VALUES('URGENCIAS QA') RETURNING id`)).rows[0].id;
    const schedule=(await query(`INSERT INTO maintenance_schedules(client_id,year,start_date,status,created_by)
      VALUES ($1,2026,'2026-01-01','approved',$2) RETURNING id`,[clientId,engineer.sub])).rows[0].id;
    async function fixture({type='preventivo',spare=false}={}) {
      const asset=(await query(`INSERT INTO "${schema}".assets(code,name,brand,model,serial,area_id,status,warranty_years)
        VALUES($1,'MONITOR QA','MARCA QA','MODELO QA','SERIE QA',$2,'operativo',0) RETURNING id`,[randomUUID(),area])).rows[0].id;
      const item=(await query(`INSERT INTO maintenance_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date,status,programming_confirmed)
        VALUES($1,$2,'trimestral','2026-09-01','2026-09-30','done',true) RETURNING id`,[schedule,asset])).rows[0].id;
      const request=(await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,status,source,requested_by,assigned_to,schedule_id,schedule_item_id)
        VALUES($1,$2,$3,$4,'cronograma',$5,$5,$6,$7) RETURNING id`,[clientId,asset,type,spare?'espera_repuesto':'reportado',engineer.sub,schedule,item])).rows[0].id;
      const report=(await query(`INSERT INTO maintenance_reports(client_id,request_id,asset_id,type,created_by,summary,findings,actions_taken,
        area_responsible_required,requires_spare_parts,spare_parts_status)
        VALUES($1,$2,$3,$4,$5,'INSPECCIÓN QA','SIN HALLAZGOS','LIMPIEZA Y PRUEBAS',true,$6,$7) RETURNING id`,
      [clientId,request,asset,type,engineer.sub,spare,spare?'solicitado':'no_aplica'])).rows[0].id;
      await query('UPDATE maintenance_schedule_items SET report_id=$2,completion_source=$3 WHERE id=$1',[item,report,'software_report']);
      await query(`INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name,signature_sha256)
        VALUES($1,$2,'ingeniero_biomedico',$3,'INGENIERO QA','original-engineer-hash')`,[report,engineer.sub,signaturePath]);
      return {asset,item,request,report};
    }
    const reason = 'Recepción excepcional autorizada porque el jefe de área no está disponible.';
    const delegate = (f, delegateUserId=store.sub, extra={}) => setMaintenanceAcceptanceDelegate({reportId:f.report,actor:engineer,delegateUserId,reason,...extra});
    const sign = (f, signer=store) => signMaintenanceReport({reportId:f.report,userId:signer.sub,role:signer.roles[0],signaturePath,signerName:signer.username,signatureSha256:'store-original-hash'});
    await t.test('author, tenant, role, reason and active signature are enforced',async()=>{
      const f=await fixture();
      for(const [extra,status] of [[{actor:{...engineer,sub:other.sub}},403],[{actor:store},403],
        [{actor:{...engineer,clientId:tenants[1].id}},403],[{reason:'corto'},400],[{reason:'x'.repeat(601)},400]]) {
        await assert.rejects(delegate(f,store.sub,extra),{status});
      }
      await assert.rejects(delegate(f,foreign.sub),{status:403});
      await assert.rejects(delegate(f,chief.sub),{status:403});
      await assert.rejects(delegate(f,false),{status:400});
      await query('UPDATE users SET is_active=false WHERE id=$1',[store.sub]);
      await assert.rejects(delegate(f),{status:403});
      await query('UPDATE users SET is_active=true,signature_path=NULL WHERE id=$1',[store.sub]);
      await assert.rejects(delegate(f),{status:400});
      await query('UPDATE users SET signature_path=$2 WHERE id=$1',[store.sub,signaturePath]);
      await query('DELETE FROM report_signatures WHERE report_id=$1',[f.report]);
      await assert.rejects(delegate(f),{status:409});
    });
    await t.test('only assigned reports enter inbox; spare work stays independently available',async()=>{
      const assigned=await fixture(), unassigned=await fixture(), spare=await fixture({spare:true});
      await delegate(assigned);
      assert.equal((await delegate(assigned)).delegation_unchanged,true);
      assert.equal((await query("SELECT id FROM audit_logs WHERE action='MAINTENANCE_ACCEPTANCE_DELEGATED' AND details->>'reportId'=$1",[assigned.report])).rowCount,1);
      const rows=await listMaintenanceReports(clientId,{storekeeperUserId:store.sub});
      assert.ok(rows.some(r=>r.id===assigned.report));
      assert.ok(rows.some(r=>r.id===spare.report));
      assert.ok(!rows.some(r=>r.id===unassigned.report));
      await delegate(assigned,other.sub);
      assert.ok(!(await listMaintenanceReports(clientId,{storekeeperUserId:store.sub})).some(r=>r.id===assigned.report));
      await delegate(assigned,null);
      assert.equal((await query('SELECT acceptance_delegate_user_id,area_responsible_required FROM maintenance_reports WHERE id=$1',[assigned.report])).rows[0].area_responsible_required,true);
      await assert.rejects(sign(assigned),{status:403});
    });
    for(const type of ['preventivo','correctivo']) for(const spare of [false,true]) {
      await t.test(`${type}, spare=${spare}: exact recipient finalizes with immutable, idempotent signature`,async()=>{
        const f=await fixture({type,spare});await delegate(f);
        await assert.rejects(sign(f,other),{status:403});
        await assert.rejects(sign(f,chief),{status:403});
        const result=await sign(f);
        assert.equal(result.is_fully_signed,true);assert.equal(result.request_status,spare?'espera_repuesto':'firmado');
        const snapshot=(await query('SELECT * FROM report_signatures WHERE report_id=$1 ORDER BY id',[f.report])).rows;
        assert.equal((await sign(f)).alreadySigned,true);
        assert.deepEqual((await query('SELECT * FROM report_signatures WHERE report_id=$1 ORDER BY id',[f.report])).rows,snapshot);
        await assert.rejects(delegate(f,other.sub),{status:409});
        await assert.rejects(requestMaintenanceReportCorrection({reportId:f.report,userId:store.sub,actor:store,reason}),{status:409});
        if(type==='preventivo') {
          const progress=await getPreventiveMaintenanceProgress(clientId,{year:2026,month:9,assetId:f.asset});
          assert.equal(progress.items[0].phase,'completed');
          assert.equal(progress.monthly.waiting_spare,spare?1:0);
        }
      });
    }
    await t.test('returns for correction, preserves recipient, and signs after correction is resolved',async()=>{
      const f=await fixture();await delegate(f);
      await assert.rejects(requestMaintenanceReportCorrection({reportId:f.report,userId:other.sub,actor:other,reason}),{status:403});
      const results=await Promise.all([1,2].map(()=>requestMaintenanceReportCorrection({reportId:f.report,userId:store.sub,actor:store,reason})));
      assert.equal(results[0].id,results[1].id);
      await assert.rejects(sign(f),{status:409});await assert.rejects(delegate(f,other.sub),{status:409});
      await query('UPDATE maintenance_report_corrections SET resolved_at=NOW() WHERE report_id=$1',[f.report]);
      await query("UPDATE maintenance_requests SET status='reportado' WHERE id=$1",[f.request]);
      assert.equal((await sign(f)).is_fully_signed,true);
    });
    await t.test('concurrent change and signature cannot replace an accepted recipient',async()=>{
      const f=await fixture();await delegate(f);
      const results=await Promise.allSettled([sign(f),delegate(f,other.sub)]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.ok([403,409].includes(results.find(r=>r.status==='rejected').reason.status));
      const race=await fixture();await delegate(race);
      const outcomes=await Promise.allSettled([sign(race),requestMaintenanceReportCorrection({reportId:race.report,userId:store.sub,actor:store,reason})]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(outcomes.find(r=>r.status==='rejected').reason.status,409);
    });
    await t.test('HTTP delegation, inbox, PDF and signing operate without storekeeper area assignment',async()=>{
      const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
      const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
      api=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:String(port),SMTP_HOST:'127.0.0.1',SMTP_PORT:'9',SMTP_USER:'qa',SMTP_PASS:'qa',ODONTOLOGY_REMINDERS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
      let logs='';api.stdout.on('data',d=>logs+=d);api.stderr.on('data',d=>logs+=d);
      const base=`http://127.0.0.1:${port}`;
      let ready=false;
      for(let i=0;i<600;i++) {try{if((await fetch(`${base}/health`)).ok){ready=true;break;}}catch{} if(api.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
      assert.ok(ready,logs);
      const sessions=new Map();
      for(const person of [engineer,store,other,chief]) sessions.set(person.sub,(await authenticateUser(person.username,password)).accessToken);
      async function call(person,path,body) {
        return fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${sessions.get(person.sub)}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
          .catch(error => { throw new Error(`${error.message}\n${logs}`); });
      }
      const f=await fixture({type:'correctivo'});
      const installation = await fixture({spare:true});
      await query("UPDATE maintenance_requests SET description='Mantenimiento preventivo programado',planned_date='2026-08-01' WHERE id=$1",[installation.request]);
      const original = (await query('SELECT * FROM maintenance_reports WHERE id=$1',[installation.report])).rows[0];
      const originalSignatures = (await query('SELECT * FROM report_signatures WHERE report_id=$1',[installation.report])).rows;
      const originalItem = (await query('SELECT * FROM maintenance_schedule_items WHERE id=$1',[installation.item])).rows[0];
      const description = 'Atención correctiva para instalar BATERÍA en MONITOR QA. Pendiente del preventivo de agosto de 2026. Coordinar entrega con urgencias.';
      const installationResponse = await call(engineer,'/maintenance/reports',{
        requestId:installation.request,requestDescription:description,summary:'Instalación de batería QA',findings:'Batería agotada',actionsTaken:'Se instala batería y se comprueba el funcionamiento.',
        maintenanceChecks:['revision_visual'],maintenanceActivities:['instalacion_repuesto'],maintenanceTests:['encendido_apagado'],assetStatusAfter:'operativo',requiresSpareParts:true,sparePartsNeeded:'BATERÍA'
      });
      assert.equal(installationResponse.status,201,await installationResponse.clone().text());
      const installed = (await query("SELECT * FROM maintenance_reports WHERE request_id=$1 AND type='correctivo'",[installation.request])).rows[0];
      assert.equal(installed.request_description,description);
      assert.deepEqual((await query('SELECT * FROM maintenance_reports WHERE id=$1',[installation.report])).rows[0],original);
      assert.deepEqual((await query('SELECT * FROM report_signatures WHERE report_id=$1',[installation.report])).rows,originalSignatures);
      assert.deepEqual((await query('SELECT * FROM maintenance_schedule_items WHERE id=$1',[installation.item])).rows[0],originalItem);
      assert.equal((await query('SELECT description FROM maintenance_requests WHERE id=$1',[installation.request])).rows[0].description,'Mantenimiento preventivo programado');
      const installationPdf = await call(engineer,`/maintenance/reports/${installed.id}/pdf`);
      assert.equal(installationPdf.status,200);
      if(process.env.QA_SPARE_DESCRIPTION_PDF) await fs.writeFile(process.env.QA_SPARE_DESCRIPTION_PDF,Buffer.from(await installationPdf.arrayBuffer()));
      let response=await call(engineer,`/maintenance/reports/${f.report}/acceptance-delegates`);
      assert.equal(response.status,200,await response.clone().text());
      assert.ok((await response.json()).some(u=>u.id===store.sub && u.hasSignature));
      response=await call(engineer,`/maintenance/reports/${f.report}/acceptance-delegate`,{delegateUserId:store.sub,reason});
      assert.equal(response.status,200,await response.clone().text());
      assert.deepEqual((await response.json()).warnings,[]);
      const notified=(await query("SELECT user_id FROM notifications WHERE payload->>'reportId'=$1 AND read_at IS NULL",[f.report])).rows;
      assert.deepEqual(notified.map(n=>n.user_id),[store.sub]);
      response=await call(store,`/maintenance/reports/${clientId}`);
      assert.equal(response.status,200,await response.clone().text());
      assert.ok((await response.json()).some(r=>r.id===f.report));
      for(const person of [chief,other]) {
        response=await call(person,`/maintenance/reports/${f.report}/sign`,{});
        assert.equal(response.status,403,await response.clone().text());
      }
      response=await call(store,`/maintenance/reports/${f.report}/sign`,{});
      assert.equal(response.status,200,await response.clone().text());
      assert.equal((await response.json()).is_fully_signed,true);
      response=await call(store,`/maintenance/reports/${f.report}/sign`,{});
      assert.equal((await response.json()).alreadySigned,true);
      response=await call(store,`/maintenance/reports/${f.report}/pdf`);
      assert.equal(response.status,200,logs);
      const pdf=Buffer.from(await response.arrayBuffer());assert.equal(pdf.subarray(0,4).toString(),'%PDF');
      if(process.env.QA_ACCEPTANCE_PDF) await fs.writeFile(process.env.QA_ACCEPTANCE_PDF,pdf);
    });
  } finally {
    if(api?.exitCode===null){api.kill('SIGTERM');await new Promise(resolve=>api.once('exit',resolve));}
    for(const tenant of tenants.reverse()) {
      await query("DELETE FROM audit_logs WHERE details->>'clientId'=$1::text OR actor_user_id IN(SELECT id FROM users WHERE client_id=$1::uuid)",[tenant.id]);
      await query('DELETE FROM maintenance_reports WHERE client_id=$1',[tenant.id]);
      await query('DELETE FROM users WHERE client_id=$1',[tenant.id]);
      await query('DELETE FROM clients WHERE id=$1',[tenant.id]);
      assert.ok(tenant.schema_name.startsWith('cliente_qa_accept_'));await query(`DROP SCHEMA "${tenant.schema_name}" CASCADE`);
      await fs.rm(`uploads/clients/${tenant.id}`,{recursive:true,force:true});
    }
    await pool.end();
  }
});
