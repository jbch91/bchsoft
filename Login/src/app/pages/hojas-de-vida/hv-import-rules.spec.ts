import {
  isNotRegisteredMarker,
  normalizeOptionalRecordedValue,
  resolveHvCalibrationImport
} from './hv-import-rules';

describe('reglas de importación de hojas de vida', () => {
  it('acepta NR o una celda vacía como dato no registrado', () => {
    expect(isNotRegisteredMarker('NR')).toBe(true);
    expect(isNotRegisteredMarker('No registra')).toBe(true);
    expect(normalizeOptionalRecordedValue(' N/R ')).toBeUndefined();
    expect(normalizeOptionalRecordedValue('')).toBeUndefined();
    expect(normalizeOptionalRecordedValue('proveedor@correo.com')).toBe('proveedor@correo.com');
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
