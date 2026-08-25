import { pool, query } from './db.js';
import { canonicalizeCatalogValue, normalizeCatalogText } from './equipment-catalog-text.js';
import { normalizeAssetCategory } from './asset-category.js';

export { canonicalizeCatalogValue, normalizeCatalogText } from './equipment-catalog-text.js';

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);
const NODE_CONFIG = Object.freeze({
  equipment: {
    table: 'biomedical_equipment_catalog',
    label: 'equipo',
    parentColumn: null,
    parentType: null
  },
  brand: {
    table: 'biomedical_equipment_brands',
    label: 'marca',
    parentColumn: 'equipment_id',
    parentType: 'equipment'
  },
  model: {
    table: 'biomedical_equipment_models',
    label: 'modelo',
    parentColumn: 'brand_id',
    parentType: 'brand'
  }
});

function catalogError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function nodeConfig(type) {
  const config = NODE_CONFIG[type];
  if (!config) {
    throw catalogError('CATALOG_INVALID_NODE_TYPE', 'Tipo de nodo de catálogo no permitido.');
  }
  return config;
}

function cleanCatalogValue(value, label) {
  const text = canonicalizeCatalogValue(value);
  if (!text) {
    throw catalogError('CATALOG_VALUE_REQUIRED', `${label} es obligatorio.`);
  }
  if (text.length > 160) {
    throw catalogError('CATALOG_VALUE_TOO_LONG', `${label} supera los 160 caracteres.`);
  }
  return text;
}

function cleanReviewNotes(value) {
  const notes = String(value || '').trim();
  if (notes.length > 500) {
    throw catalogError('CATALOG_REVIEW_NOTES_TOO_LONG', 'La observación supera los 500 caracteres.');
  }
  return notes || null;
}

function compareCatalogNodes(left, right) {
  const categoryOrder = String(left.assetCategory || '').localeCompare(String(right.assetCategory || ''));
  return categoryOrder || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
}

