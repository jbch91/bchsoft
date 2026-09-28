export function isStorekeeperWorkspace(user) {
  return Boolean(user?.roles?.includes('almacenista')
    && !user.roles.includes('ingeniero_biomedico')
    && !user.roles.includes('client_admin'));
}

export function maintenanceAcceptanceError(report, user, { alreadySigned = false } = {}) {
  if (alreadySigned) return null;
  if (report.acceptance_delegate_user_id) {
    if (report.acceptance_delegate_user_id !== user.sub || !user.roles?.includes('almacenista')) {
      return 'Este protocolo fue enviado a un almacenista específico para su firma de recepción.';
    }
    if (!user.permissions?.includes('maintenance:report:sign')) {
      return 'El administrador debe habilitar el permiso de firma de mantenimiento.';
    }
    return null;
  }
  if (isStorekeeperWorkspace(user) && !user.roles?.includes('responsable_area')) {
    return 'El ingeniero debe enviar primero este protocolo a tu bandeja de firmas.';
  }
  if (report.area_responsible_required && !user.roles?.includes('responsable_area')) {
    return 'Este reporte requiere el aval de un responsable asignado al área.';
  }
  return null;
}
