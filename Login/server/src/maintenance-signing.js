export function createMaintenanceReportSignHandler(deps) {
  return async (req, res) => {
    let result;
    const warnings = [];
    const attempt = async (step, operation) => {
      try {
        return await operation();
      } catch (error) {
        warnings.push(step);
        deps.logError(`Maintenance signing ${step} (${req.params.id})`, error);
        return null;
      }
    };
    try {
      const report = await deps.getMaintenanceReportById(req.params.id);
      if (!report) return res.status(404).json({ message: 'Reporte no encontrado.' });
      if (req.user.clientId && req.user.clientId !== report.client_id) {
        return res.status(403).json({ message: 'Sin acceso al cliente.' });
      }
      if (report.area_responsible_required && !req.user.roles?.includes('responsable_area')) {
        return res.status(403).json({ message: 'Este reporte requiere el aval de un responsable asignado al area.' });
      }
      if (deps.isAreaScopedOperationalUser(req.user)
        && !await deps.readerCanAccessAsset(report.client_id, req.user.sub, report.asset_id)) {
        return res.status(403).json({ message: 'Sin acceso al equipo.' });
      }
      if (report.correction_requested) {
        return res.status(409).json({ message: 'Este reporte tiene una correccion pendiente y no puede firmarse todavia.' });
      }
      const signatures = await deps.listReportSignatures(report.id);
      const existing = signatures.find((signature) => signature.user_id === req.user.sub);
      const role = deps.maintenanceAcceptanceRoleForUser(req.user);
      if (existing) {
        // Reconcile an interrupted response without replacing the original signature.
        result = await deps.signMaintenanceReport({ reportId: report.id, userId: req.user.sub });
      } else {
        const user = await deps.getUserById(req.user.sub);
        if (!user?.signature_path) {
          return res.status(400).json({ message: 'Firma no registrada para este usuario.' });
        }
        if (!deps.resolveStoredFilePath(user.signature_path)) {
          return res.status(400).json({ message: 'La firma registrada no esta disponible. Solicita al administrador volver a cargarla.' });
        }
        result = await deps.signMaintenanceReportWithSnapshot({
          reportId: report.id, clientId: report.client_id, user, role
        });
      }
      if (!result) throw new Error('La firma no devolvio confirmacion de guardado.');

      if (!signatures.some((signature) => signature.role === 'ingeniero_biomedico')) {
        const engineerResult = await attempt('engineer_signature', async () => {
          const engineer = await deps.getUserById(report.created_by);
          if (!engineer?.signature_path || !deps.resolveStoredFilePath(engineer.signature_path)) return null;
          return deps.signMaintenanceReportWithSnapshot({
            reportId: report.id, clientId: report.client_id, user: engineer, role: 'ingeniero_biomedico'
          });
        });
        if (engineerResult) {
          result.is_fully_signed = engineerResult.is_fully_signed;
          result.request_status = engineerResult.request_status;
        }
      }

      // PDF, audit and notification errors cannot undo a committed signature or crash Express.
      const asset = await attempt('asset', () => deps.getAssetById(report.client_id, report.asset_id));
      if (!result.alreadySigned) {
        await attempt('audit', async () => {
          await deps.logEquipmentAudit(req, {
            action: 'MAINTENANCE_REPORT_SIGN', clientId: report.client_id,
            assetId: report.asset_id, asset,
            description: `Firma de reporte de mantenimiento para ${deps.assetLabel(asset)}.`,
            details: {
              eventType: 'reporte_mantenimiento_firmado', reportId: report.id,
              requestId: report.request_id, signerRole: role, signatureId: result.id
            }
          });
          if (result.is_fully_signed) {
            const waitingSpare = report.requires_spare_parts && report.spare_parts_status !== 'recibido';
            await deps.logEquipmentAudit(req, {
              action: waitingSpare ? 'MAINTENANCE_REPORT_SIGNED_WAITING_SPARE' : 'MAINTENANCE_REPORT_FINALIZED',
              clientId: report.client_id, assetId: report.asset_id, asset,
              description: waitingSpare
                ? `Reporte firmado y en espera de repuesto para ${deps.assetLabel(asset)}.`
                : `Reporte de mantenimiento finalizado para ${deps.assetLabel(asset)}.`,
              details: {
                eventType: waitingSpare ? 'reporte_mantenimiento_firmado_espera_repuesto' : 'reporte_mantenimiento_finalizado',
                reportId: report.id, requestId: report.request_id
              }
            });
          }
        });
      }
      await attempt('pdf', async () => {
        if (!await deps.writeMaintenanceReportPdfFile(report.id)) throw new Error('PDF no disponible.');
      });
      if (report.created_by) {
        await attempt('notification', () => deps.createNotificationOnce({
          userId: report.created_by, clientId: report.client_id, title: 'Reporte firmado',
          message: result.is_fully_signed
            ? report.requires_spare_parts && report.spare_parts_status !== 'recibido'
              ? 'El reporte fue firmado y validado. El caso continua abierto en espera de repuesto.'
              : 'El reporte fue firmado y queda finalizado.'
            : 'El reporte recibio una firma, pero aun tiene firmas pendientes.',
          link: deps.maintenanceRouteForAsset(asset), type: 'maintenance_report_signed', priority: 'normal',
          data: { reportId: report.id, requestId: report.request_id, assetId: report.asset_id }
        }));
      }
      return res.json({ ...result, reportId: report.id, warnings });
    } catch (error) {
      deps.logError(`Maintenance signing failed (${req.params.id})`, error);
      if (result?.id) {
        return res.json({ ...result, reportId: req.params.id, warnings: [...warnings, 'post_signature'] });
      }
      const status = [400, 403, 404, 409].includes(error?.status) ? error.status : 500;
      return res.status(status).json({
        message: status === 500
          ? 'No se pudo confirmar la firma. Consulta el estado del reporte antes de reintentar.'
          : error.message
      });
    }
  };
}
