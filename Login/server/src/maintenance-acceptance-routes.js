import { setMaintenanceAcceptanceDelegate } from './maintenance-acceptance-delegation.js';

export function registerMaintenanceAcceptanceRoutes(app, deps) {
  const base = '/maintenance/reports/:id';
  const authorize = async req => {
    const report = await deps.getMaintenanceReportById(req.params.id);
    if (!report) throw Object.assign(new Error('Reporte no encontrado.'), { status: 404 });
    if (!req.user.clientId || report.client_id !== req.user.clientId
      || report.created_by !== req.user.sub || !req.user.roles.includes('ingeniero_biomedico')) {
      throw Object.assign(new Error('Solo el ingeniero autor puede gestionar esta solicitud de firma.'), { status: 403 });
    }
    return report;
  };
  const fail = (res, error) => {
    if (!error.status) console.error('Maintenance acceptance delegation', error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'No se pudo gestionar la firma. Actualiza el reporte antes de reintentar.' });
  };
  app.get(`${base}/acceptance-delegates`, deps.requireAuth, deps.requirePermission('maintenance:report:create'), async (req, res) => {
    try {
      const report = await authorize(req);
      const users = await deps.listUsersByRoleAndClient('almacenista', report.client_id);
      const candidates = [];
      for (const user of users) {
        const current = await deps.getCurrentSessionUser(user.id);
        if (user.id !== req.user.sub && current.permissions.includes('maintenance:report:sign')) {
          candidates.push({ id: user.id, name: user.display_name, hasSignature: Boolean(deps.resolveStoredFilePath(user.signature_path)) });
        }
      }
      return res.json(candidates);
    } catch (error) { return fail(res, error); }
  });
  app.post(`${base}/acceptance-delegate`, deps.requireAuth, deps.requirePermission('maintenance:report:create'), async (req, res) => {
    try {
      await authorize(req);
      if (!Object.hasOwn(req.body || {}, 'delegateUserId')) {
        return res.status(400).json({ message: 'Selecciona un destinatario o solicita restaurar el aval habitual.' });
      }
      if (req.body.delegateUserId) {
        const candidates = await deps.listUsersByRoleAndClient('almacenista', req.user.clientId);
        const candidate = candidates.find(user => user.id === req.body.delegateUserId);
        if (!candidate || !deps.resolveStoredFilePath(candidate.signature_path)) {
          return res.status(400).json({ message: 'Selecciona un almacenista del cliente con su firma disponible.' });
        }
      }
      const report = await setMaintenanceAcceptanceDelegate({ reportId: req.params.id, actor: req.user,
        delegateUserId: req.body.delegateUserId, reason: req.body.reason });
      const warnings = [];
      if (report.delegation_unchanged) return res.json({ report, warnings });
      try {
        const asset = await deps.getAssetById(report.client_id, report.asset_id);
        const request = await deps.getMaintenanceRequestById(report.request_id);
        const plan = await deps.buildMaintenanceReportSigningPlan(report.client_id, asset, request, report);
        for (const user of plan.users) {
          await deps.createNotification({ userId: user.id, clientId: report.client_id,
            title: report.acceptance_delegate_user_id ? 'Firma de recepción solicitada a almacén' : 'Aval de mantenimiento pendiente',
            message: report.acceptance_delegate_user_id
              ? `Se solicita tu firma para finalizar el protocolo ${report.type} de ${deps.assetLabel(asset)}. Motivo: ${report.acceptance_delegation_reason}`
              : `Se restableció el destinatario habitual del protocolo de ${deps.assetLabel(asset)}.`,
            link: `${deps.maintenanceRouteForAsset(asset)}?view=reportes&reportId=${report.id}`,
            type: 'maintenance_report_ready', priority: 'high',
            data: { reportId: report.id, requestId: report.request_id, assetId: report.asset_id }
          });
        }
      } catch (error) { console.error('Delegation notification', error); warnings.push('notification'); }
      return res.json({ report, warnings });
    } catch (error) { return fail(res, error); }
  });
}
