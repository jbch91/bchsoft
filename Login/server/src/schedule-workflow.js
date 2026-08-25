const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SCHEDULE_PERIODICITIES = Object.freeze({
  mensual: 1,
  bimensual: 2,
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
  anual: 12
});

export class ScheduleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScheduleValidationError';
    this.statusCode = 400;
  }
}

export function normalizeScheduleYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new ScheduleValidationError('El año del cronograma no es válido.');
  }
  return year;
}

export function normalizeDateOnly(value, label = 'La fecha') {
  if (typeof value !== 'string') {
    throw new ScheduleValidationError(`${label} debe tener formato AAAA-MM-DD.`);
  }
  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) {
    throw new ScheduleValidationError(`${label} debe tener formato AAAA-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ScheduleValidationError(`${label} no es válida.`);
  }
  return formatDateOnly(date);
}

export function dateOnlyFromDatabase(value, label = 'La fecha') {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ScheduleValidationError(`${label} no es válida.`);
    }
    return formatDateOnly(value);
  }
  if (typeof value === 'string') {
    return normalizeDateOnly(value.slice(0, 10), label);
  }
  throw new ScheduleValidationError(`${label} no es válida.`);
}

export function parseDateOnly(value, label = 'La fecha') {
  const normalized = normalizeDateOnly(value, label);
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(value) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeScheduleStart({ year, startDate }) {
  const normalizedYear = normalizeScheduleYear(year);
  const normalizedStartDate = normalizeDateOnly(startDate, 'La fecha inicial');
  if (Number(normalizedStartDate.slice(0, 4)) !== normalizedYear) {
    throw new ScheduleValidationError('La fecha inicial debe pertenecer al año seleccionado.');
  }
  return { year: normalizedYear, startDate: normalizedStartDate };
}

export function frequencyToMonths(value) {
  return SCHEDULE_PERIODICITIES[String(value || '').trim().toLowerCase()] ?? null;
}

export function normalizePeriodicity(value) {
  const periodicity = String(value || '').trim().toLowerCase();
  if (!frequencyToMonths(periodicity)) {
    throw new ScheduleValidationError('La periodicidad seleccionada no es válida.');
  }
  return periodicity;
}

export function adjustToWeekdayUtc(value) {
  const date = new Date(value.getTime());
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 2);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export function addBusinessDaysUtc(value, days) {
  const date = new Date(value.getTime());
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining -= 1;
  }
  return date;
}

export function addMonthsUtc(value, months) {
  const source = new Date(value.getTime());
  const targetMonthIndex = source.getUTCMonth() + Number(months);
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), lastDay)));
}

export function capDateAtScheduleYearEndUtc(value, year) {
  const normalizedYear = normalizeScheduleYear(year);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ScheduleValidationError('La fecha límite del cronograma no es válida.');
  }
  const yearEnd = new Date(Date.UTC(normalizedYear, 11, 31));
  return new Date(Math.min(value.getTime(), yearEnd.getTime()));
}

export function capDateAtMonthEndUtc(value, anchorDate) {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime()) ||
    !(anchorDate instanceof Date) ||
    Number.isNaN(anchorDate.getTime())
  ) {
    throw new ScheduleValidationError('La fecha límite del cronograma no es válida.');
  }
  const monthEnd = new Date(
    Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 0)
  );
  return new Date(Math.min(value.getTime(), monthEnd.getTime()));
}

export function startOfMonthUtc(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ScheduleValidationError('La ventana mensual del cronograma no es válida.');
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export function endOfMonthUtc(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ScheduleValidationError('La ventana mensual del cronograma no es válida.');
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

export function buildRecurringDates({ year, startDate, months }) {
  const normalized = normalizeScheduleStart({ year, startDate });
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new ScheduleValidationError('La periodicidad seleccionada no es válida.');
  }
  const dates = [];
  let planned = adjustToWeekdayUtc(parseDateOnly(normalized.startDate));
  while (planned.getUTCFullYear() === normalized.year) {
    dates.push(formatDateOnly(planned));
    planned = adjustToWeekdayUtc(addMonthsUtc(planned, months));
  }
  if (!dates.length) {
    throw new ScheduleValidationError('La fecha inicial no permite generar eventos dentro del año seleccionado.');
  }
  return dates;
}

export function normalizeUuidList(values, label = 'Los identificadores') {
  if (!Array.isArray(values) || !values.length) {
    throw new ScheduleValidationError(`${label} son requeridos.`);
  }
  const unique = [];
  const seen = new Set();
  for (const value of values) {
    const id = String(value || '').trim();
    if (!UUID_PATTERN.test(id)) {
      throw new ScheduleValidationError(`${label} contienen un valor inválido.`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
}

function normalizeRequestedItems(items, existingItems) {
  if (!Array.isArray(items) || !items.length) {
    throw new ScheduleValidationError('Debes enviar al menos un elemento para actualizar.');
  }
  if (items.length > 20000) {
    throw new ScheduleValidationError('La actualización supera el límite permitido.');
  }
  const existingById = new Map(existingItems.map((item) => [String(item.id), item]));
  const seen = new Set();
  return items.map((item) => {
    const id = String(item?.id || '').trim();
    if (!UUID_PATTERN.test(id) || !existingById.has(id)) {
      throw new ScheduleValidationError('Uno de los elementos no pertenece al cronograma.');
    }
    if (seen.has(id)) {
      throw new ScheduleValidationError('No se puede actualizar dos veces el mismo elemento.');
    }
    seen.add(id);
    return { input: item, current: existingById.get(id) };
  });
}

function assertWeekdayAndYear(dateOnly, year) {
  const date = parseDateOnly(dateOnly, 'La fecha programada');
  if (date.getUTCFullYear() !== year) {
    throw new ScheduleValidationError('Las fechas programadas deben pertenecer al año del cronograma.');
  }
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    throw new ScheduleValidationError('Las fechas programadas deben corresponder a un día hábil.');
  }
  return date;
}

export function normalizeMaintenanceItemUpdates(items, existingItems, year) {
  const normalizedYear = normalizeScheduleYear(year);
  return normalizeRequestedItems(items, existingItems).map(({ input, current }) => {
    const plannedDate = normalizeDateOnly(input.plannedDate, 'La fecha programada');
    const planned = assertWeekdayAndYear(plannedDate, normalizedYear);
    const deadlineDate = dateOnlyFromDatabase(current.deadline_date, 'La fecha límite');
    const deadline = parseDateOnly(deadlineDate);
    const minimum = startOfMonthUtc(deadline);
    if (planned < minimum || planned > deadline) {
      throw new ScheduleValidationError(
        `La fecha programada debe pertenecer al mes comprendido entre ${formatDateOnly(minimum)} y ${deadlineDate}.`
      );
    }
    return { id: String(current.id), plannedDate, deadlineDate };
  });
}

export function canEditMaintenanceSchedule(schedule, roles = []) {
  const status = String(schedule?.status || '').toLowerCase();
  if (status === 'draft') return true;
  return (
    status === 'approved'
    && schedule?.engineer_edit_enabled === true
    && roles.includes('ingeniero_biomedico')
  );
}

export function changedMaintenanceItemUpdates(
  normalizedUpdates,
  existingItems,
  { approved = false } = {}
) {
  const existingById = new Map(existingItems.map((item) => [String(item.id), item]));
  return normalizedUpdates.filter((update) => {
    const current = existingById.get(String(update.id));
    if (!current) {
      throw new ScheduleValidationError('Uno de los elementos no pertenece al cronograma.');
    }
    const changed = update.plannedDate !== dateOnlyFromDatabase(current.planned_date, 'La fecha programada');
    if (changed && approved && String(current.status || '').toLowerCase() !== 'pending') {
      throw new ScheduleValidationError(
        'En un cronograma aprobado solo se pueden modificar mantenimientos futuros pendientes.'
      );
    }
    return changed;
  });
}

export function normalizeTrainingItemUpdates(items, existingItems, year) {
  const normalizedYear = normalizeScheduleYear(year);
  return normalizeRequestedItems(items, existingItems).map(({ input, current }) => {
    const plannedDate = normalizeDateOnly(input.plannedDate, 'La fecha programada');
    assertWeekdayAndYear(plannedDate, normalizedYear);
    return { id: String(current.id), plannedDate };
  });
}

export function normalizeCalibrationItemUpdates(items, existingItems, year) {
  const normalizedYear = normalizeScheduleYear(year);
  return normalizeRequestedItems(items, existingItems).map(({ input, current }) => {
    const plannedDate = normalizeDateOnly(input.plannedDate, 'La fecha programada');
    const planned = assertWeekdayAndYear(plannedDate, normalizedYear);
    const deadlineDate = dateOnlyFromDatabase(current.deadline_date, 'La fecha límite');
    const deadline = parseDateOnly(deadlineDate);
    const minimum = addMonthsUtc(deadline, -1);
    if (planned < minimum || planned > deadline) {
      throw new ScheduleValidationError(
        `La fecha de calibración debe estar entre ${formatDateOnly(minimum)} y ${deadlineDate}.`
      );
    }
    return { id: String(current.id), plannedDate, deadlineDate };
  });
}
