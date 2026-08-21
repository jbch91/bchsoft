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

export function canOperateAssignedMaintenanceRequest(request, userId, isPlatformSuperuser = false) {
  if (isPlatformSuperuser) return true;
  return !request?.assigned_to || request.assigned_to === userId;
}
