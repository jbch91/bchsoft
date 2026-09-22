import { withTransaction } from './db.js';
import { logAudit } from './audit.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// supportCase is only supplied by an audited maintenance script, never by the HTTP body.
export async function voidPreventiveForWarranty({ clientId, reportId, reason, confirmedNoExecution, actor, supportCase },
  { transactionRunner = withTransaction } = {}) {
  if (!uuid.test(clientId || '') || !uuid.test(reportId || '')) fail(400, 'Identificación inválida.');
  const cleanReason = String(reason || '').replace(/\s+/g, ' ').trim();
  if (cleanReason.length < 10 || cleanReason.length > 600) fail(400, 'Escribe un motivo de 10 a 600 caracteres.');
  if (confirmedNoExecution !== true) fail(400, 'Confirma que el mantenimiento no se realizó.');
  if (!supportCase && (!actor?.sub || actor.clientId !== clientId || !actor.roles?.includes('ingeniero_biomedico')
    || !actor.permissions?.includes('maintenance:report:create'))) fail(403, 'Solo el ingeniero autor del cliente puede realizar esta operación.');
  if (supportCase && (typeof supportCase !== 'string' || supportCase.length < 20)) fail(400, 'Falta la autorización de soporte.');

  return transactionRunner(async db => {
    const run = db.query.bind(db);
    const customer = (await run('SELECT schema_name FROM clients WHERE id=$1', [clientId])).rows[0];
    if (!customer || !/^[a-z_][a-z0-9_]*$/.test(customer.schema_name)) fail(404, 'Cliente no encontrado.');
    const context = (await run(`SELECT r.request_id,req.schedule_item_id FROM maintenance_reports r
      JOIN maintenance_requests req ON req.id=r.request_id AND req.client_id=r.client_id
      WHERE r.id=$1 AND r.client_id=$2`, [reportId,clientId])).rows[0];
    if (!context) fail(404, 'Reporte no encontrado.');
    const item = (await run(`SELECT item.*,s.status AS schedule_status,s.client_id
      FROM maintenance_schedule_items item JOIN maintenance_schedules s ON s.id=item.schedule_id
      WHERE item.id=$1 AND s.client_id=$2 FOR UPDATE OF item,s`, [context.schedule_item_id,clientId])).rows[0];
    if (!item) fail(409, 'El reporte no corresponde a una actividad del cronograma.');
    const request = (await run('SELECT * FROM maintenance_requests WHERE id=$1 FOR UPDATE', [context.request_id])).rows[0];
    const report = (await run('SELECT * FROM maintenance_reports WHERE id=$1 AND client_id=$2 FOR UPDATE', [reportId,clientId])).rows[0];
    if (!report || !request || request.client_id !== clientId || request.schedule_item_id !== item.id
      || request.asset_id !== item.asset_id || report.request_id !== request.id || report.asset_id !== item.asset_id) {
      fail(409, 'El vínculo del reporte cambió. Actualiza el listado.');
    }
    if (!supportCase) {
      const user = (await run('SELECT id FROM users WHERE id=$1 AND client_id=$2 AND is_active=true', [actor.sub,clientId])).rows[0];
      if (!user || report.created_by !== actor.sub) fail(403, 'Solo el ingeniero que elaboró el protocolo puede anularlo.');
    }
    if (report.voided_at) return { id:report.id, replayed:true };
    const corrections = (await run('SELECT * FROM maintenance_report_corrections WHERE report_id=$1 ORDER BY created_at FOR UPDATE', [reportId])).rows;
    const signatures = (await run('SELECT * FROM report_signatures WHERE report_id=$1 ORDER BY signed_at FOR UPDATE', [reportId])).rows;
    if (report.type !== 'preventivo' || report.closure_kind !== 'maintenance' || request.type !== 'preventivo'
      || request.source !== 'cronograma' || request.status !== 'correccion' || !corrections.some(row => !row.resolved_at)) {
      fail(409, 'Solo se admite un protocolo preventivo en corrección, sin ejecución real.');
    }
    if (signatures.some(sig => sig.role !== 'ingeniero_biomedico' || sig.user_id !== report.created_by)) {
      fail(409, 'El reporte tiene aval de otra persona. Requiere revisión administrativa; no puede anularse desde este flujo.');
    }
    if (report.requires_spare_parts || (report.spare_parts_status && report.spare_parts_status !== 'no_aplica')
      || (await run('SELECT id FROM maintenance_reports WHERE request_id=$1 AND id<>$2 AND voided_at IS NULL', [request.id,reportId])).rows.length) {
      fail(409, 'Hay repuestos u otros reportes relacionados. Deben revisarse antes de anular.');
    }
    if (item.schedule_status !== 'approved' || item.legacy_history_file_id || (item.report_id && item.report_id !== reportId)
      || (item.completion_source && item.completion_source !== 'software_report')) fail(409, 'La actividad tiene otra evidencia o el cronograma no está aprobado.');
    const asset = (await run(`SELECT a.id,a.code,a.name,a.acquisition_date::text,a.warranty_years,
        (a.acquisition_date+make_interval(years=>a.warranty_years))::date::text AS warranty_release_date,
        (a.warranty_years>0 AND a.acquisition_date<=$2::date
          AND $2::date<(a.acquisition_date+make_interval(years=>a.warranty_years))::date) AS covered
      FROM "${customer.schema_name}".assets a WHERE a.id=$1 FOR UPDATE`, [report.asset_id,item.planned_date])).rows[0];
    if (!asset?.covered) fail(409, 'La fecha programada no está cubierta por una garantía válida en la hoja de vida.');
    const details = { confirmedNoExecution:true, destination:'warranty', actorUserId:actor?.sub || null,
      actorLabel:supportCase ? 'SOPORTE TÉCNICO AUTORIZADO' : (actor.username || actor.sub), supportCase:supportCase || null,
      warrantyReleaseDate:asset.warranty_release_date, plannedDate:item.planned_date,
      scheduleItemId:item.id, assetCode:asset.code, assetName:asset.name };
    await run('UPDATE maintenance_reports SET voided_at=NOW(),void_reason=$2,void_details=$3 WHERE id=$1', [reportId,cleanReason,details]);
    await run(`UPDATE maintenance_report_corrections SET resolved_at=NOW() WHERE report_id=$1 AND resolved_at IS NULL`, [reportId]);
    await run("UPDATE maintenance_requests SET status='garantia',updated_at=NOW() WHERE id=$1", [request.id]);
    await run(`UPDATE maintenance_schedule_items SET status='warranty',report_id=NULL,completed_at=NULL,
      completion_source=NULL,historical_resolution=NULL,non_execution_reason=NULL,
      warranty_resolution='covered',warranty_resolved_at=NOW(),warranty_resolved_by=$2 WHERE id=$1`, [item.id,actor?.sub || null]);
    await run('UPDATE maintenance_schedules SET pdf_path=NULL WHERE id=$1', [item.schedule_id]);
    await run(`UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE client_id=$1
      AND (payload->>'reportId'=$2 OR payload->>'requestId'=$3)`, [clientId,reportId,request.id]);
    await logAudit({ actorUserId:actor?.sub || null, actorUsername:details.actorLabel,
      action:'MAINTENANCE_REPORT_VOIDED_WARRANTY', details:{clientId,assetId:asset.id,assetCode:asset.code,
        assetName:asset.name,reportId,requestId:request.id,eventType:'reporte_anulado_por_garantia',
        description:`Protocolo anulado por registro erróneo, sin intervención. ${asset.code} pasa a garantía.`,
        reason:cleanReason,...details,originalReport:report,originalRequest:request,
        originalScheduleItem:item,originalSignatures:signatures,originalCorrections:corrections}
    }, {queryRunner:run});
    return {id:reportId,replayed:false};
  });
}
