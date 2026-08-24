import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleValidationError,
  addBusinessDaysUtc,
  addMonthsUtc,
  buildRecurringDates,
  canEditMaintenanceSchedule,
  capDateAtMonthEndUtc,
  capDateAtScheduleYearEndUtc,
  changedMaintenanceItemUpdates,
  formatDateOnly,
  normalizeCalibrationItemUpdates,
  normalizeMaintenanceItemUpdates,
  normalizeScheduleStart,
  normalizeTrainingItemUpdates,
  normalizeUuidList,
  parseDateOnly
} from './schedule-workflow.js';

test('valida que la fecha inicial pertenezca al año seleccionado', () => {
  assert.deepEqual(normalizeScheduleStart({ year: 2026, startDate: '2026-01-15' }), {
    year: 2026,
    startDate: '2026-01-15'
  });
  assert.throws(
    () => normalizeScheduleStart({ year: 2026, startDate: '2025-12-31' }),
    ScheduleValidationError
  );
  assert.throws(
    () => normalizeScheduleStart({ year: 2026, startDate: '2026-02-30' }),
    /no es válida/
  );
});

test('calcula fechas sin depender de la zona horaria del servidor', () => {
  const friday = parseDateOnly('2026-08-21');
  assert.equal(formatDateOnly(addBusinessDaysUtc(friday, 1)), '2026-08-24');
  assert.equal(formatDateOnly(addMonthsUtc(parseDateOnly('2026-01-31'), 1)), '2026-02-28');
});

test('genera recurrencias en días hábiles dentro del año', () => {
  assert.deepEqual(buildRecurringDates({ year: 2026, startDate: '2026-01-31', months: 6 }), [
    '2026-02-02',
    '2026-08-03'
  ]);
});

test('limita las ventanas de servicio al cierre de la vigencia', () => {
  const deadline = addBusinessDaysUtc(parseDateOnly('2026-12-29'), 10);
  assert.equal(formatDateOnly(deadline), '2027-01-12');
  assert.equal(formatDateOnly(capDateAtScheduleYearEndUtc(deadline, 2026)), '2026-12-31');
});

test('mantiene la fecha límite del mantenimiento en el mes programado', () => {
  const lateMonthStart = parseDateOnly('2026-08-24');
  const crossingDeadline = addBusinessDaysUtc(lateMonthStart, 10);
  assert.equal(formatDateOnly(crossingDeadline), '2026-09-07');
  assert.equal(
    formatDateOnly(capDateAtMonthEndUtc(crossingDeadline, lateMonthStart)),
    '2026-08-31'
  );

  const earlyMonthStart = parseDateOnly('2026-08-03');
  const sameMonthDeadline = addBusinessDaysUtc(earlyMonthStart, 10);
  assert.equal(
    formatDateOnly(capDateAtMonthEndUtc(sameMonthDeadline, earlyMonthStart)),
    '2026-08-17'
  );
});

test('deduplica identificadores y rechaza UUID inválidos', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(normalizeUuidList([id, id], 'Las áreas'), [id]);
  assert.throws(() => normalizeUuidList(['area-invalida'], 'Las áreas'), /valor inválido/);
});

test('mantiene la fecha límite al editar mantenimientos dentro de su ventana', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const result = normalizeMaintenanceItemUpdates(
    [{ id, plannedDate: '2026-08-17' }],
    [{ id, deadline_date: '2026-08-31' }],
    2026
  );
  assert.deepEqual(result, [{ id, plannedDate: '2026-08-17', deadlineDate: '2026-08-31' }]);
  assert.throws(
    () =>
      normalizeMaintenanceItemUpdates(
        [{ id, plannedDate: '2026-08-14' }],
        [{ id, deadline_date: '2026-08-31' }],
        2026
      ),
    /debe estar entre/
  );
});

test('permite editar borradores y exige autorización administrativa para aprobados', () => {
  assert.equal(
    canEditMaintenanceSchedule({ status: 'draft', engineer_edited: true }, ['ingeniero_biomedico']),
    true
  );
  assert.equal(
    canEditMaintenanceSchedule(
      { status: 'approved', engineer_edit_enabled: true },
      ['ingeniero_biomedico']
    ),
    true
  );
  assert.equal(
    canEditMaintenanceSchedule(
      { status: 'approved', engineer_edit_enabled: false },
      ['ingeniero_biomedico']
    ),
    false
  );
  assert.equal(
    canEditMaintenanceSchedule(
      { status: 'approved', engineer_edit_enabled: true },
      ['client_admin']
    ),
    false
  );
});

test('en aprobados solo acepta cambios de mantenimientos pendientes', () => {
  const pendingId = '11111111-1111-4111-8111-111111111111';
  const doneId = '22222222-2222-4222-8222-222222222222';
  const current = [
    { id: pendingId, planned_date: '2026-09-01', status: 'pending' },
    { id: doneId, planned_date: '2026-08-03', status: 'done' }
  ];
  assert.deepEqual(
    changedMaintenanceItemUpdates(
      [
        { id: pendingId, plannedDate: '2026-09-02' },
        { id: doneId, plannedDate: '2026-08-03' }
      ],
      current,
      { approved: true }
    ),
    [{ id: pendingId, plannedDate: '2026-09-02' }]
  );
  assert.throws(
    () =>
      changedMaintenanceItemUpdates(
        [{ id: doneId, plannedDate: '2026-08-04' }],
        current,
        { approved: true }
      ),
    /futuros pendientes/
  );
});

test('rechaza fechas de capacitación en fin de semana o fuera del año', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const current = [{ id }];
  assert.throws(
    () => normalizeTrainingItemUpdates([{ id, plannedDate: '2026-08-22' }], current, 2026),
    /día hábil/
  );
  assert.throws(
    () => normalizeTrainingItemUpdates([{ id, plannedDate: '2027-01-04' }], current, 2026),
    /año del cronograma/
  );
});

test('mantiene la ventana de calibración y valida su vigencia', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const current = [{ id, deadline_date: '2026-09-30' }];
  assert.deepEqual(
    normalizeCalibrationItemUpdates([{ id, plannedDate: '2026-09-15' }], current, 2026),
    [{ id, plannedDate: '2026-09-15', deadlineDate: '2026-09-30' }]
  );
  assert.throws(
    () => normalizeCalibrationItemUpdates([{ id, plannedDate: '2026-08-28' }], current, 2026),
    /debe estar entre/
  );
  assert.throws(
    () => normalizeCalibrationItemUpdates([{ id, plannedDate: '2027-01-04' }], current, 2026),
    /año del cronograma/
  );
});
