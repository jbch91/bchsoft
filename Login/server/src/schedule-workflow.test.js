import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleValidationError,
  addBusinessDaysUtc,
  addMonthsUtc,
  addYearsUtc,
  assetWarrantyReleaseDate,
  buildAssetMaintenanceOccurrences,
  buildOperationalMaintenanceOccurrences,
  buildRecurringDates,
  canCorrectAssetScheduleItems,
  canEditMaintenanceSchedule,
  capDateAtMonthEndUtc,
  capDateAtScheduleYearEndUtc,
  changedMaintenanceItemUpdates,
  endOfMonthUtc,
  formatDateOnly,
  maintenanceScheduleOccurrenceState,
  normalizeCalibrationItemUpdates,
  normalizeAssetScheduleEnrollmentMode,
  normalizeAssetScheduleProgrammingSelection,
  normalizePeriodicityChangeMode,
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
  assert.equal(formatDateOnly(addYearsUtc(parseDateOnly('2024-02-29'), 1)), '2025-02-28');
});

test('calcula el fin de garantía y exige una fecha de adquisición verificable', () => {
  assert.equal(
    assetWarrantyReleaseDate({ acquisitionDate: '2025-09-10', warrantyYears: 1 }),
    '2026-09-10'
  );
  assert.equal(
    assetWarrantyReleaseDate({ acquisitionDate: null, warrantyYears: null }),
    null
  );
  assert.throws(
    () => assetWarrantyReleaseDate({ acquisitionDate: null, warrantyYears: 1 }),
    /fecha de adquisición es obligatoria/
  );
});

test('distingue el ingreso de un equipo nuevo de uno existente omitido', () => {
  assert.equal(normalizeAssetScheduleEnrollmentMode(undefined), 'new');
  assert.equal(normalizeAssetScheduleEnrollmentMode('existing_omitted'), 'existing_omitted');
  assert.throws(
    () => normalizeAssetScheduleEnrollmentMode('historical'),
    /tipo de incorporación/
  );
});

test('genera recurrencias en días hábiles dentro del año', () => {
  assert.deepEqual(buildRecurringDates({ year: 2026, startDate: '2026-01-31', months: 6 }), [
    '2026-01-30',
    '2026-07-31'
  ]);
  assert.deepEqual(buildRecurringDates({ year: 2026, startDate: '2026-02-02', months: 3 }), [
    '2026-02-02',
    '2026-05-04',
    '2026-08-03',
    '2026-11-02'
  ]);
  assert.deepEqual(
    buildRecurringDates({ year: 2026, startDate: '2026-08-18', months: 3 }),
    ['2026-02-18', '2026-05-18', '2026-08-18', '2026-11-18']
  );
});

test('genera todas las ventanas de una vigencia anual', () => {
  const expectedCounts = new Map([
    [1, 12],
    [2, 6],
    [3, 4],
    [4, 3],
    [6, 2],
    [12, 1]
  ]);
  for (const [months, count] of expectedCounts) {
    const dates = buildRecurringDates({ year: 2026, startDate: '2026-08-16', months });
    assert.equal(dates.length, count);
    assert.ok(dates.every((date) => date.startsWith('2026-')));
  }

  const monthly = buildRecurringDates({ year: 2026, startDate: '2026-02-16', months: 1 });
  assert.equal(monthly[0], '2026-01-16');
  assert.equal(monthly.at(-1), '2026-12-16');
  assert.deepEqual(
    monthly.map((date) => date.slice(0, 7)),
    Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)
  );
});

test('incorpora un equipo nuevo desde la próxima fecha de su ubicación y área', () => {
  const occurrences = buildAssetMaintenanceOccurrences({
    year: 2026,
    startDate: '2026-01-15',
    frequency: 'trimestral',
    notBeforeDate: '2026-08-26',
    locationId: 'location-a',
    referenceItems: [
      { plannedDate: '2026-08-28', locationId: 'location-a' },
      { plannedDate: '2026-09-28', locationId: 'location-a' },
      { plannedDate: '2026-08-20', locationId: 'location-b' },
      { plannedDate: '2026-11-27', locationId: 'location-a' }
    ]
  });
  assert.deepEqual(occurrences, [
    { plannedDate: '2026-10-28', deadlineDate: '2026-10-31' }
  ]);
});

