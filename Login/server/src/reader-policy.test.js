import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { requireAuth } from './middleware.js';
import { READER_PERMISSIONS, readerRequestAllowed, restrictReaderPermissions } from './reader-policy.js';

test('reader permissions cannot include signing, requests, edits or platform access', () => {
  const legacy = [...READER_PERMISSIONS, 'read:all', 'hb:create', 'maintenance:report:sign',
    'maintenance:request:create', 'users:manage', 'quick_guides:view', 'inventory:move'];
  assert.deepEqual(restrictReaderPermissions(legacy, ['lector']), READER_PERMISSIONS);
  assert.deepEqual(restrictReaderPermissions(legacy, ['responsable_area']), legacy);
  assert.deepEqual(restrictReaderPermissions([], ['lector']), []);
});

test('reader API permits scoped reads but no operational routes or mutations', () => {
  for (const route of ['/biomed/client/assets', '/biomed/client/assets/equipment',
    '/biomed/client/assets/equipment/history', '/biomed/client/assets/equipment/full-pdf',
    '/biomed/client/areas', '/biomed/client/locations', '/biomed/client/sites',
    '/maintenance/reports/report/pdf', '/calibration/items/item/pdf',
    '/biomed/client/asset-history-files/file/pdf', '/biomed/client/asset-movements/move/pdf']) {
    assert.equal(readerRequestAllowed('GET', route), true, route);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(readerRequestAllowed(method, route), false, `${method} ${route}`);
    }
  }
  for (const route of ['/admin/users', '/maintenance/requests/client',
    '/maintenance/preventive-progress/client', '/maintenance/qr-context/client/equipment',
    '/quick-guides/client', '/calibration/schedules/client', '/odontology/client/patients',
    '/biomed/client/pending-historical-protocols', '/biomed/client/equipment-catalog']) {
    assert.equal(readerRequestAllowed('GET', route), false, route);
  }
  assert.equal(readerRequestAllowed('POST', '/maintenance/reports/report/sign'), false);
});

test('reader retains personal session control and notification acknowledgements', () => {
  assert.equal(readerRequestAllowed('GET', '/auth/me'), true);
  assert.equal(readerRequestAllowed('GET', '/modules/me'), true);
  assert.equal(readerRequestAllowed('DELETE', '/auth/sessions/session'), true);
  assert.equal(readerRequestAllowed('POST', '/auth/sessions/revoke-others'), true);
  assert.equal(readerRequestAllowed('POST', '/notifications/read-all'), true);
  assert.equal(readerRequestAllowed('POST', '/notifications/id/read'), true);
});

test('authentication limits legacy reader tokens and requires an assigned client', async () => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'reader-policy-test-only';
  try {
    for (const [url, clientId, allowed] of [
      ['/biomed/client/assets?category=biomedical', 'client', true],
      ['/maintenance/reports/report/sign', 'client', false],
      ['/biomed/client/assets', null, false]
    ]) {
      const req = { method: 'GET', originalUrl: url, headers: {
        authorization: `Bearer ${jwt.sign({ sub: 'reader', clientId, roles: ['lector'],
          permissions: [...READER_PERMISSIONS, 'maintenance:report:sign'] }, process.env.JWT_SECRET)}`
      } };
      let nextCalled = false;
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
      await requireAuth(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, allowed);
      if (allowed) assert.deepEqual(req.user.permissions, READER_PERMISSIONS);
      else assert.equal(res.statusCode, 403);
    }
  } finally {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  }
});
