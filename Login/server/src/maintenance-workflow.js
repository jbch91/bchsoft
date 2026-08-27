export const MAINTENANCE_REQUEST_CLAIMABLE_STATUSES = Object.freeze([
  'abierto',
  'en_proceso'
]);

export const MAINTENANCE_REQUEST_REPORTABLE_STATUSES = Object.freeze([
  'abierto',
  'en_proceso',
  'espera_repuesto',
  'correccion'
]);

export function maintenancePreventiveItemWaitsForSpare(item = {}) {
  return Boolean(
    !item.spare_case_resolved
    && (
      item.request_status === 'espera_repuesto'
      || (item.requires_spare_parts && item.spare_parts_status !== 'recibido')
    )
  );
}

export function maintenancePreventiveItemPhase(item = {}) {
  if (
    item.legacy_history_file_id
    || (item.completion_source && item.completion_source !== 'software_report')
  ) {
    return 'completed';
  }

  const hasEngineerSignature = Boolean(item.has_engineer_signature);
  const hasAcceptanceSignature = item.area_responsible_required
    ? Boolean(item.has_area_responsible_signature)
    : Boolean(item.has_acceptance_signature);
  if (item.correction_requested || item.request_status === 'correccion') {
    return 'in_progress';
  }
  if (
    item.request_status === 'firmado'
    || (hasEngineerSignature && hasAcceptanceSignature)
  ) {
    return 'completed';
  }

  if (item.report_id) {
    return 'pending_signature';
  }
  if (item.request_status === 'en_proceso' || item.request_status === 'espera_repuesto') {
    return 'in_progress';
  }
  return 'not_started';
}

function emptyPreventiveProgressSummary() {
  return {
    total: 0,
    not_started: 0,
    in_progress: 0,
    pending_signature: 0,
    waiting_spare: 0,
    completed: 0,
    overdue: 0,
    completion_percent: 0
  };
}

function preventiveProgressDateKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
}

function summarizePreventiveItems(items) {
  const summary = emptyPreventiveProgressSummary();
  for (const item of items) {
    const phase = maintenancePreventiveItemPhase(item);
    summary.total += 1;
    summary[phase] += 1;
    if (maintenancePreventiveItemWaitsForSpare(item)) {
      summary.waiting_spare += 1;
    }
    if (item.is_overdue && phase !== 'completed') {
      summary.overdue += 1;
    }
  }
  if (summary.total) {
    const rawCompletionPercent = (summary.completed / summary.total) * 100;
    summary.completion_percent = rawCompletionPercent > 0 && rawCompletionPercent < 1
      ? Number(rawCompletionPercent.toFixed(1))
      : Math.round(rawCompletionPercent);
  }
  return summary;
}

export function summarizeMaintenancePreventiveProgress(items = [], { year, month } = {}) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  const monthPrefix = Number.isInteger(normalizedYear) && Number.isInteger(normalizedMonth)
    ? `${String(normalizedYear).padStart(4, '0')}-${String(normalizedMonth).padStart(2, '0')}-`
    : '';

  return {
    annual: summarizePreventiveItems(items),
    monthly: summarizePreventiveItems(
      monthPrefix
        ? items.filter((item) => preventiveProgressDateKey(item.planned_date).startsWith(monthPrefix))
        : []
    )
  };
}

export function isMaintenanceReportFullySigned(
  report,
  signatures = [],
  legacyAcceptanceRoles = [
    'almacenista',
    'responsable_area',
    'lector',
    'viewer',
    'visor',
    'superuser'
  ]
) {
  const hasEngineer = signatures.some((signature) => signature.role === 'ingeniero_biomedico');
  if (!hasEngineer) return false;

  if (report?.area_responsible_required) {
    return signatures.some((signature) => signature.role === 'responsable_area');
  }

  if (report?.type === 'preventivo') {
    return signatures.some((signature) => legacyAcceptanceRoles.includes(signature.role));
  }

  return signatures.some((signature) =>
    legacyAcceptanceRoles.includes(signature.role)
    || (report?.requested_by && signature.user_id === report.requested_by)
  );
}

export function normalizeMaintenanceRequestDescription(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function maintenanceRequestDescriptionError(type, description) {
  const cleanDescription = normalizeMaintenanceRequestDescription(description);
  if (type === 'correctivo' && cleanDescription.length < 10) {
    return 'Describe la falla o necesidad con al menos 10 caracteres.';
  }
  if (cleanDescription.length > 1000) {
    return 'La descripción admite máximo 1000 caracteres.';
  }
  return '';
}

export function maintenanceAssetStatusObservationError(status, observation) {
  if (status === 'operativo') return '';
  const cleanObservation = String(observation || '').replace(/\s+/g, ' ').trim();
  if (cleanObservation.length < 5) {
    return status === 'operativo_observacion'
      ? 'Describe la observación con la que queda operativo el equipo.'
      : 'Describe por qué el equipo queda fuera de servicio.';
  }
  if (cleanObservation.length > 1000) {
    return 'Las observaciones del estado final admiten máximo 1000 caracteres.';
  }
  return '';
}

export function canOperateAssignedMaintenanceRequest(request, userId, isPlatformSuperuser = false) {
  if (isPlatformSuperuser) return true;
  return !request?.assigned_to || request.assigned_to === userId;
}

export function shouldCompletePreventiveScheduleItem({ requestType, reportType } = {}) {
  return requestType === 'preventivo' && reportType === 'preventivo';
}

export function maintenanceSpareWorkflowForReport({
  requestStatus,
  requiresSpareParts,
  lifecycleAction,
  correctionSpareStatus,
  installedDuringService
}) {
  if (lifecycleAction === 'retire') {
    return { requiresSpareParts: false, sparePartsStatus: 'no_aplica' };
  }
  if (requestStatus === 'espera_repuesto') {
    return { requiresSpareParts: true, sparePartsStatus: 'recibido' };
  }
  if (requestStatus === 'correccion' && correctionSpareStatus === 'recibido') {
    return { requiresSpareParts: true, sparePartsStatus: 'recibido' };
  }
  if (!requiresSpareParts) {
    return { requiresSpareParts: false, sparePartsStatus: 'no_aplica' };
  }
  if (installedDuringService) {
    return { requiresSpareParts: true, sparePartsStatus: 'recibido' };
  }
  return { requiresSpareParts: true, sparePartsStatus: 'solicitado' };
}
