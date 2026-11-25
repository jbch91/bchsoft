import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pool, query } from './db.js';
import { createClient } from './clients.js';
import { createUser } from './admin.js';
import { authenticateUser } from './auth.js';
import { listAssets, listAssetsForReader, listAssetHistory } from './biomed.js';

test('asset calibration states and complete signed PDF history remain tenant scoped', {
  skip: process.env.RUN_ASSET_HISTORY_INTEGRATION !== '1'
}, async (t) => {
  assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tag = `qa_asset_history_${Date.now()}`;
  const tenant = await createClient({ name: tag, nit: tag, city: 'QA', email: `${tag}@example.invalid` });
  const { id: clientId, schema_name: schema } = tenant;
  const root = `uploads/clients/${clientId}`;
  let api;
  try {
    await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
      VALUES ($1,'biomedico',true,'active') ON CONFLICT(client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`, [clientId]);
    await query(`INSERT INTO client_modules(client_id,module_key,enabled) SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`, [clientId]);
    const users = {};
    for (const role of ['ingeniero_biomedico','responsable_area','almacenista','lector']) {
      const password = randomUUID();
      const user = await createUser({ username: `${tag}_${role}`, displayName: 'USUARIO QA', email: `${tag}_${role}@example.invalid`, role, clientId, password });
      const session = await authenticateUser(user.username, password);
      users[role] = { id: user.id, headers: { Authorization: `Bearer ${session.accessToken}` } };
    }
    const engineer = users.ingeniero_biomedico;
    const { rows: [area] } = await query(`INSERT INTO "${schema}".areas(name) VALUES ('AREA QA') RETURNING id`);
    const { rows: [asset] } = await query(`INSERT INTO "${schema}".assets(code,name,requires_calibration,calibration_frequency,area_id)
      VALUES ('QA-001','MONITOR QA',true,'anual',$1) RETURNING id`, [area.id]);
    const { rows: [outside] } = await query(`INSERT INTO "${schema}".assets(code,name,requires_calibration) VALUES ('QA-002','OTRA AREA',true) RETURNING id`);
    await query('INSERT INTO reader_access(user_id,client_id,area_id) VALUES ($1,$2,$3)', [users.lector.id,clientId,area.id]);
    await fs.mkdir(root, { recursive: true });
    const pdf = async (filename, title, width=400) => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage([width,300]).drawText(title, { x:25,y:250,size:16,font });
      await fs.writeFile(`${root}/${filename}`, await doc.save());
      return `/${root}/${filename}`;
    };
    const calibrationPdf = await pdf('acta.pdf', 'ACTA CALIBRACION QA', 401);
    const schedule = (await query(`INSERT INTO calibration_schedules(client_id,year,start_date,status,created_by)
      VALUES ($1,2026,'2026-01-01','approved',$2) RETURNING id`, [clientId,engineer.id])).rows[0];
    const item = (await query(`INSERT INTO calibration_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date)
      VALUES ($1,$2,'anual','2026-01-01','2026-01-31') RETURNING id`, [schedule.id,asset.id])).rows[0];
    const state = async () => (await listAssets(clientId)).find(row => row.id === asset.id);
    await t.test('uploaded acta clears pending without removing the calibration requirement', async () => {
      assert.equal((await state()).calibration_state, 'pending');
      await query("UPDATE calibration_schedule_items SET pdf_path=$2,status='done',completed_at=NOW() WHERE id=$1", [item.id,calibrationPdf]);
      assert.equal((await state()).calibration_state, 'documented');
      assert.equal((await state()).requires_calibration, true);
      const scoped = await listAssetsForReader(clientId,users.lector.id);
      assert.deepEqual(scoped.map(row=>row.id), [asset.id]);
      assert.equal(scoped[0].calibration_state, 'documented');
      await query(`INSERT INTO calibration_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date)
        VALUES ($1,$2,'anual','2099-01-01','2099-01-31')`, [schedule.id,asset.id]);
      assert.equal((await state()).calibration_state, 'documented', 'future windows do not invalidate a loaded acta');
      const overdue = (await query(`INSERT INTO calibration_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date)
        VALUES ($1,$2,'semestral','2026-02-01','2026-02-28') RETURNING id`, [schedule.id,asset.id])).rows[0];
      assert.equal((await state()).calibration_state, 'pending', 'a new due cycle needs its own acta');
      await query('DELETE FROM calibration_schedule_items WHERE id=$1', [overdue.id]);
      await query(`UPDATE "${schema}".assets SET requires_calibration=false WHERE id=$1`, [asset.id]);
      assert.equal((await state()).calibration_state, 'not_required');
      assert.ok((await listAssetHistory(clientId,asset.id)).some(row=>row.id===item.id));
      await query(`UPDATE "${schema}".assets SET requires_calibration=true WHERE id=$1`, [asset.id]);
    });
    const reports = [];
    for (const [index,type,accepted] of [[0,'preventivo',true],[1,'correctivo',true],[2,'preventivo',false]]) {
      const request = (await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,requested_by)
        VALUES ($1,$2,$3,$4) RETURNING id`, [clientId,asset.id,type,engineer.id])).rows[0];
      const id = randomUUID();
      const pdfPath = await pdf(`reporte-${id}-v4.pdf`, `${type.toUpperCase()} QA`, 410+index);
      await query(`INSERT INTO maintenance_reports(id,client_id,asset_id,request_id,type,created_by,summary,
        performed_on,area_responsible_required,acceptance_delegate_user_id,pdf_path)
        VALUES ($1,$2,$3,$4,$5,$6,'REPORTE QA',$7,true,$8,$9)`,
      [id,clientId,asset.id,request.id,type,engineer.id,`2026-03-0${index+1}`,users.almacenista.id,pdfPath]);
      const signers = [['ingeniero_biomedico',engineer.id]];
      if (accepted) signers.push(['almacenista',users.almacenista.id]);
      for (const [role,userId] of signers) await query(`INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name)
        VALUES ($1,$2,$3,'/uploads/qa.png','QA')`, [id,userId,role]);
      reports.push(id);
    }
    const historicalPath = await pdf('historico.pdf','HISTORICO QA',420);
    await query(`INSERT INTO "${schema}".asset_history_files(asset_id,title,document_type,document_date,file_path)
      VALUES ($1,'HISTORICO QA','maintenance_preventive','2025-12-03',$2)`,[asset.id,historicalPath]);
    const attachment = await pdf('manual.pdf','MANUAL QA',430);
    await query(`INSERT INTO "${schema}".asset_documents(asset_id,doc_type,file_path) VALUES ($1,'MANUAL',$2)`, [asset.id,attachment]);
    const history = await listAssetHistory(clientId,asset.id,{ order:'desc',limit:100 });
    assert.deepEqual(history.filter(row=>row.item_type==='maintenance_report').map(row=>row.id), [reports[1],reports[0]]);
    const probe = createServer(); await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
    const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
    api=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:String(port),ODONTOLOGY_REMINDERS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
    let logs='';api.stdout.on('data',value=>logs+=value);api.stderr.on('data',value=>logs+=value);
    const base=`http://127.0.0.1:${port}`;
    let ready=false;
    for(let n=0;n<100;n++){try{ready=(await fetch(`${base}/health`)).ok;}catch{}if(ready||api.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,logs);
    const endpoint=(id=asset.id,tenantId=clientId)=>`${base}/biomed/${tenantId}/assets/${id}/full-pdf`;
    await t.test('full PDF contains original reports, calibration, history and undated attachments',async()=>{
      const response=await fetch(endpoint(),{headers:engineer.headers});
      assert.equal(response.status,200,await response.clone().text());
      const bytes=Buffer.from(await response.arrayBuffer());
      const merged=await PDFDocument.load(bytes);
      const widths=merged.getPages().map(page=>page.getWidth());
      assert.deepEqual(widths.slice(-5),[401,411,410,420,430]);
      if(process.env.QA_ASSET_HISTORY_PDF)await fs.writeFile(process.env.QA_ASSET_HISTORY_PDF,bytes);
      assert.equal((await fetch(endpoint(),{headers:users.lector.headers})).status,200);
      assert.equal((await fetch(endpoint(outside.id),{headers:users.lector.headers})).status,403);
      assert.equal((await fetch(endpoint(asset.id,randomUUID()),{headers:engineer.headers})).status,403);
      assert.equal((await fetch(endpoint())).status,401);
    });
    await t.test('history pagination includes every attachment and missing files never disappear silently',async()=>{
      for(let n=0;n<101;n++){
        const filename=`page-${n}.pdf`;await fs.copyFile(`${root}/historico.pdf`,`${root}/${filename}`);
        await query(`INSERT INTO "${schema}".asset_history_files(asset_id,title,document_type,document_date,file_path)
          VALUES ($1,'MISMA FECHA','other','2025-01-01',$2)`,[asset.id,`/${root}/${filename}`]);
      }
      let response=await fetch(endpoint(),{headers:engineer.headers});assert.equal(response.status,200);
      const merged=await PDFDocument.load(await response.arrayBuffer());
      assert.equal(merged.getPages().filter(page=>page.getWidth()===420).length,102);
      await fs.unlink(`${root}/acta.pdf`);
      response=await fetch(endpoint(),{headers:engineer.headers});assert.equal(response.status,409);
      const error=await response.json();assert.equal(error.code,'ASSET_HISTORY_PDF_UNAVAILABLE');
      assert.match(error.message,/Certificado de calibración/);
    });
  } finally {
    if(api?.exitCode===null){api.kill('SIGTERM');await new Promise(resolve=>api.once('exit',resolve));}
    await query('DELETE FROM maintenance_reports WHERE client_id=$1',[clientId]);
    await query('DELETE FROM users WHERE client_id=$1',[clientId]);
    await query('DELETE FROM clients WHERE id=$1',[clientId]);
    assert.ok(schema.startsWith('cliente_qa_asset_history_'));await query(`DROP SCHEMA "${schema}" CASCADE`);
    await fs.rm(root,{recursive:true,force:true});await pool.end();
  }
});
