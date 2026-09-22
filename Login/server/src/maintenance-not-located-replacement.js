import { logAudit } from './audit.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Called with the schedule item and request locked, inside the closure transaction.
export async function prepareNotLocatedReplacement(db, { clientId, item, request, reportId, actor, reason }) {
  if (!actor.permissions?.includes('maintenance:report:create')) fail(403, 'Sin permiso para corregir protocolos.');
  const cleanReason = String(reason || '').replace(/\s+/g, ' ').trim();
  if (cleanReason.length < 10 || cleanReason.length > 600) fail(400, 'Escribe un motivo de anulación de 10 a 600 caracteres.');
  const reports = (await db.query('SELECT * FROM maintenance_reports WHERE request_id=$1 FOR UPDATE', [request.id])).rows;
  const report = reports.find(row => row.id === reportId);
  if (!report || report.client_id !== clientId || report.asset_id !== item.asset_id || report.voided_at
    || report.type !== 'preventivo' || report.closure_kind !== 'maintenance'
    || request.source !== 'cronograma' || !['reportado', 'correccion'].includes(request.status)
    || reports.some(row => row.id !== reportId && !row.voided_at)) {
    fail(409, 'Solo se puede sustituir un protocolo preventivo pendiente de aval o en corrección.');
  }
  if (report.created_by !== actor.sub) fail(403, 'Solo el ingeniero autor puede anular este protocolo.');
  if ((item.report_id && item.report_id !== reportId) || !['active', 'done'].includes(item.status)
    || (item.completion_source && item.completion_source !== 'software_report')) {
    fail(409, 'El cronograma tiene otra evidencia asociada. Actualiza el listado.');
  }
  const signatures = (await db.query('SELECT * FROM report_signatures WHERE report_id=$1 ORDER BY signed_at FOR UPDATE', [reportId])).rows;
  if (signatures.some(row => row.role !== 'ingeniero_biomedico' || row.user_id !== actor.sub)) {
    fail(409, 'El reporte ya tiene aval de otra persona y requiere revisión administrativa.');
  }
  if (report.requires_spare_parts || (report.spare_parts_status && report.spare_parts_status !== 'no_aplica')
    || String(report.spare_parts_needed || '').trim()) {
    fail(409, 'El reporte tiene repuestos asociados. No puede cerrarse como equipo no localizado.');
  }
  const corrections = (await db.query('SELECT * FROM maintenance_report_corrections WHERE report_id=$1 ORDER BY created_at FOR UPDATE', [reportId])).rows;
  return { report, request, signatures, corrections, reason: cleanReason };
}

export async function voidNotLocatedReplacement(db, { clientId, item, asset, engineer, replacement, newReportId }) {
  const { report, request, signatures, corrections, reason } = replacement;
  const details = { destination: 'not_located', confirmedNoExecution: true, replacementReportId: newReportId,
    actorUserId: engineer.id, actorLabel: engineer.display_name || engineer.username,
    plannedDate: item.planned_date, scheduleItemId: item.id, assetCode: asset.code, assetName: asset.name };
  await db.query('UPDATE maintenance_reports SET voided_at=NOW(),void_reason=$2,void_details=$3 WHERE id=$1', [report.id, reason, details]);
  await db.query('UPDATE maintenance_report_corrections SET resolved_at=NOW() WHERE report_id=$1 AND resolved_at IS NULL', [report.id]);
  await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE client_id=$1
    AND (payload->>'reportId'=$2 OR payload->>'requestId'=$3)`, [clientId, report.id, request.id]);
  await logAudit({ actorUserId: engineer.id, actorUsername: engineer.username,
    action: 'MAINTENANCE_REPORT_VOIDED_NOT_LOCATED', details: { clientId, assetId: asset.id,
      reportId: report.id, requestId: request.id, eventType: 'reporte_anulado_equipo_no_localizado',
      description: 'Protocolo anulado por registro erróneo, sin intervención. Sustituido por constancia de equipo no localizado.',
      reason, ...details, originalReport: report, originalRequest: request, originalScheduleItem: item,
      originalSignatures: signatures, originalCorrections: corrections, assetStatusPreserved: asset.status }
  }, { queryRunner: db.query.bind(db) });
}
