export const SANITARY_RISK_CLASSES = Object.freeze([
  'Clase I',
  'Clase IIA',
  'Clase IIB',
  'Clase III'
]);

export const ELECTRICAL_PROTECTION_CLASSES = Object.freeze([
  'Clase I',
  'Clase II',
  'Energizado internamente'
]);

export const APPLIED_PART_TYPES = Object.freeze([
  'No aplica',
  'Tipo B',
  'Tipo BF',
  'Tipo CF'
]);

function normalizedText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalFromList(value, allowedValues, aliases = {}) {
  const normalized = normalizedText(value);
  if (!normalized) return null;
  const alias = aliases[normalized];
  if (alias) return alias;
  return allowedValues.find((item) => normalizedText(item) === normalized) ?? null;
}

function parseRequirement(payload, field, label, errors) {
  if (!Object.prototype.hasOwnProperty.call(payload, field) || payload[field] === undefined || payload[field] === null) {
    return { provided: false, value: null };
  }
  const value = payload[field];
  if (value === true || value === false) {
    return { provided: true, value };
  }
  const normalized = normalizedText(value);
  if (['si', 'true', '1', 'x'].includes(normalized)) {
    return { provided: true, value: true };
  }
  if (['no', 'false', '0'].includes(normalized)) {
    return { provided: true, value: false };
  }
  errors.push(`${label} debe ser Sí o No`);
  return { provided: true, value: null };
}

export function normalizeBiomedicalRiskClassifications(payload = {}) {
  const errors = [];
  const riskClassRaw = String(payload.riskClass ?? '').trim();
  const electricalClassRaw = String(payload.electricalProtectionClass ?? '').trim();
  const appliedPartTypeRaw = String(payload.appliedPartType ?? '').trim();

  const sanitaryRequirement = parseRequirement(
    payload,
    'requiresSanitaryClassification',
    'Requiere riesgo sanitario',
    errors
  );
  const electricalRequirement = parseRequirement(
    payload,
    'requiresElectricalClassification',
    'Requiere riesgo eléctrico',
    errors
  );

  // Templates and API clients created before these switches used riskClass directly.
  const requiresSanitaryClassification = sanitaryRequirement.provided
    ? sanitaryRequirement.value === true
    : Boolean(riskClassRaw);
  const requiresElectricalClassification = electricalRequirement.provided
    ? electricalRequirement.value === true
    : Boolean(electricalClassRaw || appliedPartTypeRaw);

  const riskClass = canonicalFromList(riskClassRaw, SANITARY_RISK_CLASSES, {
    i: 'Clase I',
    'clase 1': 'Clase I',
    iia: 'Clase IIA',
    'clase ii a': 'Clase IIA',
    iib: 'Clase IIB',
    'clase ii b': 'Clase IIB',
    iii: 'Clase III',
    'clase 3': 'Clase III'
  });
  const electricalProtectionClass = canonicalFromList(
    electricalClassRaw,
    ELECTRICAL_PROTECTION_CLASSES,
    {
      i: 'Clase I',
      'clase 1': 'Clase I',
      ii: 'Clase II',
      'clase 2': 'Clase II',
      'equipo energizado internamente': 'Energizado internamente',
      'internamente energizado': 'Energizado internamente'
    }
  );
  const appliedPartType = canonicalFromList(appliedPartTypeRaw, APPLIED_PART_TYPES, {
    na: 'No aplica',
    'n/a': 'No aplica',
    'sin parte aplicada': 'No aplica',
    b: 'Tipo B',
    bf: 'Tipo BF',
    cf: 'Tipo CF'
  });

  if (requiresSanitaryClassification) {
    if (!riskClassRaw) {
      errors.push('Clasificación de riesgo sanitario es obligatoria cuando el equipo la requiere');
    } else if (!riskClass) {
      errors.push(`Clasificación de riesgo sanitario no permitida. Usa: ${SANITARY_RISK_CLASSES.join(', ')}`);
    }
  } else if (riskClassRaw) {
    errors.push('Clasificación de riesgo sanitario debe estar vacía cuando el equipo no la requiere');
  }

  if (requiresElectricalClassification) {
    if (!electricalClassRaw) {
      errors.push('Clase de protección eléctrica es obligatoria cuando el equipo requiere clasificación eléctrica');
    } else if (!electricalProtectionClass) {
      errors.push(`Clase de protección eléctrica no permitida. Usa: ${ELECTRICAL_PROTECTION_CLASSES.join(', ')}`);
    }
    if (!appliedPartTypeRaw) {
      errors.push('Tipo de parte aplicada es obligatorio cuando el equipo requiere clasificación eléctrica');
    } else if (!appliedPartType) {
      errors.push(`Tipo de parte aplicada no permitido. Usa: ${APPLIED_PART_TYPES.join(', ')}`);
    }
  } else {
    if (electricalClassRaw) {
      errors.push('Clase de protección eléctrica debe estar vacía cuando el equipo no requiere clasificación eléctrica');
    }
    if (appliedPartTypeRaw) {
      errors.push('Tipo de parte aplicada debe estar vacío cuando el equipo no requiere clasificación eléctrica');
    }
  }

  return {
    values: {
      requiresSanitaryClassification,
      riskClass: requiresSanitaryClassification ? riskClass : null,
      requiresElectricalClassification,
      electricalProtectionClass: requiresElectricalClassification ? electricalProtectionClass : null,
      appliedPartType: requiresElectricalClassification ? appliedPartType : null
    },
    errors
  };
}

export function assertBiomedicalRiskClassifications(payload = {}) {
  const result = normalizeBiomedicalRiskClassifications(payload);
  if (result.errors.length) {
    const error = new Error(result.errors.join('. '));
    error.code = 'INVALID_RISK_CLASSIFICATION';
    throw error;
  }
  return result.values;
}
