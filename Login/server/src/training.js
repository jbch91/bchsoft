import { query, withTransaction } from './db.js';

export async function createTrainingSchedule({ clientId, year, startDate, periodicity, createdBy }) {
  const { rows } = await query(
    `INSERT INTO training_schedules (client_id, year, start_date, periodicity, created_by, pdf_path)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [clientId, year, startDate, periodicity, createdBy, null]
  );
  return rows[0];
}

export async function createTrainingScheduleWithItems({
  clientId,
  year,
  startDate,
  periodicity,
  createdBy,
  items
}) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [
      `training-schedule:${clientId}`,
      year
    ]);
    const existing = await client.query(
      'SELECT id FROM training_schedules WHERE client_id = $1 AND year = $2 LIMIT 1',
      [clientId, year]
    );
    if (existing.rows.length) return null;

    const scheduleResult = await client.query(
      `INSERT INTO training_schedules (client_id, year, start_date, periodicity, created_by, pdf_path)
       VALUES ($1,$2,$3,$4,$5,NULL)
       RETURNING id, client_id, year, start_date, periodicity, status, created_by, pdf_path`,
      [clientId, year, startDate, periodicity, createdBy]
    );
    const schedule = scheduleResult.rows[0];
    await client.query(
      `INSERT INTO training_schedule_items (schedule_id, area_id, planned_date)
       SELECT $1, data.area_id, data.planned_date
       FROM UNNEST($2::uuid[], $3::date[]) AS data(area_id, planned_date)`,
      [
        schedule.id,
        items.map((item) => item.areaId),
        items.map((item) => item.plannedDate)
      ]
    );
    return schedule;
  });
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
     WHERE id = $1 AND status = 'draft'
     RETURNING id`,
    [scheduleId]
  );
  return rows[0];
}

export async function setTrainingSchedulePdf(scheduleId, pdfPath) {
  await query('UPDATE training_schedules SET pdf_path = $1 WHERE id = $2', [pdfPath, scheduleId]);
}

export async function deleteTrainingSchedule(scheduleId) {
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

export async function updateTrainingItems(scheduleId, items) {
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT status
       FROM training_schedules
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
      `UPDATE training_schedule_items AS target
       SET planned_date = data.planned_date
       FROM UNNEST($2::uuid[], $3::date[]) AS data(id, planned_date)
       WHERE target.schedule_id = $1 AND target.id = data.id
       RETURNING target.id`,
      [scheduleId, items.map((item) => item.id), items.map((item) => item.plannedDate)]
    );
    if (rows.length !== items.length) {
      const error = new Error('Uno de los elementos no pertenece al cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    return rows;
  });
}

export async function countTrainingItems(scheduleId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM training_schedule_items WHERE schedule_id = $1',
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function refreshTrainingScheduleStatus(scheduleId) {
  const { rows } = await query(
    `UPDATE training_schedules AS schedule
     SET status = CASE
       WHEN NOT EXISTS (
         SELECT 1 FROM training_schedule_items item
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

export async function markTrainingItemActiveIfDue(itemId) {
  await query(
    `UPDATE training_schedule_items
     SET status = 'active'
     WHERE id = $1 AND status = 'pending' AND planned_date <= CURRENT_DATE`,
    [itemId]
  );
}
