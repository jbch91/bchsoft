import { query } from './db.js';

export async function createMaintenanceRequest(payload) {
  const {
    clientId,
    assetId,
    type,
    description,
    requestedBy,
    plannedDate,
    deadlineDate,
    source,
    scheduleId,
    scheduleItemId
  } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_requests (
       client_id, asset_id, type, description, planned_date, deadline_date, source,
       requested_by, schedule_id, schedule_item_id
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      clientId,
      assetId,
      type,
      description || null,
      plannedDate || null,
      deadlineDate || null,
      source || 'manual',
      requestedBy,
      scheduleId || null,
      scheduleItemId || null
    ]
  );
  return rows[0];
}

export async function listMaintenanceRequests(clientId) {
  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email
     FROM maintenance_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     WHERE r.client_id = $1
       AND r.status NOT IN ('firmado', 'vencido')
     ORDER BY r.created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function listMaintenanceRequestsForReader(clientId, userId) {
  const { rows: clientRows } = await query('SELECT schema_name FROM clients WHERE id = $1', [
    clientId
  ]);
  const schema = clientRows[0]?.schema_name;
  if (!schema) {
    return [];
  }
  const { rows: accessRows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  const areaIds = accessRows.filter((row) => row.area_id).map((row) => row.area_id);
  const locationIds = accessRows.filter((row) => row.location_id).map((row) => row.location_id);
  if (!areaIds.length && !locationIds.length) {
    return [];
  }

  let where = '';
  let params = [];
  if (locationIds.length && areaIds.length) {
    where = 'AND (a.location_id = ANY($2) OR a.area_id = ANY($3))';
    params = [clientId, locationIds, areaIds];
  } else if (locationIds.length) {
    where = 'AND a.location_id = ANY($2)';
    params = [clientId, locationIds];
  } else {
    where = 'AND a.area_id = ANY($2)';
    params = [clientId, areaIds];
  }

  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email
     FROM maintenance_requests r
     JOIN "${schema}".assets a ON a.id = r.asset_id
     LEFT JOIN users u ON u.id = r.requested_by
     WHERE r.client_id = $1 ${where}
       AND r.status NOT IN ('firmado', 'vencido')
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

export async function getMaintenanceRequestById(requestId) {
  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email
     FROM maintenance_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     WHERE r.id = $1`,
    [requestId]
  );
  return rows[0];
}

export async function assignMaintenanceRequest(requestId, assignedTo) {
  await query(
    `UPDATE maintenance_requests SET assigned_to = $1, status = 'en_proceso', updated_at = NOW()
     WHERE id = $2`,
    [assignedTo, requestId]
  );
}

export async function createMaintenanceReport(payload) {
  const {
    clientId,
    requestId,
    assetId,
    type,
    summary,
    findings,
    actionsTaken,
    failureCause,
    maintenanceChecks,
    maintenanceActivities,
    maintenanceTests,
    assetStatusAfter,
    requiresSpareParts,
    sparePartsNeeded,
    sparePartsStatus,
    requestStatusAfter,
    createdBy
  } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_reports (
       client_id, request_id, asset_id, type, summary, findings, actions_taken,
       failure_cause, maintenance_checks, maintenance_activities, maintenance_tests,
       asset_status_after, requires_spare_parts, spare_parts_needed, spare_parts_status, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      clientId,
      requestId,
      assetId,
      type,
      summary || null,
      findings || null,
      actionsTaken || null,
      failureCause || null,
      JSON.stringify(Array.isArray(maintenanceChecks) ? maintenanceChecks : []),
      JSON.stringify(Array.isArray(maintenanceActivities) ? maintenanceActivities : []),
      JSON.stringify(Array.isArray(maintenanceTests) ? maintenanceTests : []),
      assetStatusAfter || 'operativo',
      Boolean(requiresSpareParts),
      sparePartsNeeded || null,
      sparePartsStatus || 'no_aplica',
      createdBy
    ]
  );
  await query(
    `UPDATE maintenance_requests SET status = $2, updated_at = NOW()
     WHERE id = $1`,
    [requestId, requestStatusAfter || 'reportado']
  );
  return rows[0];
}

export async function getMaintenanceReportWithOpenCorrectionByRequest(requestId) {
  const { rows } = await query(
    `SELECT r.*
     FROM maintenance_reports r
     JOIN maintenance_report_corrections c ON c.report_id = r.id AND c.resolved_at IS NULL
     WHERE r.request_id = $1
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [requestId]
  );
  return rows[0];
}

export async function getLatestWaitingSpareReportByRequest(requestId) {
  const { rows } = await query(
    `SELECT *
     FROM maintenance_reports
     WHERE request_id = $1
       AND requires_spare_parts = TRUE
       AND spare_parts_status <> 'recibido'
     ORDER BY created_at DESC
     LIMIT 1`,
    [requestId]
  );
  return rows[0];
}

export async function updateMaintenanceReport(reportId, payload) {
  const {
    type,
    summary,
    findings,
    actionsTaken,
    failureCause,
    maintenanceChecks,
    maintenanceActivities,
    maintenanceTests,
    assetStatusAfter,
    requiresSpareParts,
    sparePartsNeeded,
    sparePartsStatus,
    requestStatusAfter,
    createdBy
  } = payload;
  await query(
    `UPDATE maintenance_reports
     SET type = $2,
         summary = $3,
         findings = $4,
         actions_taken = $5,
         failure_cause = $6,
         maintenance_checks = $7,
         maintenance_activities = $8,
         maintenance_tests = $9,
         asset_status_after = $10,
         requires_spare_parts = $11,
         spare_parts_needed = $12,
         spare_parts_status = $13,
         created_by = $14,
         pdf_path = NULL
     WHERE id = $1`,
    [
      reportId,
      type,
      summary || null,
      findings || null,
      actionsTaken || null,
      failureCause || null,
      JSON.stringify(Array.isArray(maintenanceChecks) ? maintenanceChecks : []),
      JSON.stringify(Array.isArray(maintenanceActivities) ? maintenanceActivities : []),
      JSON.stringify(Array.isArray(maintenanceTests) ? maintenanceTests : []),
      assetStatusAfter || 'operativo',
      Boolean(requiresSpareParts),
      sparePartsNeeded || null,
      sparePartsStatus || 'no_aplica',
      createdBy
    ]
  );
  await query(
    `UPDATE maintenance_requests SET status = $2, updated_at = NOW()
     WHERE id = (SELECT request_id FROM maintenance_reports WHERE id = $1)`,
    [reportId, requestStatusAfter || 'reportado']
  );
  return { id: reportId };
}

export async function deleteReportSignatures(reportId) {
  await query('DELETE FROM report_signatures WHERE report_id = $1', [reportId]);
}

export async function resolveMaintenanceReportCorrections(reportId) {
  await query(
    `UPDATE maintenance_report_corrections
     SET resolved_at = COALESCE(resolved_at, NOW())
     WHERE report_id = $1 AND resolved_at IS NULL`,
    [reportId]
  );
}

export async function signMaintenanceReport(payload) {
  const { reportId, userId, role, signaturePath } = payload;
  const { rows } = await query(
    `INSERT INTO report_signatures (report_id, user_id, role, signature_path)
     VALUES ($1,$2,$3,$4)
     RETURNING id`,
    [reportId, userId, role, signaturePath]
  );
  return rows[0];
}

export async function listMaintenanceReports(clientId, { assetId, from, to, order = 'desc', limit, offset } = {}) {
  const clauses = ['r.client_id = $1'];
  const params = [clientId];
  if (assetId) {
    params.push(assetId);
    clauses.push(`r.asset_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`r.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`r.created_at <= $${params.length}`);
  }
  if (limit !== undefined) {
    params.push(limit);
  }
  if (offset !== undefined) {
    params.push(offset);
  }
  const orderDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limitClause = limit !== undefined ? `LIMIT $${params.length - (offset !== undefined ? 1 : 0)}` : '';
  const offsetClause = offset !== undefined ? `OFFSET $${params.length}` : '';
  const { rows } = await query(
    `SELECT r.*, u.display_name AS engineer_name, req.status AS request_status, req.requested_by,
            (lc.id IS NOT NULL) AS correction_requested,
            lc.reason AS correction_reason,
            lc.created_at AS correction_requested_at,
            lcu.display_name AS correction_requested_by_name
     FROM maintenance_reports r
     LEFT JOIN users u ON u.id = r.created_by
     LEFT JOIN maintenance_requests req ON req.id = r.request_id
     LEFT JOIN LATERAL (
       SELECT id, requested_by, reason, created_at
       FROM maintenance_report_corrections
       WHERE report_id = r.id AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
     ) lc ON TRUE
     LEFT JOIN users lcu ON lcu.id = lc.requested_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY r.created_at ${orderDir}
     ${limitClause} ${offsetClause}`,
    params
  );
  return rows;
}

export async function updateMaintenanceReportTracking(reportId, payload) {
  const { assetStatusAfter, requiresSpareParts, sparePartsNeeded, sparePartsStatus } = payload;
  await query(
    `UPDATE maintenance_reports
     SET asset_status_after = $1,
         requires_spare_parts = $2,
         spare_parts_needed = $3,
         spare_parts_status = $4
     WHERE id = $5`,
    [
      assetStatusAfter || 'operativo',
      Boolean(requiresSpareParts),
      sparePartsNeeded || null,
      sparePartsStatus || 'no_aplica',
      reportId
    ]
  );
}

export async function listMaintenanceReportsForReader(clientId, userId, { assetId, from, to, order = 'desc', limit, offset } = {}) {
  const { rows: clientRows } = await query('SELECT schema_name FROM clients WHERE id = $1', [
    clientId
  ]);
  const schema = clientRows[0]?.schema_name;
  if (!schema) {
    return [];
  }
  const { rows: accessRows } = await query(
    'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
  const areaIds = accessRows.filter((row) => row.area_id).map((row) => row.area_id);
  const locationIds = accessRows.filter((row) => row.location_id).map((row) => row.location_id);
  if (!areaIds.length && !locationIds.length) {
    return [];
  }

  const clauses = ['r.client_id = $1'];
  const params = [clientId];
  if (assetId) {
    params.push(assetId);
    clauses.push(`r.asset_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`r.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`r.created_at <= $${params.length}`);
  }
  if (limit !== undefined) {
    params.push(limit);
  }
  if (offset !== undefined) {
    params.push(offset);
  }

  let accessClause = '';
  if (locationIds.length && areaIds.length) {
    params.push(locationIds);
    params.push(areaIds);
    accessClause = `AND (a.location_id = ANY($${params.length - 1}) OR a.area_id = ANY($${params.length}))`;
  } else if (locationIds.length) {
    params.push(locationIds);
    accessClause = `AND a.location_id = ANY($${params.length})`;
  } else {
    params.push(areaIds);
    accessClause = `AND a.area_id = ANY($${params.length})`;
  }

  const orderDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limitClause = limit !== undefined ? `LIMIT $${params.length - (offset !== undefined ? 1 : 0)}` : '';
  const offsetClause = offset !== undefined ? `OFFSET $${params.length}` : '';
  const { rows } = await query(
    `SELECT r.*, u.display_name AS engineer_name, req.status AS request_status, req.requested_by,
            (lc.id IS NOT NULL) AS correction_requested,
            lc.reason AS correction_reason,
            lc.created_at AS correction_requested_at,
            lcu.display_name AS correction_requested_by_name
     FROM maintenance_reports r
     JOIN "${schema}".assets a ON a.id = r.asset_id
     LEFT JOIN users u ON u.id = r.created_by
     LEFT JOIN maintenance_requests req ON req.id = r.request_id
     LEFT JOIN LATERAL (
       SELECT id, requested_by, reason, created_at
       FROM maintenance_report_corrections
       WHERE report_id = r.id AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
     ) lc ON TRUE
     LEFT JOIN users lcu ON lcu.id = lc.requested_by
     WHERE ${clauses.join(' AND ')} ${accessClause}
     ORDER BY r.created_at ${orderDir}
     ${limitClause} ${offsetClause}`,
    params
  );
  return rows;
}

export async function getMaintenanceReportById(reportId) {
  const { rows } = await query(
    `SELECT r.*, req.client_id, req.requested_by, req.status AS request_status,
            (lc.id IS NOT NULL) AS correction_requested,
            lc.reason AS correction_reason,
            lc.created_at AS correction_requested_at,
            lcu.display_name AS correction_requested_by_name
     FROM maintenance_reports r
     JOIN maintenance_requests req ON req.id = r.request_id
     LEFT JOIN LATERAL (
       SELECT id, requested_by, reason, created_at
       FROM maintenance_report_corrections
       WHERE report_id = r.id AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
     ) lc ON TRUE
     LEFT JOIN users lcu ON lcu.id = lc.requested_by
     WHERE r.id = $1`,
    [reportId]
  );
  return rows[0];
}

export async function requestMaintenanceReportCorrection(payload) {
  const { reportId, userId, reason } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_report_corrections (report_id, requested_by, reason)
     VALUES ($1,$2,$3)
     RETURNING id`,
    [reportId, userId, reason]
  );
  return rows[0];
}

export async function updateMaintenanceRequestStatus(requestId, status) {
  await query('UPDATE maintenance_requests SET status = $1, updated_at = NOW() WHERE id = $2', [
    status,
    requestId
  ]);
}

export async function updateMaintenanceReportPdf(reportId, pdfPath) {
  await query('UPDATE maintenance_reports SET pdf_path = $1 WHERE id = $2', [pdfPath, reportId]);
}

export async function listReportSignatures(reportId) {
  const { rows } = await query(
    `SELECT s.id, s.user_id, s.role, s.signature_path, s.signed_at, u.display_name
     FROM report_signatures s
     JOIN users u ON u.id = s.user_id
     WHERE s.report_id = $1
     ORDER BY s.signed_at ASC`,
    [reportId]
  );
  return rows;
}

export async function listReportSignaturesByReports(reportIds) {
  if (!reportIds.length) return [];
  const { rows } = await query(
    `SELECT s.report_id, s.user_id, s.role, s.signed_at
     FROM report_signatures s
     WHERE s.report_id = ANY($1)`,
    [reportIds]
  );
  return rows;
}

export async function deleteMaintenanceReport(reportId) {
  await query('DELETE FROM maintenance_reports WHERE id = $1', [reportId]);
}

export async function deleteMaintenanceRequest(requestId) {
  await query('DELETE FROM maintenance_requests WHERE id = $1', [requestId]);
}

export async function createNotification(payload) {
  const { userId, clientId, title, message, link, type, priority, data } = payload;
  const { rows } = await query(
    `INSERT INTO notifications (user_id, client_id, title, message, link, type, priority, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      userId,
      clientId || null,
      title,
      message,
      link || null,
      type || 'general',
      priority || 'normal',
      data || {}
    ]
  );
  return rows[0];
}

export async function createNotificationOnce(payload) {
  const { userId, type, data } = payload;
  const reportId = data?.reportId;
  if (reportId) {
    const { rows } = await query(
      `SELECT id
       FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND payload->>'reportId' = $3
       LIMIT 1`,
      [userId, type || 'general', reportId]
    );
    if (rows[0]) return rows[0];
  }
  return createNotification(payload);
}

export async function listNotifications(userId) {
  const { rows } = await query(
    `SELECT id, client_id, title, message, link, type, priority, payload, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 80`,
    [userId]
  );
  return rows;
}

export async function markNotificationRead(notificationId, userId) {
  await query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllNotificationsRead(userId) {
  await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
}

export async function markMaintenanceRequestNotificationsResolved(requestId) {
  await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE payload->>'requestId' = $1
       AND type IN (
         'maintenance_request_created',
         'maintenance_preventive_generated',
         'maintenance_spare_part_requested'
       )
       AND read_at IS NULL`,
    [requestId]
  );
}

export async function markMaintenanceReportNotificationsResolved(reportId) {
  await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE payload->>'reportId' = $1
       AND type = 'maintenance_report_ready'
       AND read_at IS NULL`,
    [reportId]
  );
}

export async function listUsersByRoleAndClient(role, clientId) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.display_name, u.signature_path
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.name = $1 AND u.client_id = $2 AND u.is_active = TRUE`,
    [role, clientId]
  );
  return rows;
}

export async function listUsersByClient(clientId) {
  const { rows } = await query(
    `SELECT DISTINCT u.id, u.email, u.display_name
     FROM users u
     WHERE u.client_id = $1
       AND u.is_active = TRUE
     ORDER BY u.display_name ASC`,
    [clientId]
  );
  return rows;
}
