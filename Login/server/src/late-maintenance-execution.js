import { withTransaction } from './db.js';
import { normalizeAssetCategory } from './asset-category.js';

export const LATE_MAINTENANCE_EXECUTION_PERMISSION =
  'maintenance:preventive:late_execution';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function monthKey(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function previousCalendarMonth(dateOnly) {
  if (!DATE_PATTERN.test(String(dateOnly || ''))) {
    throw new Error('La fecha actual no es válida.');
  }
  const [year, month] = dateOnly.split('-').map(Number);
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

export function normalizeLateMaintenanceOpening(payload = {}, today) {
  const year = Number(payload.year);
  const month = Number(payload.month);
  const reason = String(payload.reason || '').replace(/\s+/g, ' ').trim();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('El año del periodo no es válido.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('El mes del periodo no es válido.');
  }
  const previous = previousCalendarMonth(today);
  if (year !== previous.year || month !== previous.month) {
    throw new Error('Solo se puede abrir excepcionalmente el mes inmediatamente anterior.');
  }
  if (reason.length < 15) {
    throw new Error('Describe la justificación excepcional con al menos 15 caracteres.');
  }
  if (reason.length > 600) {
    throw new Error('La justificación admite máximo 600 caracteres.');
  }
  return {
    year,
    month,
    period: monthKey(year, month),
    reason,
    assetCategory: normalizeAssetCategory(payload.assetCategory)
  };
}

export function lateExecutionAuthorizationExpiry(permissionExpiresAt, now = new Date()) {
  const permissionExpiry = new Date(permissionExpiresAt);
  if (Number.isNaN(permissionExpiry.getTime()) || permissionExpiry <= now) {
    throw new Error('El permiso temporal no está activo.');
  }
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new Date(Math.min(permissionExpiry.getTime(), sevenDays.getTime()));
}

export function validateLateExecutionTemporaryGrant(
  { expiresAt, reason },
  now = new Date()
) {
  const expiry = new Date(expiresAt);
  const normalizedReason = String(reason || '').replace(/\s+/g, ' ').trim();
  if (Number.isNaN(expiry.getTime()) || expiry <= now) {
    throw new Error('La fecha de vencimiento debe ser futura.');
  }
  if (expiry.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000 + 60_000) {
    throw new Error('La apertura excepcional puede autorizarse por máximo siete días.');
  }
  if (normalizedReason.length < 15) {
    throw new Error('Registra un motivo de autorización de al menos 15 caracteres.');
  }
  if (normalizedReason.length > 600) {
    throw new Error('El motivo de autorización admite máximo 600 caracteres.');
  }
  return { expiry, reason: normalizedReason };
}

export async function openLateMaintenancePeriod({
  clientId,
  actorUserId,
  actorUsername,
  actorDisplayName,
  actorRoles = [],
  temporaryPermissionId,
  permissionExpiresAt,
  permissionGrantedBy,
  permissionReason,
  year,
  month,
  reason,
  assetCategory,
  now = new Date(),
  transactionRunner = withTransaction
}) {
  const authorizedUntil = lateExecutionAuthorizationExpiry(permissionExpiresAt, now);
  return transactionRunner(async (client) => {
    const tenantResult = await client.query(
      'SELECT schema_name, name FROM clients WHERE id = $1',
      [clientId]
    );
    const tenant = tenantResult.rows[0];
    const schema = tenant?.schema_name;
    if (!schema || !/^[a-zA-Z0-9_]+$/.test(schema)) {
      const error = new Error('Cliente no encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const candidates = await client.query(
      `SELECT item.id, item.schedule_id, item.asset_id, item.planned_date,
              item.deadline_date, schedule.created_by
       FROM maintenance_schedule_items item
       JOIN maintenance_schedules schedule ON schedule.id = item.schedule_id
       JOIN "${schema}".assets asset ON asset.id = item.asset_id
       WHERE schedule.client_id = $1
         AND schedule.asset_category = $2
         AND schedule.status = 'approved'
         AND schedule.year = $3
         AND item.planned_date >= make_date($3, $4, 1)
         AND item.planned_date < (make_date($3, $4, 1) + INTERVAL '1 month')::date
         AND item.status = 'expired'
         AND item.report_id IS NULL
         AND item.completion_source IS NULL
         AND item.legacy_history_file_id IS NULL
         AND item.historical_resolution IS DISTINCT FROM 'not_performed'
         AND COALESCE(asset.status, 'activo') <> 'dado_de_baja'
         AND (
           item.warranty_resolution = 'perform'
           OR asset.warranty_years IS NULL
           OR (
             asset.acquisition_date IS NOT NULL
             AND item.planned_date >= (
               asset.acquisition_date + make_interval(years => asset.warranty_years)
             )::date
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM maintenance_requests request
           WHERE request.schedule_item_id = item.id
             AND request.status NOT IN ('abierto', 'vencido')
         )
       ORDER BY item.planned_date, item.id
       LIMIT 501
       FOR UPDATE OF item`,
      [clientId, assetCategory, year, month]
    );
    if (candidates.rows.length > 500) {
      const error = new Error(
        'El periodo supera 500 actividades. Solicita una revisión controlada al administrador de la plataforma.'
      );
      error.statusCode = 413;
      throw error;
    }
    if (!candidates.rows.length) {
      const error = new Error('No hay preventivos vencidos y disponibles para abrir en este periodo.');
      error.statusCode = 409;
      throw error;
    }

    const itemIds = candidates.rows.map((item) => item.id);
    await client.query(
      `UPDATE maintenance_schedule_items
       SET status = 'active',
           late_execution_authorized_at = $6,
           late_execution_authorized_until = $2,
           late_execution_authorized_by = $3,
           late_execution_temporary_permission_id = $4,
           late_execution_reason = $5
       WHERE id = ANY($1::uuid[])`,
      [itemIds, authorizedUntil, actorUserId, temporaryPermissionId, reason, now]
    );
    await client.query(
      `UPDATE maintenance_requests
       SET status = 'abierto', assigned_to = NULL, updated_at = NOW()
       WHERE schedule_item_id = ANY($1::uuid[])
         AND status = 'vencido'`,
      [itemIds]
    );
    await client.query(
      `INSERT INTO maintenance_requests (
         client_id, asset_id, type, description, planned_date, deadline_date,
         source, requested_by, schedule_id, schedule_item_id
       )
       SELECT $1, candidate.asset_id, 'preventivo',
              'Mantenimiento preventivo programado', candidate.planned_date,
              candidate.deadline_date, 'cronograma', $2, candidate.schedule_id,
              candidate.id
       FROM UNNEST(
         $3::uuid[], $4::uuid[], $5::uuid[], $6::date[], $7::date[]
       ) AS candidate(id, schedule_id, asset_id, planned_date, deadline_date)
       WHERE NOT EXISTS (
         SELECT 1 FROM maintenance_requests request
         WHERE request.schedule_item_id = candidate.id
       )`,
      [
        clientId,
        actorUserId,
        itemIds,
        candidates.rows.map((item) => item.schedule_id),
        candidates.rows.map((item) => item.asset_id),
        candidates.rows.map((item) => item.planned_date),
        candidates.rows.map((item) => item.deadline_date)
      ]
    );
    const scheduleIds = Array.from(new Set(candidates.rows.map((item) => item.schedule_id)));
    await client.query(
      'UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = ANY($1::uuid[])',
      [scheduleIds]
    );
    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, actor_username, action, target_user_id, target_username, details
       )
       VALUES ($1, $2, 'MAINTENANCE_LATE_PERIOD_OPEN', $3, $4, $5)`,
      [
        actorUserId,
        actorUsername,
        clientId,
        tenant.name,
        {
          category: 'equipment',
          description: `Apertura excepcional de ${candidates.rows.length} preventivo(s) correspondientes a ${monthKey(year, month)}.`,
          actorDisplayName: actorDisplayName || actorUsername,
          actorUsername,
          actorRoles,
          clientId,
          clientName: tenant.name,
          period: monthKey(year, month),
          assetCategory,
          openedItems: candidates.rows.length,
          reason,
          temporaryPermissionId,
          temporaryPermissionGrantedBy: permissionGrantedBy || null,
          temporaryPermissionReason: permissionReason || null,
          temporaryPermissionExpiresAt: new Date(permissionExpiresAt).toISOString(),
          executionAuthorizationExpiresAt: authorizedUntil.toISOString()
        }
      ]
    );
    return {
      opened: candidates.rows.length,
      period: monthKey(year, month),
      authorizedUntil: authorizedUntil.toISOString(),
      scheduleIds
    };
  });
}
