import { createHash } from 'node:crypto';
import { query, withTransaction } from './db.js';
import { normalizeAssetCategory } from './asset-category.js';
import { logAudit } from './audit.js';
import { createMaintenanceReport, createMaintenanceRequest, createNotification } from './maintenance.js';
import { maintenanceAssetStatusObservationError, maintenanceSpareWorkflowForReport } from './maintenance-workflow.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ['operativo', 'operativo_observacion', 'fuera_de_servicio'];
const failure = (message, status = 400, field = null) => Object.assign(new Error(message), { status, field });
const clean = value => typeof value === 'string' ? value.trim() : '';
const singleLine = value => clean(value).replace(/\s+/g, ' ');

export function verbalAttentionAccessError(user) {
  return !user?.clientId || !user.roles?.includes('ingeniero_biomedico')
    || !user.permissions?.includes('maintenance:report:create')
    || user.roles?.includes('superuser')
    ? 'Solo un ingeniero del cliente puede registrar una atención verbal.' : '';
}

export function normalizeVerbalAttention(body, options, today) {
  const requiredText = (field, min, max, label, multiline = false) => {
    const value = multiline ? clean(body[field]) : singleLine(body[field]);
    if (value.length < min || value.length > max) {
      throw failure(`${label}: escribe entre ${min} y ${max} caracteres.`, 400, field);
    }
    return value;
  };
  const selected = (field, allowed, required) => {
    const value = body[field];
    if (!Array.isArray(value) || value.some(item => !allowed.includes(item)) || (required && !value.length)) {
      throw failure(`Revisa las opciones de ${field === 'maintenanceChecks' ? 'revisión' : field === 'maintenanceActivities' ? 'actividades' : 'pruebas realizadas'}.`, 400, field);
    }
    return [...new Set(value)].sort();
  };
  if (!UUID.test(body.submissionId || '')) throw failure('Identificador de registro inválido.', 400, 'submissionId');
  if (!UUID.test(body.assetId || '')) throw failure('Selecciona un equipo vigente.', 400, 'assetId');
  if (body.assetCategory && !['biomedical', 'industrial'].includes(body.assetCategory)) throw failure('Categoría de equipo inválida.', 400, 'assetId');
  const performedOn = clean(body.performedOn);
  const date = new Date(`${performedOn}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== performedOn || performedOn < '1900-01-01' || performedOn > today) {
    throw failure('La fecha de atención debe ser válida y no puede estar en el futuro.', 400, 'performedOn');
  }
  if (!STATES.includes(body.assetStatusAfter)) throw failure('Selecciona el estado final del equipo.', 400, 'assetStatusAfter');
  if (typeof body.requiresSpareParts !== 'boolean' || typeof body.sparePartsInstalledNow !== 'boolean') {
    throw failure('Confirma si hubo repuesto y si quedó instalado.', 400, 'requiresSpareParts');
  }
  if (body.assetLifecycleAction || body.requestId || body.type && body.type !== 'correctivo') {
    throw failure('La atención verbal genera únicamente un correctivo independiente.');
  }
  const input = {
    submissionId: body.submissionId.toLowerCase(), assetId: body.assetId.toLowerCase(),
    assetCategory: normalizeAssetCategory(body.assetCategory), performedOn,
    reporterName: requiredText('reporterName', 3, 160, 'Persona que informó'),
    reporterRole: singleLine(body.reporterRole),
    description: requiredText('description', 10, 1000, 'Falla informada', true),
    summary: requiredText('summary', 5, 5000, 'Resumen', true),
    findings: requiredText('findings', 5, 5000, 'Hallazgos', true),
    actionsTaken: requiredText('actionsTaken', 5, 5000, 'Acciones realizadas', true),
    maintenanceChecks: selected('maintenanceChecks', options.checks, true),
    maintenanceActivities: selected('maintenanceActivities', options.activities, true),
    maintenanceTests: selected('maintenanceTests', options.tests, body.assetStatusAfter !== 'fuera_de_servicio'),
    assetStatusAfter: body.assetStatusAfter,
    assetStatusObservations: body.assetStatusAfter === 'operativo' ? '' : singleLine(body.assetStatusObservations),
    requiresSpareParts: body.requiresSpareParts,
    sparePartsNeeded: body.requiresSpareParts ? requiredText('sparePartsNeeded', 3, 2000, 'Repuesto', true) : '',
    sparePartsInstalledNow: body.sparePartsInstalledNow
  };
  if (input.reporterRole.length > 100) throw failure('El cargo admite máximo 100 caracteres.', 400, 'reporterRole');
  const statusError = maintenanceAssetStatusObservationError(input.assetStatusAfter, input.assetStatusObservations);
  if (statusError) throw failure(statusError, 400, 'assetStatusObservations');
  if (input.sparePartsInstalledNow && (!input.requiresSpareParts || !input.maintenanceActivities.includes('instalacion_repuesto'))) {
    throw failure('Para indicar repuesto instalado, registra su detalle y la actividad de instalación.', 400, 'sparePartsNeeded');
  }
  return input;
}

export async function findVerbalAttention(clientId, userId, submissionId, queryRunner = query) {
  if (!UUID.test(submissionId || '')) throw failure('Identificador de registro inválido.');
  const { rows } = await queryRunner(
    `SELECT id, request_id AS "requestId", verbal_submission_hash AS "submissionHash",
            verbal_asset_status_applied AS "assetStatusApplied"
     FROM maintenance_reports WHERE client_id = $1 AND created_by = $2 AND verbal_submission_id = $3`,
    [clientId, userId, submissionId]
  );
  return rows[0] || null;
}

export async function saveVerbalAttention(input, user, deps) {
  const accessError = verbalAttentionAccessError(user);
  if (accessError) throw failure(accessError, 403);
  const submissionHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return withTransaction(async tx => {
    const queryRunner = (sql, params) => tx.query(sql, params);
    // A retry waits for the first transaction and returns the same report, never a second request.
    await queryRunner('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`verbal:${user.clientId}:${user.sub}:${input.submissionId}`]);
    const existing = await findVerbalAttention(user.clientId, user.sub, input.submissionId, queryRunner);
    if (existing) {
      if (existing.submissionHash !== submissionHash) {
        throw Object.assign(failure('Esta atención ya fue guardada. Revisa el reporte antes de cambiarla.', 409), { reportId: existing.id });
      }
      return { ...existing, replayed: true, emails: [] };
    }
    const { rows: clients } = await queryRunner('SELECT schema_name, name FROM clients WHERE id=$1', [user.clientId]);
    const client = clients[0];
    if (!client || !/^[a-z_][a-z0-9_]*$/i.test(client.schema_name)) throw failure('Cliente no disponible.', 404);
    const { rows: assets } = await queryRunner(`SELECT * FROM "${client.schema_name}".assets WHERE id=$1 FOR UPDATE`, [input.assetId]);
    const asset = assets[0];
    if (!asset || normalizeAssetCategory(asset.asset_category) !== input.assetCategory) throw failure('Equipo no encontrado en este cliente y módulo.', 404, 'assetId');
    if (asset.status === 'dado_de_baja') throw failure('El equipo está dado de baja y no admite una nueva atención.', 409, 'assetId');
    const request = { client_id: user.clientId, asset_id: asset.id, type: 'correctivo', source: 'verbal', requested_by: null };
    const plan = await deps.buildSigningPlan(user.clientId, asset, request);
    const signers = plan.users.filter(signer => signer.id !== user.sub);
    if (!signers.length) throw failure('No hay un responsable habilitado para avalar este equipo. Asigna un responsable de área o un almacenista antes de registrar la atención.', 409);
    const spare = maintenanceSpareWorkflowForReport({ requestStatus: 'en_proceso', requiresSpareParts: input.requiresSpareParts, installedDuringService: input.sparePartsInstalledNow });
    const waiting = spare.sparePartsStatus === 'solicitado';
    const createdRequest = await createMaintenanceRequest({
      clientId: user.clientId, assetId: asset.id, type: 'correctivo', source: 'verbal', requestedBy: null,
      description: `Aviso verbal de ${input.reporterName}${input.reporterRole ? ` (${input.reporterRole})` : ''}.\n${input.description}`
    }, { queryRunner });
    await queryRunner('UPDATE maintenance_requests SET assigned_to=$1 WHERE id=$2', [user.sub, createdRequest.id]);
    const { rows: laterReports } = await queryRunner(
      `SELECT id FROM maintenance_reports WHERE client_id=$1 AND asset_id=$2 AND voided_at IS NULL
       AND closure_kind = 'maintenance'
       AND COALESCE(performed_on, (created_at AT TIME ZONE 'America/Bogota')::date) > $3::date LIMIT 1`,
      [user.clientId, asset.id, input.performedOn]
    );
    const assetStatusApplied = !laterReports.length;
    const report = await createMaintenanceReport({
      ...input, ...spare, clientId: user.clientId, requestId: createdRequest.id,
      type: 'correctivo', createdBy: user.sub, areaResponsibleRequired: plan.areaResponsibleRequired,
      requestStatusAfter: waiting ? 'espera_repuesto' : 'reportado'
    }, { queryRunner });
    await queryRunner(
      `UPDATE maintenance_reports SET performed_on=$2, verbal_reporter_name=$3, verbal_reporter_role=$4,
       verbal_submission_id=$5, verbal_submission_hash=$6, verbal_asset_status_applied=$7 WHERE id=$1`,
      [report.id, input.performedOn, input.reporterName, input.reporterRole || null, input.submissionId, submissionHash, assetStatusApplied]
    );
    if (assetStatusApplied) await queryRunner(`UPDATE "${client.schema_name}".assets SET status=$1 WHERE id=$2`, [input.assetStatusAfter, asset.id]);
    const description = `Correctivo por atención verbal registrado para ${asset.code} - ${asset.name}.`;
    await logAudit({ actorUserId: user.sub, actorUsername: user.username, action: 'MAINTENANCE_VERBAL_ATTENTION_CREATE',
      targetUserId: asset.id, targetUsername: `${asset.code} - ${asset.name}`,
      details: { category: 'equipment', eventType: 'reporte_correctivo_atencion_verbal', clientId: user.clientId,
        clientName: client.name, description, actorDisplayName: user.displayName || user.username, actorRoles: user.roles,
        asset: { id: asset.id, code: asset.code, name: asset.name, brand: asset.brand, model: asset.model, serial: asset.serial,
          areaId: asset.area_id, locationId: asset.location_id, siteId: asset.site_id },
        reportId: report.id, requestId: createdRequest.id, performedOn: input.performedOn,
        reporterName: input.reporterName, reporterRole: input.reporterRole,
        assetStatusBefore: asset.status, assetStatusAfter: input.assetStatusAfter, assetStatusApplied,
        requiresSpareParts: spare.requiresSpareParts, sparePartsStatus: spare.sparePartsStatus }
    }, { queryRunner });
    const notifications = signers.map(signer => ({
      user: signer, type: 'maintenance_report_ready', title: 'Correctivo por atención verbal pendiente de aval',
      message: `${description} Requiere tu revisión y firma.${waiting ? ` Repuesto pendiente: ${input.sparePartsNeeded}.` : ''}`
    }));
    if (waiting) {
      for (const storekeeper of await deps.listStorekeepers(user.clientId)) notifications.push({ user: storekeeper,
        type: 'maintenance_spare_part_requested', title: 'Solicitud de repuesto',
        message: `El equipo ${asset.code} - ${asset.name} requiere repuesto: ${input.sparePartsNeeded}.` });
    }
    for (const notification of notifications) {
      await createNotification({ userId: notification.user.id, clientId: user.clientId,
        title: notification.title, message: notification.message, type: notification.type, priority: 'high',
        link: deps.maintenanceRoute(asset), data: { reportId: report.id, requestId: createdRequest.id, assetId: asset.id, maintenanceType: 'correctivo' }
      }, { queryRunner });
    }
    return { id: report.id, requestId: createdRequest.id, replayed: false, assetStatusApplied,
      emails: notifications.filter(item => item.user.email).map(item => ({ to: item.user.email, subject: item.title, text: item.message })) };
  });
}

export function createVerbalAttentionHandler(deps) {
  return async (req, res) => {
    try {
      const accessError = verbalAttentionAccessError(req.user);
      if (accessError) throw failure(accessError, 403);
      if (req.body?.clientId && req.body.clientId !== req.user.clientId) throw failure('Sin acceso al cliente.', 403);
      const input = normalizeVerbalAttention(req.body || {}, deps.options, deps.today());
      const engineer = await deps.getEngineer(req.user.sub);
      if (!engineer || engineer.client_id !== req.user.clientId || !engineer.roles?.includes('ingeniero_biomedico')) throw failure('Ingeniero no disponible para este cliente.', 403);
      if (!engineer.signature_path || !deps.signatureAvailable(engineer.signature_path)) throw failure('Registra tu firma digital antes de guardar el correctivo.', 409);
      const saved = await deps.save(input, req.user, deps);
      const warnings = [];
      try { await deps.signReport(saved.id, req.user.clientId, engineer); }
      catch (error) { console.error('Firma de atención verbal pendiente', error); warnings.push('signature'); }
      try { if (!await deps.writePdf(saved.id)) throw new Error('PDF no generado'); }
      catch (error) { console.error('PDF de atención verbal pendiente', error); warnings.push('pdf'); }
      // Notifications are committed with the report. Email delivery cannot hold the form open.
      for (const email of saved.emails) void deps.sendEmail(email).catch(error => console.error('Correo de atención verbal pendiente', error));
      return res.status(saved.replayed ? 200 : 201).json({ id: saved.id, requestId: saved.requestId,
        replayed: saved.replayed, assetStatusApplied: saved.assetStatusApplied, warnings });
    } catch (error) {
      if (!error.status) console.error('No se pudo registrar atención verbal', error);
      return res.status(error.status || 500).json({
        message: error.status ? error.message : 'No se pudo guardar la atención verbal. Puedes reintentar sin duplicar el reporte.',
        field: error.field || null, reportId: error.reportId || null
      });
    }
  };
}
