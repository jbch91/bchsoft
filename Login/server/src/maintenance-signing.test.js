import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaintenanceReportSignHandler } from './maintenance-signing.js';

function setup({ existing = false, spare = false } = {}) {
  const calls = [];
  const report = {
    id: 'report-1', client_id: 'client-1', asset_id: 'asset-1', request_id: 'request-1',
    created_by: 'engineer-1', area_responsible_required: true, requires_spare_parts: spare,
    spare_parts_status: spare ? 'solicitado' : 'no_aplica'
  };
  const signature = {
    id: 'signature-1', signed_at: '2026-09-09T15:00:00Z', signed_by_me: true,
    is_fully_signed: true, alreadySigned: existing, request_status: spare ? 'espera_repuesto' : 'firmado'
  };
  const deps = {
    getMaintenanceReportById: async () => report,
    isAreaScopedOperationalUser: () => true,
    readerCanAccessAsset: async (...args) => { calls.push(['access', ...args]); return true; },
    listReportSignatures: async () => [
      { id: 'engineer-signature', user_id: 'engineer-1', role: 'ingeniero_biomedico' },
      ...(existing ? [{ id: 'signature-1', user_id: 'chief-1', role: 'responsable_area' }] : [])
    ],
    maintenanceAcceptanceRoleForUser: () => 'responsable_area',
    signMaintenanceReport: async (payload) => { calls.push(['reconcile', payload]); return signature; },
    getUserById: async () => ({ id: 'chief-1', signature_path: '/uploads/firma.png' }),
    resolveStoredFilePath: () => '/app/uploads/firma.png',
    signMaintenanceReportWithSnapshot: async (payload) => { calls.push(['sign', payload]); return signature; },
    getAssetById: async () => ({ id: 'asset-1', name: 'MONITOR', asset_category: 'industrial' }),
    logEquipmentAudit: async (_req, payload) => { calls.push(['audit', payload]); },
    assetLabel: (asset) => asset?.name || 'EQUIPO',
    writeMaintenanceReportPdfFile: async (id) => { calls.push(['pdf', id]); return '/uploads/report.pdf'; },
    createNotificationOnce: async (payload) => { calls.push(['notification', payload]); },
    maintenanceRouteForAsset: (asset) => asset.asset_category === 'industrial' ? '/mantenimiento-industrial' : '/mantenimiento',
    logError: (...args) => calls.push(['error', ...args])
  };
  const req = { params: { id: 'report-1' }, user: { sub: 'chief-1', clientId: 'client-1', roles: ['responsable_area'] } };
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return { calls, deps, report, signature, req, res, run: () => createMaintenanceReportSignHandler(deps)(req, res) };
}

test('confirms the signature and notifies using the signed equipment, without an undefined variable', async () => {
  const state = setup();
  await state.run();
  assert.equal(state.res.statusCode, 200);
  assert.equal(state.res.body.signed_by_me, true);
  assert.equal(state.res.body.is_fully_signed, true);
  assert.deepEqual(state.res.body.warnings, []);
  const notification = state.calls.find(([name]) => name === 'notification')[1];
  assert.equal(notification.link, '/mantenimiento-industrial');
  assert.equal(notification.userId, 'engineer-1');
  assert.equal(notification.data.reportId, 'report-1');
  assert.equal(state.calls.filter(([name]) => name === 'sign').length, 1);
});

test('a signed preventive with pending spares stays signed without closing the spare case', async () => {
  const state = setup({ spare: true });
  await state.run();
  assert.equal(state.res.body.is_fully_signed, true);
  assert.equal(state.res.body.request_status, 'espera_repuesto');
  assert.match(state.calls.find(([name]) => name === 'notification')[1].message, /repuesto/);
});

test('a retry confirms the same signature even if the profile signature was removed later', async () => {
  const state = setup({ existing: true });
  state.deps.getUserById = async () => { throw new Error('Profile must not be needed'); };
  await state.run();
  assert.equal(state.res.statusCode, 200);
  assert.equal(state.res.body.id, 'signature-1');
  assert.equal(state.res.body.signed_at, '2026-09-09T15:00:00Z');
  assert.equal(state.res.body.alreadySigned, true);
  assert.equal(state.calls.some(([name]) => name === 'sign'), false);
  assert.equal(state.calls.some(([name]) => name === 'audit'), false);
});

for (const [step, method] of [
  ['pdf', 'writeMaintenanceReportPdfFile'], ['notification', 'createNotificationOnce'],
  ['audit', 'logEquipmentAudit']
]) {
  test(`${step} errors do not fail a committed signature or escape the HTTP handler`, async () => {
    const state = setup();
    state.deps[method] = async () => { throw new Error(`${step} unavailable`); };
    await state.run();
    assert.equal(state.res.statusCode, 200);
    assert.equal(state.res.body.signed_by_me, true);
    assert.deepEqual(state.res.body.warnings, [step]);
  });
}

for (const [name, change, status] of [
  ['missing report', (s) => { s.deps.getMaintenanceReportById = async () => null; }, 404],
  ['different client', (s) => { s.req.user.clientId = 'other-client'; }, 403],
  ['different area/location', (s) => { s.deps.readerCanAccessAsset = async () => false; }, 403],
  ['wrong role', (s) => { s.req.user.roles = ['almacenista']; }, 403],
  ['pending correction', (s) => { s.report.correction_requested = true; }, 409],
  ['missing signature', (s) => { s.deps.getUserById = async () => ({}); }, 400],
  ['missing image', (s) => { s.deps.resolveStoredFilePath = () => null; }, 400],
  ['database unavailable', (s) => { s.deps.signMaintenanceReportWithSnapshot = async () => { throw new Error('DB down'); }; }, 500],
  ['concurrent correction', (s) => { s.deps.signMaintenanceReportWithSnapshot = async () => { throw Object.assign(new Error('Correccion pendiente'), { status: 409 }); }; }, 409]
]) {
  test(`rejects ${name} and always returns an HTTP response`, async () => {
    const state = setup();
    change(state);
    await state.run();
    assert.equal(state.res.statusCode, status);
    assert.equal(typeof state.res.body.message, 'string');
    assert.equal(state.calls.some(([method]) => method === 'notification'), false);
  });
}

test('retries still check the client and assigned equipment', async () => {
  const state = setup({ existing: true });
  state.deps.readerCanAccessAsset = async () => false;
  await state.run();
  assert.equal(state.res.statusCode, 403);
  assert.equal(state.calls.some(([name]) => name === 'reconcile'), false);
});
