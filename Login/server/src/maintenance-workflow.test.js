import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOperateAssignedMaintenanceRequest,
  isMaintenanceReportFullySigned,
  maintenanceAssetStatusObservationError,
  maintenanceReportEngineerReopenError,
  maintenancePreventiveItemPhase,
  maintenancePreventiveItemWaitsForSpare,
  maintenanceSpareWorkflowForReport,
  maintenanceRequestDescriptionError,
  normalizeMaintenanceRequestDescription,
  shouldCompletePreventiveScheduleItem,
  summarizeMaintenancePreventiveProgress
} from './maintenance-workflow.js';

test('clasifica el avance operativo de cada preventivo sin mezclar estados', () => {
  assert.equal(maintenancePreventiveItemPhase({}), 'not_started');
  assert.equal(
    maintenancePreventiveItemPhase({ request_status: 'en_proceso' }),
    'in_progress'
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      report_id: 'report-a',
      has_engineer_signature: true,
      area_responsible_required: true
    }),
    'pending_signature'
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      report_id: 'report-b',
      requires_spare_parts: true,
      spare_parts_status: 'solicitado',
      has_engineer_signature: true,
      area_responsible_required: true
    }),
    'pending_signature'
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      report_id: 'report-b',
      requires_spare_parts: true,
      spare_parts_status: 'solicitado',
      has_engineer_signature: true,
      has_area_responsible_signature: true,
      area_responsible_required: true
    }),
    'completed'
  );
  assert.equal(
    maintenancePreventiveItemWaitsForSpare({
      request_status: 'espera_repuesto',
      report_id: 'report-b',
      spare_parts_status: 'solicitado'
    }),
    true
  );
  assert.equal(
    maintenancePreventiveItemWaitsForSpare({
      request_status: 'reportado',
      requires_spare_parts: true,
      spare_parts_status: 'solicitado',
      spare_case_resolved: true
    }),
    false
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      report_id: 'report-c',
      has_engineer_signature: true,
      has_area_responsible_signature: true,
      area_responsible_required: true
    }),
    'completed'
  );
  assert.equal(
    maintenancePreventiveItemPhase({ completion_source: 'historical_pdf' }),
    'completed'
  );
  assert.equal(
    maintenancePreventiveItemPhase({ is_under_warranty: true }),
    'warranty'
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      is_under_warranty: true,
      warranty_resolution: 'perform'
    }),
    'not_started'
  );
  assert.equal(
    maintenancePreventiveItemPhase({
      completion_source: 'software_report',
      report_id: 'report-d',
      has_engineer_signature: true,
      area_responsible_required: true
    }),
    'pending_signature'
  );
});

test('resume el avance mensual y anual con vencidos como indicador transversal', () => {
  const result = summarizeMaintenancePreventiveProgress([
    { planned_date: '2026-08-05', is_overdue: true },
    { planned_date: '2026-08-12', request_status: 'en_proceso', is_overdue: false },
    {
      planned_date: '2026-08-20',
      report_id: 'report-a',
      has_engineer_signature: true,
      area_responsible_required: true,
      request_status: 'espera_repuesto',
      requires_spare_parts: true,
      spare_parts_status: 'solicitado',
      is_overdue: false
    },
    {
      planned_date: '2026-08-22',
      request_status: 'firmado',
      is_overdue: false
    },
    {
      planned_date: '2026-08-25',
      is_under_warranty: true,
      is_overdue: true
    },
    { planned_date: '2026-09-15', completion_source: 'historical_pdf', is_overdue: false }
  ], { year: 2026, month: 8 });

  assert.deepEqual(result.monthly, {
    total: 5,
    not_started: 1,
    in_progress: 1,
    pending_signature: 1,
    waiting_spare: 1,
    warranty: 1,
    completed: 1,
    overdue: 1,
    completion_percent: 25
  });
  assert.equal(result.annual.total, 6);
  assert.equal(result.annual.warranty, 1);
  assert.equal(result.annual.completed, 2);
  assert.equal(result.annual.completion_percent, 40);
});

