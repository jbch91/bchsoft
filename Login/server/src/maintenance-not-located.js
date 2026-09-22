import { randomUUID } from 'node:crypto';
import { withTransaction } from './db.js';
import { normalizeDateOnly, dateOnlyFromDatabase, assetWarrantyReleaseDate } from './schedule-workflow.js';
import { createMaintenanceSignatureSnapshot, removeMaintenanceSignatureSnapshot } from './maintenance-signature-snapshots.js';
import { logAudit } from './audit.js';
import { prepareNotLocatedReplacement, voidNotLocatedReplacement } from './maintenance-not-located-replacement.js';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function normalizeNotLocatedClosure(payload, today) {
  if (payload?.confirmed !== true) fail(400, 'Confirma que el equipo no fue localizado y no se realizó mantenimiento.');
  let verifiedOn;
  try { verifiedOn = normalizeDateOnly(payload.verifiedOn, 'La fecha de búsqueda'); }
  catch (error) { fail(400, error.message); }
  if (verifiedOn > today) fail(400, 'La fecha de búsqueda no puede ser futura.');
  const reason = String(payload.reason || '').replace(/\s+/g, ' ').trim();
  const searchedLocation = String(payload.searchedLocation || '').replace(/\s+/g, ' ').trim();
  if (reason.length < 20 || reason.length > 1000) fail(400, 'Describe la búsqueda y el motivo con entre 20 y 1000 caracteres.');
  if (searchedLocation.length < 3 || searchedLocation.length > 250) fail(400, 'Indica el lugar revisado con entre 3 y 250 caracteres.');
  return { verifiedOn, reason, searchedLocation };
}

