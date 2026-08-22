import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleValidationError,
  addBusinessDaysUtc,
  addMonthsUtc,
  buildRecurringDates,
  capDateAtScheduleYearEndUtc,
  formatDateOnly,
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