test('activa la ventana mensual vigente aunque la fecha del área ya haya pasado', () => {
  const occurrences = buildOperationalMaintenanceOccurrences({
    year: 2026,
    startDate: '2026-01-12',
    frequency: 'mensual',
    availableFrom: '2026-08-26',
    referenceItems: [
      { planned_date: '2026-08-10', location_id: 'location-a' },
      { planned_date: '2026-09-10', location_id: 'location-a' }
    ],
    locationId: 'location-a'
  });

  assert.deepEqual(occurrences.slice(0, 2), [
    { plannedDate: '2026-08-26', deadlineDate: '2026-08-31' },
    { plannedDate: '2026-09-10', deadlineDate: '2026-09-30' }
  ]);
});

test('reconstruye la vigencia de un equipo existente omitido', () => {
  const today = '2026-08-26';
  const occurrences = buildOperationalMaintenanceOccurrences({
    year: 2026,
    startDate: '2026-01-12',
    frequency: 'mensual',
    availableFrom: '2026-01-01',
    referenceItems: Array.from({ length: 12 }, (_, index) => ({
      planned_date: `2026-${String(index + 1).padStart(2, '0')}-12`,
      location_id: 'location-a'
    })),
    locationId: 'location-a'
  });

  const historical = occurrences.filter((item) => item.deadlineDate < today);
  const current = occurrences.filter(
    (item) => item.plannedDate <= today && item.deadlineDate >= today
  );
  const future = occurrences.filter((item) => item.plannedDate > today);

  assert.equal(occurrences.length, 12);
  assert.equal(historical.length, 7);
  assert.deepEqual(current, [{ plannedDate: '2026-08-12', deadlineDate: '2026-08-31' }]);
  assert.equal(future.length, 4);
  assert.deepEqual(
    maintenanceScheduleOccurrenceState(historical[0], {
      today,
      scheduleStatus: 'approved',
      historicalBackfill: true
    }),
    { status: 'expired', historicalResolution: 'pending_evidence' }
  );
  assert.deepEqual(
    maintenanceScheduleOccurrenceState(current[0], {
      today,
      scheduleStatus: 'approved',
      historicalBackfill: true
    }),
    { status: 'active', historicalResolution: null }
  );
  assert.deepEqual(
    maintenanceScheduleOccurrenceState(future[0], {
      today,
      scheduleStatus: 'approved',
      historicalBackfill: true
    }),
    { status: 'pending', historicalResolution: null }
  );
});

test('omite mantenimientos anteriores al vencimiento de la garantía', () => {
  const occurrences = buildAssetMaintenanceOccurrences({
    year: 2026,
    startDate: '2026-01-15',
    frequency: 'mensual',
    notBeforeDate: '2026-09-20',
    referenceItems: [
      { plannedDate: '2026-09-10' },
      { plannedDate: '2026-10-12' }
    ]
  });
  assert.equal(occurrences[0]?.plannedDate, '2026-10-12');
  assert.equal(occurrences.length, 3);
  assert.deepEqual(
    occurrences.map((item) => item.plannedDate.slice(0, 7)),
    ['2026-10', '2026-11', '2026-12']
  );
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
  assert.equal(formatDateOnly(endOfMonthUtc(earlyMonthStart)), '2026-08-31');
});

test('deduplica identificadores y rechaza UUID inválidos', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(normalizeUuidList([id, id], 'Las áreas'), [id]);
  assert.throws(() => normalizeUuidList(['area-invalida'], 'Las áreas'), /valor inválido/);
});

test('mantiene la fecha límite al editar mantenimientos dentro de su ventana', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const result = normalizeMaintenanceItemUpdates(
    [{ id, plannedDate: '2026-08-03' }],
    [{ id, deadline_date: '2026-08-31' }],
    2026
  );
  assert.deepEqual(result, [{ id, plannedDate: '2026-08-03', deadlineDate: '2026-08-31' }]);
  assert.throws(
    () =>
      normalizeMaintenanceItemUpdates(
        [{ id, plannedDate: '2026-09-01' }],
        [{ id, deadline_date: '2026-08-31' }],
        2026
      ),
    /debe pertenecer al mes/
  );
});

test('impide mover una fecha programada dentro del periodo de garantía', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const current = [{
    id,
    deadline_date: '2026-09-30',
    acquisition_date: '2025-09-10',
    warranty_years: 1
  }];
  assert.throws(
    () => normalizeMaintenanceItemUpdates(
      [{ id, plannedDate: '2026-09-09' }],
      current,
      2026
    ),
    /fin de la garantía/
  );
  assert.deepEqual(
    normalizeMaintenanceItemUpdates(
      [{ id, plannedDate: '2026-09-10' }],
      current,
      2026
    ),
    [{ id, plannedDate: '2026-09-10', deadlineDate: '2026-09-30' }]
  );
});

