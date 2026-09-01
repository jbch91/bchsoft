import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extendLateMaintenanceAuthorizations,
  lateExecutionAuthorizationExpiry,
  normalizeLateMaintenanceOpening,
  openLateMaintenancePeriod,
  previousCalendarMonth,
  validateLateExecutionTemporaryGrant
} from './late-maintenance-execution.js';

test('identifica el mes anterior incluso al cambiar de año', () => {
  assert.deepEqual(previousCalendarMonth('2027-01-03'), { year: 2026, month: 12 });
  assert.deepEqual(previousCalendarMonth('2026-09-01'), { year: 2026, month: 8 });
});

test('normaliza una apertura excepcional solo para el mes anterior', () => {
  assert.deepEqual(
    normalizeLateMaintenanceOpening({
      year: 2026,
      month: 8,
      reason: '  Cierre operativo excepcional autorizado por el cliente. ',
      assetCategory: 'biomedical'
    }, '2026-09-01'),
    {
      year: 2026,
      month: 8,
      period: '2026-08',
      reason: 'Cierre operativo excepcional autorizado por el cliente.',
      assetCategory: 'biomedical'
    }
  );
  assert.throws(
    () => normalizeLateMaintenanceOpening({
      year: 2026, month: 7, reason: 'Justificación suficientemente extensa.',
      assetCategory: 'biomedical'
    }, '2026-09-01'),
    /mes inmediatamente anterior/
  );
});

test('exige una justificación útil y limita la autorización a veinte días', () => {
  assert.throws(
    () => normalizeLateMaintenanceOpening({
      year: 2026, month: 8, reason: 'urgente', assetCategory: 'biomedical'
    }, '2026-09-01'),
    /15 caracteres/
  );
  const now = new Date('2026-09-01T12:00:00Z');
  assert.equal(
    lateExecutionAuthorizationExpiry('2026-10-01T00:00:00Z', now).toISOString(),
    '2026-09-21T12:00:00.000Z'
  );
  assert.equal(
    lateExecutionAuthorizationExpiry('2026-09-03T15:00:00Z', now).toISOString(),
    '2026-09-03T15:00:00.000Z'
  );
});

test('limita también la autorización concedida por el administrador', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  assert.deepEqual(
    validateLateExecutionTemporaryGrant({
      expiresAt: '2026-09-05T12:00:00.000Z',
      reason: '  Cierre excepcional aprobado por la institución. '
    }, now),
    {
      expiry: new Date('2026-09-05T12:00:00.000Z'),
      reason: 'Cierre excepcional aprobado por la institución.'
    }
  );
  assert.throws(
    () => validateLateExecutionTemporaryGrant({
      expiresAt: '2026-09-22T12:00:00.000Z',
      reason: 'Cierre excepcional aprobado por la institución.'
    }, now),
    /máximo veinte días/
  );
  assert.throws(
    () => validateLateExecutionTemporaryGrant({
      expiresAt: '2026-09-05T12:00:00.000Z',
      reason: 'urgente'
    }, now),
    /15 caracteres/
  );
});

test('extiende las actividades abiertas vinculadas al mismo permiso temporal', async () => {
  const calls = [];
  const result = await extendLateMaintenanceAuthorizations({
    clientId: '55555555-5555-4555-8555-555555555555',
    temporaryPermissionId: '77777777-7777-4777-8777-777777777777',
    permissionExpiresAt: '2026-09-21T12:00:00.000Z',
    now: new Date('2026-09-01T12:00:00.000Z'),
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ updated_activities: 79 }] };
    }
  });

  assert.deepEqual(result, {
    updatedActivities: 79,
    authorizedUntil: '2026-09-21T12:00:00.000Z'
  });
  assert.match(calls[0].sql, /item\.late_execution_temporary_permission_id = \$2/);
  assert.match(calls[0].sql, /item\.status = 'active'/);
  assert.deepEqual(calls[0].params, [
    '55555555-5555-4555-8555-555555555555',
    '77777777-7777-4777-8777-777777777777',
    new Date('2026-09-21T12:00:00.000Z')
  ]);
});

test('abre actividades y registra la auditoría dentro de la misma transacción', async () => {
  const calls = [];
  const candidate = {
    id: '11111111-1111-4111-8111-111111111111',
    schedule_id: '22222222-2222-4222-8222-222222222222',
    asset_id: '33333333-3333-4333-8333-333333333333',
    planned_date: '2026-08-20',
    deadline_date: '2026-08-31',
    created_by: '44444444-4444-4444-8444-444444444444'
  };
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT schema_name, name FROM clients')) {
        return { rows: [{ schema_name: 'tenant_test', name: 'CLIENTE DE PRUEBA' }] };
      }
      if (sql.includes('FROM maintenance_schedule_items item')) {
        return { rows: [candidate] };
      }
      return { rows: [] };
    }
  };
  let transactionCount = 0;
  const now = new Date('2026-09-01T12:00:00.000Z');
  const result = await openLateMaintenancePeriod({
    clientId: '55555555-5555-4555-8555-555555555555',
    actorUserId: '66666666-6666-4666-8666-666666666666',
    actorUsername: 'ingeniero.prueba',
    actorDisplayName: 'INGENIERO DE PRUEBA',
    actorRoles: ['ingeniero_biomedico'],
    temporaryPermissionId: '77777777-7777-4777-8777-777777777777',
    permissionExpiresAt: '2026-09-05T12:00:00.000Z',
    permissionGrantedBy: '88888888-8888-4888-8888-888888888888',
    permissionReason: 'Autorización institucional para cierre de agosto.',
    year: 2026,
    month: 8,
    reason: 'Cierre operativo excepcional correspondiente a agosto.',
    assetCategory: 'biomedical',
    now,
    transactionRunner: async (callback) => {
      transactionCount += 1;
      return callback(client);
    }
  });

  assert.equal(transactionCount, 1);
  assert.equal(result.opened, 1);
  assert.equal(result.period, '2026-08');
  assert.equal(result.authorizedUntil, '2026-09-05T12:00:00.000Z');
  assert.match(calls[1].sql, /schedule\.status = 'approved'/);
  assert.match(calls[1].sql, /item\.status = 'expired'/);
  assert.match(calls[1].sql, /item\.report_id IS NULL/);
  assert.ok(calls.some(({ sql }) => sql.includes('INSERT INTO maintenance_requests')));
  const auditCall = calls.find(({ sql }) => sql.includes('INSERT INTO audit_logs'));
  assert.ok(auditCall);
  assert.equal(auditCall.params[4].openedItems, 1);
  assert.equal(auditCall.params[4].period, '2026-08');
  assert.equal(auditCall.params[4].temporaryPermissionGrantedBy,
    '88888888-8888-4888-8888-888888888888');
});
