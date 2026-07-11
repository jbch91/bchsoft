import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUITE_ACCESS_PERMISSIONS,
  allowedClientPermissionsForModules
} from './permission-policy.js';

test('habilita solo permisos de modulos contratados', () => {
  const permissions = allowedClientPermissionsForModules([
    { key: 'hojas_de_vida', suite_key: 'biomedico', enabled: true },
    { key: 'calibraciones', suite_key: 'biomedico', enabled: false }
  ]);

  assert.equal(permissions.has('areas:manage'), true);
  assert.equal(permissions.has('hb:view'), true);
  assert.equal(permissions.has('hb:import'), true);
  assert.equal(permissions.has('calibration:report:upload'), false);
});

test('excluye permisos temporales de la configuracion permanente del rol', () => {
  const permissions = allowedClientPermissionsForModules(
    [{ key: 'hojas_de_vida', suite_key: 'biomedico', enabled: true }],
    { includeTemporary: false }
  );

  assert.equal(permissions.has('hb:create'), true);
  assert.equal(permissions.has('hb:import'), false);
  assert.equal(permissions.has('asset_history:upload'), false);
});

test('el acceso a cada software reconoce todos sus permisos operativos', () => {
  assert.equal(SUITE_ACCESS_PERMISSIONS.biomedico.includes('areas:manage'), true);
  assert.equal(SUITE_ACCESS_PERMISSIONS.biomedico.includes('quick_guides:view'), true);
  assert.equal(SUITE_ACCESS_PERMISSIONS.odontologico.includes('odontology:financial:view'), true);
  assert.equal(SUITE_ACCESS_PERMISSIONS.laboratorio.includes('laboratory:results:manage'), true);
});
