import { query } from './db.js';

export async function createSchedule({ clientId, year, startDate, createdBy, pdfPath }) {
  const { rows } = await query(
    `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [clientId, year, startDate, createdBy, pdfPath || null]
  );
  return rows[0];
}

export async function listSchedules(clientId, year) {
  const params = [clientId];
  let where = 'client_id = $1';
  if (year) {
    params.push(year);
    where += ` AND year = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, status, engineer_edited, created_at, approved_at, pdf_path
     FROM maintenance_schedules
     WHERE ${where}
     ORDER BY year DESC, created_at DESC`,
    params
  );
  return rows;
}

export async function getScheduleById(scheduleId) {
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, status, engineer_edited, created_by, pdf_path
     FROM maintenance_schedules
     WHERE id = $1`,
    [scheduleId]
  );
  return rows[0];
}

export async function setSchedulePdf(scheduleId, pdfPath) {
  await query('UPDATE maintenance_schedules SET pdf_path = $1 WHERE id = $2', [pdfPath, scheduleId]);
}

export async function approveSchedule(scheduleId, actorId, force = false) {
  const { rows } = await query(
    `UPDATE maintenance_schedules
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [scheduleId]
  );
  return rows[0];
}

export async function markEngineerEdited(scheduleId) {
  await query('UPDATE maintenance_schedules SET engineer_edited = TRUE WHERE id = $1', [scheduleId]);
}

export async function listScheduleItemsWithSchema(scheduleId, schema) {
  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date, i.deadline_date, i.status,
            a.code, a.name, a.brand, a.model, a.serial, ar.name AS area_name, lo.name AS location_name
     FROM maintenance_schedule_items i
     LEFT JOIN "${schema}".assets a ON a.id = i.asset_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     LEFT JOIN "${schema}".locations lo ON lo.id = a.location_id
     WHERE i.schedule_id = $1
     ORDER BY i.planned_date ASC`,
    [scheduleId]
  );
  return rows;
}

export async function insertScheduleItems(items) {
  for (const item of items) {
    await query(
      `INSERT INTO maintenance_schedule_items (schedule_id, asset_id, frequency, planned_date, deadline_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [item.scheduleId, item.assetId, item.frequency, item.plannedDate, item.deadlineDate]
    );
  }
}

export async function updateScheduleItems(items) {
  for (const item of items) {
    await query(
      `UPDATE maintenance_schedule_items
       SET planned_date = $1, deadline_date = $2
       WHERE id = $3`,
      [item.plannedDate, item.deadlineDate, item.id]
    );
  }
}

export async function setScheduleClosedIfDone(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS pending
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND status <> 'done'`,
    [scheduleId]
  );
  if ((rows[0]?.pending ?? 0) === 0) {
    await query(`UPDATE maintenance_schedules SET status = 'closed' WHERE id = $1`, [scheduleId]);
  }
}

export async function deleteSchedule(scheduleId) {
  await query('DELETE FROM maintenance_schedule_items WHERE schedule_id = $1', [scheduleId]);
  await query('DELETE FROM maintenance_schedules WHERE id = $1', [scheduleId]);
}

export async function markScheduleItemDone(scheduleId, itemId, reportId) {
  await query(
    `UPDATE maintenance_schedule_items
     SET status = 'done', completed_at = NOW(), report_id = $3
     WHERE id = $1 AND schedule_id = $2`,
    [itemId, scheduleId, reportId]
  );
}

export async function findScheduleItemForAsset(scheduleId, assetId, date) {
  const { rows } = await query(
    `SELECT id
     FROM maintenance_schedule_items
     WHERE schedule_id = $1
       AND asset_id = $2
       AND status <> 'done'
       AND planned_date <= $3
       AND deadline_date >= $3
     ORDER BY planned_date ASC
     LIMIT 1`,
    [scheduleId, assetId, date]
  );
  return rows[0];
}
