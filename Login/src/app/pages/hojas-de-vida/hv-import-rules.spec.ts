import {
  isNotRegisteredMarker,
  normalizeOptionalRecordedValue,
  resolveHvCalibrationImport,
  resolveHvRiskImport
} from './hv-import-rules';

describe('reglas de importación de hojas de vida', () => {
  it('acepta NR o una celda vacía como dato no registrado', () => {
    expect(isNotRegisteredMarker('NR')).toBe(true);
    expect(isNotRegisteredMarker('No registra')).toBe(true);
    expect(normalizeOptionalRecordedValue(' N/R ')).toBeUndefined();
    expect(normalizeOptionalRecordedValue('')).toBeUndefined();
    expect(normalizeOptionalRecordedValue('proveedor@correo.com')).toBe('proveedor@correo.com');
  });

  it('valida las clasificaciones sanitaria y eléctrica según sus activadores', () => {
    const valid = resolveHvRiskImport({
      requiresSanitaryValue: 'Sí',
      sanitaryRiskClassValue: 'clase ii b',
      requiresElectricalValue: 'Sí',
      electricalProtectionClassValue: 'Clase II',
      appliedPartTypeValue: 'bf',
      sanitaryRequirementColumnPresent: true,
      electricalRequirementColumnPresent: true,
      sanitaryRiskClasses: ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'],
      electricalProtectionClasses: ['Clase I', 'Clase II', 'Energizado internamente'],
      appliedPartTypes: ['No aplica', 'Tipo B', 'Tipo BF', 'Tipo CF']
    });

    expect(valid).toEqual({
      requiresSanitaryClassification: true,
      riskClass: 'Clase IIB',
      requiresElectricalClassification: true,
      electricalProtectionClass: 'Clase II',
      appliedPartType: 'Tipo BF',
      errors: []
    });
  });

  it('acepta la plantilla anterior e impide valores en clasificaciones desactivadas', () => {
    const legacy = resolveHvRiskImport({
      requiresSanitaryValue: '',
      sanitaryRiskClassValue: 'Clase III',
      requiresElectricalValue: '',
      electricalProtectionClassValue: '',
      appliedPartTypeValue: '',
      sanitaryRequirementColumnPresent: false,
      electricalRequirementColumnPresent: false,
      sanitaryRiskClasses: ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'],
      electricalProtectionClasses: ['Clase I', 'Clase II', 'Energizado internamente'],
      appliedPartTypes: ['No aplica', 'Tipo B', 'Tipo BF', 'Tipo CF']
    });
    const inactive = resolveHvRiskImport({
      requiresSanitaryValue: 'No',
      sanitaryRiskClassValue: 'Clase I',
      requiresElectricalValue: 'No',
      electricalProtectionClassValue: 'Clase I',
      appliedPartTypeValue: 'Tipo B',
      sanitaryRequirementColumnPresent: true,
      electricalRequirementColumnPresent: true,
      sanitaryRiskClasses: ['Clase I', 'Clase IIA', 'Clase IIB', 'Clase III'],
      electricalProtectionClasses: ['Clase I', 'Clase II', 'Energizado internamente'],
      appliedPartTypes: ['No aplica', 'Tipo B', 'Tipo BF', 'Tipo CF']
    });

    expect(legacy.errors).toEqual([]);
    expect(legacy.requiresSanitaryClassification).toBe(true);
    expect(legacy.riskClass).toBe('Clase III');
    expect(inactive.errors).toContain(
      'Clasificación de riesgo sanitario debe estar vacía cuando el equipo no la requiere'
    );
    expect(inactive.errors).toContain(
      'Clase de protección eléctrica debe estar vacía cuando el equipo no requiere clasificación eléctrica'
    );
  });

  it('no permite una frecuencia cuando el equipo no requiere calibración', () => {
    const result = resolveHvCalibrationImport('No', 'anual', ['mensual', 'anual']);

    expect(result.requiresCalibration).toBe(false);
    expect(result.calibrationFrequency).toBeUndefined();
    expect(result.errors).toContain(
      'Frecuencia de calibración debe estar vacía cuando el equipo no requiere calibración'
    );
  });

  it('exige una frecuencia válida cuando el equipo requiere calibración', () => {
    const missing = resolveHvCalibrationImport('Sí', '', ['mensual', 'anual']);
    const valid = resolveHvCalibrationImport('Sí', 'Anual', ['mensual', 'anual']);

    expect(missing.errors).toContain(
      'Frecuencia de calibración es obligatoria cuando el equipo requiere calibración'
    );
    expect(valid).toEqual({
      requiresCalibration: true,
      calibrationFrequency: 'anual',
      errors: []
    });
  });
});
