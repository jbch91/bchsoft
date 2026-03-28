import { query } from './db.js';

export async function createTrainingSchedule({ clientId, year, startDate, periodicity, createdBy }) {
  const { rows } = await query(
    `INSERT INTO training_schedules (client_id, year, start_date, periodicity, created_by, pdf_path)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [clientId, year, startDate, periodicity, createdBy, null]
  );
  return rows[0];
}

export async function listTrainingSchedules(clientId, year) {
  const params = [clientId];
  let where = 'client_id = $1';
  if (year) {
    params.push(year);
    where += ` AND year = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, periodicity, status, created_at, approved_at, pdf_path
     FROM training_schedules
     WHERE ${where}
     ORDER BY year DESC, created_at DESC`,
    params
  );
  return rows;
}

export async function getTrainingScheduleById(scheduleId) {
  const { rows } = await query(
    `SELECT id, client_id, year, start_date, periodicity, status, created_by, pdf_path
     FROM training_schedules
     WHERE id = $1`,
    [scheduleId]
  );
  return rows[0];
}

export async function approveTrainingSchedule(scheduleId) {
  const { rows } = await query(
    `UPDATE training_schedules
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [scheduleId]
  );
  return rows[0];
}

export async function setTrainingSchedulePdf(scheduleId, pdfPath) {
  await query('UPDATE training_schedules SET pdf_path = $1 WHERE id = $2', [pdfPath, scheduleId]);
}

export async function deleteTrainingSchedule(scheduleId) {
  await query('DELETE FROM training_schedule_items WHERE schedule_id = $1', [scheduleId]);
  await query('DELETE FROM training_schedules WHERE id = $1', [scheduleId]);
}

export async function insertTrainingItems(items) {
  for (const item of items) {
    await query(
      `INSERT INTO training_schedule_items (schedule_id, area_id, planned_date)
       VALUES ($1,$2,$3)`,
      [item.scheduleId, item.areaId, item.plannedDate]
    );
  }
}

export async function listTrainingItemsWithSchema(scheduleId, schema) {
  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.area_id, i.planned_date, i.status, i.pdf_path, i.completed_at,
            a.name AS area_name
     FROM training_schedule_items i
     LEFT JOIN "${schema}".areas a ON a.id = i.area_id
     WHERE i.schedule_id = $1
     ORDER BY i.planned_date ASC`,
    [scheduleId]
  );
  return rows;
}

export async function setTrainingItemPdf(itemId, pdfPath) {
  await query(
    `UPDATE training_schedule_items
     SET pdf_path = $1, status = 'done', completed_at = NOW()
     WHERE id = $2`,
    [pdfPath, itemId]
  );
}

export async function clearTrainingItemPdf(itemId) {
  await query(
    `UPDATE training_schedule_items
     SET pdf_path = NULL, status = 'pending', completed_at = NULL
     WHERE id = $1`,
    [itemId]
  );
}

export async function updateTrainingItems(items) {
  for (const item of items) {
    await query(
      `UPDATE training_schedule_items
       SET planned_date = $1
       WHERE id = $2`,
      [item.plannedDate, item.id]
    );
  }
}

export async function markTrainingItemActiveIfDue(itemId) {
  await query(
    `UPDATE training_schedule_items
     SET status = 'active'
     WHERE id = $1 AND status = 'pending' AND planned_date <= CURRENT_DATE`,
    [itemId]
  );
}
