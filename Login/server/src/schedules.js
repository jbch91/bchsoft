import { query, withTransaction } from './db.js';
import { normalizeAssetCategory } from './asset-category.js';

export async function createSchedule({
  clientId,
  year,
  startDate,
  createdBy,
  pdfPath,
  assetCategory = 'biomedical'
}) {
  const category = normalizeAssetCategory(assetCategory);
  const { rows } = await query(
    `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path, asset_category)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [clientId, year, startDate, createdBy, pdfPath || null, category]
  );
  return rows[0];
}

export async function createScheduleWithItems({
  clientId,
  year,
  startDate,
  createdBy,
  items,
  assetCategory = 'biomedical'
}) {
  const category = normalizeAssetCategory(assetCategory);
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [
      `maintenance-schedule:${clientId}:${category}`,
      year
    ]);
    const existing = await client.query(
      'SELECT id FROM maintenance_schedules WHERE client_id = $1 AND year = $2 AND asset_category = $3 LIMIT 1',
      [clientId, year, category]
    );
    if (existing.rows.length) return null;

    const scheduleResult = await client.query(
      `INSERT INTO maintenance_schedules (client_id, year, start_date, created_by, pdf_path, asset_category)
       VALUES ($1,$2,$3,$4,NULL,$5)
       RETURNING id, client_id, asset_category, year, start_date, status, engineer_edited,
                 engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at,
                 created_by, pdf_path`,
      [clientId, year, startDate, createdBy, category]
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

export async function listSchedules(clientId, year, assetCategory = 'biomedical') {
  const params = [clientId, normalizeAssetCategory(assetCategory)];
  let where = 'schedule.client_id = $1 AND schedule.asset_category = $2';
  if (year) {
    params.push(year);
    where += ` AND schedule.year = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT schedule.id, schedule.client_id, schedule.asset_category, schedule.year, schedule.start_date, schedule.status,
            schedule.engineer_edited, schedule.engineer_edit_enabled,
            schedule.engineer_edit_enabled_by, schedule.engineer_edit_enabled_at,
            schedule.created_at, schedule.approved_at, schedule.pdf_path,
            (SELECT COUNT(*)::int FROM maintenance_schedule_items item
             WHERE item.schedule_id = schedule.id) AS total_items,
            (SELECT COUNT(*)::int FROM maintenance_schedule_items item
             WHERE item.schedule_id = schedule.id AND item.programming_confirmed) AS programmed_items
     FROM maintenance_schedules schedule
     WHERE ${where}
     ORDER BY schedule.year DESC, schedule.created_at DESC`,
    params
  );
  return rows;
}

export async function getScheduleById(scheduleId) {
  const { rows } = await query(
    `SELECT id, client_id, asset_category, year, start_date, status, engineer_edited,
            engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at,
            created_by, pdf_path
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
    `UPDATE maintenance_schedules AS schedule
     SET status = 'approved',
         approved_at = NOW(),
         engineer_edit_enabled = FALSE,
         engineer_edit_enabled_by = NULL,
         engineer_edit_enabled_at = NULL
     WHERE schedule.id = $1
       AND schedule.status = 'draft'
       AND NOT EXISTS (
         SELECT 1 FROM maintenance_schedule_items item
         WHERE item.schedule_id = schedule.id AND NOT item.programming_confirmed
       )
     RETURNING schedule.id`,
    [scheduleId]
  );
  return rows[0];
}

export async function setScheduleEngineerEditAccess(scheduleId, enabled, enabledBy) {
  const { rows } = await query(
    `UPDATE maintenance_schedules
     SET engineer_edit_enabled = $2,
         engineer_edit_enabled_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
         engineer_edit_enabled_at = CASE WHEN $2 THEN NOW() ELSE NULL END
     WHERE id = $1 AND status = 'approved'
     RETURNING id, engineer_edit_enabled, engineer_edit_enabled_by, engineer_edit_enabled_at`,
    [scheduleId, enabled, enabledBy]
  );
  return rows[0];
}

