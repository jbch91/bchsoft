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
import { reprogramCalibrationDraft } from './calibration.js';

test('calibration: draft, site isolation, approval and certificate workflow', {
  skip: process.env.RUN_CALIBRATION_INTEGRATION !== '1'
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tag = `qa_calibration_${Date.now()}`;
  const tenant = await createClient({ name: tag, nit: tag, city: 'QA', email: `${tag}@example.invalid` });
  const { id: clientId, schema_name: schema } = tenant;
  let api;
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
      for (const action of ['reprogram', 'approve']) {
        const response = await fetch(`${base}${url}/${action}`, { method: 'POST',
          headers: { Authorization: `Bearer ${uploaderSession.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate: '2026-09-24' }) });
        assert.equal(response.status, 403);
      }
    });
    await t.test('moving a day also moves the deadline, then saving all allows approval', async () => {
      const current = await items();
      const updates = current.map((item) => ({ id: item.id, plannedDate: item.planned_date.slice(0, 10) }));
      const selected = current.find((item) => item.site_id === sites[0].id);
      updates.find((item) => item.id === selected.id).plannedDate = '2026-09-24';
      const saved = await request(`${url}/items`, { items: updates }, 'PATCH');
      assert.equal(saved.status, 200, JSON.stringify(saved));
      const moved = (await items()).find((item) => item.id === selected.id);
      assert.equal(moved.deadline_date.slice(0, 10), '2026-10-24');
      assert.ok((await items()).every((item) => item.programming_confirmed));
      assert.equal((await request(`${url}/approve`, {})).status, 200);
      assert.equal((await request(`${url}/reprogram`, { startDate: '2026-09-24' })).status, 400);
      assert.equal((await request(`${url}/items`, { items: updates }, 'PATCH')).status, 403);
      const pdf = await fetch(base + url + '/pdf', { headers });
      assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /pdf/);
      const bytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      if (process.env.QA_CALIBRATION_PDF) await fs.writeFile(process.env.QA_CALIBRATION_PDF, bytes);
    });
    await t.test('approved schedule accepts evidence and prevents duplicate upload', async () => {
      const item = (await items()).find((row) => row.planned_date.startsWith('2026-03'));
      const doc = new PDFDocument(); const chunks = []; doc.on('data', (chunk) => chunks.push(chunk));
      doc.text('CERTIFICADO DE PRUEBA QA'); doc.end(); await new Promise((r) => doc.on('end', r));
      const upload = () => { const form = new FormData(); form.append('pdf', new Blob(chunks, { type: 'application/pdf' }), 'qa.pdf');
        return fetch(`${base}/calibration/items/${item.id}/upload`, { method: 'POST', headers, body: form }); };
      const first = await upload(); assert.equal(first.status, 200, await first.text());
      const second = await upload(); assert.equal(second.status, 409, await second.text());
      const done = (await items()).find((row) => row.id === item.id);
      assert.equal(done.status, 'done'); assert.ok(done.pdf_path);
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
