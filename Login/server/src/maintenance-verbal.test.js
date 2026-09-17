import assert from 'node:assert/strict';
import test from 'node:test';
import { createVerbalAttentionHandler, normalizeVerbalAttention, verbalAttentionAccessError } from './maintenance-verbal.js';

const options = { checks: ['revision_visual'], activities: ['limpieza_externa', 'instalacion_repuesto'], tests: ['encendido_apagado'] };
const input = () => ({
  submissionId: '00000000-0000-4000-8000-000000000001', assetId: '00000000-0000-4000-8000-000000000002',
  assetCategory: 'biomedical', performedOn: '2026-09-10', reporterName: '  Jefe   de prueba ', reporterRole: 'Enfermero',
  description: 'El equipo no enciende.', summary: 'Revision por aviso verbal.', findings: 'Cable deteriorado.', actionsTaken: 'Se reemplaza el cable.',
  maintenanceChecks: ['revision_visual'], maintenanceActivities: ['instalacion_repuesto'], maintenanceTests: ['encendido_apagado'],
  assetStatusAfter: 'operativo', assetStatusObservations: '', requiresSpareParts: true, sparePartsInstalledNow: true, sparePartsNeeded: 'Cable de alimentacion'
});
const engineer = { sub: 'engineer', clientId: 'client', roles: ['ingeniero_biomedico'], permissions: ['maintenance:report:create'] };

test('normalizes an installed spare, keeping service date separate and lists canonical', () => {
  const data = normalizeVerbalAttention({ ...input(), maintenanceChecks: ['revision_visual', 'revision_visual'] }, options, '2026-09-16');
  assert.equal(data.reporterName, 'Jefe de prueba');
  assert.equal(data.performedOn, '2026-09-10');
  assert.deepEqual(data.maintenanceChecks, ['revision_visual']);
  assert.equal(data.sparePartsInstalledNow, true);
  assert.equal(data.createdAt, undefined);
});

for (const [label, change] of [
  ['future date', { performedOn: '2026-09-17' }], ['invalid date', { performedOn: '2026-02-30' }],
  ['invalid equipment', { assetId: '../other' }], ['unknown category', { assetCategory: 'odontology' }],
  ['empty reporter', { reporterName: '' }], ['short fault', { description: 'falla' }],
  ['spoofed selection', { maintenanceChecks: ['inventado'] }], ['missing tests', { maintenanceTests: [] }],
  ['missing spare', { sparePartsNeeded: '' }], ['not installed', { maintenanceActivities: ['limpieza_externa'] }],
  ['inconsistent spare', { requiresSpareParts: false }], ['missing status observation', { assetStatusAfter: 'fuera_de_servicio' }],
  ['wrong report type', { type: 'preventivo' }], ['existing request', { requestId: 'request' }]
]) test(`rejects ${label}`, () => {
  assert.throws(() => normalizeVerbalAttention({ ...input(), ...change }, options, '2026-09-16'), { status: 400 });
});

test('out of service accepts no final tests, but requires an explanation', () => {
  const data = normalizeVerbalAttention({ ...input(), maintenanceTests: [], assetStatusAfter: 'fuera_de_servicio', assetStatusObservations: 'No supera las pruebas de encendido.' }, options, '2026-09-16');
  assert.deepEqual(data.maintenanceTests, []);
});

for (const roles of [['lector'], ['responsable_area'], ['almacenista'], ['superuser'], ['superuser', 'ingeniero_biomedico']]) {
  test(`rejects role ${roles.join(',')}`, () => assert.ok(verbalAttentionAccessError({ ...engineer, roles })));
}
test('requires both a tenant and reporting permission', () => {
  assert.ok(verbalAttentionAccessError({ ...engineer, clientId: null }));
  assert.ok(verbalAttentionAccessError({ ...engineer, permissions: [] }));
  assert.equal(verbalAttentionAccessError(engineer), '');
});

function setup() {
  const calls = [];
  const req = { user: { ...engineer }, body: input() };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const deps = {
    options, today: () => '2026-09-16', getEngineer: async () => ({ id: 'engineer', client_id: 'client', roles: ['ingeniero_biomedico'], signature_path: 'firma.png' }),
    signatureAvailable: () => true,
    save: async data => { calls.push(['save', data]); return { id: 'report', requestId: 'request', assetStatusApplied: true, replayed: false, emails: [] }; },
    signReport: async () => calls.push(['sign']), writePdf: async () => { calls.push(['pdf']); return 'report.pdf'; }, sendEmail: async () => {}
  };
  return { req, res, deps, calls, run: () => createVerbalAttentionHandler(deps)(req, res) };
}
test('creates a corrective, signs the engineer and returns a confirmed result', async () => {
  const s = setup(); await s.run();
  assert.equal(s.res.statusCode, 201);
  assert.equal(s.res.body.id, 'report');
  assert.deepEqual(s.calls.map(c => c[0]), ['save', 'sign', 'pdf']);
  assert.deepEqual(s.res.body.warnings, []);
});
for (const [name, change, status] of [
  ['cross tenant', s => { s.req.body.clientId = 'other'; }, 403],
  ['inactive or moved engineer', s => { s.deps.getEngineer = async () => null; }, 403],
  ['missing signature', s => { s.deps.signatureAvailable = () => false; }, 409],
  ['invalid date', s => { s.req.body.performedOn = '2028-01-01'; }, 400]
]) test(`never saves ${name}`, async () => {
  const s = setup(); change(s); await s.run(); assert.equal(s.res.statusCode, status); assert.equal(s.calls.length, 0);
});
test('a committed report remains confirmed if PDF generation fails', async t => {
  t.mock.method(console, 'error', () => {});
  const s = setup(); s.deps.writePdf = async () => { throw new Error('PDF unavailable'); };
  await s.run(); assert.equal(s.res.statusCode, 201); assert.deepEqual(s.res.body.warnings, ['pdf']);
});
test('email delivery does not block the form', async () => {
  const s = setup(); s.deps.save = async () => ({ id: 'report', requestId: 'request', replayed: false, emails: [{}] });
  s.deps.sendEmail = () => new Promise(() => {});
  await s.run(); assert.equal(s.res.statusCode, 201);
});
