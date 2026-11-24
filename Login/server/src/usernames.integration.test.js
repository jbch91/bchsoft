import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { pool, query } from './db.js';
import { createClient } from './clients.js';
import { createUser } from './admin.js';
import { authenticateUser } from './auth.js';

test('hospital usernames: creation, availability, tenant scope, races and existing accounts', {
  skip: process.env.RUN_USERNAME_INTEGRATION !== '1'
}, async () => {
  assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tag = `qa_username_${Date.now()}`;
  const password = randomUUID();
  const tenants = [];
  let api;
  try {
    for (const [label, city] of [['SAN ANTONIO', 'Timaná'], ['SAN JUAN', 'El Pital']]) {
      const tenant = await createClient({ name: `QA ${label} ${tag}`, nit: `${tag}_${tenants.length}`, city, email: `${tag}_${tenants.length}@example.invalid` });
      tenants.push(tenant);
      await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
        VALUES ($1,'biomedico',true,'active') ON CONFLICT(client_id,suite_key) DO UPDATE SET enabled=true,license_status='active'`, [tenant.id]);
      await query(`INSERT INTO client_modules(client_id,module_key,enabled) SELECT $1,key,true FROM modules
        WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`, [tenant.id]);
    }
    const admins = [];
    for (let n=0; n<2; n++) {
      const admin = await createUser({ username: `${tag}_admin${n}`, displayName: 'ADMIN QA', email: `${tag}_admin${n}@example.invalid`, password, role: 'client_admin', clientId: tenants[n].id });
      admins.push({ ...admin, session: await authenticateUser(admin.username, password) });
    }
    const oldIds = admins.map(admin => admin.id);
    const oldRows = (await query('SELECT id,username,password_hash,client_id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id', [oldIds])).rows;
    const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    api = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT: String(port), SMTP_HOST: '127.0.0.1', SMTP_PORT: '9',
      SMTP_USER: 'qa', SMTP_PASS: 'qa', SMTP_SECURE: 'false', ODONTOLOGY_REMINDERS_ENABLED: 'false' }, stdio: ['ignore','pipe','pipe'] });
    let logs = ''; api.stdout.on('data', value => logs += value); api.stderr.on('data', value => logs += value);
    const base = `http://127.0.0.1:${port}`;
    for (let n=0; n<100; n++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(api.exitCode, null, logs);
    const request = async (url, n=0, body) => {
      const response = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${admins[n].session.accessToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, body: await response.json() };
    };
    const previewUrl = '/admin/users/username-preview?role=calibracion&base=fisioterapia';
    assert.equal((await fetch(base + previewUrl)).status, 401);
    const first = await request(previewUrl, 0), second = await request(previewUrl, 1);
    assert.equal(first.status, 200); assert.equal(second.status, 200);
    assert.notEqual(first.body.username, second.body.username);
    assert.deepEqual(Object.keys(first.body).sort(), ['available','username']);
    assert.equal((await request(`${previewUrl}&clientId=${tenants[1].id}`)).status, 403);
    assert.equal((await request('/admin/users/username-preview?role=superuser&base=qa')).status, 403);
    const make = (username, n) => ({ username, displayName: 'FISIOTERAPIA QA', email: `${tag}_user${n}@example.invalid`, role: 'calibracion',
      clientId: tenants[n].id, documentType: 'cedula_ciudadania', documentNumber: `1000${n}` });
    for (let n=0; n<2; n++) {
      const username = [first,second][n].body.username;
      const result = await request('/admin/users', n, make(username,n));
      assert.equal(result.status, 201, JSON.stringify(result));
      assert.equal(result.body.username, username);
      assert.equal((await query('SELECT client_id FROM users WHERE id=$1', [result.body.id])).rows[0].client_id, tenants[n].id);
    }
    assert.equal((await request(`/admin/users/username-preview?role=calibracion&username=${encodeURIComponent(first.body.username.toUpperCase())}`)).body.available, false);
    const next = await request(previewUrl);
    assert.equal(next.body.username, `${first.body.username}.2`);
    const manual = await request('/admin/users', 0, { ...make(`${tag}.manual`,0), email: `${tag}_manual@example.invalid` });
    assert.equal(manual.status, 201, JSON.stringify(manual));
    assert.equal(manual.body.username, `${tag}.manual`);
    const raceName = `${tag}.race`;
    const races = await Promise.all([raceName,raceName.toUpperCase()].map((username,n) => createUser({ username, displayName: 'RACE QA',
      email: `${tag}_race${n}@example.invalid`, password, role: 'calibracion', clientId: tenants[n].id })));
    assert.equal(races.filter(result => result.id).length, 1);
    assert.equal(races.filter(result => result.error === 'DUPLICATE' && result.fields.includes('username')).length, 1);
    const winner = await authenticateUser(raceName.toUpperCase(), password);
    assert.ok(winner?.user?.clientId);
    assert.equal((await request(previewUrl)).status, 200);
    assert.deepEqual((await query('SELECT id,username,password_hash,client_id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id', [oldIds])).rows, oldRows);
    for (const admin of admins) assert.equal((await authenticateUser(admin.username,password)).user.sub, admin.id);
  } finally {
    if (api?.exitCode === null) { api.kill('SIGTERM'); await new Promise(resolve => api.once('exit', resolve)); }
    for (const tenant of tenants) {
      await query("DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE client_id=$1) OR details->>'clientId'=$1::text", [tenant.id]);
      await query('DELETE FROM users WHERE client_id=$1', [tenant.id]);
      await query('DELETE FROM clients WHERE id=$1', [tenant.id]);
      assert.ok(tenant.schema_name.startsWith('cliente_qa_'));
      await query(`DROP SCHEMA "${tenant.schema_name}" CASCADE`);
    }
    await pool.end();
  }
});
