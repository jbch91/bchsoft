export const HV_CALIBRATION_FREQUENCIES = Object.freeze([
  'mensual',
  'bimensual',
  'trimestral',
  'cuatrimestral',
  'semestral',
  'anual'
]);

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isNotRegisteredMarker(value) {
  const marker = normalizedText(value).replace(/\s+/g, '');
  return ['nr', 'n/r', 'n.r', 'n.r.', 'noregistra', 'noregistrado', 'noreporta'].includes(marker);
}

export function normalizeOptionalRecordedValue(value) {
  const text = String(value ?? '').trim();
  return !text || isNotRegisteredMarker(text) ? null : text;
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = normalizedText(value);
  if (!normalized) return false;
  if (['si', 'true', '1', 'x'].includes(normalized)) return true;
  if (['no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function isValidIsoDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() + 1 === month
    && candidate.getUTCDate() === day;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateAndNormalizeHvImportAsset(asset = {}) {
  const errors = [];
  const acquisitionDate = normalizeOptionalRecordedValue(asset.acquisitionDate);
  const supplierEmail = normalizeOptionalRecordedValue(asset.supplierEmail);
  const requiresCalibration = parseBoolean(asset.requiresCalibration);
  const calibrationFrequencyRaw = String(asset.calibrationFrequency ?? '').trim();
  const calibrationFrequency = normalizedText(calibrationFrequencyRaw) || null;

  if (acquisitionDate && !isValidIsoDate(acquisitionDate)) {
    errors.push('Fecha adquisición debe usar yyyy-mm-dd, quedar vacía o ser NR');
  }
  if (supplierEmail && !isValidEmail(supplierEmail)) {
    errors.push('Correo proveedor no tiene un formato válido');
  }
  if (requiresCalibration === null) {
    errors.push('Requiere calibración debe ser Sí o No');
  } else if (!requiresCalibration && calibrationFrequencyRaw) {
    errors.push('Frecuencia de calibración debe estar vacía cuando el equipo no requiere calibración');
  } else if (requiresCalibration && !calibrationFrequency) {
    errors.push('Frecuencia de calibración es obligatoria cuando el equipo requiere calibración');
  } else if (calibrationFrequency && !HV_CALIBRATION_FREQUENCIES.includes(calibrationFrequency)) {
    errors.push(`Frecuencia de calibración no permitida. Usa: ${HV_CALIBRATION_FREQUENCIES.join(', ')}`);
  }

  return {
    asset: {
      ...asset,
      acquisitionDate,
      supplierEmail,
      requiresCalibration: requiresCalibration ?? false,
      calibrationFrequency: requiresCalibration ? calibrationFrequency : null
    },
    errors
  };
}
