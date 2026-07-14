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
