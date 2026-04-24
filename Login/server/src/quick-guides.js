import { query } from './db.js';

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePayload(payload = {}) {
  const brand = String(payload.brand || '').trim();
  const model = String(payload.model || '').trim();
  return {
    documentCode: String(payload.documentCode || '').trim() || null,
    version: String(payload.version || '1.0').trim() || '1.0',
    equipmentName: String(payload.equipmentName || '').trim(),
    equipmentType: String(payload.equipmentType || '').trim() || null,
    brand,
    model,
    brandNormalized: normalizeKey(brand),
    modelNormalized: normalizeKey(model),
    status: 'aprobada',
    intendedUse: null,
    responsibleUse: String(payload.responsibleUse || '').trim() || null,
    placementNotes: String(payload.placementNotes || '').trim() || null,
    prerequisites: String(payload.prerequisites || '').trim() || null,
    startupSteps: String(payload.startupSteps || '').trim() || null,
    shutdownSteps: String(payload.shutdownSteps || '').trim() || null,
    basicOperation: String(payload.basicOperation || '').trim() || null,
    alarms: String(payload.alarms || '').trim() || null,
    cleaningDisinfection: String(payload.cleaningDisinfection || '').trim() || null,
    emergencyActions: String(payload.emergencyActions || '').trim() || null,
    supportContact: String(payload.supportContact || '').trim() || null,
    visualNotes: String(payload.visualNotes || '').trim() || null
  };
}

async function getClientSchema(clientId) {
  const { rows } = await query('SELECT schema_name FROM clients WHERE id = $1', [clientId]);
  return rows[0]?.schema_name ?? null;
}

async function countAssetsForGuide(clientId, brand, model) {
  const schema = await getClientSchema(clientId);
  if (!schema || !brand || !model) return 0;
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM "${schema}".assets
     WHERE LOWER(TRIM(COALESCE(brand, ''))) = $1
       AND LOWER(TRIM(COALESCE(model, ''))) = $2`,
    [normalizeKey(brand), normalizeKey(model)]
  );
  return rows[0]?.total ?? 0;
}

async function attachAssetCounts(clientId, guides) {
  return Promise.all(
    guides.map(async (guide) => ({
      ...guide,
      asset_count: await countAssetsForGuide(clientId, guide.brand, guide.model)
    }))
  );
}

const GUIDE_SELECT = `
  SELECT g.*,
         cb.display_name AS created_by_name,
         ub.display_name AS updated_by_name,
         ub.document_number AS updated_by_document_number,
         ub.invima_registration AS updated_by_invima_registration,
         ub.signature_path AS updated_by_signature_path,
         ab.display_name AS approved_by_name
  FROM quick_use_guides g
  LEFT JOIN users cb ON cb.id = g.created_by
  LEFT JOIN users ub ON ub.id = g.updated_by
  LEFT JOIN users ab ON ab.id = g.approved_by
`;

export async function listQuickGuides(clientId, filters = {}) {
  const params = [clientId];
  const where = ['g.client_id = $1'];
  if (filters.status) {
    params.push(filters.status);
    where.push(`g.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim().toLowerCase()}%`);
    where.push(`(
      LOWER(g.equipment_name) LIKE $${params.length}
      OR LOWER(g.brand) LIKE $${params.length}
      OR LOWER(g.model) LIKE $${params.length}
      OR LOWER(COALESCE(g.document_code, '')) LIKE $${params.length}
    )`);
  }
  const { rows } = await query(
    `${GUIDE_SELECT}
     WHERE ${where.join(' AND ')}
     ORDER BY g.updated_at DESC`,
    params
  );
  return attachAssetCounts(clientId, rows);
}

export async function getQuickGuideById(clientId, guideId) {
  const { rows } = await query(
    `${GUIDE_SELECT}
     WHERE g.client_id = $1 AND g.id = $2
     LIMIT 1`,
    [clientId, guideId]
  );
  if (!rows[0]) return null;
  const [guide] = await attachAssetCounts(clientId, [rows[0]]);
  return guide;
}

export async function findQuickGuideForAsset(clientId, assetId, { includeDrafts = false } = {}) {
  const schema = await getClientSchema(clientId);
  if (!schema) return null;
  const { rows: assetRows } = await query(
    `SELECT id, brand, model FROM "${schema}".assets WHERE id = $1 LIMIT 1`,
    [assetId]
  );
  const asset = assetRows[0];
  if (!asset?.brand || !asset?.model) return null;

  const params = [clientId, normalizeKey(asset.brand), normalizeKey(asset.model)];
  const statusWhere = includeDrafts ? '' : "AND g.status = 'aprobada'";
  const { rows } = await query(
    `${GUIDE_SELECT}
     WHERE g.client_id = $1
       AND g.brand_normalized = $2
       AND g.model_normalized = $3
       ${statusWhere}
     LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