export async function closeNotLocatedPreventive({ clientId, itemId, payload, actor, today, replaceReportId = null, voidReason }, {
  transactionRunner = withTransaction,
  snapshotSignature = createMaintenanceSignatureSnapshot,
  removeSnapshot = removeMaintenanceSignatureSnapshot
} = {}) {
  if (!actor?.sub || actor.clientId !== clientId || !actor.roles?.includes('ingeniero_biomedico')) {
    fail(403, 'Solo el ingeniero biomédico del cliente puede registrar esta constancia.');
  }
  if (![clientId, itemId, ...(replaceReportId ? [replaceReportId] : [])].every(value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))) {
    fail(400, 'Identificador de actividad o cliente inválido.');
  }
  const details = normalizeNotLocatedClosure(payload, today);
  let snapshot;
  try {
    return await transactionRunner(async (client) => {
      const tenant = (await client.query('SELECT schema_name, name FROM clients WHERE id=$1', [clientId])).rows[0];
      if (!tenant || !/^[a-zA-Z0-9_]+$/.test(tenant.schema_name)) fail(404, 'Cliente no encontrado.');
      const item = (await client.query(
        `SELECT item.*, schedule.status AS schedule_status, schedule.asset_category AS schedule_category,
                (item.late_execution_authorized_until > NOW() AND EXISTS (
                  SELECT 1 FROM user_temporary_permissions permission
                  JOIN permissions definition ON definition.id=permission.permission_id
                  JOIN users owner ON owner.id=permission.user_id
                  WHERE permission.id=item.late_execution_temporary_permission_id
                    AND definition.name='maintenance:preventive:late_execution'
                    AND permission.expires_at>NOW() AND owner.client_id=$2 AND owner.is_active
                )) AS late_active
         FROM maintenance_schedule_items item
         JOIN maintenance_schedules schedule ON schedule.id=item.schedule_id
         WHERE item.id=$1 AND schedule.client_id=$2 FOR UPDATE OF item`, [itemId, clientId]
      )).rows[0];
      if (!item) fail(404, 'Actividad no encontrada en este cliente.');
      const existing = (await client.query(
        `SELECT report.* FROM maintenance_reports report
         JOIN maintenance_requests request ON request.id=report.request_id
         WHERE report.id=$1 OR request.schedule_item_id=$2`, [item.report_id, item.id]
      )).rows;
      if (existing.length) {
        const saved = existing.find(row => !row.voided_at && row.closure_kind === 'not_located');
        const original = existing.find(row => row.id === replaceReportId);
        const sameReplacement = replaceReportId && original?.voided_at
          && original.void_details?.replacementReportId === saved?.id
          && original.void_reason === String(voidReason || '').replace(/\s+/g, ' ').trim()
          && saved?.non_execution_details?.replacesReportId === replaceReportId;
        if (saved?.created_by === actor.sub && ((!replaceReportId && existing.length === 1) || sameReplacement)
          && Object.entries(details).every(([key,value]) => saved.non_execution_details?.[key] === value)) {
          return { id: saved.id, replayed: true };
        }
        if (!replaceReportId) fail(409, 'Este preventivo ya tiene un reporte. Utiliza la anulación auditada antes de registrar la constancia.');
      }
      if (item.schedule_status !== 'approved' || item.legacy_history_file_id || item.historical_resolution === 'not_performed'
        || (!replaceReportId && (!['pending','active'].includes(item.status) || item.completion_source))) {
        fail(409, 'La actividad no está disponible para este cierre.');
      }
      const planned = dateOnlyFromDatabase(item.planned_date);
      const deadline = dateOnlyFromDatabase(item.deadline_date);
      // Replacing an existing, unapproved report corrects its record; it does not reopen service execution.
      if (planned > today || details.verifiedOn < planned || (!replaceReportId && deadline < today && !item.late_active)) {
        fail(409, 'La ventana no está activa o la fecha de búsqueda no corresponde. Para un periodo vencido se requiere apertura temporal.');
      }
      const requests = (await client.query(
        'SELECT * FROM maintenance_requests WHERE schedule_item_id=$1 FOR UPDATE', [item.id]
      )).rows;
      if (requests.length > 1) fail(409, 'La actividad tiene más de una solicitud y necesita revisión.');
      let request = requests[0];
      if (request && (request.client_id !== clientId || request.asset_id !== item.asset_id || request.type !== 'preventivo'
        || !(replaceReportId ? ['reportado','correccion'] : ['abierto','en_proceso']).includes(request.status)
        || (request.assigned_to && request.assigned_to !== actor.sub))) {
        fail(409, 'La solicitud no está disponible o está asignada a otro ingeniero.');
      }
      // Recheck after locking the request: a report may have been saved while waiting.
      if (!replaceReportId && request && (await client.query('SELECT id FROM maintenance_reports WHERE request_id=$1', [request.id])).rows.length) {
        fail(409, 'La solicitud ya tiene un reporte registrado.');
      }
      if (replaceReportId && !request) fail(409, 'No existe una solicitud con el protocolo que se pretende anular.');
      const replacement = replaceReportId ? await prepareNotLocatedReplacement(client, {
        clientId, item, request, reportId: replaceReportId, actor, reason: voidReason
      }) : null;
      const asset = (await client.query(
        `SELECT asset.*, area.name AS area_name, location.name AS location_name, site.name AS site_name
         FROM "${tenant.schema_name}".assets asset
         LEFT JOIN "${tenant.schema_name}".areas area ON area.id=asset.area_id
         LEFT JOIN "${tenant.schema_name}".locations location ON location.id=asset.location_id
         LEFT JOIN "${tenant.schema_name}".sites site ON site.id=asset.site_id
         WHERE asset.id=$1`, [item.asset_id]
      )).rows[0];
      if (!asset || asset.status === 'dado_de_baja') fail(409, 'El equipo fue retirado del inventario.');
      if (asset.asset_category !== item.schedule_category) fail(409, 'El equipo ya no pertenece a este cronograma.');
      if (item.warranty_resolution !== 'perform') {
        let releaseDate;
        try {
          releaseDate = assetWarrantyReleaseDate({ acquisitionDate: asset.acquisition_date, warrantyYears: asset.warranty_years });
        } catch {
          fail(409, 'Revisa la garantía del equipo antes de registrar esta constancia.');
        }
        if (item.warranty_resolution === 'covered' || (releaseDate && planned < releaseDate)) {
          fail(409, 'Esta actividad está cubierta por garantía. Utiliza la opción de garantía.');
        }
      }
      const engineer = (await client.query(
        `SELECT u.* FROM users u WHERE u.id=$1 AND u.client_id=$2 AND u.is_active
         AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
                     WHERE ur.user_id=u.id AND r.name='ingeniero_biomedico')`, [actor.sub, clientId]
      )).rows[0];
      if (!engineer) fail(403, 'El usuario ya no es un ingeniero activo de este cliente.');
      const reportId = randomUUID();
      try {
        snapshot = await snapshotSignature({ clientId, reportId, sourceSignaturePath: engineer.signature_path });
      } catch (error) {
        if (error.code === 'SIGNATURE_NOT_FOUND') fail(400, 'Registra una firma válida antes de cerrar la constancia.');
        throw error;
      }
      if (!request) {
        request = (await client.query(
          `INSERT INTO maintenance_requests(client_id,asset_id,type,description,source,planned_date,
             deadline_date,schedule_id,schedule_item_id,requested_by,assigned_to)
           VALUES ($1,$2,'preventivo','Mantenimiento preventivo programado','cronograma',$3,$4,$5,$6,$7,$7)
           RETURNING *`, [clientId,item.asset_id,planned,deadline,item.schedule_id,item.id,actor.sub]
        )).rows[0];
      }
      const assetSnapshot = Object.fromEntries(['id','code','name','brand','model','serial','asset_category',
        'site_name','area_name','location_name'].map(key => [key,asset[key] || null]));
      if (replacement) await voidNotLocatedReplacement(client, { clientId, item, asset, engineer, replacement, newReportId: reportId });
      await client.query(
        `INSERT INTO maintenance_reports(id,client_id,request_id,asset_id,type,summary,findings,actions_taken,
           asset_status_after,area_responsible_required,requires_spare_parts,created_by,closure_kind,non_execution_details)
         VALUES ($1,$2,$3,$4,'preventivo','CONSTANCIA DE EQUIPO NO LOCALIZADO',$5,
           'NO SE REALIZÓ MANTENIMIENTO NI SE VERIFICÓ EL ESTADO OPERATIVO. SE REQUIERE LOCALIZAR EL EQUIPO.',
           'no_verificado',false,false,$6,'not_located',$7)`,
        [reportId,clientId,request.id,item.asset_id,details.reason,actor.sub,
          {...details,asset:assetSnapshot,plannedDate:planned,deadlineDate:deadline,clientName:tenant.name,
            ...(replacement ? {replacesReportId:replacement.report.id} : {})}]
      );
      await client.query(
        `INSERT INTO report_signatures(report_id,user_id,role,signature_path,signer_name,signer_invima_registration,signature_sha256)
         VALUES ($1,$2,'ingeniero_biomedico',$3,$4,$5,$6)`,
        [reportId,actor.sub,snapshot.publicPath,engineer.display_name || engineer.username,engineer.invima_registration,snapshot.sha256]
      );
      await client.query("UPDATE maintenance_requests SET status='firmado',assigned_to=$2,updated_at=NOW() WHERE id=$1", [request.id,actor.sub]);
      await client.query(
        `UPDATE maintenance_schedule_items SET status='done',report_id=$2,completion_source='software_report',
           historical_resolution='not_performed',non_execution_reason=$3 WHERE id=$1`, [item.id,reportId,details.reason]
      );
      await client.query('UPDATE maintenance_schedules SET pdf_path=NULL WHERE id=$1', [item.schedule_id]);
      await client.query(
        `UPDATE notifications SET read_at=COALESCE(read_at,NOW())
         WHERE client_id=$1 AND payload->>'requestId'=$2 AND type IN ('maintenance_request_created','maintenance_preventive_generated')`,
        [clientId,request.id]
      );
      await logAudit({ actorUserId:actor.sub,actorUsername:engineer.username,action:'MAINTENANCE_NOT_LOCATED_CLOSED',
        targetUserId:asset.id,targetUsername:`${asset.code} - ${asset.name}`, details:{category:'equipment',
          clientId,clientName:tenant.name,asset:assetSnapshot,reportId,requestId:request.id,scheduleItemId:item.id,
          eventType:'equipo_no_localizado',description:'Cierre sin ejecución de mantenimiento: equipo no localizado.',
          ...details,signatureSha256:snapshot.sha256}}, {queryRunner:client.query.bind(client)});
      return { id:reportId,replayed:false };
    });
  } catch (error) {
    if (snapshot) await removeSnapshot(snapshot.fullPath).catch(() => {});
    throw error;
  }
}
