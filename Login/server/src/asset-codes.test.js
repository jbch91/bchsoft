import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assetCodePlan, hospitalCodePrefix, normalizeAssetCode, getAssetCodeSuggestion, withAssetCode } from './asset-codes.js';
import { query, pool } from './db.js';

after(() => pool.end());

test('hospital initials omit legal forms and respect accented names', () => {
  assert.equal(hospitalCodePrefix('E.S.E. Hospital San Antonio de Timaná'), 'HSAT-');
  assert.equal(hospitalCodePrefix('ESE CENTRO DE SALUD SAN JUAN DE DIOS'), 'CSSJD-');
  assert.equal(hospitalCodePrefix(''), 'EQ-');
});

test('continues the dominant existing hospital series without changing old codes', () => {
  const codes = ['ESJD132', 'esjd009', 'ESJD131', 'QA-9999'];
  assert.equal(assetCodePlan('Hospital', codes).suggestion, 'ESJD133');
  assert.equal(codes[1], 'esjd009');
  assert.equal(assetCodePlan('Hospital', ['H-0099']).suggestion, 'H-0100');
  assert.equal(assetCodePlan('Hospital', ['H-999']).suggestion, 'H-1000');
});

test('new hospitals get a readable prefix and padded sequential number', () => {
  assert.equal(assetCodePlan('Hospital San Antonio', []).suggestion, 'HSA-0001');
});

test('persisted sequence survives removed assets and preserves its prefix', () => {
  const sequence = { prefix: 'ESJD', number_width: 3, last_number: '150' };
  assert.equal(assetCodePlan('Hospital renamed', ['ESJD132', 'QA-100000'], sequence).suggestion, 'ESJD151');
  assert.equal(assetCodePlan('Hospital renamed', [], sequence).suggestion, 'ESJD151');
  assert.equal(assetCodePlan('Hospital', ['ESJD200'], sequence).suggestion, 'ESJD201');
});

test('normalizes manual codes and rejects invalid values', () => {
  assert.equal(normalizeAssetCode(' esjd132 '), 'ESJD132');
  for (const value of ['', ' ', 'A'.repeat(81), 'A\u0000B']) {
    assert.throws(() => normalizeAssetCode(value), { code: 'ASSET_CODE_INVALID', status: 400 });
  }
});

test('exhausted auto series still allows manual code validation', () => {
  assert.equal(assetCodePlan('Hospital', ['H-999999999999999999']).suggestion, null);
});

test('local database: atomic allocation, duplicate protection, tenant isolation and rollback', {
  skip: process.env.ASSET_CODE_DB_TESTS !== '1'
}, async () => {
  assert(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Only a local database is allowed');
  const clients = [];
  try {
    for (let i = 0; i < 2; i += 1) {
      const id = randomUUID();
      const schema = `qa_codes_${id.replaceAll('-', '')}`;
      await query(`INSERT INTO clients(id,name,nit,city,email,schema_name) VALUES($1,$2,$3,$4,$5,$6)`,
        [id, 'Hospital QA', id, 'QA', 'qa@example.test', schema]);
      clients.push({ id, schema });
      await query(`CREATE SCHEMA "${schema}"`);
      await query(`CREATE TABLE "${schema}".assets (id UUID PRIMARY KEY, code TEXT NOT NULL,
        asset_category TEXT DEFAULT 'biomedical', status TEXT DEFAULT 'activo')`);
    }
    const [a, b] = clients;
    const insert = (tenant, options) => withAssetCode(tenant.id, options, async (db, code) => {
      const { rows } = await db.query(`INSERT INTO "${tenant.schema}".assets(id,code) VALUES($1,$2) RETURNING id`, [randomUUID(), code]);
      return rows[0];
    });
    const first = await insert(a, { code: 'esjd132' });
    assert.equal(first.code, 'ESJD132');
    assert.equal((await getAssetCodeSuggestion(a.id)).suggestion, 'ESJD133');
    await query(`UPDATE "${a.schema}".assets SET asset_category='industrial', status='inactivo' WHERE id=$1`, [first.id]);
    assert.equal((await getAssetCodeSuggestion(a.id, { code: ' esjd132 ' })).available, false);
    assert.equal((await getAssetCodeSuggestion(a.id, { code: 'ESJD132', assetId: first.id })).available, true);
    await assert.rejects(insert(a, { code: 'Esjd132' }), { code: 'ASSET_CODE_EXISTS', status: 409 });
    assert.equal((await insert(b, { code: 'ESJD132' })).code, 'ESJD132');
    const simultaneous = await Promise.all(Array.from({ length: 6 }, () => insert(a, { automatic: true, code: 'ESJD133' })));
    assert.deepEqual(simultaneous.map(row => row.code).sort(), ['ESJD133', 'ESJD134', 'ESJD135', 'ESJD136', 'ESJD137', 'ESJD138']);
    assert.equal(simultaneous.filter(row => row.codeAdjusted).length, 5);
    await query(`DELETE FROM "${a.schema}".assets WHERE code='ESJD138'`);
    assert.equal((await getAssetCodeSuggestion(a.id)).suggestion, 'ESJD139');
    await assert.rejects(withAssetCode(a.id, { automatic: true }, async (db, code) => {
      await db.query(`INSERT INTO "${a.schema}".assets(id,code) VALUES($1,$2)`, [randomUUID(), code]);
      throw new Error('Rollback test');
    }), /Rollback test/);
    assert.equal((await getAssetCodeSuggestion(a.id)).suggestion, 'ESJD139');
    await assert.rejects(withAssetCode(a.id, { code: 'ESJD132', assetId: simultaneous[0].id }, () => {}), { code: 'ASSET_CODE_EXISTS' });
    await assert.rejects(getAssetCodeSuggestion(b.id, { code: first.code, assetId: first.id }), { status: 404 });
    // Legacy duplicates do not block unrelated edits, but cannot be assigned to another asset.
    await query(`INSERT INTO "${a.schema}".assets(id,code) VALUES($1,$2)`, [randomUUID(), ' esjd132 ']);
    const unchanged = await withAssetCode(a.id, { code: 'ESJD132', assetId: first.id }, () => ({ ok: true }));
    assert.equal(unchanged.ok, true);
  } finally {
    for (const { id, schema } of clients) {
      await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await query('DELETE FROM clients WHERE id=$1', [id]);
    }
  }
});
