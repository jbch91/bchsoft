import { query } from './db.js';
import { normalizeAssetCategory } from './asset-category.js';
import {
  maintenancePreventiveItemPhase,
  summarizeMaintenancePreventiveProgress
} from './maintenance-workflow.js';

async function clientSchema(clientId) {
  const { rows } = await query('SELECT schema_name FROM clients WHERE id = $1', [clientId]);
  return rows[0]?.schema_name || null;
}

export async function getPreventiveMaintenanceProgress(
  clientId,
  { year, month, assetCategory = 'biomedical', scopedUserId = null } = {}
) {
  const category = normalizeAssetCategory(assetCategory);
  const schema = await clientSchema(clientId);
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  const emptySummary = summarizeMaintenancePreventiveProgress([], {
    year: normalizedYear,
    month: normalizedMonth
  });
  if (!schema) {
    return {
      schedule_id: null,
      schedule_status: null,
      asset_category: category,
      year: normalizedYear,
      month: normalizedMonth,
      ...emptySummary,
      items: [],
      generated_at: new Date().toISOString()
    };
  }

  const { rows: scheduleRows } = await query(
    `SELECT id, status
     FROM maintenance_schedules
     WHERE client_id = $1
       AND asset_category = $2
       AND year = $3
       AND status IN ('approved', 'closed')
     ORDER BY CASE status WHEN 'approved' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [clientId, category, normalizedYear]
  );
  const schedule = scheduleRows[0];
  if (!schedule) {
    return {
      schedule_id: null,
      schedule_status: null,
      asset_category: category,
      year: normalizedYear,
      month: normalizedMonth,
      ...emptySummary,
      items: [],
      generated_at: new Date().toISOString()
    };
  }

  const params = [schedule.id, category];
  let accessClause = '';
  if (scopedUserId) {
    const { rows: accessRows } = await query(
      'SELECT area_id, location_id FROM reader_access WHERE user_id = $1 AND client_id = $2',
      [scopedUserId, clientId]
    );
    const locationIds = Array.from(
      new Set(accessRows.filter((row) => row.location_id).map((row) => row.location_id))
    );
    const areaIds = Array.from(
      new Set(accessRows.filter((row) => row.area_id).map((row) => row.area_id))
    );
    params.push(locationIds, areaIds);
    accessClause = `
      AND (
        a.location_id = ANY($3::uuid[])
        OR a.area_id = ANY($4::uuid[])
      )`;
  }

  const { rows: items } = await query(
    `SELECT item.id AS schedule_item_id,
            item.asset_id,
            item.planned_date,
            item.deadline_date,
            item.status AS item_status,
            item.completion_source,
            item.legacy_history_file_id,
            a.code AS asset_code,
            a.name AS asset_name,
            a.brand AS asset_brand,
            a.model AS asset_model,
            a.serial AS asset_serial,
            site.name AS site_name,
            area.name AS area_name,
            location.name AS location_name,
            request.id AS request_id,
            request.status AS request_status,
            request.assigned_to,
            assigned.display_name AS assigned_name,
            report.id AS report_id,
            report.created_at AS report_created_at,
            report.pdf_path AS report_pdf_path,
            report.area_responsible_required,
            report.requires_spare_parts,
            report.spare_parts_status,
            EXISTS (
              SELECT 1
              FROM maintenance_report_corrections correction
              WHERE correction.report_id = report.id
                AND correction.resolved_at IS NULL
            ) AS correction_requested,
            COALESCE(signatures.has_engineer_signature, FALSE) AS has_engineer_signature,
            COALESCE(signatures.has_area_responsible_signature, FALSE) AS has_area_responsible_signature,
            COALESCE(signatures.has_acceptance_signature, FALSE) AS has_acceptance_signature,
            item.deadline_date < CURRENT_DATE AS is_overdue
     FROM maintenance_schedule_items item
     JOIN "${schema}".assets a ON a.id = item.asset_id
     LEFT JOIN "${schema}".sites site ON site.id = a.site_id
     LEFT JOIN "${schema}".areas area ON area.id = a.area_id
     LEFT JOIN "${schema}".locations location ON location.id = a.location_id
     LEFT JOIN LATERAL (
       SELECT maintenance_request.id,
              maintenance_request.status,
              maintenance_request.assigned_to
       FROM maintenance_requests maintenance_request
       WHERE maintenance_request.schedule_item_id = item.id
         AND maintenance_request.type = 'preventivo'
       ORDER BY maintenance_request.created_at DESC
       LIMIT 1
     ) request ON TRUE
     LEFT JOIN users assigned ON assigned.id = request.assigned_to
     LEFT JOIN LATERAL (
       SELECT maintenance_report.id,
              maintenance_report.area_responsible_required,
              maintenance_report.requires_spare_parts,
              maintenance_report.spare_parts_status,
              maintenance_report.pdf_path,
              maintenance_report.created_at
       FROM maintenance_reports maintenance_report
       WHERE maintenance_report.type = 'preventivo'
         AND (
           maintenance_report.id = item.report_id
           OR maintenance_report.request_id = request.id
         )
       ORDER BY (maintenance_report.id = item.report_id) DESC, maintenance_report.created_at DESC
       LIMIT 1
     ) report ON TRUE
     LEFT JOIN LATERAL (
       SELECT BOOL_OR(signature.role = 'ingeniero_biomedico') AS has_engineer_signature,
              BOOL_OR(signature.role = 'responsable_area') AS has_area_responsible_signature,
              BOOL_OR(signature.role IN (
                'almacenista', 'responsable_area', 'lector', 'viewer', 'visor', 'superuser'
              )) AS has_acceptance_signature
       FROM report_signatures signature
       WHERE signature.report_id = report.id
     ) signatures ON TRUE
     WHERE item.schedule_id = $1
       AND a.asset_category = $2
       ${accessClause}
     ORDER BY item.planned_date, site.name, area.name, location.name, a.code, item.id`,
    params
  );
  const summary = summarizeMaintenancePreventiveProgress(items, {
    year: normalizedYear,
    month: normalizedMonth
  });
  const progressItems = items.map((item) => {
    const phase = maintenancePreventiveItemPhase(item);
    return {
      id: item.schedule_item_id,
      asset_id: item.asset_id,
      asset_code: item.asset_code,
      asset_name: item.asset_name,
      asset_brand: item.asset_brand,
      asset_model: item.asset_model,
      asset_serial: item.asset_serial,
      site_name: item.site_name,
      area_name: item.area_name,
      location_name: item.location_name,
      planned_date: item.planned_date,
      deadline_date: item.deadline_date,
      phase,
      is_overdue: Boolean(item.is_overdue && phase !== 'completed'),
      request_id: item.request_id,
      request_status: item.request_status,
      assigned_to: item.assigned_to,
      assigned_name: item.assigned_name,
      report_id: item.report_id,
      report_created_at: item.report_created_at,
      pdf_available: Boolean(item.report_pdf_path || item.legacy_history_file_id),
      legacy_history_file_id: item.legacy_history_file_id,
      completion_source: item.completion_source
    };
  });
  return {
    schedule_id: schedule.id,
    schedule_status: schedule.status,
    asset_category: category,
    year: normalizedYear,
    month: normalizedMonth,
    ...summary,
    items: progressItems,
    generated_at: new Date().toISOString()
  };
}

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

export async function createMaintenanceProtocolPrintBatch(payload) {
  const {
    batchCode,
    clientId,
    generatedBy,
    temporaryPermissionId,
    permissionExpiresAt,
    selectionScope,
    assetIds,
    reason
  } = payload;
  const { rows } = await query(
    `INSERT INTO maintenance_protocol_print_batches (
       batch_code, client_id, generated_by, temporary_permission_id,
       permission_expires_at, selection_scope, asset_ids, asset_count, reason
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[],cardinality($7::uuid[]),$8)
     RETURNING id, batch_code, asset_count, created_at`,
    [
      batchCode,
      clientId,
      generatedBy,
      temporaryPermissionId,
      permissionExpiresAt,
      selectionScope,
      assetIds,
      reason
    ]
  );
  return rows[0];
}

export async function listMaintenanceRequests(clientId, { assetCategory = null } = {}) {
  const params = [clientId];
  let assetJoin = '';
  let categoryClause = '';
  if (assetCategory) {
    const schema = await clientSchema(clientId);
    if (!schema) return [];
    params.push(normalizeAssetCategory(assetCategory));
    assetJoin = `JOIN "${schema}".assets a ON a.id = r.asset_id`;
    categoryClause = `AND a.asset_category = $${params.length}`;
  }
  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email,
            assigned.display_name AS assigned_name
     FROM maintenance_requests r
     ${assetJoin}
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users assigned ON assigned.id = r.assigned_to
     WHERE r.client_id = $1
       ${categoryClause}
       AND r.status NOT IN ('firmado', 'vencido')
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

export async function listMaintenanceRequestsForReader(
  clientId,
  userId,
  { assetCategory = null } = {}
) {
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
  if (assetCategory) {
    params.push(normalizeAssetCategory(assetCategory));
    where += ` AND a.asset_category = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email,
            assigned.display_name AS assigned_name
     FROM maintenance_requests r
     JOIN "${schema}".assets a ON a.id = r.asset_id
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users assigned ON assigned.id = r.assigned_to
     WHERE r.client_id = $1 ${where}
       AND r.status NOT IN ('firmado', 'vencido')
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

export async function getMaintenanceRequestById(requestId) {
  const { rows } = await query(
    `SELECT r.*, u.display_name AS requester_name, u.email AS requester_email,
            assigned.display_name AS assigned_name
     FROM maintenance_requests r
     LEFT JOIN users u ON u.id = r.requested_by
     LEFT JOIN users assigned ON assigned.id = r.assigned_to
     WHERE r.id = $1`,
    [requestId]
  );
  return rows[0];
}

export async function assignMaintenanceRequest(
  requestId,
  assignedTo,
  { allowedStatuses = ['abierto', 'en_proceso'], force = false } = {}
) {
  const ownershipClause = force ? '' : 'AND (assigned_to IS NULL OR assigned_to = $1)';
  const { rows } = await query(
    `UPDATE maintenance_requests
     SET assigned_to = $1,
         status = CASE WHEN status = 'abierto' THEN 'en_proceso' ELSE status END,
         updated_at = NOW()
     WHERE id = $2
       AND status = ANY($3::text[])
       ${ownershipClause}
     RETURNING id, assigned_to, status, updated_at`,
    [assignedTo, requestId, allowedStatuses]
  );
  return rows[0] ?? null;
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
    assetStatusObservations,
    areaResponsibleRequired,
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
       asset_status_after, asset_status_observations, area_responsible_required,
       requires_spare_parts, spare_parts_needed, spare_parts_status, created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
      assetStatusObservations || null,
      Boolean(areaResponsibleRequired),
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
    assetStatusObservations,
    areaResponsibleRequired,
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
         asset_status_observations = $11,
         area_responsible_required = $12,
         requires_spare_parts = $13,
         spare_parts_needed = $14,
         spare_parts_status = $15,
         created_by = $16,
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
      assetStatusObservations || null,
      Boolean(areaResponsibleRequired),
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

export async function listMaintenanceReports(
  clientId,
  { assetId, assetCategory = null, from, to, order = 'desc', limit, offset } = {}
) {
  const clauses = ['r.client_id = $1'];
  const params = [clientId];
  let assetJoin = '';
  if (assetCategory) {
    const schema = await clientSchema(clientId);
    if (!schema) return [];
    params.push(normalizeAssetCategory(assetCategory));
    clauses.push(`a.asset_category = $${params.length}`);
    assetJoin = `JOIN "${schema}".assets a ON a.id = r.asset_id`;
  }
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
     ${assetJoin}
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
  const {
    assetStatusAfter,
    assetStatusObservations,
    requiresSpareParts,
    sparePartsNeeded,
    sparePartsStatus
  } = payload;
  await query(
    `UPDATE maintenance_reports
     SET asset_status_after = $1,
         asset_status_observations = $2,
         requires_spare_parts = $3,
         spare_parts_needed = $4,
         spare_parts_status = $5
     WHERE id = $6`,
    [
      assetStatusAfter || 'operativo',
      assetStatusObservations || null,
      Boolean(requiresSpareParts),
      sparePartsNeeded || null,
      sparePartsStatus || 'no_aplica',
      reportId
    ]
  );
}

export async function listMaintenanceReportsForReader(
  clientId,
  userId,
  { assetId, assetCategory = null, from, to, order = 'desc', limit, offset } = {}
) {
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
  if (assetCategory) {
    params.push(normalizeAssetCategory(assetCategory));
    clauses.push(`a.asset_category = $${params.length}`);
  }
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
  let limitClause = '';
  let offsetClause = '';
  if (limit !== undefined) {
    params.push(limit);
    limitClause = `LIMIT $${params.length}`;
  }
  if (offset !== undefined) {
    params.push(offset);
    offsetClause = `OFFSET $${params.length}`;
  }
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
       AND NOT EXISTS (
         SELECT 1
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
           AND r.name IN ('lector', 'responsable_area')
       )
     ORDER BY u.display_name ASC`,
    [clientId]
  );
  return rows;
}
