import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import bcrypt from 'bcrypt';
import { query, pool } from './db.js';
import { createClient } from './clients.js';
import { openLateMaintenancePeriod } from './late-maintenance-execution.js';
import { listActiveMaintenanceOpenings } from './maintenance-open-periods.js';
import { syncAssetsIntoMaintenanceSchedules, syncNewAssetsInOpenMaintenancePeriods } from './schedules.js';
import { getPreventiveMaintenanceProgress } from './maintenance.js';
import { authenticateUser } from './auth.js';

test('integration: new assets inherit only authorized maintenance periods', {
  skip: process.env.RUN_SCHEDULE_INTEGRATION !== '1'
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tenants = [];
  const tag = `qa_open_${Date.now()}`;
  const today = '2026-09-21';
  try {
    async function fixture(suffix) {
      const tenant = await createClient({ name: `${tag}_${suffix}`, nit: `${tag}_${suffix}`, city: 'QA',
        email: `${tag}_${suffix}@example.invalid` });
      tenants.push(tenant);
      const { id: clientId, schema_name: schema } = tenant;
      const user = (await query(
        `INSERT INTO users(username, password_hash, client_id, display_name, email)
         VALUES ($1, 'unusable-test-password', $2, 'QA INGENIERO', $1 || '@example.invalid') RETURNING id`,
        [`${tag}_${suffix}`, clientId]
      )).rows[0].id;
      await query(`INSERT INTO user_roles(user_id,role_id)
                   SELECT $1,id FROM roles WHERE name='ingeniero_biomedico'`, [user]);
      const area = (await query(`INSERT INTO "${schema}".areas(name) VALUES ('CONSULTA EXTERNA') RETURNING id`)).rows[0].id;
      const location = (await query(`INSERT INTO "${schema}".locations(area_id,name) VALUES ($1,'PEDIATRIA') RETURNING id`, [area])).rows[0].id;
      const schedule = (await query(
        `INSERT INTO maintenance_schedules(client_id,year,start_date,status,created_by,created_at)
         VALUES ($1,2026,'2026-02-16','approved',$2,'2026-08-01') RETURNING id`, [clientId, user]
      )).rows[0].id;
      const permission = (await query(
        `INSERT INTO user_temporary_permissions(user_id,permission_id,expires_at,granted_by,reason)
         SELECT $1,id,NOW()+INTERVAL '2 days',$1,'QA apertura excepcional autorizada'
         FROM permissions WHERE name='maintenance:preventive:late_execution' RETURNING id,expires_at`, [user]
      )).rows[0];
      async function asset(overrides = {}) {
        const value = { acquisition: '2024-10-05', warranty: 1, frequency: 'trimestral',
          category: 'biomedical', status: 'activo', area, location, ...overrides };
        return (await query(
          `INSERT INTO "${schema}".assets(code,name,maintenance_frequency,area_id,location_id,
             acquisition_date,warranty_years,asset_category,status)
           VALUES ($1,'EQUIPO QA',$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [randomUUID(),value.frequency,value.area,value.location,value.acquisition,value.warranty,value.category,value.status]
        )).rows[0].id;
      }
      async function item(assetId, date, status = 'expired', extra = {}) {
        return (await query(
          `INSERT INTO maintenance_schedule_items(schedule_id,asset_id,frequency,planned_date,deadline_date,
             status,programming_confirmed,historical_resolution,warranty_resolution,non_execution_reason)
           VALUES ($1,$2,'trimestral',$3,(date_trunc('month',$3::date)+INTERVAL '1 month - 1 day')::date,
             $4,true,$5,$6,$7) RETURNING id`,
          [schedule,assetId,date,status,extra.historicalResolution || null,extra.warrantyResolution || null,
            extra.historicalResolution === 'not_performed' ? 'QA mantenimiento no realizado y documentado' : null]
        )).rows[0].id;
      }
      const reference = await asset();
      await query(`UPDATE "${schema}".assets SET created_at='2026-01-01' WHERE id=$1`, [reference]);
      const anchor = await item(reference, '2026-08-19');
      await item(reference, '2026-11-18', 'pending');
      const sync = (ids, options = {}) => syncAssetsIntoMaintenanceSchedules({ clientId, schema, assetIds: ids,
        today, actorUserId: user, ...options });
      const items = async (assetId) => (await query(
        `SELECT *,to_char(planned_date,'YYYY-MM-DD') AS date FROM maintenance_schedule_items
         WHERE schedule_id=$1 AND asset_id=$2 ORDER BY planned_date`, [schedule,assetId]
      )).rows;
      const open = () => openLateMaintenancePeriod({ clientId,actorUserId:user,actorUsername:`${tag}_${suffix}`,
        temporaryPermissionId:permission.id,permissionExpiresAt:permission.expires_at,
        year:2026,month:8,reason:'QA apertura de agosto autorizada',assetCategory:'biomedical' });
      return { clientId,schema,user,area,location,schedule,permission,asset,item,anchor,reference,sync,items,open };
    }
    const f = await fixture('principal');
    let registeredBeforeOpening;
    await t.test('grant without opening does not backdate new equipment', async () => {
      registeredBeforeOpening = await f.asset();
      await f.sync([registeredBeforeOpening]);
      assert.deepEqual((await f.items(registeredBeforeOpening)).map((i) => i.date), ['2026-11-18']);
      assert.equal((await listActiveMaintenanceOpenings(f.clientId)).length, 0);
    });
    await f.open();
    await t.test('retroactive recovery includes previously imported assets, once only', async () => {
      const result = await syncNewAssetsInOpenMaintenancePeriods({ clientId:f.clientId,today });
      assert.equal(result.itemsAdded, 1);
      const rows = await f.items(registeredBeforeOpening);
      assert.deepEqual(rows.map((i) => i.date), ['2026-08-19','2026-11-18']);
      assert.equal(rows[0].status, 'active');
      assert.equal(rows[0].late_execution_temporary_permission_id, f.permission.id);
      assert.equal((await syncNewAssetsInOpenMaintenancePeriods({ clientId:f.clientId,today })).itemsAdded, 0);
    });
    await t.test('single creation and batch creation inherit dates and authorization', async () => {
      const ids = [await f.asset(),await f.asset({ acquisition:null,warranty:null })];
      const result = await f.sync(ids);
      assert.equal(result.itemsAdded,4);
      assert.equal(result.activeItemsAdded,2);
      assert.equal(result.requestsCreated,2);
      assert.deepEqual(result.historicalEvidenceRequired,[]);
      for (const id of ids) {
        const rows = await f.items(id);
        assert.deepEqual(rows.map((i) => i.date),['2026-08-19','2026-11-18']);
        assert.equal(rows[0].historical_resolution,null);
        assert.equal(rows[0].late_execution_authorized_until.toISOString(),f.permission.expires_at.toISOString());
      }
    });
    for (const [label, data, dates, active] of [
      ['warranty expires before August',{ acquisition:'2025-07-01',warranty:1 },['2026-08-19','2026-11-18'],1],
      ['warranty expires on reference day',{ acquisition:'2025-08-19',warranty:1 },['2026-08-19','2026-11-18'],1],
      ['warranty expires during open month',{ acquisition:'2025-08-24',warranty:1 },['2026-08-24','2026-11-18'],1],
      ['warranty expires on last day',{ acquisition:'2025-08-31',warranty:1 },['2026-08-31','2026-11-18'],1],
      ['warranty expires in September',{ acquisition:'2025-09-01',warranty:1 },['2026-11-18'],0],
      ['warranty valid through 2028',{ acquisition:'2025-08-14',warranty:3 },[],0],
      ['warranty without acquisition date stays protected',{ acquisition:null,warranty:1 },[],0],
      ['acquired after August without warranty',{ acquisition:'2026-09-02',warranty:null },['2026-11-18'],0],
      ['retired equipment excluded',{ status:'dado_de_baja' },[],0],
      ['industrial equipment excluded from biomedical schedule',{ category:'industrial' },[],0],
      ['monthly frequency adds only open and current or future months',{ frequency:'mensual' },['2026-08-19','2026-09-21','2026-10-19','2026-11-18','2026-12-18'],1]
    ]) await t.test(label, async () => {
      const id = await f.asset(data);
      const result = await f.sync([id]);
      assert.deepEqual((await f.items(id)).map((i) => i.date),dates);
      // September monthly equipment also has a normally active request.
      assert.equal((await f.items(id)).filter((i) => i.late_execution_authorized_at).length,active);
      if (data.warranty && !data.acquisition) assert.equal(result.assets[0].status,'warranty_data_required');
    });
    await t.test('location reference takes priority over area reference', async () => {
      const location = (await query(`INSERT INTO "${f.schema}".locations(area_id,name) VALUES ($1,'GINECOLOGIA') RETURNING id`, [f.area])).rows[0].id;
      const reference = await f.asset({location});
      await f.item(reference,'2026-08-27','done');
      const id = await f.asset({location});
      await f.sync([id]);
      assert.equal((await f.items(id))[0].date,'2026-08-27');
    });
    await t.test('existing omitted equipment retains other historical evidence requests', async () => {
      const id = await f.asset();
      const result = await f.sync([id],{enrollmentMode:'existing_omitted'});
      assert.equal((await f.items(id)).length,4);
      assert.deepEqual(result.historicalEvidenceRequired.map((i) => i.plannedDate.slice(5,7)),['02','05']);
      assert.equal((await f.items(id))[2].status,'active');
    });
    await t.test('historical pending evidence already created joins open period', async () => {
      const id = await f.asset();
      const item = await f.item(id,'2026-08-19','expired',{historicalResolution:'pending_evidence'});
      await f.sync([id]);
      const row = (await f.items(id)).find((i) => i.id===item);
      assert.equal(row.status,'active'); assert.equal(row.historical_resolution,null);
    });
    for (const [label,status,extra] of [
      ['completed','done',{}], ['warranty covered','warranty',{warrantyResolution:'covered'}],
      ['explicitly not performed','expired',{historicalResolution:'not_performed'}]
    ]) await t.test(`preserves ${label} without opening a request`, async () => {
      const id = await f.asset();
      const item = await f.item(id,'2026-08-19',status,extra);
      const before = (await f.items(id))[0];
      await f.sync([id]);
      assert.deepEqual((await f.items(id)).find((i) => i.id===item),before);
      assert.equal((await query('SELECT id FROM maintenance_requests WHERE schedule_item_id=$1',[item])).rows.length,0);
    });
    await t.test('report with inconsistent item status is preserved', async () => {
      const id=await f.asset(); const item=await f.item(id,'2026-08-19');
      const request=(await query(`INSERT INTO maintenance_requests(client_id,asset_id,type,status,source,schedule_id,schedule_item_id)
        VALUES ($1,$2,'preventivo','abierto','cronograma',$3,$4) RETURNING id`,[f.clientId,id,f.schedule,item])).rows[0].id;
      const report=(await query(`INSERT INTO maintenance_reports(client_id,asset_id,request_id,type,summary,created_by)
        VALUES ($1,$2,$3,'preventivo','QA REPORTE EXISTENTE',$4) RETURNING *`,[f.clientId,id,request,f.user])).rows[0];
      await f.sync([id]);
      assert.equal((await f.items(id))[0].status,'expired');
      assert.deepEqual((await query('SELECT * FROM maintenance_reports WHERE id=$1',[report.id])).rows[0],report);
    });
    await t.test('concurrent synchronization does not duplicate activities or requests', async () => {
      const id=await f.asset();
      await Promise.all([f.sync([id]),f.sync([id])]);
      assert.equal((await f.items(id)).length,2);
      assert.equal((await query('SELECT id FROM maintenance_requests WHERE client_id=$1 AND asset_id=$2',[f.clientId,id])).rows.length,1);
    });
    await t.test('progress places new asset in August, not September', async () => {
      const progress=await getPreventiveMaintenanceProgress(f.clientId,{year:2026,month:8,assetId:registeredBeforeOpening});
      const row=progress.items.find((i) => i.asset_id===registeredBeforeOpening && new Date(i.planned_date).getUTCMonth()===7);
      assert.ok(row.request_id); assert.equal(row.can_perform_protocol,true);
      assert.equal(row.late_execution_authorization_active,true);
      assert.equal(row.phase,'not_started');
    });
    await t.test('client isolation and schema mismatch', async () => {
      const other=await fixture('other');
      const id=await other.asset();
      await other.sync([id]);
      assert.deepEqual((await other.items(id)).map((i) => i.date),['2026-11-18']);
      assert.equal((await f.sync([id])).itemsAdded,0);
      await assert.rejects(f.sync([id],{schema:other.schema}),{code:'SCHEDULE_CLIENT_MISMATCH'});
    });
    await t.test('disabled owner cannot authorize new equipment', async () => {
      await query('UPDATE users SET is_active=false WHERE id=$1',[f.user]);
      const id=await f.asset(); await f.sync([id]);
      assert.equal((await f.items(id)).length,1);
      await query('UPDATE users SET is_active=true WHERE id=$1',[f.user]);
    });
    await t.test('expired permission does not reopen new or historical items', async () => {
      await query("UPDATE user_temporary_permissions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[f.permission.id]);
      const id=await f.asset(); await f.sync([id],{enrollmentMode:'existing_omitted'});
      assert.equal((await f.items(id))[2].status,'expired');
      assert.equal((await listActiveMaintenanceOpenings(f.clientId)).length,0);
    });
    await t.test('revoked permission cannot be inherited', async () => {
      await query('DELETE FROM user_temporary_permissions WHERE id=$1',[f.permission.id]);
      const id=await f.asset(); await f.sync([id]);
      assert.deepEqual((await f.items(id)).map((i) => i.date),['2026-11-18']);
    });
    await t.test('HTTP engineer flow: recovery, QR, claiming, expiry and tenant isolation', async () => {
      const http = await fixture('http');
      await http.open();
      const id = await http.asset();
      await http.item(id,'2026-11-18','pending');
      await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
        VALUES ($1,'biomedico',true,'active') ON CONFLICT (client_id,suite_key)
        DO UPDATE SET enabled=true,license_status='active'`, [http.clientId]);
      await query(`INSERT INTO client_modules(client_id,module_key,enabled)
        SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`,[http.clientId]);
      const password=randomUUID();
      await query('UPDATE users SET password_hash=$2 WHERE id=$1',[http.user,await bcrypt.hash(password,4)]);
      const session=await authenticateUser(`${tag}_http`,password);
      assert.deepEqual(session.user.roles,['ingeniero_biomedico']);
      const probe=createServer();
      await new Promise(resolve => probe.listen(0,'127.0.0.1',resolve));
      const port=probe.address().port;
      await new Promise(resolve => probe.close(resolve));
      const api=spawn(process.execPath,['src/server.js'],{
        env:{...process.env,PORT:String(port),SMTP_HOST:'127.0.0.1',SMTP_PORT:'9',SMTP_SECURE:'false',
          SMTP_USER:'qa',SMTP_PASS:'qa',ODONTOLOGY_REMINDERS_ENABLED:'false'},stdio:['ignore','pipe','pipe']
      });
      let logs='';
      api.stdout.on('data',chunk => { logs+=chunk; });
      api.stderr.on('data',chunk => { logs+=chunk; });
      const base=`http://127.0.0.1:${port}`;
      const call=async (path,method='GET') => {
        const response=await fetch(`${base}${path}`,{method,
          headers:{Authorization:`Bearer ${session.accessToken}`},signal:AbortSignal.timeout(10000)});
        return {status:response.status,data:await response.json()};
      };
      try {
        let ready=false;
        for(let i=0;i<100;i++) {
          assert.equal(api.exitCode,null,logs);
          try { ready=(await fetch(`${base}/health`)).ok; } catch {}
          if(ready) break;
          await new Promise(resolve => setTimeout(resolve,100));
        }
        assert.ok(ready,logs);
        const result=await call(`/maintenance/preventive-progress/${http.clientId}?year=2026&month=8`);
        assert.equal(result.status,200,JSON.stringify(result));
        const row=result.data.items.find(i => i.asset_id===id && String(i.planned_date).startsWith('2026-08'));
        assert.ok(row,JSON.stringify(result));
        assert.equal(row.can_perform_protocol,true); assert.ok(row.request_id);
        const denied=await call(`/maintenance/preventive-progress/${f.clientId}?year=2026&month=8`);
        assert.equal(denied.status,403);
        const qr=await call(`/maintenance/qr-context/${http.clientId}/${id}`);
        assert.equal(qr.status,200,JSON.stringify(qr));
        assert.ok(JSON.stringify(qr.data).includes(row.request_id));
        assert.equal((await call(`/maintenance/requests/${row.request_id}/assign`,'POST')).status,200);
        const pending=await http.asset(); await http.sync([pending]);
        await query("UPDATE user_temporary_permissions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[http.permission.id]);
        const expired=await call(`/maintenance/preventive-progress/${http.clientId}?year=2026&month=8`);
        assert.equal(expired.status,200,JSON.stringify(expired));
        const expiredItem=expired.data.items.find(i => i.asset_id===pending && String(i.planned_date).startsWith('2026-08'));
        assert.equal(expiredItem.can_perform_protocol,false);
        assert.equal(expiredItem.late_execution_authorization_active,false);
        assert.equal((await http.items(pending))[0].status,'expired');
        assert.equal((await call(`/maintenance/requests/${expiredItem.request_id}/assign`,'POST')).status,409);
      } finally {
        if(api.exitCode===null) {
          api.kill('SIGTERM');
          await new Promise(resolve => api.once('exit',resolve));
        }
      }
    });
    await t.test('December reopening still works across the year boundary', async () => {
      const prior=await fixture('prior_year');
      await query('DELETE FROM maintenance_schedule_items WHERE schedule_id=$1',[prior.schedule]);
      await query("UPDATE maintenance_schedules SET year=2025,start_date='2025-03-17' WHERE id=$1",[prior.schedule]);
      await prior.item(prior.reference,'2025-12-18');
      await openLateMaintenancePeriod({clientId:prior.clientId,actorUserId:prior.user,
        temporaryPermissionId:prior.permission.id,permissionExpiresAt:prior.permission.expires_at,
        year:2025,month:12,reason:'QA cierre excepcional de diciembre',assetCategory:'biomedical'});
      const id=await prior.asset();
      await prior.sync([id],{today:'2026-01-09'});
      const rows=await prior.items(id);
      assert.deepEqual(rows.map(i => i.date),['2025-12-18']);
      assert.equal(rows[0].status,'active');
    });
    await t.test('draft schedule, expired opening and mismatched permission are excluded', async () => {
      const isolated=await fixture('safety');
      await isolated.open();
      await query("UPDATE maintenance_schedules SET status='draft' WHERE id=$1",[isolated.schedule]);
      assert.equal((await listActiveMaintenanceOpenings(isolated.clientId)).length,0);
      await query("UPDATE maintenance_schedules SET status='approved' WHERE id=$1",[isolated.schedule]);
      await query("UPDATE maintenance_schedule_items SET late_execution_authorized_until=NOW()-INTERVAL '1 second' WHERE id=$1",[isolated.anchor]);
      assert.equal((await listActiveMaintenanceOpenings(isolated.clientId)).length,0);
      await query("UPDATE maintenance_schedule_items SET late_execution_authorized_until=NOW()+INTERVAL '1 day' WHERE id=$1",[isolated.anchor]);
      await query('UPDATE users SET client_id=$2 WHERE id=$1',[isolated.user,f.clientId]);
      assert.equal((await listActiveMaintenanceOpenings(isolated.clientId)).length,0);
      await query('UPDATE users SET client_id=$2 WHERE id=$1',[isolated.user,isolated.clientId]);
      assert.equal((await listActiveMaintenanceOpenings(isolated.clientId)).length,1);
    });
  } finally {
    for (const tenant of tenants.reverse()) {
      await query('DELETE FROM audit_logs WHERE target_user_id=$1 OR actor_user_id IN (SELECT id FROM users WHERE client_id=$1)',[tenant.id]);
      await query('DELETE FROM users WHERE client_id=$1',[tenant.id]);
      await query('DELETE FROM clients WHERE id=$1',[tenant.id]);
      assert.ok(tenant.schema_name.startsWith('cliente_qa_open_'));
      await query(`DROP SCHEMA "${tenant.schema_name}" CASCADE`);
    }
    await pool.end();
  }
});
