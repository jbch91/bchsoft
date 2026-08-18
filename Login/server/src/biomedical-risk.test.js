import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertBiomedicalRiskClassifications,
  normalizeBiomedicalRiskClassifications
} from './biomedical-risk.js';

test('normaliza clasificaciones sanitaria y eléctrica válidas', () => {
  const result = normalizeBiomedicalRiskClassifications({
    requiresSanitaryClassification: 'Sí',
    riskClass: 'clase ii a',
    requiresElectricalClassification: true,
    electricalProtectionClass: 'equipo energizado internamente',
    appliedPartType: 'bf'
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.values, {
    requiresSanitaryClassification: true,
    riskClass: 'Clase IIA',
    requiresElectricalClassification: true,
    electricalProtectionClass: 'Energizado internamente',
    appliedPartType: 'Tipo BF'
  });
});

test('exige los valores asociados únicamente cuando la clasificación aplica', () => {
  const missing = normalizeBiomedicalRiskClassifications({
    requiresSanitaryClassification: true,
    riskClass: '',
    requiresElectricalClassification: true,
    electricalProtectionClass: 'Clase I',
    appliedPartType: ''
  });
  const inactive = normalizeBiomedicalRiskClassifications({
    requiresSanitaryClassification: false,
    riskClass: 'Clase I',
    requiresElectricalClassification: false,
    appliedPartType: 'Tipo B'
  });

  assert.equal(missing.errors.some((error) => error.includes('riesgo sanitario es obligatoria')), true);
  assert.equal(missing.errors.some((error) => error.includes('parte aplicada es obligatorio')), true);
  assert.equal(inactive.errors.some((error) => error.includes('riesgo sanitario debe estar vacía')), true);
  assert.equal(inactive.errors.some((error) => error.includes('parte aplicada debe estar vacío')), true);
});

test('mantiene compatibilidad con payloads anteriores que solo enviaban riskClass', () => {
  const result = assertBiomedicalRiskClassifications({ riskClass: 'Clase III' });

  assert.equal(result.requiresSanitaryClassification, true);
  assert.equal(result.riskClass, 'Clase III');
  assert.equal(result.requiresElectricalClassification, false);
  assert.equal(result.electricalProtectionClass, null);
  assert.equal(result.appliedPartType, null);
});
