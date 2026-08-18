export interface HvCalibrationImportResult {
  requiresCalibration: boolean;
  calibrationFrequency?: string;
  errors: string[];
}

export interface HvRiskImportResult {
  requiresSanitaryClassification: boolean;
  riskClass?: string;
  requiresElectricalClassification: boolean;
  electricalProtectionClass?: string;
  appliedPartType?: string;
  errors: string[];
}

export interface HvRiskImportOptions {
  requiresSanitaryValue: unknown;
  sanitaryRiskClassValue: unknown;
  requiresElectricalValue: unknown;
  electricalProtectionClassValue: unknown;
  appliedPartTypeValue: unknown;
  sanitaryRequirementColumnPresent: boolean;
  electricalRequirementColumnPresent: boolean;
  sanitaryRiskClasses: readonly string[];
  electricalProtectionClasses: readonly string[];
  appliedPartTypes: readonly string[];
}

function normalizedText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function canonicalValue(
  value: unknown,
  allowedValues: readonly string[],
  aliases: Record<string, string> = {}
): string | undefined {
  const normalized = normalizedText(value).replace(/\s+/g, ' ');
  if (!normalized) return undefined;
  const alias = aliases[normalized];
  return alias ?? allowedValues.find((item) => normalizedText(item) === normalized);
}

function parseYesNo(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const normalized = normalizedText(value);
  if (['si', 'true', '1', 'x'].includes(normalized)) return true;
  if (['no', 'false', '0'].includes(normalized)) return false;
  return null;
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

export function resolveHvRiskImport(options: HvRiskImportOptions): HvRiskImportResult {
  const errors: string[] = [];
  const sanitaryRiskClassRaw = String(options.sanitaryRiskClassValue ?? '').trim();
  const electricalProtectionClassRaw = String(options.electricalProtectionClassValue ?? '').trim();
  const appliedPartTypeRaw = String(options.appliedPartTypeValue ?? '').trim();
  const sanitaryFlag = parseYesNo(options.requiresSanitaryValue);
  const electricalFlag = parseYesNo(options.requiresElectricalValue);

  if (options.sanitaryRequirementColumnPresent && sanitaryFlag === null) {
    errors.push('Requiere riesgo sanitario debe ser Sí o No');
  }
  if (options.electricalRequirementColumnPresent && electricalFlag === null) {
    errors.push('Requiere riesgo eléctrico debe ser Sí o No');
  }

  const requiresSanitaryClassification = options.sanitaryRequirementColumnPresent
    ? sanitaryFlag === true
    : Boolean(sanitaryRiskClassRaw);
  const requiresElectricalClassification = options.electricalRequirementColumnPresent
    ? electricalFlag === true
    : Boolean(electricalProtectionClassRaw || appliedPartTypeRaw);

  const riskClass = canonicalValue(
    sanitaryRiskClassRaw,
    options.sanitaryRiskClasses,
    {
      i: 'Clase I',
      'clase 1': 'Clase I',
      iia: 'Clase IIA',
      'clase ii a': 'Clase IIA',
      iib: 'Clase IIB',
      'clase ii b': 'Clase IIB',
      iii: 'Clase III',
      'clase 3': 'Clase III'
    }
  );
  const electricalProtectionClass = canonicalValue(
    electricalProtectionClassRaw,
    options.electricalProtectionClasses,
    {
      i: 'Clase I',
      'clase 1': 'Clase I',
      ii: 'Clase II',
      'clase 2': 'Clase II',
      'equipo energizado internamente': 'Energizado internamente',
      'internamente energizado': 'Energizado internamente'
    }
  );
  const appliedPartType = canonicalValue(
    appliedPartTypeRaw,
    options.appliedPartTypes,
    {
      na: 'No aplica',
      'n/a': 'No aplica',
      'sin parte aplicada': 'No aplica',
      b: 'Tipo B',
      bf: 'Tipo BF',
      cf: 'Tipo CF'
    }
  );

  if (requiresSanitaryClassification) {
    if (!sanitaryRiskClassRaw) {
      errors.push('Clasificación de riesgo sanitario es obligatoria cuando el equipo la requiere');
    } else if (!riskClass) {
      errors.push(`Clasificación de riesgo sanitario no permitida. Usa: ${options.sanitaryRiskClasses.join(', ')}`);
    }
  } else if (sanitaryRiskClassRaw) {
    errors.push('Clasificación de riesgo sanitario debe estar vacía cuando el equipo no la requiere');
  }

  if (requiresElectricalClassification) {
    if (!electricalProtectionClassRaw) {
      errors.push('Clase de protección eléctrica es obligatoria cuando el equipo requiere clasificación eléctrica');
    } else if (!electricalProtectionClass) {
      errors.push(`Clase de protección eléctrica no permitida. Usa: ${options.electricalProtectionClasses.join(', ')}`);
    }
    if (!appliedPartTypeRaw) {
      errors.push('Tipo de parte aplicada es obligatorio cuando el equipo requiere clasificación eléctrica');
    } else if (!appliedPartType) {
      errors.push(`Tipo de parte aplicada no permitido. Usa: ${options.appliedPartTypes.join(', ')}`);
    }
  } else {
    if (electricalProtectionClassRaw) {
      errors.push('Clase de protección eléctrica debe estar vacía cuando el equipo no requiere clasificación eléctrica');
    }
    if (appliedPartTypeRaw) {
      errors.push('Tipo de parte aplicada debe estar vacío cuando el equipo no requiere clasificación eléctrica');
    }
  }

  return {
    requiresSanitaryClassification,
    riskClass: requiresSanitaryClassification ? riskClass : undefined,
    requiresElectricalClassification,
    electricalProtectionClass: requiresElectricalClassification ? electricalProtectionClass : undefined,
    appliedPartType: requiresElectricalClassification ? appliedPartType : undefined,
    errors
  };
}
