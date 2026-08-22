import { query, withTransaction } from './db.js';

export async function createSchedule({ clientId, year, startDate, createdBy, pdfPath }) {
  const { rows } = await query(
    `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [clientId, year, startDate, createdBy, pdfPath || null]
  );
  return rows[0];
}

export async function createScheduleWithItems({ clientId, year, startDate, createdBy, items }) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [
      `maintenance-schedule:${clientId}`,
      year
    ]);
    const existing = await client.query(
      'SELECT id FROM maintenance_schedules WHERE client_id = $1 AND year = $2 LIMIT 1',
      [clientId, year]
    );
    if (existing.rows.length) return null;

    const scheduleResult = await client.query(
      `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path)
       VALUES ($1,$2,$3,$4,NULL)
       RETURNING id, client_id, year, start_date, status, engineer_edited, created_by, pdf_path`,
      [clientId, year, startDate, createdBy]
    );
    const schedule = scheduleResult.rows[0];
    await client.query(
      `INSERT INTO maintenance_schedule_items
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

export async function approveSchedule(scheduleId) {
  const { rows } = await query(
    `UPDATE maintenance_schedules
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1 AND status = 'draft'
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
            a.code, a.name, a.brand, a.model, a.serial, a.area_id, a.site_id,
            ar.name AS area_name, s.name AS site_name, lo.name AS location_name
     FROM maintenance_schedule_items i
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

export async function insertScheduleItems(items) {
  for (const item of items) {
    await query(
      `INSERT INTO maintenance_schedule_items (schedule_id, asset_id, frequency, planned_date, deadline_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [item.scheduleId, item.assetId, item.frequency, item.plannedDate, item.deadlineDate]
    );
  }
}

export async function updateScheduleItems(scheduleId, items, { markEngineerEdited: edited = false } = {}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE maintenance_schedule_items AS target
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
    if (edited) {
      await client.query(
        'UPDATE maintenance_schedules SET engineer_edited = TRUE WHERE id = $1',
        [scheduleId]
      );
    }
    return rows;
  });
}

export async function countScheduleItems(scheduleId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM maintenance_schedule_items WHERE schedule_id = $1',
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
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