function reviewMetadata(row) {
  return {
    reviewStatus: row.review_status,
    isActive: row.is_active,
    submissionCount: Number(row.submission_count || 0),
    submittedAt: row.submitted_at,
    lastSubmittedAt: row.last_submitted_at,
    submittedByName: row.submitted_by_name || null,
    submittedClientName: row.submitted_client_name || null,
    reviewedAt: row.reviewed_at,
    reviewedByName: row.reviewed_by_name || null,
    reviewNotes: row.review_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function buildEquipmentCatalogTree(rows = []) {
  const equipmentById = new Map();

  for (const row of rows) {
    let equipment = equipmentById.get(row.equipment_id);
    if (!equipment) {
      equipment = {
        id: row.equipment_id,
        name: row.equipment_name,
        assetCategory: row.asset_category || 'biomedical',
        brands: []
      };
      equipmentById.set(row.equipment_id, equipment);
    }

    if (!row.brand_id) continue;
    let brand = equipment.brands.find((item) => item.id === row.brand_id);
    if (!brand) {
      brand = {
        id: row.brand_id,
        name: row.brand_name,
        models: []
      };
      equipment.brands.push(brand);
    }

    if (row.model_id && !brand.models.some((item) => item.id === row.model_id)) {
      brand.models.push({ id: row.model_id, name: row.model_name });
    }
  }

  const equipment = Array.from(equipmentById.values());
  equipment.forEach((item) => {
    item.brands.sort(compareCatalogNodes);
    item.brands.forEach((brand) => brand.models.sort(compareCatalogNodes));
  });
  return equipment.sort(compareCatalogNodes);
}

export function buildAdminEquipmentCatalogTree({ equipmentRows = [], brandRows = [], modelRows = [] } = {}) {
  const equipmentById = new Map(
    equipmentRows.map((row) => [
      row.id,
      {
        id: row.id,
        type: 'equipment',
        name: row.name,
        assetCategory: row.asset_category || 'biomedical',
        ...reviewMetadata(row),
        brands: []
      }
    ])
  );
  const brandById = new Map();

  for (const row of brandRows) {
    const brand = {
      id: row.id,
      type: 'brand',
      equipmentId: row.equipment_id,
      name: row.name,
      ...reviewMetadata(row),
      models: []
    };
    brandById.set(row.id, brand);
    equipmentById.get(row.equipment_id)?.brands.push(brand);
  }

  for (const row of modelRows) {
    brandById.get(row.brand_id)?.models.push({
      id: row.id,
      type: 'model',
      brandId: row.brand_id,
      name: row.name,
      ...reviewMetadata(row)
    });
  }

  const equipment = Array.from(equipmentById.values());
  equipment.forEach((item) => {
    item.brands.sort(compareCatalogNodes);
    item.brands.forEach((brand) => brand.models.sort(compareCatalogNodes));
  });
  return equipment.sort(compareCatalogNodes);
}

export async function listEquipmentCatalog(assetCategory = 'biomedical') {
  const category = normalizeAssetCategory(assetCategory);
  const { rows } = await query(
    `SELECT e.id AS equipment_id,
            e.name AS equipment_name,
            e.asset_category,
            b.id AS brand_id,
            b.name AS brand_name,
            m.id AS model_id,
            m.name AS model_name
     FROM biomedical_equipment_catalog e
     LEFT JOIN biomedical_equipment_brands b
       ON b.equipment_id = e.id
      AND b.is_active = TRUE
      AND b.review_status = 'approved'
     LEFT JOIN biomedical_equipment_models m
       ON m.brand_id = b.id
      AND m.is_active = TRUE
      AND m.review_status = 'approved'
     WHERE e.is_active = TRUE
       AND e.review_status = 'approved'
       AND e.asset_category = $1
     ORDER BY e.name, b.name, m.name`,
    [category]
  );
  return buildEquipmentCatalogTree(rows);
}

async function listAdminNodes(table, db = { query }) {
  const { rows } = await db.query(
    `SELECT n.*,
            submitter.display_name AS submitted_by_name,
            submitted_client.name AS submitted_client_name,
            reviewer.display_name AS reviewed_by_name
     FROM ${table} n
     LEFT JOIN users submitter ON submitter.id = n.submitted_by
     LEFT JOIN clients submitted_client ON submitted_client.id = n.submitted_client_id
     LEFT JOIN users reviewer ON reviewer.id = n.reviewed_by
     ORDER BY n.name`
  );
  return rows;
}

export async function listEquipmentCatalogForAdmin() {
  const [equipmentRows, brandRows, modelRows] = await Promise.all([
    listAdminNodes('biomedical_equipment_catalog'),
    listAdminNodes('biomedical_equipment_brands'),
    listAdminNodes('biomedical_equipment_models')
  ]);
  return buildAdminEquipmentCatalogTree({ equipmentRows, brandRows, modelRows });
}

async function findSuggestionNode(db, config, parentId, normalizedName, assetCategory, lock = false) {
  const parentWhere = config.parentColumn
    ? `${config.parentColumn} = $1 AND normalized_name = $2`
    : 'asset_category = $1 AND normalized_name = $2';
  const params = config.parentColumn
    ? [parentId, normalizedName]
    : [normalizeAssetCategory(assetCategory), normalizedName];
  const { rows } = await db.query(
    `SELECT id, name, review_status, is_active
     FROM ${config.table}
     WHERE ${parentWhere}
     ${lock ? 'FOR UPDATE' : ''}`,
    params
  );
  return rows[0] || null;
}

async function ensureSuggestionNode(db, {
  type,
  parentId = null,
  name,
  assetCategory = 'biomedical',
  submittedBy,
  submittedClientId
}) {
  const config = nodeConfig(type);
  const label = type === 'equipment' ? 'El nombre del equipo' : type === 'brand' ? 'La marca' : 'El modelo';
  const value = cleanCatalogValue(name, label);
  const normalizedName = normalizeCatalogText(value);
  const category = normalizeAssetCategory(assetCategory);
  let existing = await findSuggestionNode(db, config, parentId, normalizedName, category, true);

  if (existing?.review_status === 'approved' && existing.is_active) {
    return existing;
  }

  if (existing) {
    const { rows } = await db.query(
      `UPDATE ${config.table}
       SET name = $2,
           review_status = 'pending',
           is_active = TRUE,
           submitted_by = $3,
           submitted_client_id = $4,
           submitted_at = CASE WHEN review_status = 'pending' THEN COALESCE(submitted_at, NOW()) ELSE NOW() END,
           last_submitted_at = NOW(),
           submission_count = submission_count + 1,
           reviewed_by = NULL,
           reviewed_at = NULL,
           review_notes = NULL
       WHERE id = $1
       RETURNING id, name, review_status, is_active`,
      [existing.id, value, submittedBy || null, submittedClientId || null]
    );
    return rows[0];
  }

  const columns = config.parentColumn
    ? `${config.parentColumn}, name, normalized_name, is_active, created_by, review_status, submitted_by, submitted_client_id, submitted_at, last_submitted_at, submission_count`
    : 'asset_category, name, normalized_name, is_active, created_by, review_status, submitted_by, submitted_client_id, submitted_at, last_submitted_at, submission_count';
  const values = config.parentColumn
    ? '$1,$2,$3,TRUE,$4,\'pending\',$4,$5,NOW(),NOW(),1'
    : '$1,$2,$3,TRUE,$4,\'pending\',$4,$5,NOW(),NOW(),1';
  const params = config.parentColumn
    ? [parentId, value, normalizedName, submittedBy || null, submittedClientId || null]
    : [category, value, normalizedName, submittedBy || null, submittedClientId || null];
  const conflict = config.parentColumn
    ? `(${config.parentColumn}, normalized_name)`
    : '(asset_category, normalized_name)';
  const { rows } = await db.query(
    `INSERT INTO ${config.table} (${columns})
     VALUES (${values})
     ON CONFLICT ${conflict} DO NOTHING
     RETURNING id, name, review_status, is_active`,
    params
  );
  if (rows[0]) return rows[0];

  existing = await findSuggestionNode(db, config, parentId, normalizedName, category, true);
  if (!existing) {
    throw catalogError('CATALOG_SUGGESTION_FAILED', `No se pudo registrar la propuesta de ${config.label}.`);
  }
  return existing;
}

export async function ensureEquipmentCatalogPath({
  equipmentName,
  brand,
  model,
  assetCategory = 'biomedical',
  createdBy = null,
  submittedBy = null,
  submittedClientId = null
} = {}) {
  const equipmentValue = cleanCatalogValue(equipmentName, 'El nombre del equipo');
  const category = normalizeAssetCategory(assetCategory);
  const brandValue = canonicalizeCatalogValue(brand);
  const modelValue = canonicalizeCatalogValue(model);
  if (modelValue && !brandValue) {
    throw catalogError('CATALOG_INVALID_PATH', 'Selecciona o escribe una marca antes del modelo.');
  }

  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const submitterId = submittedBy || createdBy || null;
    const equipment = await ensureSuggestionNode(db, {
      type: 'equipment',
      name: equipmentValue,
      assetCategory: category,
      submittedBy: submitterId,
      submittedClientId
    });
    let brandNode = null;
    let modelNode = null;

    if (brandValue) {
      brandNode = await ensureSuggestionNode(db, {
        type: 'brand',
        parentId: equipment.id,
        name: brandValue,
        assetCategory: category,
        submittedBy: submitterId,
        submittedClientId
      });
    }
    if (modelValue && brandNode) {
      modelNode = await ensureSuggestionNode(db, {
        type: 'model',
        parentId: brandNode.id,
        name: modelValue,
        assetCategory: category,
        submittedBy: submitterId,
        submittedClientId
      });
    }

    const nodes = [
      { type: 'equipment', label: 'Equipo', value: equipmentValue, node: equipment },
      ...(brandNode ? [{ type: 'brand', label: 'Marca', value: brandValue, node: brandNode }] : []),
      ...(modelNode ? [{ type: 'model', label: 'Modelo', value: modelValue, node: modelNode }] : [])
    ];
    const pendingNodes = nodes
      .filter(({ node }) => node.review_status !== 'approved' || !node.is_active)
      .map(({ type, label, value, node }) => ({ id: node.id, type, label, value }));
    const fullyApproved = pendingNodes.length === 0;

    await db.query('COMMIT');
    return {
      equipmentId: equipment.id,
      assetCategory: category,
      brandId: brandNode?.id || null,
      modelId: modelNode && fullyApproved ? modelNode.id : null,
      equipmentName: equipmentValue,
      brand: brandValue || null,
      model: modelValue || null,
      reviewStatus: fullyApproved ? 'approved' : 'pending',
      pendingNodes
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function getCatalogNode(db, type, id, lock = false) {
  const config = nodeConfig(type);
  const { rows } = await db.query(
    `SELECT * FROM ${config.table} WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`,
    [id]
  );
  if (!rows[0]) {
    throw catalogError('CATALOG_NODE_NOT_FOUND', `${config.label[0].toUpperCase()}${config.label.slice(1)} no encontrado.`);
  }
  return rows[0];
}

async function assertApprovedParent(db, type, parentId) {
  const config = nodeConfig(type);
  if (!config.parentType) return null;
  if (!parentId) {
    throw catalogError('CATALOG_PARENT_REQUIRED', `Selecciona el nivel superior para la ${config.label}.`);
  }
  const parent = await getCatalogNode(db, config.parentType, parentId, true);
  if (parent.review_status !== 'approved' || !parent.is_active) {
    throw catalogError('CATALOG_PARENT_NOT_APPROVED', 'El nivel superior debe estar aprobado y activo.');
  }
  return parent;
}

async function catalogPathForNode(db, type, id) {
  nodeConfig(type);
  const select = type === 'equipment'
    ? `SELECT e.name AS equipment_name,
              e.asset_category,
              e.normalized_name AS equipment_normalized,
              NULL::text AS brand_name,
              NULL::text AS brand_normalized,
              NULL::text AS model_name,
              NULL::text AS model_normalized
       FROM biomedical_equipment_catalog e
       WHERE e.id = $1`
    : type === 'brand'
      ? `SELECT e.name AS equipment_name,
                e.asset_category,
                e.normalized_name AS equipment_normalized,
                b.name AS brand_name,
                b.normalized_name AS brand_normalized,
                NULL::text AS model_name,
                NULL::text AS model_normalized
         FROM biomedical_equipment_brands b
         JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
         WHERE b.id = $1`
      : `SELECT e.name AS equipment_name,
                e.asset_category,
                e.normalized_name AS equipment_normalized,
                b.name AS brand_name,
                b.normalized_name AS brand_normalized,
                m.name AS model_name,
                m.normalized_name AS model_normalized
         FROM biomedical_equipment_models m
         JOIN biomedical_equipment_brands b ON b.id = m.brand_id
         JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
         WHERE m.id = $1`;
  const { rows } = await db.query(select, [id]);
  if (!rows[0]) {
    throw catalogError('CATALOG_NODE_NOT_FOUND', 'No se encontró la ruta del elemento del catálogo.');
  }
  return rows[0];
}

async function rewriteUnlinkedCatalogPath(db, fromPath, toPath) {
  const params = [
    fromPath.asset_category,
    fromPath.equipment_normalized,
    fromPath.brand_normalized,
    fromPath.model_normalized,
    toPath.equipment_name,
    toPath.brand_name,
    toPath.model_name
  ];
  let assets = 0;
  let guides = 0;

  for (const schema of await tenantSchemas(db)) {
    const result = await db.query(
      `UPDATE "${schema}".assets a
       SET name = $5,
           brand = CASE WHEN $6::text IS NULL THEN a.brand ELSE $6 END,
           model = CASE WHEN $7::text IS NULL THEN a.model ELSE $7 END
       WHERE a.equipment_catalog_model_id IS NULL
         AND a.asset_category = $1
         AND public.normalize_biomedical_catalog_text(a.name) = $2
         AND ($3::text IS NULL OR public.normalize_biomedical_catalog_text(a.brand) = $3)
         AND ($4::text IS NULL OR public.normalize_biomedical_catalog_text(a.model) = $4)`,
      params
    );
    assets += result.rowCount || 0;
  }

  if (fromPath.asset_category === 'biomedical' && toPath.asset_category === 'biomedical') {
    const guideResult = await db.query(
      `UPDATE quick_use_guides g
       SET equipment_name = $5,
           brand = CASE WHEN $6::text IS NULL THEN g.brand ELSE $6 END,
           model = CASE WHEN $7::text IS NULL THEN g.model ELSE $7 END
       WHERE g.equipment_catalog_model_id IS NULL
         AND g.equipment_name_normalized = $2
         AND ($3::text IS NULL OR g.brand_normalized = $3)
         AND ($4::text IS NULL OR g.model_normalized = $4)`,
      params
    );
    guides += guideResult.rowCount || 0;
  }
  return { assets, guides };
}

async function approvedModelIdsForNode(db, type, id) {
  const where = type === 'equipment'
    ? 'e.id = $1'
    : type === 'brand'
      ? 'b.id = $1'
      : 'm.id = $1';
  const { rows } = await db.query(
    `SELECT m.id
     FROM biomedical_equipment_models m
     JOIN biomedical_equipment_brands b ON b.id = m.brand_id
     JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
     WHERE ${where}
       AND e.review_status = 'approved' AND e.is_active = TRUE
       AND b.review_status = 'approved' AND b.is_active = TRUE
       AND m.review_status = 'approved' AND m.is_active = TRUE`,
    [id]
  );
  return rows.map((row) => row.id);
}

async function tenantSchemas(db) {
  const { rows } = await db.query(
    `SELECT schema_name
     FROM clients
     WHERE schema_name ~ '^[a-zA-Z0-9_]+$'
       AND to_regclass(format('%I.%I', schema_name, 'assets')) IS NOT NULL`
  );
  return rows.map((row) => row.schema_name);
}

async function syncCatalogModels(db, modelIds, { matchUnlinked = true } = {}) {
  const ids = Array.from(new Set((modelIds || []).filter(Boolean)));
  if (!ids.length) return { assets: 0, guides: 0 };
  let assets = 0;
  let guides = 0;

  for (const schema of await tenantSchemas(db)) {
    const result = await db.query(
      `UPDATE "${schema}".assets a
       SET name = e.name,
           brand = b.name,
           model = m.name,
           equipment_catalog_model_id = m.id
       FROM biomedical_equipment_models m
       JOIN biomedical_equipment_brands b ON b.id = m.brand_id
       JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
       WHERE m.id = ANY($1::uuid[])
         AND e.review_status = 'approved' AND e.is_active = TRUE
         AND b.review_status = 'approved' AND b.is_active = TRUE
         AND m.review_status = 'approved' AND m.is_active = TRUE
         AND (
           a.equipment_catalog_model_id = m.id
           OR (
             $2::boolean = TRUE
             AND a.equipment_catalog_model_id IS NULL
             AND public.normalize_biomedical_catalog_text(a.name) = e.normalized_name
             AND public.normalize_biomedical_catalog_text(a.brand) = b.normalized_name
             AND public.normalize_biomedical_catalog_text(a.model) = m.normalized_name
           )
         )
         AND a.asset_category = e.asset_category`,
      [ids, matchUnlinked]
    );
    assets += result.rowCount || 0;
  }

  const canonicalized = await db.query(
    `UPDATE quick_use_guides g
     SET equipment_name = e.name,
         brand = b.name,
         model = m.name
     FROM biomedical_equipment_models m
     JOIN biomedical_equipment_brands b ON b.id = m.brand_id
     JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
     WHERE m.id = ANY($1::uuid[])
       AND e.asset_category = 'biomedical'
       AND (
         g.equipment_catalog_model_id = m.id
         OR (
           $2::boolean = TRUE
           AND g.equipment_catalog_model_id IS NULL
           AND g.equipment_name_normalized = e.normalized_name
           AND g.brand_normalized = b.normalized_name
           AND g.model_normalized = m.normalized_name
         )
       )`,
    [ids, matchUnlinked]
  );
  guides += canonicalized.rowCount || 0;

  if (matchUnlinked) {
    await db.query(
      `UPDATE quick_use_guides g
       SET equipment_catalog_model_id = m.id
       FROM biomedical_equipment_models m
       JOIN biomedical_equipment_brands b ON b.id = m.brand_id
       JOIN biomedical_equipment_catalog e ON e.id = b.equipment_id
       WHERE m.id = ANY($1::uuid[])
         AND e.asset_category = 'biomedical'
         AND g.equipment_catalog_model_id IS NULL
         AND g.equipment_name_normalized = e.normalized_name
         AND g.brand_normalized = b.normalized_name
         AND g.model_normalized = m.normalized_name
         AND NOT EXISTS (
           SELECT 1
           FROM quick_use_guides existing
           WHERE existing.client_id = g.client_id
             AND existing.equipment_catalog_model_id = m.id
             AND existing.id <> g.id
         )`,
      [ids]
    );
  }
  return { assets, guides };
}

export async function createApprovedCatalogNode({
  type,
  name,
  parentId = null,
  assetCategory = 'biomedical',
  actorUserId
}) {
  const config = nodeConfig(type);
  const value = cleanCatalogValue(name, type === 'equipment' ? 'El nombre del equipo' : type === 'brand' ? 'La marca' : 'El modelo');
  const category = normalizeAssetCategory(assetCategory);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await assertApprovedParent(db, type, parentId);
    const columns = config.parentColumn
      ? `${config.parentColumn}, name, normalized_name, is_active, created_by, review_status, reviewed_by, reviewed_at`
      : 'asset_category, name, normalized_name, is_active, created_by, review_status, reviewed_by, reviewed_at';
    const values = config.parentColumn
      ? '$1,$2,$3,TRUE,$4,\'approved\',$4,NOW()'
      : '$1,$2,$3,TRUE,$4,\'approved\',$4,NOW()';
    const params = config.parentColumn
      ? [parentId, value, normalizeCatalogText(value), actorUserId || null]
      : [category, value, normalizeCatalogText(value), actorUserId || null];
    const { rows } = await db.query(
      `INSERT INTO ${config.table} (${columns}) VALUES (${values}) RETURNING *`,
      params
    );
    if (type === 'model') await syncCatalogModels(db, [rows[0].id]);
    await db.query('COMMIT');
    return rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    if (error?.code === '23505') {
      throw catalogError('CATALOG_DUPLICATE', `Ya existe una ${config.label} con ese nombre en el nivel seleccionado.`);
    }
    throw error;
  } finally {
    db.release();
  }
}

export async function updateCatalogNode({
  type,
  id,
  name,
  parentId,
  isActive,
  actorUserId
}) {
  const config = nodeConfig(type);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const current = await getCatalogNode(db, type, id, true);
    const beforePath = await catalogPathForNode(db, type, id);
    const nextName = name === undefined
      ? current.name
      : cleanCatalogValue(name, type === 'equipment' ? 'El nombre del equipo' : type === 'brand' ? 'La marca' : 'El modelo');
    const nextParentId = config.parentColumn
      ? (parentId === undefined ? current[config.parentColumn] : parentId)
      : null;
    if (config.parentColumn && current.review_status === 'approved') {
      await assertApprovedParent(db, type, nextParentId);
    } else if (config.parentColumn && !nextParentId) {
      throw catalogError('CATALOG_PARENT_REQUIRED', `Selecciona el nivel superior para la ${config.label}.`);
    }
    const active = typeof isActive === 'boolean' ? isActive : current.is_active;
    const parentSet = config.parentColumn ? `${config.parentColumn} = $4,` : '';
    const params = config.parentColumn
      ? [id, nextName, normalizeCatalogText(nextName), nextParentId, active, actorUserId || null]
      : [id, nextName, normalizeCatalogText(nextName), active, actorUserId || null];
    const activePosition = config.parentColumn ? 5 : 4;
    const actorPosition = config.parentColumn ? 6 : 5;
    const { rows } = await db.query(
      `UPDATE ${config.table}
       SET name = $2,
           normalized_name = $3,
           ${parentSet}
           is_active = $${activePosition},
           reviewed_by = $${actorPosition},
           reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params
    );
    const afterPath = await catalogPathForNode(db, type, id);
    const rewritten = await rewriteUnlinkedCatalogPath(db, beforePath, afterPath);
    const modelIds = await approvedModelIdsForNode(db, type, id);
    const linked = await syncCatalogModels(db, modelIds);
    const sync = {
      assets: rewritten.assets + linked.assets,
      guides: rewritten.guides + linked.guides
    };
    await db.query('COMMIT');
    return { node: rows[0], sync };
  } catch (error) {
    await db.query('ROLLBACK');
    if (error?.code === '23505') {
      throw catalogError('CATALOG_DUPLICATE', `Ya existe una ${config.label} con ese nombre en el nivel seleccionado.`);
    }
    throw error;
  } finally {
    db.release();
  }
}

async function approveAncestors(db, type, node, actorUserId, notes) {
  if (type === 'brand') {
    await db.query(
      `UPDATE biomedical_equipment_catalog
       SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $1`,
      [node.equipment_id, actorUserId || null, notes]
    );
  }
  if (type === 'model') {
    const { rows } = await db.query(
      `SELECT b.id AS brand_id, b.equipment_id
       FROM biomedical_equipment_brands b
       WHERE b.id = $1`,
      [node.brand_id]
    );
    const parent = rows[0];
    if (!parent) throw catalogError('CATALOG_PARENT_NOT_FOUND', 'No se encontró la rama superior del modelo.');
    await db.query(
      `UPDATE biomedical_equipment_catalog
       SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $1`,
      [parent.equipment_id, actorUserId || null, notes]
    );
    await db.query(
      `UPDATE biomedical_equipment_brands
       SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $1`,
      [parent.brand_id, actorUserId || null, notes]
    );
  }
}

export async function reviewCatalogNode({ type, id, decision, cascade = false, notes, actorUserId }) {
  const config = nodeConfig(type);
  if (!['approve', 'reject'].includes(decision)) {
    throw catalogError('CATALOG_INVALID_REVIEW', 'Decisión de revisión no permitida.');
  }
  const reviewNotes = cleanReviewNotes(notes);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const node = await getCatalogNode(db, type, id, true);
    if (decision === 'reject' && node.review_status === 'approved') {
      throw catalogError('CATALOG_APPROVED_REJECT_FORBIDDEN', 'Desactiva o fusiona los nodos aprobados en lugar de rechazarlos.');
    }

    if (decision === 'approve') {
      await approveAncestors(db, type, node, actorUserId, reviewNotes);
      await db.query(
        `UPDATE ${config.table}
         SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
         WHERE id = $1`,
        [id, actorUserId || null, reviewNotes]
      );
      if (cascade && type === 'equipment') {
        await db.query(
          `UPDATE biomedical_equipment_brands
           SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
           WHERE equipment_id = $1 AND review_status = 'pending'`,
          [id, actorUserId || null, reviewNotes]
        );
        await db.query(
          `UPDATE biomedical_equipment_models m
           SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
           FROM biomedical_equipment_brands b
           WHERE m.brand_id = b.id AND b.equipment_id = $1 AND m.review_status = 'pending'`,
          [id, actorUserId || null, reviewNotes]
        );
      }
      if (cascade && type === 'brand') {
        await db.query(
          `UPDATE biomedical_equipment_models
           SET review_status = 'approved', is_active = TRUE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
           WHERE brand_id = $1 AND review_status = 'pending'`,
          [id, actorUserId || null, reviewNotes]
        );
      }
      const modelIds = await approvedModelIdsForNode(db, type, id);
      const sync = await syncCatalogModels(db, modelIds);
      await db.query('COMMIT');
      return { decision, sync, modelIds };
    }

    await db.query(
      `UPDATE ${config.table}
       SET review_status = 'rejected', is_active = FALSE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $1`,
      [id, actorUserId || null, reviewNotes]
    );
    if (type === 'equipment') {
      await db.query(
        `UPDATE biomedical_equipment_brands
         SET review_status = 'rejected', is_active = FALSE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
         WHERE equipment_id = $1 AND review_status = 'pending'`,
        [id, actorUserId || null, reviewNotes]
      );
      await db.query(
        `UPDATE biomedical_equipment_models m
         SET review_status = 'rejected', is_active = FALSE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
         FROM biomedical_equipment_brands b
         WHERE m.brand_id = b.id AND b.equipment_id = $1 AND m.review_status = 'pending'`,
        [id, actorUserId || null, reviewNotes]
      );
    }
    if (type === 'brand') {
      await db.query(
        `UPDATE biomedical_equipment_models
         SET review_status = 'rejected', is_active = FALSE, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
         WHERE brand_id = $1 AND review_status = 'pending'`,
        [id, actorUserId || null, reviewNotes]
      );
    }
    await db.query('COMMIT');
    return { decision, sync: { assets: 0, guides: 0 }, modelIds: [] };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

async function mergeModels(db, sourceId, targetId) {
  const target = await getCatalogNode(db, 'model', targetId, true);
  if (target.review_status !== 'approved' || !target.is_active) {
    throw catalogError('CATALOG_MERGE_TARGET_NOT_APPROVED', 'El modelo de destino debe estar aprobado y activo.');
  }
  const sourcePath = await catalogPathForNode(db, 'model', sourceId);
  const targetPath = await catalogPathForNode(db, 'model', targetId);
  if (sourcePath.asset_category !== targetPath.asset_category) {
    throw catalogError('CATALOG_CATEGORY_MISMATCH', 'Solo puedes fusionar elementos de la misma categoría de equipos.');
  }
  await rewriteUnlinkedCatalogPath(db, sourcePath, targetPath);
  for (const schema of await tenantSchemas(db)) {
    await db.query(
      `UPDATE "${schema}".assets SET equipment_catalog_model_id = $2 WHERE equipment_catalog_model_id = $1`,
      [sourceId, targetId]
    );
  }
  await db.query(
    `UPDATE quick_use_guides source
     SET equipment_catalog_model_id = NULL
     WHERE source.equipment_catalog_model_id = $1
       AND EXISTS (
         SELECT 1 FROM quick_use_guides target
         WHERE target.client_id = source.client_id
           AND target.equipment_catalog_model_id = $2
           AND target.id <> source.id
       )`,
    [sourceId, targetId]
  );
  await db.query(
    'UPDATE quick_use_guides SET equipment_catalog_model_id = $2 WHERE equipment_catalog_model_id = $1',
    [sourceId, targetId]
  );
  await db.query('DELETE FROM biomedical_equipment_models WHERE id = $1', [sourceId]);
  return [targetId];
}

async function mergeBrands(db, sourceId, targetId) {
  const target = await getCatalogNode(db, 'brand', targetId, true);
  if (target.review_status !== 'approved' || !target.is_active) {
    throw catalogError('CATALOG_MERGE_TARGET_NOT_APPROVED', 'La marca de destino debe estar aprobada y activa.');
  }
  const sourcePath = await catalogPathForNode(db, 'brand', sourceId);
  const targetPath = await catalogPathForNode(db, 'brand', targetId);
  if (sourcePath.asset_category !== targetPath.asset_category) {
    throw catalogError('CATALOG_CATEGORY_MISMATCH', 'Solo puedes fusionar elementos de la misma categoría de equipos.');
  }
  await rewriteUnlinkedCatalogPath(db, sourcePath, targetPath);
  const { rows: sourceModels } = await db.query(
    'SELECT id, normalized_name FROM biomedical_equipment_models WHERE brand_id = $1 ORDER BY created_at',
    [sourceId]
  );
  const affected = [];
  for (const sourceModel of sourceModels) {
    const { rows } = await db.query(
      'SELECT id FROM biomedical_equipment_models WHERE brand_id = $1 AND normalized_name = $2 LIMIT 1',
      [targetId, sourceModel.normalized_name]
    );
    if (rows[0]) {
      affected.push(...await mergeModels(db, sourceModel.id, rows[0].id));
    } else {
      await db.query('UPDATE biomedical_equipment_models SET brand_id = $2 WHERE id = $1', [sourceModel.id, targetId]);
      affected.push(sourceModel.id);
    }
  }
  await db.query('DELETE FROM biomedical_equipment_brands WHERE id = $1', [sourceId]);
  return affected;
}

async function mergeEquipment(db, sourceId, targetId) {
  const target = await getCatalogNode(db, 'equipment', targetId, true);
  if (target.review_status !== 'approved' || !target.is_active) {
    throw catalogError('CATALOG_MERGE_TARGET_NOT_APPROVED', 'El equipo de destino debe estar aprobado y activo.');
  }
  const sourcePath = await catalogPathForNode(db, 'equipment', sourceId);
  const targetPath = await catalogPathForNode(db, 'equipment', targetId);
  if (sourcePath.asset_category !== targetPath.asset_category) {
    throw catalogError('CATALOG_CATEGORY_MISMATCH', 'Solo puedes fusionar elementos de la misma categoría de equipos.');
  }
  await rewriteUnlinkedCatalogPath(db, sourcePath, targetPath);
  const { rows: sourceBrands } = await db.query(
    'SELECT id, normalized_name FROM biomedical_equipment_brands WHERE equipment_id = $1 ORDER BY created_at',
    [sourceId]
  );
  const affected = [];
  for (const sourceBrand of sourceBrands) {
    const { rows } = await db.query(
      'SELECT id FROM biomedical_equipment_brands WHERE equipment_id = $1 AND normalized_name = $2 LIMIT 1',
      [targetId, sourceBrand.normalized_name]
    );
    if (rows[0]) {
      affected.push(...await mergeBrands(db, sourceBrand.id, rows[0].id));
    } else {
      await db.query('UPDATE biomedical_equipment_brands SET equipment_id = $2 WHERE id = $1', [sourceBrand.id, targetId]);
      const { rows: models } = await db.query(
        'SELECT id FROM biomedical_equipment_models WHERE brand_id = $1',
        [sourceBrand.id]
      );
      affected.push(...models.map((row) => row.id));
    }
  }
  await db.query('DELETE FROM biomedical_equipment_catalog WHERE id = $1', [sourceId]);
  return affected;
}

export async function mergeCatalogNodes({ type, sourceId, targetId }) {
  nodeConfig(type);
  if (!sourceId || !targetId || sourceId === targetId) {
    throw catalogError('CATALOG_INVALID_MERGE', 'Selecciona un nodo de destino diferente.');
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await getCatalogNode(db, type, sourceId, true);
    const modelIds = type === 'equipment'
      ? await mergeEquipment(db, sourceId, targetId)
      : type === 'brand'
        ? await mergeBrands(db, sourceId, targetId)
        : await mergeModels(db, sourceId, targetId);
    const sync = await syncCatalogModels(db, modelIds);
    await db.query('COMMIT');
    return { targetId, modelIds, sync };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