export async function createQuickGuide(clientId, payload, userId) {
  const data = normalizePayload(payload);
  const { rows } = await query(
    `INSERT INTO quick_use_guides (
       client_id, document_code, version, equipment_name, equipment_type,
       brand, model, brand_normalized, model_normalized, status,
       intended_use, responsible_use, placement_notes, prerequisites,
       startup_steps, shutdown_steps, basic_operation, alarms,
       cleaning_disinfection, emergency_actions, support_contact, visual_notes,
       created_by, updated_by, approved_by, approved_at
     )
     VALUES (
       $1,$2,$3,$4,$5,
       $6,$7,$8,$9,$10,
       $11,$12,$13,$14,
       $15,$16,$17,$18,
       $19,$20,$21,$22,
       $23,$23,$23,NOW()
     )
     RETURNING id`,
    [
      clientId,
      data.documentCode,
      data.version,
      data.equipmentName,
      data.equipmentType,
      data.brand,
      data.model,
      data.brandNormalized,
      data.modelNormalized,
      data.status,
      data.intendedUse,
      data.responsibleUse,
      data.placementNotes,
      data.prerequisites,
      data.startupSteps,
      data.shutdownSteps,
      data.basicOperation,
      data.alarms,
      data.cleaningDisinfection,
      data.emergencyActions,
      data.supportContact,
      data.visualNotes,
      userId ?? null
    ]
  );
  return rows[0];
}

export async function updateQuickGuide(clientId, guideId, payload, userId) {
  const data = normalizePayload(payload);
  const { rows } = await query(
    `UPDATE quick_use_guides
     SET document_code = $3,
         version = $4,
         equipment_name = $5,
         equipment_type = $6,
         brand = $7,
         model = $8,
         brand_normalized = $9,
         model_normalized = $10,
         status = $11,
         intended_use = $12,
         responsible_use = $13,
         placement_notes = $14,
         prerequisites = $15,
         startup_steps = $16,
         shutdown_steps = $17,
         basic_operation = $18,
         alarms = $19,
         cleaning_disinfection = $20,
         emergency_actions = $21,
         support_contact = $22,
         visual_notes = $23,
         updated_by = $24,
         approved_by = $24,
         approved_at = NOW()
     WHERE client_id = $1 AND id = $2
     RETURNING id`,
    [
      clientId,
      guideId,
      data.documentCode,
      data.version,
      data.equipmentName,
      data.equipmentType,
      data.brand,
      data.model,
      data.brandNormalized,
      data.modelNormalized,
      data.status,
      data.intendedUse,
      data.responsibleUse,
      data.placementNotes,
      data.prerequisites,
      data.startupSteps,
      data.shutdownSteps,
      data.basicOperation,
      data.alarms,
      data.cleaningDisinfection,
      data.emergencyActions,
      data.supportContact,
      data.visualNotes,
      userId ?? null
    ]
  );
  return rows[0] ?? null;
}

export async function setQuickGuideVisual(clientId, guideId, visualPath) {
  const { rows } = await query(
    `UPDATE quick_use_guides
     SET visual_path = $3
     WHERE client_id = $1 AND id = $2
     RETURNING id`,
    [clientId, guideId, visualPath]
  );
  return rows[0] ?? null;
}

export async function approveQuickGuide(clientId, guideId, userId) {
  const { rows } = await query(
    `UPDATE quick_use_guides
     SET status = 'aprobada',
         approved_by = $3,
         approved_at = NOW()
     WHERE client_id = $1 AND id = $2
     RETURNING id`,
    [clientId, guideId, userId ?? null]
  );
  return rows[0] ?? null;
}

export async function deleteQuickGuide(clientId, guideId) {
  const { rows } = await query(
    `DELETE FROM quick_use_guides
     WHERE client_id = $1 AND id = $2
     RETURNING *`,
    [clientId, guideId]
  );
  return rows[0] ?? null;
}
