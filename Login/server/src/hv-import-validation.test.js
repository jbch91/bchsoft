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

test('solo permite garantía cuando existe una fecha de adquisición', () => {
  const missingDate = validateAndNormalizeHvImportAsset({
    acquisitionDate: 'NR',
    warrantyYears: 1,
    requiresCalibration: false
  });
  const noWarranty = validateAndNormalizeHvImportAsset({
    acquisitionDate: 'NR',
    warrantyYears: '',
    requiresCalibration: false
  });

  assert.equal(
    missingDate.errors.includes(
      'La fecha de adquisición es obligatoria cuando el equipo tiene garantía.'
    ),
    true
  );
  assert.deepEqual(noWarranty.errors, []);
  assert.equal(noWarranty.asset.warrantyYears, null);
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

test('separa equipos industriales y descarta campos exclusivamente biomédicos', () => {
  const result = validateAndNormalizeHvImportAsset({
    assetCategory: 'industrial',
    name: 'nevera industrial',
    requiresSanitaryClassification: true,
    riskClass: 'Clase III',
    requiresElectricalClassification: true,
    electricalProtectionClass: 'Clase II',
    appliedPartType: 'Tipo CF',
    requiresCalibration: true,
    calibrationFrequency: 'anual'
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.asset.assetCategory, 'industrial');
  assert.equal(result.asset.name, 'NEVERA INDUSTRIAL');
  assert.equal(result.asset.requiresSanitaryClassification, false);
  assert.equal(result.asset.riskClass, null);
  assert.equal(result.asset.requiresElectricalClassification, false);
  assert.equal(result.asset.electricalProtectionClass, null);
  assert.equal(result.asset.appliedPartType, null);
  assert.equal(result.asset.requiresCalibration, false);
  assert.equal(result.asset.calibrationFrequency, null);
});
