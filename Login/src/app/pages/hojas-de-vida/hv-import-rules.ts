export interface HvCalibrationImportResult {
  requiresCalibration: boolean;
  calibrationFrequency?: string;
  errors: string[];
}

function normalizedText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isNotRegisteredMarker(value: unknown): boolean {
  const marker = normalizedText(value).replace(/\s+/g, '');
  return ['nr', 'n/r', 'n.r', 'n.r.', 'noregistra', 'noregistrado', 'noreporta'].includes(marker);
}

export function normalizeOptionalRecordedValue(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return !text || isNotRegisteredMarker(text) ? undefined : text;
}

export function resolveHvCalibrationImport(
  requiresCalibrationValue: unknown,
  frequencyValue: unknown,
  allowedFrequencies: readonly string[]
): HvCalibrationImportResult {
  const requiresText = normalizedText(requiresCalibrationValue);
  const frequency = normalizedText(frequencyValue);
  let requiresCalibration = false;

  if (requiresText) {
    if (['si', 'true', '1', 'x'].includes(requiresText)) {
      requiresCalibration = true;
    } else if (!['no', 'false', '0'].includes(requiresText)) {
      return {
        requiresCalibration: false,
        errors: ['Requiere calibración debe ser Sí o No']
      };
    }
  }

  if (!requiresCalibration && frequency) {
    return {
      requiresCalibration,
      errors: ['Frecuencia de calibración debe estar vacía cuando el equipo no requiere calibración']
    };
  }

  if (requiresCalibration && !frequency) {
    return {
      requiresCalibration,
      errors: ['Frecuencia de calibración es obligatoria cuando el equipo requiere calibración']
    };
  }

  if (frequency && !allowedFrequencies.includes(frequency)) {
    return {
      requiresCalibration,
      errors: [`Frecuencia de calibración no permitida. Usa: ${allowedFrequencies.join(', ')}`]
    };
  }

  return {
    requiresCalibration,
    calibrationFrequency: requiresCalibration ? frequency : undefined,
    errors: []
  };
}