export async function listScheduleItemsWithSchema(scheduleId, schema) {
  const { rows } = await query(
    `SELECT i.id, i.schedule_id, i.asset_id, i.frequency, i.planned_date, i.deadline_date, i.status,
            i.programming_confirmed, i.programmed_at, i.programmed_by,
            i.report_id, i.completion_source, i.legacy_history_file_id,
            a.code, a.name, a.brand, a.model, a.serial, a.area_id, a.site_id, a.location_id,
            a.maintenance_frequency AS asset_maintenance_frequency,
            ar.name AS area_name, s.name AS site_name, lo.name AS location_name
     FROM maintenance_schedule_items i
     JOIN "${schema}".assets a ON a.id = i.asset_id
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

export async function updateScheduleItems(
  scheduleId,
  items,
  {
    markEngineerEdited: edited = false,
    consumeEngineerEdit = false,
    expectedStatus = null,
    confirmProgramming = false,
    programmedBy = null
  } = {}
) {
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT status, engineer_edit_enabled
       FROM maintenance_schedules
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );
    const schedule = scheduleRows[0];
    if (!schedule || (expectedStatus && schedule.status !== expectedStatus)) {
      const error = new Error('El cronograma cambió de estado. Actualiza la información.');
      error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
      throw error;
    }
    if (consumeEngineerEdit && (schedule.status !== 'approved' || !schedule.engineer_edit_enabled)) {
      const error = new Error('La autorización de edición ya no está disponible.');
      error.code = 'SCHEDULE_EDIT_LOCKED';
      throw error;
    }

    let rows = [];
    if (items.length) {
      const result = await client.query(
        `UPDATE maintenance_schedule_items AS target
         SET planned_date = data.planned_date,
             deadline_date = data.deadline_date,
             programming_confirmed = CASE WHEN $5 THEN TRUE ELSE target.programming_confirmed END,
             programmed_at = CASE WHEN $5 THEN NOW() ELSE target.programmed_at END,
             programmed_by = CASE WHEN $5 THEN $6::uuid ELSE target.programmed_by END
         FROM UNNEST($2::uuid[], $3::date[], $4::date[])
           AS data(id, planned_date, deadline_date)
         WHERE target.schedule_id = $1 AND target.id = data.id
         RETURNING target.id`,
        [
          scheduleId,
          items.map((item) => item.id),
          items.map((item) => item.plannedDate),
          items.map((item) => item.deadlineDate),
          confirmProgramming,
          programmedBy
        ]
      );
      rows = result.rows;
    }
    if (rows.length !== items.length) {
      const error = new Error('Uno de los elementos no pertenece al cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (edited || consumeEngineerEdit) {
      await client.query(
        `UPDATE maintenance_schedules
         SET engineer_edited = CASE WHEN $2 THEN TRUE ELSE engineer_edited END,
             engineer_edit_enabled = CASE WHEN $3 THEN FALSE ELSE engineer_edit_enabled END,
             engineer_edit_enabled_by = CASE WHEN $3 THEN NULL ELSE engineer_edit_enabled_by END,
             engineer_edit_enabled_at = CASE WHEN $3 THEN NULL ELSE engineer_edit_enabled_at END
         WHERE id = $1`,
        [scheduleId, edited, consumeEngineerEdit]
      );
    }
    return rows;
  });
}

export async function rescheduleDraftAsset({
  scheduleId,
  clientId,
  schema,
  assetId,
  assetCategory = 'biomedical',
  frequency,
  items
}) {
  const category = normalizeAssetCategory(assetCategory);
  return withTransaction(async (client) => {
    const { rows: scheduleRows } = await client.query(
      `SELECT id, status, asset_category
       FROM maintenance_schedules
       WHERE id = $1 AND client_id = $2
       FOR UPDATE`,
      [scheduleId, clientId]
    );
    const schedule = scheduleRows[0];
    if (!schedule || normalizeAssetCategory(schedule.asset_category) !== category) {
      const error = new Error('El cronograma no corresponde al equipo seleccionado.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (schedule.status !== 'draft') {
      const error = new Error('Solo se puede reprogramar un equipo mientras el cronograma está en borrador.');
      error.code = 'SCHEDULE_EDIT_STATE_CHANGED';
      throw error;
    }

    const { rows: assetRows } = await client.query(
      `SELECT id, asset_category, maintenance_frequency
       FROM "${schema}".assets
       WHERE id = $1
       FOR UPDATE`,
      [assetId]
    );
    const asset = assetRows[0];
    if (!asset || normalizeAssetCategory(asset.asset_category) !== category) {
      const error = new Error('El equipo no pertenece a este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }

    const { rows: currentItems } = await client.query(
      `SELECT id, status, report_id, completion_source, legacy_history_file_id
       FROM maintenance_schedule_items
       WHERE schedule_id = $1 AND asset_id = $2
       FOR UPDATE`,
      [scheduleId, assetId]
    );
    if (!currentItems.length) {
      const error = new Error('El equipo no tiene mantenimientos dentro de este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }
    if (
      currentItems.some(
        (item) =>
          item.status !== 'pending' ||
          item.report_id ||
          item.completion_source ||
          item.legacy_history_file_id
      )
    ) {
      const error = new Error('El equipo ya tiene mantenimientos operativos o históricos y no puede regenerarse.');
      error.code = 'SCHEDULE_EDIT_LOCKED';
      throw error;
    }
    if (!Array.isArray(items) || !items.length) {
      const error = new Error('La periodicidad no generó fechas para este cronograma.');
      error.code = 'SCHEDULE_ITEM_MISMATCH';
      throw error;
    }

    await client.query(
      `UPDATE "${schema}".assets
       SET maintenance_frequency = $2
       WHERE id = $1`,
      [assetId, frequency]
    );
    await client.query(
      'DELETE FROM maintenance_schedule_items WHERE schedule_id = $1 AND asset_id = $2',
      [scheduleId, assetId]
    );
    await client.query(
      `INSERT INTO maintenance_schedule_items
         (schedule_id, asset_id, frequency, planned_date, deadline_date)
       SELECT $1, $2, $3, data.planned_date, data.deadline_date
       FROM UNNEST($4::date[], $5::date[]) AS data(planned_date, deadline_date)`,
      [
        scheduleId,
        assetId,
        frequency,
        items.map((item) => item.plannedDate),
        items.map((item) => item.deadlineDate)
      ]
    );
    await client.query('UPDATE maintenance_schedules SET pdf_path = NULL WHERE id = $1', [scheduleId]);

    return {
      oldFrequency: asset.maintenance_frequency,
      frequency,
      oldItemCount: currentItems.length,
      newItemCount: items.length
    };
  });
}

export async function countScheduleItems(scheduleId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM maintenance_schedule_items WHERE schedule_id = $1',
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function countPendingScheduleItems(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND status = 'pending'`,
    [scheduleId]
  );
  return rows[0]?.count ?? 0;
}

export async function countUnprogrammedScheduleItems(scheduleId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM maintenance_schedule_items
     WHERE schedule_id = $1 AND NOT programming_confirmed`,
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

export async function deleteDraftSchedule(scheduleId) {
  const { rows } = await query(
    `DELETE FROM maintenance_schedules
     WHERE id = $1 AND status = 'draft'
     RETURNING id, pdf_path`,
    [scheduleId]
  );
  return rows[0];
}

export async function markScheduleItemDone(scheduleId, itemId, reportId) {
  await query(
    `UPDATE maintenance_schedule_items
     SET status = 'done',
         completed_at = NOW(),
         report_id = $3,
         completion_source = 'software_report',
         legacy_history_file_id = NULL
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
