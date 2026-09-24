import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs/promises';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { pool, query } from './db.js';
import { createClient } from './clients.js';
import { authenticateUser } from './auth.js';
import { reprogramCalibrationDraft, deleteCalibrationSchedule } from './calibration.js';

test('calibration: draft, site isolation, approval and certificate workflow', {
  skip: process.env.RUN_CALIBRATION_INTEGRATION !== '1'
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tag = `qa_calibration_${Date.now()}`;
  const tenant = await createClient({ name: tag, nit: tag, city: 'QA', email: `${tag}@example.invalid` });
  const { id: clientId, schema_name: schema } = tenant;
  let api;
  let uploaderHeaders;
  let engineerHeaders;
  try {
    const password = randomUUID();
    const { rows: [user] } = await query(`INSERT INTO users(username,password_hash,client_id,display_name,email)
      VALUES ($1,$2,$3,'INGENIERO QA',$1||'@example.invalid') RETURNING id`, [tag, await bcrypt.hash(password, 4), clientId]);
    await query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name IN ('ingeniero_biomedico','calibracion')", [user.id]);
    await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
      VALUES ($1,'biomedico',true,'active') ON CONFLICT(client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`, [clientId]);
    await query(`INSERT INTO client_modules(client_id,module_key,enabled) SELECT $1,key,true FROM modules
      WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`, [clientId]);
    const sites = (await query(`INSERT INTO "${schema}".sites(name) VALUES ('PRINCIPAL QA'),('RURAL QA') RETURNING id,name`)).rows;
    for (let n = 0; n < 3; n++) {
      await query(`INSERT INTO "${schema}".assets(code,name,brand,model,serial,site_id,requires_calibration,calibration_frequency)
        VALUES ($1,'MONITOR QA','MARCA QA','MODELO QA','SERIE QA',$2,true,'anual')`, [`CAL-${n}`, sites[n % 2].id]);
    }
    const session = await authenticateUser(tag, password);
    const probe = createServer(); await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
    api = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT: String(port), SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '9', SMTP_USER: 'qa', SMTP_PASS: 'qa', ODONTOLOGY_REMINDERS_ENABLED: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; api.stdout.on('data', (data) => logs += data); api.stderr.on('data', (data) => logs += data);
    const base = `http://127.0.0.1:${port}`;
    for (let n = 0; n < 100; n++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
    assert.equal(api.exitCode, null, logs);
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const doc = new PDFDocument(); const chunks = []; doc.on('data', (chunk) => chunks.push(chunk));
    doc.text('ACTA DE CALIBRACION QA'); doc.end(); await new Promise((r) => doc.on('end', r));
    const upload = (itemId, auth = uploaderHeaders) => {
      const form = new FormData(); form.append('pdf', new Blob(chunks, { type: 'application/pdf' }), 'qa.pdf');
      return fetch(`${base}/calibration/items/${itemId}/upload`, { method: 'POST', headers: auth, body: form });
    };
    const request = async (url, body, method = 'POST', token = true) => {
      const response = await fetch(base + url, { method, headers: { ...(token ? headers : {}), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const generated = await request(`/calibration/schedules/${clientId}/generate`, { year: 2026, startDate: '2026-09-01' });
    assert.equal(generated.status, 201, JSON.stringify(generated));
    const scheduleId = generated.body.id, url = `/calibration/schedules/${scheduleId}`;
    const items = async () => (await request(`${url}/items`, undefined, 'GET')).body;

    await t.test('requires saving before approval and blocks draft evidence', async () => {
      assert.equal((await request(`${url}/approve`, {})).status, 409);
      const doc = new PDFDocument(); const chunks = []; doc.on('data', (chunk) => chunks.push(chunk));
      doc.text('CERTIFICADO DE PRUEBA QA'); doc.end(); await new Promise((r) => doc.on('end', r));
      const form = new FormData(); form.append('pdf', new Blob(chunks, { type: 'application/pdf' }), 'qa.pdf');
      const response = await fetch(`${base}/calibration/items/${(await items())[0].id}/upload`, { method: 'POST', headers, body: form });
      assert.equal(response.status, 409, await response.text());
    });
    await t.test('site planning changes only that site and preserves equipment frequency', async () => {
      const before = (await items()).filter((item) => item.site_id === sites[0].id);
      const result = await request(`${url}/reprogram`, { siteId: sites[1].id, startDate: '2026-09-24', frequency: 'semestral' });
      assert.equal(result.status, 200, JSON.stringify(result));
      const after = await items();
      assert.deepEqual(after.filter((item) => item.site_id === sites[0].id), before);
      const rural = after.filter((item) => item.site_id === sites[1].id);
      assert.equal(rural.length, 2);
      assert.deepEqual(rural.map((item) => item.planned_date.slice(0, 10)), ['2026-03-24', '2026-09-24']);
      assert.equal(rural[1].deadline_date.slice(0, 10), '2026-10-24');
      assert.ok(rural.every((item) => !item.programming_confirmed));
      assert.deepEqual((await query(`SELECT DISTINCT calibration_frequency FROM "${schema}".assets`)).rows, [{ calibration_frequency: 'anual' }]);
    });
    await t.test('invalid dates, frequency, site and tenant cannot mutate the draft', async () => {
      const before = await items();
      for (const payload of [{ startDate: '2027-09-24' }, { startDate: '2026-09-31' },
        { startDate: '2026-09-24', frequency: 'diaria' }, { startDate: '2026-09-24', siteId: randomUUID() }]) {
        assert.equal((await request(`${url}/reprogram`, payload)).status, 400);
      }
      assert.equal((await request(`${url}/reprogram`, { startDate: '2026-09-24' }, 'POST', false)).status, 401);
      await assert.rejects(reprogramCalibrationDraft({ scheduleId, clientId: randomUUID(), startDate: '2026-09-24' }));
      assert.deepEqual(await items(), before);
    });
    await t.test('a calibration uploader cannot reprogram or approve without manage permission', async () => {
      const uploaderName = `${tag}_uploader`;
      const { rows: [uploader] } = await query(`INSERT INTO users(username,password_hash,client_id,email,display_name)
        VALUES ($1,$2,$3,$1||'@example.invalid','CALIBRADOR QA') RETURNING id`, [uploaderName, await bcrypt.hash(password, 4), clientId]);
      await query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='calibracion'", [uploader.id]);
      const uploaderSession = await authenticateUser(uploaderName, password);
      uploaderHeaders = { Authorization: `Bearer ${uploaderSession.accessToken}` };
      for (const action of ['reprogram', 'approve']) {
        const response = await fetch(`${base}${url}/${action}`, { method: 'POST',
          headers: { Authorization: `Bearer ${uploaderSession.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: '2026-09-24' }) });
        assert.equal(response.status, 403);
      }
      assert.equal((await fetch(`${base}${url}`, { method: 'DELETE', headers: uploaderHeaders })).status, 403);
      const engineerName = `${tag}_engineer`;
      const { rows: [engineer] } = await query(`INSERT INTO users(username,password_hash,client_id,email,display_name)
        VALUES ($1,$2,$3,$1||'@example.invalid','BIOMEDICO QA') RETURNING id`, [engineerName, await bcrypt.hash(password, 4), clientId]);
      await query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='ingeniero_biomedico'", [engineer.id]);
      const engineerSession = await authenticateUser(engineerName, password);
      engineerHeaders = { Authorization: `Bearer ${engineerSession.accessToken}` };
      assert.equal((await upload((await items())[0].id, engineerHeaders)).status, 403);
    });
    await t.test('contractual deadlines persist, then saving all allows approval', async () => {
      const current = await items();
      const updates = current.map((item) => ({ id: item.id, plannedDate: item.planned_date.slice(0, 10) }));
      const selected = current.find((item) => item.site_id === sites[0].id);
      updates.find((item) => item.id === selected.id).plannedDate = '2026-09-24';
      updates.find((item) => item.id === selected.id).deadlineDate = '2026-11-07';
      assert.equal((await request(`${url}/items`, { items: [{ id: selected.id, plannedDate: '2026-09-24', deadlineDate: '2026-09-23' }] }, 'PATCH')).status, 400);
      const saved = await request(`${url}/items`, { items: updates }, 'PATCH');
      assert.equal(saved.status, 200, JSON.stringify(saved));
      const moved = (await items()).find((item) => item.id === selected.id);
      assert.equal(moved.deadline_date.slice(0, 10), '2026-11-07');
      assert.ok((await items()).every((item) => item.programming_confirmed));
      assert.equal((await request(`${url}/approve`, {})).status, 200);
      assert.equal((await request(`${url}/reprogram`, { startDate: '2026-09-24' })).status, 400);
      assert.equal((await request(`${url}/items`, { items: updates }, 'PATCH')).status, 403);
      assert.equal((await request(url, undefined, 'DELETE')).status, 400);
      const pdf = await fetch(base + url + '/pdf', { headers });
      assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /pdf/);
      const bytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      if (process.env.QA_CALIBRATION_PDF) await fs.writeFile(process.env.QA_CALIBRATION_PDF, bytes);
    });
    await t.test('approved schedule accepts evidence and prevents duplicate upload', async () => {
      const item = (await items()).find((row) => row.planned_date.startsWith('2026-03'));
      const responses = await Promise.all([upload(item.id), upload(item.id)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const done = (await items()).find((row) => row.id === item.id);
      assert.equal(done.status, 'done'); assert.ok(done.pdf_path);
      const files = await fs.readdir(`uploads/clients/${clientId}/calibrations`);
      assert.equal(files.filter((name) => name.startsWith(`calibracion-${item.id}-`)).length, 1);
      for (const auth of [engineerHeaders, uploaderHeaders]) {
        const response = await fetch(`${base}/calibration/schedules/${clientId}?year=2026`, { headers: auth });
        assert.equal(response.status, 200);
        const [schedule] = await response.json(); assert.equal(schedule.completed_items, 1); assert.equal(schedule.total_items, 4);
        assert.equal((await fetch(`${base}/calibration/items/${item.id}/pdf`, { headers: auth })).status, 200);
      }
    });
    await t.test('concurrent remaining uploads reach 100 percent and close the schedule', async () => {
      const pending = (await items()).filter((item) => !item.pdf_path);
      const responses = await Promise.all(pending.map((item) => upload(item.id)));
      assert.ok(responses.every((response) => response.status === 200));
      const [schedule] = (await request(`/calibration/schedules/${clientId}?year=2026`, undefined, 'GET')).body;
      assert.equal(schedule.status, 'closed'); assert.equal(schedule.completed_items, schedule.total_items);
      assert.equal((await request(url, undefined, 'DELETE')).status, 400);
    });
    await t.test('draft deletion is tenant scoped, authorized and does not delete equipment', async () => {
      const result = await request(`/calibration/schedules/${clientId}/generate`, { year: 2025, startDate: '2025-09-02' });
      assert.equal(result.status, 201, JSON.stringify(result));
      const id = result.body.id;
      await assert.rejects(deleteCalibrationSchedule(id, randomUUID()));
      const response = await fetch(`${base}/calibration/schedules/${id}`, { method: 'DELETE', headers: engineerHeaders });
      assert.equal(response.status, 200, await response.text());
      assert.equal((await query('SELECT id FROM calibration_schedule_items WHERE schedule_id = $1', [id])).rowCount, 0);
      assert.equal((await query(`SELECT id FROM "${schema}".assets`)).rowCount, 3);
    });
    await t.test('approval enables future contractual evidence for the calibration role', async () => {
      const year = new Date().getUTCFullYear() + 1;
      const result = await request(`/calibration/schedules/${clientId}/generate`, { year, startDate: `${year}-09-01` });
      assert.equal(result.status, 201, JSON.stringify(result));
      const futureUrl = `/calibration/schedules/${result.body.id}`;
      const futureItems = (await request(`${futureUrl}/items`, undefined, 'GET')).body;
      const updates = futureItems.map((item) => ({ id: item.id, plannedDate: item.planned_date.slice(0, 10), deadlineDate: item.deadline_date.slice(0, 10) }));
      assert.equal((await request(`${futureUrl}/items`, { items: updates }, 'PATCH')).status, 200);
      assert.equal((await request(`${futureUrl}/approve`, {})).status, 200);
      const response = await upload(futureItems[0].id);
      assert.equal(response.status, 200, await response.text());
    });
  } finally {
    if (api?.exitCode === null) { api.kill('SIGTERM'); await new Promise((r) => api.once('exit', r)); }
    await query('DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE client_id=$1)', [clientId]);
    await query('DELETE FROM users WHERE client_id=$1', [clientId]);
    await query('DELETE FROM clients WHERE id=$1', [clientId]);
    assert.ok(schema.startsWith('cliente_qa_calibration_')); await query(`DROP SCHEMA "${schema}" CASCADE`);
    await fs.rm(`uploads/clients/${clientId}`, { recursive: true, force: true });
    await pool.end();
  }
});