test('valida todas las fechas elegidas al cambiar la periodicidad de una hoja de vida', () => {
  const scheduleId = '11111111-1111-4111-8111-111111111111';
  const expected = [{
    scheduleId,
    year: 2026,
    items: [
      {
        month: '2026-09',
        plannedDate: '2026-09-18',
        minDate: '2026-09-01',
        maxDate: '2026-09-30',
        deadlineDate: '2026-09-30'
      },
      {
        month: '2026-10',
        plannedDate: '2026-10-19',
        minDate: '2026-10-01',
        maxDate: '2026-10-31',
        deadlineDate: '2026-10-31'
      }
    ]
  }];

  assert.deepEqual(
    normalizeAssetScheduleProgrammingSelection({
      schedules: [{
        scheduleId,
        items: [
          { month: '2026-09', plannedDate: '2026-09-21' },
          { month: '2026-10', plannedDate: '2026-10-20' }
        ]
      }]
    }, expected),
    {
      changeMode: 'correction',
      effectiveDate: null,
      schedules: [{
        scheduleId,
        items: [
          { month: '2026-09', plannedDate: '2026-09-21', deadlineDate: '2026-09-30' },
          { month: '2026-10', plannedDate: '2026-10-20', deadlineDate: '2026-10-31' }
        ]
      }]
    }
  );

  assert.throws(
    () => normalizeAssetScheduleProgrammingSelection({
      schedules: [{
        scheduleId,
        items: [
          { month: '2026-09', plannedDate: '2026-10-01' },
          { month: '2026-10', plannedDate: '2026-10-20' }
        ]
      }]
    }, expected),
    /debe estar entre/
  );
  assert.throws(
    () => normalizeAssetScheduleProgrammingSelection({
      schedules: [{
        scheduleId,
        items: [
          { month: '2026-09', plannedDate: '2026-09-19' },
          { month: '2026-10', plannedDate: '2026-10-20' }
        ]
      }]
    }, expected),
    /día hábil/
  );
});

test('distingue una corrección anual de un cambio operativo con evidencia', () => {
  assert.equal(normalizePeriodicityChangeMode(undefined), 'correction');
  assert.equal(normalizePeriodicityChangeMode('operational'), 'operational');
  assert.equal(
    canCorrectAssetScheduleItems([
      { status: 'expired', historical_resolution: 'pending_evidence' },
      { status: 'active', has_blocking_request: false }
    ]),
    true
  );
  assert.equal(
    canCorrectAssetScheduleItems([{ status: 'done', completion_source: 'software_report' }]),
    false
  );
  assert.equal(
    canCorrectAssetScheduleItems([
      { status: 'expired', historical_resolution: 'not_performed' }
    ]),
    false
  );
  assert.equal(
    canCorrectAssetScheduleItems([{ status: 'active', has_blocking_request: true }]),
    false
  );
});

test('exige resolución y justificación para cada periodo histórico reconstruido', () => {
  const scheduleId = '11111111-1111-4111-8111-111111111111';
  const expected = [{
    scheduleId,
    year: 2026,
    items: [{
      month: '2026-05',
      plannedDate: '2026-05-18',
      minDate: '2026-05-01',
      maxDate: '2026-05-31',
      deadlineDate: '2026-05-31',
      phase: 'historical',
      historicalResolution: 'pending_evidence'
    }]
  }];

  assert.deepEqual(
    normalizeAssetScheduleProgrammingSelection({
      changeMode: 'correction',
      effectiveDate: '2026-01-01',
      schedules: [{
        scheduleId,
        items: [{
          month: '2026-05',
          plannedDate: '2026-05-18',
          historicalResolution: 'not_performed',
          nonExecutionReason: 'No fue ejecutado durante la vigencia.'
        }]
      }]
    }, expected, {
      expectedChangeMode: 'correction',
      expectedEffectiveDate: '2026-01-01'
    }),
    {
      changeMode: 'correction',
      effectiveDate: '2026-01-01',
      schedules: [{
        scheduleId,
        items: [{
          month: '2026-05',
          plannedDate: '2026-05-18',
          deadlineDate: '2026-05-31',
          phase: 'historical',
          historicalResolution: 'not_performed',
          nonExecutionReason: 'No fue ejecutado durante la vigencia.'
        }]
      }]
    }
  );

  assert.throws(
    () => normalizeAssetScheduleProgrammingSelection({
      schedules: [{
        scheduleId,
        items: [{
          month: '2026-05',
          plannedDate: '2026-05-18',
          historicalResolution: 'not_performed'
        }]
      }]
    }, expected),
    /justificación/
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
