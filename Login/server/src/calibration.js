import { query } from './db.js';

export async function createCalibrationSchedule({ clientId, year, startDate, createdBy }) {
  const { rows } = await query(
    `INSERT INTO calibration_schedules (client_id, year, start_date, created_by, status, pdf_path)
     VALUES ($1,$2,$3,$4,'approved',$5)
     RETURNING id`,
    [clientId, year, startDate, createdBy, null]
  );
  return rows[0];
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
     WHERE id = $1
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
            a.code, a.name, a.brand, a.model, a.serial, a.area_id, ar.name AS area_name
     FROM calibration_schedule_items i
     LEFT JOIN "${schema}".assets a ON a.id = i.asset_id
     LEFT JOIN "${schema}".areas ar ON ar.id = a.area_id
     WHERE i.schedule_id = $1
     ORDER BY i.planned_date ASC`,
    [scheduleId]
  );
  return rows;
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
