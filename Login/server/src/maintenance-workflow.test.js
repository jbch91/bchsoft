import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOperateAssignedMaintenanceRequest,
  maintenanceAssetStatusObservationError,
  maintenanceSpareWorkflowForReport,
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

test('exige observaciones para estados finales condicionados', () => {
  assert.equal(maintenanceAssetStatusObservationError('operativo', ''), '');
  assert.match(
    maintenanceAssetStatusObservationError('operativo_observacion', ''),
    /observación/
  );
  assert.match(
    maintenanceAssetStatusObservationError('fuera_de_servicio', 'No'),
    /fuera de servicio/
  );
  assert.equal(
    maintenanceAssetStatusObservationError('fuera_de_servicio', 'Falla eléctrica pendiente de diagnóstico.'),
    ''
  );
});

test('un primer reporte solo puede solicitar el repuesto', () => {
  assert.deepEqual(
    maintenanceSpareWorkflowForReport({
      requestStatus: 'en_proceso',
      requiresSpareParts: true,
      lifecycleAction: null,
      correctionSpareStatus: null,
      installedDuringService: false
    }),
    { requiresSpareParts: true, sparePartsStatus: 'solicitado' }
  );
});

test('la instalación solo se registra desde un caso en espera de repuesto', () => {
  assert.deepEqual(
    maintenanceSpareWorkflowForReport({
      requestStatus: 'espera_repuesto',
      requiresSpareParts: false,
      lifecycleAction: null,
      correctionSpareStatus: null,
      installedDuringService: false
    }),
    { requiresSpareParts: true, sparePartsStatus: 'recibido' }
  );
});

test('la baja técnica cierra el flujo sin instalación', () => {
  assert.deepEqual(
    maintenanceSpareWorkflowForReport({
      requestStatus: 'espera_repuesto',
      requiresSpareParts: true,
      lifecycleAction: 'retire',
      correctionSpareStatus: null,
      installedDuringService: false
    }),
    { requiresSpareParts: false, sparePartsStatus: 'no_aplica' }
  );
});

test('una corrección conserva el estado instalado del reporte original', () => {
  assert.deepEqual(
    maintenanceSpareWorkflowForReport({
      requestStatus: 'correccion',
      requiresSpareParts: false,
      lifecycleAction: null,
      correctionSpareStatus: 'recibido',
      installedDuringService: false
    }),
    { requiresSpareParts: true, sparePartsStatus: 'recibido' }
  );
});

test('permite documentar un repuesto instalado durante el correctivo inicial', () => {
  assert.deepEqual(
    maintenanceSpareWorkflowForReport({
      requestStatus: 'en_proceso',
      requiresSpareParts: true,
      lifecycleAction: null,
      correctionSpareStatus: null,
      installedDuringService: true
    }),
    { requiresSpareParts: true, sparePartsStatus: 'recibido' }
  );
});