test('conserva un porcentaje visible cuando el avance es menor al uno por ciento', () => {
  const items = Array.from({ length: 500 }, (_, index) => ({
    planned_date: '2026-08-15',
    ...(index === 0 ? { request_status: 'firmado' } : {})
  }));

  const result = summarizeMaintenancePreventiveProgress(items, { year: 2026, month: 8 });

  assert.equal(result.monthly.completed, 1);
  assert.equal(result.monthly.completion_percent, 0.2);
});

test('exige la firma del ingeniero antes de cualquier aval', () => {
  assert.equal(
    isMaintenanceReportFullySigned(
      { type: 'preventivo', area_responsible_required: true },
      [{ role: 'responsable_area', user_id: 'responsable-a' }]
    ),
    false
  );
});

test('cuando hay responsable asignado solo su aval completa el reporte', () => {
  const report = { type: 'preventivo', area_responsible_required: true };
  const engineer = { role: 'ingeniero_biomedico', user_id: 'ingeniero-a' };

  assert.equal(
    isMaintenanceReportFullySigned(report, [engineer, { role: 'almacenista', user_id: 'almacen-a' }]),
    false
  );
  assert.equal(
    isMaintenanceReportFullySigned(report, [engineer, { role: 'responsable_area', user_id: 'responsable-a' }]),
    true
  );
});

test('conserva el aval legado cuando el área aún no tiene responsable', () => {
  const engineer = { role: 'ingeniero_biomedico', user_id: 'ingeniero-a' };
  assert.equal(
    isMaintenanceReportFullySigned(
      { type: 'preventivo', area_responsible_required: false },
      [engineer, { role: 'lector', user_id: 'lector-a' }]
    ),
    true
  );
  assert.equal(
    isMaintenanceReportFullySigned(
      {
        type: 'correctivo',
        requested_by: 'solicitante-a',
        area_responsible_required: false
      },
      [engineer, { role: 'usuario', user_id: 'solicitante-a' }]
    ),
    true
  );
});

test('permite al ingeniero autor reabrir un preventivo solo antes del aval', () => {
  const report = {
    type: 'preventivo',
    created_by: 'ingeniero-a',
    request_status: 'reportado',
    area_responsible_required: true,
    correction_requested: false
  };
  const engineerSignature = [{
    role: 'ingeniero_biomedico',
    user_id: 'ingeniero-a'
  }];

  assert.equal(
    maintenanceReportEngineerReopenError(report, engineerSignature, 'ingeniero-a'),
    ''
  );
  assert.equal(
    maintenanceReportEngineerReopenError(report, engineerSignature, 'ingeniero-b'),
    'not_owner'
  );
  assert.equal(
    maintenanceReportEngineerReopenError(
      report,
      [...engineerSignature, { role: 'responsable_area', user_id: 'responsable-a' }],
      'ingeniero-a'
    ),
    'accepted_signature_exists'
  );
  assert.equal(
    maintenanceReportEngineerReopenError(
      { ...report, request_status: 'firmado' },
      engineerSignature,
      'ingeniero-a'
    ),
    'already_finalized'
  );
  assert.equal(
    maintenanceReportEngineerReopenError(
      { ...report, type: 'correctivo' },
      engineerSignature,
      'ingeniero-a'
    ),
    'not_preventive'
  );
});

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

test('el preventivo cierra su ítem y la instalación posterior queda como correctivo', () => {
  assert.equal(
    shouldCompletePreventiveScheduleItem({
      requestType: 'preventivo',
      reportType: 'preventivo'
    }),
    true
  );
  assert.equal(
    shouldCompletePreventiveScheduleItem({
      requestType: 'preventivo',
      reportType: 'correctivo'
    }),
    false
  );
  assert.equal(
    shouldCompletePreventiveScheduleItem({
      requestType: 'correctivo',
      reportType: 'correctivo'
    }),
    false
  );
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
