import { query } from './db.js';

// An issued permission alone does not reopen a month: require an actual opening.
export async function listActiveMaintenanceOpenings(clientId, queryRunner = query) {
  const { rows } = await queryRunner(
    `SELECT DISTINCT ON (schedule.id, date_trunc('month', item.planned_date))
            schedule.id AS schedule_id, schedule.asset_category, schedule.year,
            to_char(item.planned_date, 'YYYY-MM') AS period,
            item.late_execution_authorized_at AS authorized_at,
            LEAST(item.late_execution_authorized_until, permission.expires_at) AS authorized_until,
            item.late_execution_authorized_by AS authorized_by,
            permission.id AS permission_id, permission.user_id,
            item.late_execution_reason AS reason
     FROM maintenance_schedule_items item
     JOIN maintenance_schedules schedule ON schedule.id = item.schedule_id
     JOIN user_temporary_permissions permission
       ON permission.id = item.late_execution_temporary_permission_id
     JOIN permissions definition ON definition.id = permission.permission_id
     JOIN users owner ON owner.id = permission.user_id
     WHERE schedule.client_id = $1
       AND schedule.status = 'approved'
       AND owner.client_id = schedule.client_id AND owner.is_active
       AND definition.name = 'maintenance:preventive:late_execution'
       AND permission.expires_at > NOW()
       AND item.late_execution_authorized_until > NOW()
       AND item.late_execution_authorized_at IS NOT NULL
     ORDER BY schedule.id, date_trunc('month', item.planned_date),
              LEAST(item.late_execution_authorized_until, permission.expires_at) DESC,
              item.late_execution_authorized_at DESC, item.id`,
    [clientId]
  );
  return rows;
}

export async function inheritActiveMaintenanceOpenings(client, {
  clientId, schema, assetIds, today
}) {
  if (!/^[a-zA-Z0-9_]+$/.test(schema)) throw new Error('Invalid tenant schema');
  const openings = await listActiveMaintenanceOpenings(clientId, client.query.bind(client));
  const activated = [];
  for (const opening of openings) {
    const { rows } = await client.query(
      `UPDATE maintenance_schedule_items item
       SET status = 'active',
           historical_resolution = NULL,
           late_execution_authorized_at = $5,
           late_execution_authorized_until = $6,
           late_execution_authorized_by = $7,
           late_execution_temporary_permission_id = $8,
           late_execution_reason = $9
       FROM "${schema}".assets asset
       WHERE item.schedule_id = $1
         AND item.asset_id = asset.id AND item.asset_id = ANY($2::uuid[])
         AND asset.asset_category = $10
         AND item.planned_date >= $3::date
         AND item.planned_date < ($3::date + INTERVAL '1 month')::date
         AND item.deadline_date < $4::date
         AND item.status IN ('pending', 'expired')
         AND item.report_id IS NULL AND item.completion_source IS NULL
         AND item.legacy_history_file_id IS NULL
         AND item.historical_resolution IS DISTINCT FROM 'not_performed'
         AND item.warranty_resolution IS DISTINCT FROM 'covered'
         AND COALESCE(asset.status, 'activo') <> 'dado_de_baja'
         AND (asset.acquisition_date IS NULL OR item.planned_date >= asset.acquisition_date)
         AND (
           item.warranty_resolution = 'perform'
           OR asset.warranty_years IS NULL
           OR (asset.acquisition_date IS NOT NULL AND item.planned_date >=
               (asset.acquisition_date + make_interval(years => asset.warranty_years))::date)
         )
         AND NOT EXISTS (
           SELECT 1 FROM maintenance_requests request
           WHERE request.schedule_item_id = item.id
             AND (request.status NOT IN ('abierto', 'vencido') OR EXISTS (
               SELECT 1 FROM maintenance_reports report WHERE report.request_id = request.id
             ))
         )
       RETURNING item.id, item.asset_id, item.schedule_id, item.planned_date, item.deadline_date`,
      [opening.schedule_id, assetIds, `${opening.period}-01`, today,
        opening.authorized_at, opening.authorized_until, opening.authorized_by,
        opening.permission_id, opening.reason, opening.asset_category]
    );
    if (!rows.length) continue;
    const ids = rows.map((item) => item.id);
    await client.query(
      `UPDATE maintenance_requests SET status = 'abierto', assigned_to = NULL, updated_at = NOW()
       WHERE client_id = $1 AND schedule_item_id = ANY($2::uuid[]) AND status = 'vencido'`,
      [clientId, ids]
    );
    const requests = await client.query(
      `INSERT INTO maintenance_requests (
         client_id, asset_id, type, description, planned_date, deadline_date,
         source, requested_by, schedule_id, schedule_item_id
       )
       SELECT $1, item.asset_id, 'preventivo', 'Mantenimiento preventivo programado',
              item.planned_date, item.deadline_date, 'cronograma', $3, item.schedule_id, item.id
       FROM maintenance_schedule_items item
       WHERE item.id = ANY($2::uuid[]) AND NOT EXISTS (
         SELECT 1 FROM maintenance_requests request WHERE request.schedule_item_id = item.id
       ) RETURNING schedule_item_id`,
      [clientId, ids, opening.user_id]
    );
    const created = new Set(requests.rows.map((row) => row.schedule_item_id));
    activated.push(...rows.map((row) => ({ ...row, requestCreated: created.has(row.id) })));
    await client.query('UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = $1',
      [opening.schedule_id]);
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_user_id, details)
       VALUES ($1, 'MAINTENANCE_LATE_PERIOD_ENROLLMENT', $2, $3)`,
      [opening.user_id, clientId, {
        clientId, scheduleId: opening.schedule_id, period: opening.period,
        temporaryPermissionId: opening.permission_id, authorizedUntil: opening.authorized_until,
        scheduleItemIds: ids, assetIds: rows.map((row) => row.asset_id),
        source: 'automatic_schedule_sync'
      }]
    );
  }
  return activated;
}
