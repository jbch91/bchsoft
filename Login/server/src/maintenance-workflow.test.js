import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOperateAssignedMaintenanceRequest,
  maintenanceRequestDescriptionError,
  normalizeMaintenanceRequestDescription
} from './maintenance-workflow.js';

test('normaliza la descripción de una solicitud de mantenimiento', () => {
  assert.equal(
    normalizeMaintenanceRequestDescription('  Falla   intermitente\n en pantalla  '),
    'Falla intermitente en pantalla'
  );
});

test('exige una descripción útil para solicitudes correctivas', () => {
  assert.match(maintenanceRequestDescriptionError('correctivo', 'No sirve'), /10 caracteres/);
  assert.equal(
    maintenanceRequestDescriptionError('correctivo', 'Pantalla sin imagen'),
    ''
  );
  assert.equal(maintenanceRequestDescriptionError('preventivo', ''), '');
});

test('limita la operación al ingeniero que tomó la solicitud', () => {
  const request = { assigned_to: 'ingeniero-a' };
  assert.equal(canOperateAssignedMaintenanceRequest(request, 'ingeniero-a'), true);
  assert.equal(canOperateAssignedMaintenanceRequest(request, 'ingeniero-b'), false);
  assert.equal(canOperateAssignedMaintenanceRequest({ assigned_to: null }, 'ingeniero-b'), true);
  assert.equal(canOperateAssignedMaintenanceRequest(request, 'superuser', true), true);
});
