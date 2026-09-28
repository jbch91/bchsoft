import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import bcrypt from 'bcrypt';
import { pool, query } from './db.js';
import { createClient } from './clients.js';
import { authenticateUser } from './auth.js';

test('inventory lists both categories without expanding tenant or area access', {
  skip: process.env.RUN_INVENTORY_INTEGRATION !== '1'
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Local database only');
  const tag = `qa_inventory_${Date.now()}`;
  const { id: clientId, schema_name: schema } = await createClient({
    name: tag, nit: tag, city: 'QA', email: `${tag}@example.invalid`
  });
  let api;
  try {
    await query(`INSERT INTO client_software_access(client_id,suite_key,enabled,license_status)
      VALUES ($1,'biomedico',true,'active') ON CONFLICT(client_id,suite_key)
      DO UPDATE SET enabled=true,license_status='active'`, [clientId]);
    await query(`INSERT INTO client_modules(client_id,module_key,enabled)
      SELECT $1,key,true FROM modules WHERE suite_key='biomedico' ON CONFLICT DO NOTHING`, [clientId]);
    const areas = (await query(`INSERT INTO "${schema}".areas(name)
      VALUES ('AREA AUTORIZADA'),('OTRA AREA') RETURNING id`)).rows;
    const locations = (await query(`INSERT INTO "${schema}".locations(name,area_id)
      VALUES ('UBICACION AUTORIZADA',$1),('OTRA UBICACION',$1) RETURNING id`, [areas[0].id])).rows;
    const assets = [];
    for (const [index, category, areaId, locationId] of [
      [0, 'biomedical', areas[0].id, locations[0].id],
      [1, 'industrial', areas[0].id, locations[0].id],
      [2, 'industrial', areas[0].id, locations[1].id],
      [3, 'industrial', areas[1].id, null]
    ]) {
      assets.push((await query(`INSERT INTO "${schema}".assets(code,name,asset_category,area_id,location_id)
        VALUES ($1,'EQUIPO QA',$2,$3,$4) RETURNING id`, [`QA-${index}`, category, areaId, locationId])).rows[0].id);
    }
    const accounts = {};
    for (const role of ['ingeniero_biomedico', 'almacenista', 'responsable_area', 'lector']) {
      const password = randomUUID();
      const username = `${tag}_${role}`;
      const { rows: [user] } = await query(`INSERT INTO users(username,password_hash,client_id,display_name,email)
        VALUES ($1,$2,$3,'QA INVENTARIO',$1||'@example.invalid') RETURNING id`,
      [username, await bcrypt.hash(password, 4), clientId]);
      await query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2', [user.id, role]);
      const session = await authenticateUser(username, password);
      accounts[role] = { id: user.id, headers: { Authorization: `Bearer ${session.accessToken}` } };
    }
    await query('INSERT INTO reader_access(user_id,client_id,area_id) VALUES ($1,$2,$3)',
      [accounts.responsable_area.id, clientId, areas[0].id]);
    await query('INSERT INTO reader_access(user_id,client_id,location_id) VALUES ($1,$2,$3)',
      [accounts.lector.id, clientId, locations[0].id]);

    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    api = spawn(process.execPath, ['src/server.js'], {
      env: { ...process.env, PORT: String(port), ODONTOLOGY_REMINDERS_ENABLED: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let logs = '';
    api.stdout.on('data', (data) => logs += data);
    api.stderr.on('data', (data) => logs += data);
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try { ready = (await fetch(`${base}/health`)).ok; } catch {}
      if (ready || api.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, logs);
    const list = async (category, role = 'ingeniero_biomedico', tenantId = clientId) => {
      const suffix = category === undefined ? '' : `?category=${category}`;
      const response = await fetch(`${base}/biomed/${tenantId}/assets${suffix}`, { headers: accounts[role].headers });
      return { status: response.status, body: await response.json() };
    };
    await t.test('default biomedical remains separate; all includes industrial imports', async () => {
      for (const [category, expected] of [[undefined, [assets[0]]], ['biomedical', [assets[0]]],
        ['industrial', assets.slice(1)], ['all', assets]]) {
        const result = await list(category);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.deepEqual(result.body.map((asset) => asset.id).sort(), [...expected].sort());
      }
      assert.equal((await list('invalid')).status, 400);
      assert.equal((await list('all', 'almacenista')).body.length, 4);
    });
    await t.test('area and location restrictions apply to both categories', async () => {
      for (const [role, expected] of [['responsable_area', assets.slice(0, 3)], ['lector', assets.slice(0, 2)]]) {
        const result = await list('all', role);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.deepEqual(result.body.map((asset) => asset.id).sort(), [...expected].sort());
        const industrial = await list('industrial', role);
        assert.deepEqual(industrial.body.map((asset) => asset.id).sort(), expected.slice(1).sort());
        await query('DELETE FROM reader_access WHERE user_id=$1', [accounts[role].id]);
        assert.deepEqual((await list('all', role)).body, []);
      }
    });
    await t.test('no client crossover or anonymous access', async () => {
      for (const role of Object.keys(accounts)) assert.equal((await list('all', role, randomUUID())).status, 403);
      assert.equal((await fetch(`${base}/biomed/${clientId}/assets?category=all`)).status, 401);
    });
  } finally {
    if (api?.exitCode === null) {
      api.kill('SIGTERM');
      await new Promise((resolve) => api.once('exit', resolve));
    }
    await query('DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE client_id=$1)', [clientId]);
    await query('DELETE FROM users WHERE client_id=$1', [clientId]);
    await query('DELETE FROM clients WHERE id=$1', [clientId]);
    assert.ok(schema.startsWith('cliente_qa_inventory_'));
    await query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
