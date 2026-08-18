import { query } from './db.js';
import {
  canonicalizeCatalogValue,
  ensureEquipmentCatalogPath,
  normalizeCatalogText
} from './equipment-catalog.js';

function normalizePayload(payload = {}) {
  const equipmentName = canonicalizeCatalogValue(payload.equipmentName);
  const brand = canonicalizeCatalogValue(payload.brand);
  const model = canonicalizeCatalogValue(payload.model);
  return {
    documentCode: String(payload.documentCode || '').trim() || null,
    version: String(payload.version || '1.0').trim() || '1.0',
    equipmentName,
    equipmentType: String(payload.equipmentType || '').trim() || null,
    brand,
    model,
    equipmentNameNormalized: normalizeCatalogText(equipmentName),
    brandNormalized: normalizeCatalogText(brand),
    modelNormalized: normalizeCatalogText(model),
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

async function countAssetsForGuide(clientId, equipmentName, brand, model, catalogModelId) {
  const schema = await getClientSchema(clientId);
  if (!schema || !equipmentName || !brand || !model) return 0;
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM "${schema}".assets
     WHERE ($1::uuid IS NOT NULL AND equipment_catalog_model_id = $1)
        OR (
          public.normalize_biomedical_catalog_text(name) = $2
          AND public.normalize_biomedical_catalog_text(brand) = $3
          AND public.normalize_biomedical_catalog_text(model) = $4
        )`,
    [
      catalogModelId || null,
      normalizeCatalogText(equipmentName),
      normalizeCatalogText(brand),
      normalizeCatalogText(model)
    ]
  );
  return rows[0]?.total ?? 0;
}

async function attachAssetCounts(clientId, guides) {
  return Promise.all(
    guides.map(async (guide) => ({
      ...guide,
      asset_count: await countAssetsForGuide(
        clientId,
        guide.equipment_name,
        guide.brand,
        guide.model,
        guide.equipment_catalog_model_id
      )
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
    `SELECT id, name, brand, model, equipment_catalog_model_id
     FROM "${schema}".assets
     WHERE id = $1
     LIMIT 1`,
    [assetId]
  );
  const asset = assetRows[0];
  if (!asset?.brand || !asset?.model) return null;

  const params = [
    clientId,
    asset.equipment_catalog_model_id || null,
    normalizeCatalogText(asset.name),
    normalizeCatalogText(asset.brand),
    normalizeCatalogText(asset.model)
  ];
  const statusWhere = includeDrafts ? '' : "AND g.status = 'aprobada'";
  const { rows } = await query(
    `${GUIDE_SELECT}
     WHERE g.client_id = $1
       AND (
         ($2::uuid IS NOT NULL AND g.equipment_catalog_model_id = $2)
         OR (
           g.equipment_name_normalized = $3
           AND g.brand_normalized = $4
           AND g.model_normalized = $5
         )
       )
       ${statusWhere}
     ORDER BY
       CASE WHEN $2::uuid IS NOT NULL AND g.equipment_catalog_model_id = $2 THEN 0 ELSE 1 END,
       g.updated_at DESC
     LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

export async function createQuickGuide(clientId, payload, userId) {
  const data = normalizePayload(payload);
  const catalogPath = await ensureEquipmentCatalogPath({
    equipmentName: data.equipmentName,
    brand: data.brand,
    model: data.model,
    createdBy: userId
  });
  const { rows } = await query(
    `INSERT INTO quick_use_guides (
       client_id, document_code, version, equipment_name, equipment_type,
       brand, model, equipment_name_normalized, brand_normalized, model_normalized,
       equipment_catalog_model_id, status,
       intended_use, responsible_use, placement_notes, prerequisites,
       startup_steps, shutdown_steps, basic_operation, alarms,
       cleaning_disinfection, emergency_actions, support_contact, visual_notes,
       created_by, updated_by, approved_by, approved_at
     )
     VALUES (
       $1,$2,$3,$4,$5,
       $6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,
       $16,$17,$18,$19,
       $20,$21,$22,$23,
       $24,$25,$25,$25,NOW()
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
      data.equipmentNameNormalized,
      data.brandNormalized,
      data.modelNormalized,
      catalogPath.modelId,
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
  const catalogPath = await ensureEquipmentCatalogPath({
    equipmentName: data.equipmentName,
    brand: data.brand,
    model: data.model,
    createdBy: userId
  });
  const { rows } = await query(
    `UPDATE quick_use_guides
     SET document_code = $3,
         version = $4,
         equipment_name = $5,
         equipment_type = $6,
         brand = $7,
         model = $8,
         equipment_name_normalized = $9,
         brand_normalized = $10,
         model_normalized = $11,
         equipment_catalog_model_id = $12,
         status = $13,
         intended_use = $14,
         responsible_use = $15,
         placement_notes = $16,
         prerequisites = $17,
         startup_steps = $18,
         shutdown_steps = $19,
         basic_operation = $20,
         alarms = $21,
         cleaning_disinfection = $22,
         emergency_actions = $23,
         support_contact = $24,
         visual_notes = $25,
         updated_by = $26,
         approved_by = $26,
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
      data.equipmentNameNormalized,
      data.brandNormalized,
      data.modelNormalized,
      catalogPath.modelId,
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
