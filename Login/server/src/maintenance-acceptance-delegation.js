import { withTransaction } from './db.js';
import { getCurrentSessionUser } from './auth.js';
import { logAudit } from './audit.js';

const failure = (status, message) => Object.assign(new Error(message), { status });

export async function setMaintenanceAcceptanceDelegate({ reportId, actor, delegateUserId, reason }) {
  if (!actor.clientId || !actor.roles?.includes('ingeniero_biomedico')
    || !actor.permissions?.includes('maintenance:report:create')) {
    throw failure(403, 'Solo el ingeniero autor puede cambiar el destinatario de firma.');
  }
  if (delegateUserId !== null && (typeof delegateUserId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(delegateUserId))) {
    throw failure(400, 'Selecciona un almacenista válido.');
  }
  const cleanReason = String(reason || '').replace(/\s+/g, ' ').trim();
  if (cleanReason.length < 10 || cleanReason.length > 600) {
    throw failure(400, 'Indica un motivo de entre 10 y 600 caracteres.');
  }
  let delegate;
  if (delegateUserId) {
    try { delegate = await getCurrentSessionUser(delegateUserId); } catch { /* Unavailable users are not eligible. */ }
    if (!delegate || delegate.clientId !== actor.clientId || !delegate.roles.includes('almacenista')
      || !delegate.permissions.includes('maintenance:report:sign') || delegateUserId === actor.sub) {
      throw failure(403, 'El firmante debe ser un almacenista activo del mismo cliente con permiso de firma.');
    }
  }
  return withTransaction(async db => {
    const { rows: [report] } = await db.query(`SELECT r.*, req.status AS request_status
      FROM maintenance_reports r JOIN maintenance_requests req ON req.id=r.request_id
      WHERE r.id=$1 FOR UPDATE OF r, req`, [reportId]);
    if (!report) throw failure(404, 'Reporte no encontrado.');
    if (report.client_id !== actor.clientId || report.created_by !== actor.sub) {
      throw failure(403, 'Solo el ingeniero autor del mismo cliente puede asignar esta firma.');
    }
    const signatures = (await db.query('SELECT user_id,role FROM report_signatures WHERE report_id=$1', [reportId])).rows;
    if (report.voided_at || report.closure_kind === 'not_located' || report.request_status === 'firmado'
      || signatures.some(signature => signature.role !== 'ingeniero_biomedico' || signature.user_id !== report.created_by)) {
      throw failure(409, 'El protocolo ya tiene una firma de recepción, está finalizado o fue anulado.');
    }
    if (delegateUserId && !signatures.some(signature => signature.role === 'ingeniero_biomedico' && signature.user_id === report.created_by)) {
      throw failure(409, 'El protocolo debe tener primero la firma del ingeniero.');
    }
    const corrections = await db.query('SELECT id FROM maintenance_report_corrections WHERE report_id=$1 AND resolved_at IS NULL', [reportId]);
    if (corrections.rowCount || !['reportado', 'espera_repuesto'].includes(report.request_status)) {
      throw failure(409, 'Primero termina la corrección del protocolo y vuelve a enviarlo a firma.');
    }
    if (delegateUserId) {
      const { rows: [candidate] } = await db.query(`SELECT u.display_name,u.signature_path FROM users u
        JOIN user_roles ur ON ur.user_id=u.id JOIN roles role ON role.id=ur.role_id
        WHERE u.id=$1 AND u.client_id=$2 AND u.is_active AND role.name='almacenista' FOR SHARE OF u`,
      [delegateUserId, actor.clientId]);
      if (!candidate?.signature_path) throw failure(400, 'El almacenista debe tener su firma registrada.');
      delegate.displayName = candidate.display_name;
    }
    if (report.acceptance_delegate_user_id === delegateUserId
      && (!delegateUserId || report.acceptance_delegation_reason === cleanReason)) {
      return { ...report, delegation_unchanged: true };
    }
    const { rows: [updated] } = await db.query(`UPDATE maintenance_reports
      SET acceptance_delegate_user_id=$2, acceptance_delegate_name=$3, acceptance_delegated_by=$4,
          acceptance_delegated_at=CASE WHEN $2::uuid IS NULL THEN NULL ELSE NOW() END,
          acceptance_delegation_reason=$5, pdf_path=NULL
      WHERE id=$1 RETURNING *`, [reportId, delegateUserId || null, delegate?.displayName || null,
      delegateUserId ? actor.sub : null, delegateUserId ? cleanReason : null]);
    await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW())
      WHERE payload->>'reportId'=$1 AND type='maintenance_report_ready' AND read_at IS NULL`, [reportId]);
    await logAudit({ actorUserId: actor.sub, actorUsername: actor.username,
      action: 'MAINTENANCE_ACCEPTANCE_DELEGATED',
      details: { clientId: actor.clientId, assetId: report.asset_id, reportId,
        previousDelegateUserId: report.acceptance_delegate_user_id, delegateUserId: delegateUserId || null,
        delegateName: delegate?.displayName || null, reason: cleanReason }
    }, { queryRunner: db.query.bind(db) });
    return updated;
  });
}
