import { query } from './db.js';

export async function createMaintenanceRequest(payload) {
  const { clientId, assetId, type, description, requestedBy, plannedDate, deadlineDate, source } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_requests (client_id, asset_id, type, description, planned_date, deadline_date, source, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [clientId, assetId, type, description || null, plannedDate || null, deadlineDate || null, source || 'manual', requestedBy]
  );
  return rows[0];
}

export async function listMaintenanceRequests(clientId) {
  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email
     FROM maintenance_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     WHERE r.client_id = $1
       AND r.status NOT IN ('reportado', 'firmado')
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
       AND r.status NOT IN ('reportado', 'firmado')
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
  const { clientId, requestId, assetId, type, summary, findings, actionsTaken, createdBy } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_reports (client_id, request_id, asset_id, type, summary, findings, actions_taken, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [clientId, requestId, assetId, type, summary || null, findings || null, actionsTaken || null, createdBy]
  );
  await query(
    `UPDATE maintenance_requests SET status = 'reportado', updated_at = NOW()
     WHERE id = $1`,
    [requestId]
  );
  return rows[0];
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
    `SELECT r.*, u.display_name AS engineer_name, req.status AS request_status, req.requested_by
     FROM maintenance_reports r
     LEFT JOIN users u ON u.id = r.created_by
     LEFT JOIN maintenance_requests req ON req.id = r.request_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY r.created_at ${orderDir}
     ${limitClause} ${offsetClause}`,
    params
  );
  return rows;
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
    `SELECT r.*, u.display_name AS engineer_name, req.status AS request_status, req.requested_by
     FROM maintenance_reports r
     JOIN "${schema}".assets a ON a.id = r.asset_id
     LEFT JOIN users u ON u.id = r.created_by
     LEFT JOIN maintenance_requests req ON req.id = r.request_id
     WHERE ${clauses.join(' AND ')} ${accessClause}
     ORDER BY r.created_at ${orderDir}
     ${limitClause} ${offsetClause}`,
    params
  );
  return rows;
}

export async function getMaintenanceReportById(reportId) {
  const { rows } = await query(
    `SELECT r.*, req.client_id, req.requested_by
     FROM maintenance_reports r
     JOIN maintenance_requests req ON req.id = r.request_id
     WHERE r.id = $1`,
    [reportId]
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
  const { userId, clientId, title, message, link } = payload;
  const { rows } = await query(
    `INSERT INTO notifications (user_id, client_id, title, message, link)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [userId, clientId || null, title, message, link || null]
  );
  return rows[0];
}

export async function listNotifications(userId) {
  const { rows } = await query(
    `SELECT id, title, message, link, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
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
