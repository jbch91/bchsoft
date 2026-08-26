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
