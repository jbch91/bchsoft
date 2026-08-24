import { query, withTransaction } from './db.js';

export async function createCalibrationSchedule({ clientId, year, startDate, createdBy }) {
  const { rows } = await query(
    `INSERT INTO calibration_schedules (client_id, year, start_date, created_by, status, pdf_path)
     VALUES ($1,$2,$3,$4,'draft',$5)
     RETURNING id`,
    [clientId, year, startDate, createdBy, null]
  );
  return rows[0];
}

export async function createCalibrationScheduleWithItems({ clientId, year, startDate, createdBy, items }) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [
      `calibration-schedule:${clientId}`,
      year
    ]);
    const existing = await client.query(
      'SELECT id FROM calibration_schedules WHERE client_id = $1 AND year = $2 LIMIT 1',
      [clientId, year]
    );
    if (existing.rows.length) return null;

    const scheduleResult = await client.query(
      `INSERT INTO calibration_schedules (client_id, year, start_date, created_by, status, pdf_path)
       VALUES ($1,$2,$3,$4,'draft',NULL)
       RETURNING id, client_id, year, start_date, status, created_by, pdf_path`,
      [clientId, year, startDate, createdBy]
    );
    const schedule = scheduleResult.rows[0];
    await client.query(
      `INSERT INTO calibration_schedule_items
         (schedule_id, asset_id, frequency, planned_date, deadline_date)
       SELECT $1, data.asset_id, data.frequency, data.planned_date, data.deadline_date
       FROM UNNEST($2::uuid[], $3::text[], $4::date[], $5::date[])
         AS data(asset_id, frequency, planned_date, deadline_date)`,
      [
        schedule.id,
        items.map((item) => item.assetId),
        items.map((item) => item.frequency),
        items.map((item) => item.plannedDate),
        items.map((item) => item.deadlineDate)
      ]
    );
    return schedule;
  });
}

export async function listCalibrationSchedules(clientId, year) {
  const params = [clientId];
  let where = 'client_id = $1';
  if (year) {
    params.push(year);
    where += ` AND year = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, status, created_at, approved_at, pdf_path
     FROM calibration_schedules
     WHERE ${where}
     ORDER BY year DESC, created_at DESC`,
    params
  );
  return rows;
}

export async function getCalibrationScheduleById(scheduleId) {
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, status, created_by, pdf_path
     FROM calibration_schedules
     WHERE id = $1`,
    [scheduleId]
  );
  return rows[0];
}

export async function approveCalibrationSchedule(scheduleId) {
  const { rows } = await query(
    `UPDATE calibration_schedules
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1 AND status = 'draft'
     RETURNING id`,
    [scheduleId]
  );
  return rows[0];
}

export async function setCalibrationSchedulePdf(scheduleId, pdfPath) {
  await query('UPDATE calibration_schedules SET pdf_path = $1 WHERE id = $2', [pdfPath, scheduleId]);
}

export async function deleteCalibrationSchedule(scheduleId) {
  await query('DELETE FROM calibration_schedules WHERE id = $1', [scheduleId]);
}

export async function countCalibrationItems(scheduleId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM calibration_schedule_items WHERE schedule_id = $1',
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function refreshCalibrationScheduleStatus(scheduleId) {
  const { rows } = await query(
    `UPDATE calibration_schedules AS schedule
     SET status = CASE
       WHEN NOT EXISTS (
         SELECT 1 FROM calibration_schedule_items item
         WHERE item.schedule_id = schedule.id AND item.status <> 'done'
       ) THEN 'closed'
       WHEN schedule.status = 'closed' THEN 'approved'
       ELSE schedule.status
     END
     WHERE schedule.id = $1
     RETURNING status`,
    [scheduleId]
  );
  return rows[0]?.status;
}

export async function insertCalibrationItems(items) {
  for (const item of items) {
    await query(
      `INSERT INTO calibration_schedule_items (schedule_id, asset_id, frequency, planned_date, deadline_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [item.scheduleId, item.assetId, item.frequency, item.plannedDate, item.deadlineDate]
    );
  }
}

export async function listCalibrationItemsWithSchema(scheduleId, schema) {
  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date, i.deadline_date, i.status, i.pdf_path,
            a.code, a.name, a.brand, a.model, a.serial, a.area_id, a.site_id, a.location_id,
            ar.name AS area_name, s.name AS site_name, lo.name AS location_name
     FROM calibration_schedule_items i
     LEFT JOIN "${schema}".assets a ON a.id = i.asset_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".sites s ON s.id = a.site_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     WHERE i.schedule_id = $1
     ORDER BY i.planned_date ASC`,
    [scheduleId]
  );
  return rows;
}

export async function updateCalibrationItems(scheduleId, items) {
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT status
       FROM calibration_schedules
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );
    if (!scheduleRows[0] || scheduleRows[0].status !== 'draft') {
      const error = new Error('El cronograma cambió de estado. Actualiza la información.');
      error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
      throw error;
    }
    const { rows } = await client.query(
      `UPDATE calibration_schedule_items AS target
       SET planned_date = data.planned_date, deadline_date = data.deadline_date
       FROM UNNEST($2::uuid[], $3::date[], $4::date[])
         AS data(id, planned_date, deadline_date)
       WHERE target.schedule_id = $1 AND target.id = data.id
       RETURNING target.id`,
      [
        scheduleId,
        items.map((item) => item.id),
        items.map((item) => item.plannedDate),
        items.map((item) => item.deadlineDate)
      ]
    );
    if (rows.length !== items.length) {
      const error = new Error('Uno de los elementos no pertenece al cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    return rows;
  });
}

export async function setCalibrationItemPdf(itemId, pdfPath) {
  await query(
    `UPDATE calibration_schedule_items
     SET pdf_path = $1, status = 'done', completed_at = NOW()
     WHERE id = $2`,
    [pdfPath, itemId]
  );
}

export async function clearCalibrationItemPdf(itemId) {
  await query(
    `UPDATE calibration_schedule_items
     SET pdf_path = NULL, status = 'pending', completed_at = NULL
     WHERE id = $1`,
    [itemId]
  );
}

export async function listCalibrationReportsByAsset(assetId, limit, offset) {
  const params = [assetId];
  if (limit !== undefined) params.push(limit);
  if (offset !== undefined) params.push(offset);
  const limitClause = limit !== undefined ? `LIMIT $${params.length - (offset !== undefined ? 1 : 0)}` : '';
  const offsetClause = offset !== undefined ? `OFFSET $${params.length}` : '';
  const { rows } = await query(
    `SELECT i.id, i.planned_date, i.completed_at, i.pdf_path, i.frequency
     FROM calibration_schedule_items i
     WHERE i.asset_id = $1 AND i.pdf_path IS NOT NULL
     ORDER BY i.completed_at DESC NULLS LAST, i.planned_date DESC
     ${limitClause} ${offsetClause}`,
    params
  );
  return rows;
}
