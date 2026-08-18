import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAndNormalizeHvImportAsset } from './hv-import-validation.js';

test('normaliza NR en fecha y correo como datos no registrados', () => {
  const result = validateAndNormalizeHvImportAsset({
    acquisitionDate: 'NR',
    supplierEmail: 'No registra',
    requiresCalibration: false,
    calibrationFrequency: ''
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.asset.acquisitionDate, null);
  assert.equal(result.asset.supplierEmail, null);
});

test('rechaza frecuencia cuando el equipo no requiere calibración', () => {
  const result = validateAndNormalizeHvImportAsset({
    requiresCalibration: false,
    calibrationFrequency: 'anual'
  });

  assert.equal(result.errors.includes(
    'Frecuencia de calibración debe estar vacía cuando el equipo no requiere calibración'
  ), true);
  assert.equal(result.asset.calibrationFrequency, null);
});

test('exige frecuencia válida cuando el equipo requiere calibración', () => {
  const missing = validateAndNormalizeHvImportAsset({
    requiresCalibration: true,
    calibrationFrequency: ''
  });
  const valid = validateAndNormalizeHvImportAsset({
    acquisitionDate: '2020-02-29',
    supplierEmail: 'proveedor@correo.com',
    requiresCalibration: 'Sí',
    calibrationFrequency: 'Anual'
  });

  assert.equal(missing.errors.includes(
    'Frecuencia de calibración es obligatoria cuando el equipo requiere calibración'
  ), true);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.asset.requiresCalibration, true);
  assert.equal(valid.asset.calibrationFrequency, 'anual');
});

test('rechaza fechas inexistentes y correos inválidos', () => {
  const result = validateAndNormalizeHvImportAsset({
    acquisitionDate: '2021-02-29',
    supplierEmail: 'NR@',
    requiresCalibration: false
  });

  assert.equal(result.errors.some((error) => error.startsWith('Fecha adquisición')), true);
  assert.equal(result.errors.some((error) => error.startsWith('Correo proveedor')), true);
});

test('convierte equipo, marca y modelo importados a mayúsculas', () => {
  const result = validateAndNormalizeHvImportAsset({
    name: '  monitor de signos vitales ',
    brand: 'Mindray',
    model: 'uMEC 12',
    requiresCalibration: false
  });

  assert.equal(result.asset.name, 'MONITOR DE SIGNOS VITALES');
  assert.equal(result.asset.brand, 'MINDRAY');
  assert.equal(result.asset.model, 'UMEC 12');
});

test('valida y normaliza los riesgos condicionales de la importación', () => {
  const valid = validateAndNormalizeHvImportAsset({
    requiresSanitaryClassification: 'Sí',
    riskClass: 'clase iib',
    requiresElectricalClassification: 'Sí',
    electricalProtectionClass: 'Clase II',
    appliedPartType: 'CF',
    requiresCalibration: false
  });
  const invalid = validateAndNormalizeHvImportAsset({
    requiresSanitaryClassification: 'No',
    riskClass: 'Clase I',
    requiresElectricalClassification: 'Sí',
    electricalProtectionClass: '',
    appliedPartType: '',
    requiresCalibration: false
  });

  assert.deepEqual(valid.errors, []);
  assert.equal(valid.asset.riskClass, 'Clase IIB');
  assert.equal(valid.asset.electricalProtectionClass, 'Clase II');
  assert.equal(valid.asset.appliedPartType, 'Tipo CF');
  assert.equal(invalid.errors.some((error) => error.includes('riesgo sanitario debe estar vacía')), true);
  assert.equal(invalid.errors.some((error) => error.includes('protección eléctrica es obligatoria')), true);
});
